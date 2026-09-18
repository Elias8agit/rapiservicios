/**
 * MODULO DE INTERPRETACION - Capa de comprension de lenguaje e imagen.
 *
 * Traduce la descripcion en texto libre del mecanico, junto con la fotografia
 * del componente, hacia una lectura que el sistema logre operar.
 *
 * La lectura ocurre en dos niveles, decision del 28 de agosto de 2026:
 *
 *   Nivel 1  La descripcion corresponde a una de las doce categorias del
 *            catalogo del taller. El modulo entrega la categoria y ahi
 *            concluye su intervencion: la decision del diagnostico pertenece
 *            al motor de reglas.
 *
 *   Nivel 2  Ninguna categoria corresponde, pero el vehiculo si presenta una
 *            averia. Un automovil sufre fallas que exceden un catalogo de doce
 *            entradas, y una orden vacia no le sirve al taller. El modulo
 *            entonces describe el sistema afectado y propone tareas de
 *            revision con su tiempo. Esa propuesta viaja marcada como
 *            sugerencia y nunca se confunde con una regla del taller.
 *
 * Sobre el nivel 1 opera ademas la profundidad complementaria, incorporada el
 * 28 de agosto de 2026 a pedido del taller. El motor de reglas resuelve la
 * orden y recien despues, con esa resolucion a la vista, el modulo pregunta al
 * servicio que revision adicional reclama el caso concreto. El orden importa:
 * el modelo no compite con la base de conocimiento del taller, complementa una
 * decision ya tomada.
 *
 * La profundidad guarda proporcion con la evidencia disponible. Una
 * descripcion de tres palabras sin fotografia no admite profundizacion alguna
 * y ni siquiera consume una peticion. Una fotografia de la pieza averiada
 * junto con una descripcion detallada habilita el maximo. El criterio proviene
 * del taller: una revision a fondo evita el reclamo posterior, y una lista que
 * nadie termina no revisa nada.
 *
 * Proveedor: Google Gemini, variante Flash-Lite.
 *
 * El nombre del modelo reside dentro de GEMINI_MODELO, de manera que una
 * retirada del proveedor se resuelve con un cambio de configuracion y no con
 * un cambio de codigo. El proyecto se planteo con Gemini 2.5 Flash, retirado
 * para cuentas nuevas el 19 de agosto de 2026.
 *
 * La eleccion de gemini-flash-lite-latest descansa en la medicion del 19 de
 * agosto de 2026: 688 ms de demora promedio y tres aciertos de tres, frente a
 * los 4358 ms de gemini-3.1-flash-lite, los 7914 ms de gemini-3.5-flash-lite
 * y los 8286 ms de gemini-3.6-flash. Reproducir con npm run prueba:modelos.
 *
 * La medicion del 28 de agosto de 2026 corrigio el presupuesto de tiempo. Con
 * el contrato de dos niveles, tres de cuatro casos excedieron los 8000 ms del
 * limite anterior y cayeron al respaldo local. La abstencion, que devuelve una
 * sola linea, respondio en 3278 ms. La demora la gobierna la cantidad de texto
 * que el modelo produce, no la dificultad del caso. De ahi el presupuesto de
 * 20000 ms y el techo de generacion. Reproducir con npm run prueba:niveles.
 *
 * Cuando la clave de servicio no existe o el servicio no responde, opera el
 * clasificador local de respaldo por coincidencia lexica.
 */

const { CATEGORIAS, REGLAS } = require('../datos/catalogo');
const { normalizar } = require('./motorReglas');

const MODELO = process.env.GEMINI_MODELO || 'gemini-flash-lite-latest';

/**
 * Ultima version concreta hacia la que resolvio el alias del modelo. Se
 * conserva para anotar el cambio una sola vez y no en cada peticion.
 */
let ultimaVersionRegistrada = null;
const CLAVE = process.env.GEMINI_API_KEY || '';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Presupuesto total de tiempo para la capa de interpretacion, en milisegundos.
 *
 * El mecanico atiende al cliente con el vehiculo enfrente, de modo que la
 * generacion de la orden requiere una respuesta pronta. Agotado el
 * presupuesto, la clasificacion queda a cargo del motor local y el trabajo
 * del taller continua. Vale mas una categoria aproximada de inmediato que una
 * categoria exacta un minuto despues.
 */
const PRESUPUESTO_MS = Number(process.env.GEMINI_LIMITE_MS || 20000);

/**
 * Presupuesto para la peticion de profundidad complementaria.
 *
 * Esa peticion ocurre despues de la interpretacion y del motor de reglas, de
 * modo que su presupuesto debe caber dentro de lo que resta del limite de
 * espera de la aplicacion movil. Un valor holgado alli retrasaria una orden
 * que a esas alturas ya se encuentra resuelta.
 *
 * Agotado este plazo, la orden conserva las tareas del taller y prescinde de
 * las complementarias. La profundidad constituye una mejora, nunca un
 * requisito para generar la orden.
 */
const PRESUPUESTO_COMPLEMENTO_MS = Number(process.env.GEMINI_LIMITE_COMPLEMENTO_MS || 12000);

/** Codigos de estado que corresponden a una condicion pasajera del servicio. */
const ESTADOS_PASAJEROS = [429, 500, 502, 503, 504];

/**
 * Confianza minima que se exige para aplicar una categoria del catalogo.
 *
 * Un modelo de lenguaje responde siempre, incluso cuando la correspondencia
 * resulta debil. La confianza que el propio modelo declara distingue una
 * clasificacion sustentada de una respuesta emitida por compromiso.
 *
 * Por debajo del umbral la categoria no se aplica, pero la orden ya no queda
 * vacia: la atiende el nivel dos, con la marca de sugerencia correspondiente.
 */
const UMBRAL_INTERPRETACION = Number(process.env.GEMINI_UMBRAL || 0.60);

/** Cantidad maxima de tareas que se admite de una sugerencia del nivel dos. */
const MAXIMO_TAREAS_SUGERIDAS = 4;

/**
 * Tope de tareas para una revision preventiva, superior al de una averia.
 *
 * Una averia concreta se confirma con pocas revisiones bien dirigidas, y una
 * lista larga solo infla el tiempo estimado. Una revision preventiva es lo
 * contrario: su valor reside en la cobertura, porque el cliente que sale de
 * viaje quiere frenos, aceite, refrigerante, llantas, luces y bateria
 * revisados, no tres de esos seis. Observacion del usuario del 12 de
 * septiembre de 2026.
 */
const MAXIMO_TAREAS_PREVENTIVAS = 6;

/**
 * Tope de tareas por orden, decision del usuario del 28 de agosto de 2026.
 *
 * Diez tareas equivalen a unas dos o tres horas de revision. El numero
 * definitivo corresponde al propietario del taller, quien conoce el ritmo de
 * trabajo de sus mecanicos. Hasta esa consulta rige este valor.
 */
const TOPE_TAREAS_ORDEN = Number(process.env.TOPE_TAREAS_ORDEN || 10);

/**
 * Longitud a partir de la cual una descripcion se considera detallada.
 *
 * Debajo de este umbral el texto nombra un sistema pero no un sintoma, como
 * ocurre con "Falla de transmision". Un texto asi no aporta material para
 * profundizar.
 */
const LONGITUD_DESCRIPCION_DETALLADA = 60;

/** Margenes admisibles para el tiempo de una tarea sugerida, en minutos. */
const TIEMPO_MINIMO = 5;
const TIEMPO_MAXIMO = 240;

/**
 * Techo de generacion, en unidades de texto del proveedor.
 *
 * La demora de un modelo de lenguaje depende sobre todo de la cantidad de
 * texto que produce. El techo acota esa produccion y con ella la espera del
 * mecanico. La medicion del 28 de agosto de 2026 lo dejo a la vista: una
 * abstencion de una linea tardo 3278 ms, mientras que las respuestas con
 * hallazgo y tareas excedieron los 8000 ms del presupuesto anterior.
 */
const TECHO_GENERACION = Number(process.env.GEMINI_TECHO_TEXTO || 700);

/**
 * Supresion del razonamiento previo del modelo.
 *
 * Las variantes recientes dedican tiempo a un razonamiento interno antes de
 * responder. La medicion del 28 de agosto de 2026 descarto esa via para el
 * modelo en uso: gemini-flash-lite-latest rechaza la instruccion con estado
 * 400 y un mensaje generico. La instruccion permanece desactivada de manera
 * predeterminada, de modo que ningun arranque del servidor gasta un viaje
 * perdido contra el proveedor.
 *
 * El valor 1 dentro de GEMINI_SUPRIMIR_RAZONAMIENTO la reactiva, util ante un
 * cambio de modelo. Si el proveedor la rechaza, el modulo la retira por cuenta
 * propia y repite el intento sin ella.
 */
let suprimirRazonamiento = process.env.GEMINI_SUPRIMIR_RAZONAMIENTO === '1';

// --------------------------------------------------------------------------
//  COMUNICACION CON EL SERVICIO
// --------------------------------------------------------------------------

/**
 * Emite una peticion al servicio de interpretacion dentro de un presupuesto.
 *
 * Concentra el manejo del tiempo, del reintento ante congestion pasajera y del
 * rechazo de la supresion del razonamiento, de modo que las funciones de
 * interpretacion se ocupen unicamente de su contenido.
 *
 * @param {Array} partes Contenido de la peticion, texto e imagen.
 * @param {number} presupuestoMs Tiempo total disponible.
 */
async function pedirAlServicio(partes, presupuestoMs) {
  const vencimiento = Date.now() + presupuestoMs;

  async function solicitar() {
    const restante = vencimiento - Date.now();
    if (restante <= 0) {
      const agotado = new Error(`Presupuesto de ${presupuestoMs} ms agotado.`);
      agotado.pasajero = true;
      throw agotado;
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), restante);

    try {
      const generationConfig = {
        temperature: 0.1,
        responseMimeType: 'application/json',
        maxOutputTokens: TECHO_GENERACION,
      };

      const conSupresion = suprimirRazonamiento;
      if (conSupresion) generationConfig.thinkingConfig = { thinkingBudget: 0 };

      // La clave viaja dentro del encabezado y no dentro de la direccion, de
      // manera que no queda registrada en los archivos de bitacora de los
      // servidores intermedios. Este metodo admite cualquier formato de clave
      // que emita el proveedor.
      const respuesta = await fetch(`${URL_BASE}/${MODELO}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': CLAVE,
        },
        signal: controlador.signal,
        body: JSON.stringify({ contents: [{ parts: partes }], generationConfig }),
      });

      if (!respuesta.ok) {
        // El detalle del cuerpo distingue una clave invalida de una cuota
        // agotada o de un modelo inexistente.
        const cuerpoError = await respuesta.text();
        const resumen = cuerpoError.replace(/\s+/g, ' ').slice(0, 240);

        // Rechazo de la instruccion de supresion del razonamiento. El
        // proveedor responde con un mensaje generico, sin nombrar el campo que
        // rechaza, de modo que la condicion no se apoya en el texto del error
        // sino en el hecho de haber enviado esa instruccion. Repetir sin ella
        // carece de riesgo, y la propia repeticion revela si era la causa.
        if (respuesta.status === 400 && conSupresion) {
          suprimirRazonamiento = false;
          console.warn(
            'El proveedor rechazo la supresion del razonamiento previo. La instruccion se retira ' +
              'y el intento se repite sin ella.'
          );
          return solicitar();
        }

        const falla = new Error(`El servicio respondio con estado ${respuesta.status}. ${resumen}`);
        falla.pasajero = ESTADOS_PASAJEROS.includes(respuesta.status);
        throw falla;
      }

      return respuesta.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        const vencido = new Error(`El servicio no respondio dentro de ${presupuestoMs} ms.`);
        vencido.pasajero = true;
        throw vencido;
      }
      throw error;
    } finally {
      clearTimeout(temporizador);
    }
  }

  try {
    return await solicitar();
  } catch (error) {
    // Una congestion pasajera del servicio amerita un segundo intento,
    // siempre que sobre tiempo dentro del presupuesto.
    if (error.pasajero && vencimiento - Date.now() > 1500) return solicitar();
    throw error;
  }
}

/** Extrae el objeto JSON de la respuesta del servicio. */
function leerRespuesta(cuerpo) {
  const texto = cuerpo?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try {
    return JSON.parse(texto);
  } catch (errorFormato) {
    // Un techo de generacion corto interrumpe la respuesta a media frase y el
    // objeto JSON queda incompleto. El mensaje distingue esa condicion de una
    // respuesta con formato equivocado, porque la correccion difiere.
    const motivo = cuerpo?.candidates?.[0]?.finishReason;
    throw new Error(
      motivo === 'MAX_TOKENS'
        ? `La respuesta excedio el techo de ${TECHO_GENERACION} unidades y quedo truncada. Elevar GEMINI_TECHO_TEXTO.`
        : 'El servicio devolvio una respuesta que no constituye un objeto JSON.'
    );
  }
}

// --------------------------------------------------------------------------
//  DEPURACION DE TAREAS
// --------------------------------------------------------------------------

/**
 * Depura la lista de tareas que propone el servicio.
 * @param {Array} crudas Tareas tal como llegan del servicio.
 * @param {number} maximo Cantidad maxima admitida.
 * @param {string[]} yaCubiertas Nombres de tareas que la orden ya contiene.
 */
function depurarTareas(crudas, maximo, yaCubiertas = []) {
  if (!Array.isArray(crudas)) return [];

  const conocidas = new Set(yaCubiertas.map((n) => normalizar(n)));
  const limpias = [];

  for (const t of crudas) {
    const nombre = String(t?.nombre || '').trim().slice(0, 160);
    const minutos = Math.round(Number(t?.minutos));
    if (!nombre || !Number.isFinite(minutos)) continue;

    // El servicio recibe la instruccion de no repetir, pero la comprobacion
    // corresponde al servidor: una tarea duplicada dentro de la orden le hace
    // perder tiempo al mecanico y desvirtua el tiempo estimado.
    const clave = normalizar(nombre);
    if (conocidas.has(clave)) continue;
    conocidas.add(clave);

    limpias.push({ nombre, minutos: Math.min(Math.max(minutos, TIEMPO_MINIMO), TIEMPO_MAXIMO) });
    if (limpias.length >= maximo) break;
  }

  return limpias;
}

/**
 * Determina cuanta profundidad admite la evidencia disponible.
 *
 * Escala acordada con el usuario el 28 de agosto de 2026. El criterio proviene
 * del oficio: un jefe de taller profundiza donde tiene con que profundizar.
 *
 * @returns {number} Cantidad maxima de tareas complementarias.
 */
function medirEvidencia(descripcion, hayFotografia) {
  const detallada = String(descripcion || '').trim().length >= LONGITUD_DESCRIPCION_DETALLADA;
  if (hayFotografia && detallada) return 6;
  if (hayFotografia) return 4;
  if (detallada) return 2;
  return 0;
}

// --------------------------------------------------------------------------
//  NIVEL 1 Y NIVEL 2: INTERPRETACION
// --------------------------------------------------------------------------

/** Construye la instruccion que delimita la respuesta del servicio externo. */
function construirInstruccion(conFotografia) {
  const listado = CATEGORIAS.map((c) => `${c.idCategoria}. ${c.nombre} (${c.sistema})`).join('\n');

  return [
    'Actuas como tecnico de diagnostico automotriz dentro de un taller mecanico.',
    'Recibes la descripcion de un mecanico y, en ocasiones, la fotografia de un componente.',
    '',
    'REGLA PRINCIPAL: LA ORDEN NO PUEDE QUEDAR SIN LECTURA.',
    '',
    'El mecanico escribe de prisa, con el cliente enfrente y el vehiculo en el',
    'patio. Abrevia, escribe mal, a veces deja una sola palabra que no significa',
    'nada. Esa pobreza del texto no constituye motivo para abstenerse: constituye',
    'justamente el motivo por el cual se te consulta. Lo que al texto le falta lo',
    'aporta la fotografia.',
    '',
    'PASO 1. Establece de que evidencia dispones.',
    conFotografia
      ? 'ACOMPANA FOTOGRAFIA, Y LA FOTOGRAFIA MANDA. Observala antes que al texto: ' +
        'identifica el componente, su estado, las fugas, las roturas, el desgaste, ' +
        'las piezas faltantes, los testigos encendidos dentro de un tablero. ' +
        'Cuando el texto resulte vago, equivocado o carente de sentido, sigue lo ' +
        'que la imagen muestra y dejalo dicho dentro de justificacion, por ejemplo: ' +
        '"la descripcion no aporta, el diagnostico proviene de la fotografia". ' +
        'Una caja de cambios fuera del vehiculo o una pieza con aceite es evidencia ' +
        'suficiente para nombrar el sistema y proponer la revision.'
      : 'NO ACOMPANA FOTOGRAFIA. Trabaja unicamente el texto y extrae de el todo lo ' +
        'que permita, aun de una palabra suelta, abreviada o mal escrita. ' +
        '"trasmision", "caja", "no jala" o "chilla" bastan para nombrar el sistema.',
    '',
    'PASO 2. Ubica la averia dentro de este catalogo del taller:',
    listado,
    '',
    'Devuelve idCategoria con el numero correspondiente unicamente cuando la',
    'averia pertenezca de lleno a esa categoria. Ante duda, devuelve idCategoria',
    'en nulo: forzar una categoria equivocada resulta peor que omitirla, porque',
    'el taller ejecutaria la revision de otro sistema.',
    '',
    'PASO 3. Cuando ninguna categoria corresponda, describe la averia por cuenta',
    'propia dentro de sistemaAfectado y hallazgo, y propone las tareas de revision',
    'que un tecnico ejecutaria para confirmarla. Ejemplos de averias fuera del',
    'catalogo: los testigos del tablero, la seguridad pasiva como el airbag, la',
    'carroceria, el sistema antibloqueo o el equipo de audio.',
    'Cada tarea lleva un nombre concreto y accionable, con verbo y pieza nombrada,',
    'y su tiempo en minutos.',
    `Propone entre dos y ${MAXIMO_TAREAS_SUGERIDAS} tareas, ordenadas de la mas`,
    'reveladora a la menos reveladora.',
    '',
    'PASO 4. Distingue la averia de la revision preventiva.',
    'No todo ingreso corresponde a una falla. Un cliente que deja el vehiculo',
    'antes de un viaje, o que pide el servicio de mantenimiento, no reporta',
    'sintoma alguno y aun asi constituye trabajo del taller. Ese caso lleva',
    'tipoLectura en PREVENTIVA y hayFalla en verdadero, porque hay trabajo que',
    'hacer.',
    '',
    'Una revision preventiva vale por su cobertura, no por su profundidad. Cubre',
    'los sistemas de los que depende un viaje seguro, cada uno como una tarea',
    'propia y concreta: frenos, niveles y estado del aceite, refrigerante y',
    'sistema de enfriamiento, llantas incluida la de repuesto, luces, bateria y',
    'carga, fugas visibles, bandas y mangueras. Elige las que correspondan al',
    'caso y nombralas una por una.',
    `En este caso propone hasta ${MAXIMO_TAREAS_PREVENTIVAS} tareas.`,
    'Una sola tarea llamada "revision general" no sirve: el mecanico necesita la',
    'lista de lo que debe tocar, no el titulo de la lista.',
    '',
    'Todo ingreso que si reporte un sintoma lleva tipoLectura en FALLA.',
    '',
    'CUANDO CORRESPONDE RESPONDER hayFalla EN FALSO.',
    'Unicamente cuando no exista fotografia Y ademas el texto trate de un asunto',
    'ajeno al vehiculo: un cobro, una cita, un recado, un dato del cliente.',
    'Un texto corto, abreviado, mal escrito o confuso NO entra en este caso: ahi',
    'corresponde interpretar con lo que haya.',
    conFotografia
      ? 'Y como en esta consulta SI acompana fotografia, hayFalla es verdadero ' +
        'siempre: que el mecanico haya fotografiado un componente ya prueba que ' +
        'algo de ese vehiculo esta bajo revision. Aunque el texto no signifique ' +
        'nada, la respuesta debe nombrar el sistema que la imagen muestra.'
      : null,
    '',
    'El campo nivelConfianza refleja la certeza real de tu lectura. Una lectura',
    'apoyada solo en la fotografia puede ser de confianza alta; una apoyada en un',
    'texto ambiguo, baja. Informalo con honestidad, no lo infles.',
    'Redacta hallazgo y justificacion en una sola linea cada uno. El mecanico',
    'atiende al cliente con el vehiculo enfrente y una respuesta breve le sirve',
    'mas que una extensa.',
    '',
    'Responde unicamente con un objeto JSON con esta forma exacta:',
    '{',
    '  "hayFalla": <true o false>,',
    '  "tipoLectura": "<FALLA o PREVENTIVA>",',
    '  "idCategoria": <numero del catalogo o null>,',
    '  "nivelConfianza": <decimal entre 0 y 1>,',
    '  "sistemaAfectado": "<sistema del vehiculo, o null>",',
    '  "hallazgo": "<descripcion breve de la averia, o null>",',
    '  "justificacion": "<motivo de tu lectura, una o dos lineas>",',
    '  "tareasSugeridas": [{"nombre": "<tarea>", "minutos": <entero>}]',
    '}',
    'Deja tareasSugeridas como arreglo vacio cuando entregues una categoria del',
    'catalogo, porque en ese caso las tareas las decide el taller.',
    'No agregues explicaciones fuera del objeto JSON.',
  ]
    // El renglon nulo corresponde a la advertencia que solo aplica cuando hay
    // fotografia. Los renglones vacios se conservan: separan los pasos y una
    // instruccion apelmazada se sigue peor.
    .filter((linea) => linea !== null)
    .join('\n');
}

/**
 * Falla de la capa de interpretacion.
 *
 * Se emite cuando el modulo no logra producir una lectura utilizable y por lo
 * tanto la orden quedaria sin diagnostico y sin tareas. Decision del usuario
 * del 12 de septiembre de 2026: una orden en blanco no constituye un resultado
 * aceptable, de modo que la orden no se registra y el mecanico reintenta.
 *
 * Textual: "la cosa es que no quede en blanco eso".
 *
 * CONSECUENCIA QUE CONVIENE TENER PRESENTE. Con el servicio de interpretacion
 * caido, el taller no puede registrar ordenes. El reintento de pedirAlServicio
 * vuelve esa condicion poco frecuente, pero no imposible.
 */
class FallaInterpretacion extends Error {
  constructor(mensaje, detalle = null) {
    super(mensaje);
    this.name = 'FallaInterpretacion';
    this.interpretacionFallida = true;
    this.detalle = detalle;
  }
}

/** Estructura vacia que devuelve el modulo cuando no hay falla que atender. */
function sinFalla(origen, justificacion) {
  return {
    idCategoria: null,
    nivelConfianza: 0,
    origen,
    justificacion,
    hayFalla: false,
    sistemaSugerido: null,
    hallazgo: null,
    tareasSugeridas: [],
  };
}

/** Clasificador local de respaldo, sin dependencia de servicios externos. */
function clasificarLocal(descripcion) {
  const texto = normalizar(descripcion);
  const puntajes = new Map();

  REGLAS.forEach((regla) => {
    const aciertos = regla.condicion.palabras.filter((p) => texto.includes(normalizar(p))).length;
    if (aciertos === 0) return;
    const acumulado = puntajes.get(regla.idCategoria) || 0;
    puntajes.set(regla.idCategoria, acumulado + aciertos * regla.nivelConfianza);
  });

  if (puntajes.size === 0) {
    return sinFalla('LOCAL', 'Sin coincidencia lexica dentro del catalogo del taller.');
  }

  const [idCategoria, puntaje] = [...puntajes.entries()].sort((a, b) => b[1] - a[1])[0];
  const total = [...puntajes.values()].reduce((s, v) => s + v, 0);

  return {
    idCategoria,
    nivelConfianza: Number(Math.min(puntaje / total, 0.95).toFixed(3)),
    origen: 'LOCAL',
    justificacion: 'Clasificacion por coincidencia lexica del catalogo del taller.',
    hayFalla: true,
    sistemaSugerido: null,
    hallazgo: null,
    tareasSugeridas: [],
  };
}

/**
 * Interpreta una descripcion y una fotografia opcional.
 *
 * @param {string} descripcion Texto libre del mecanico.
 * @param {{datos:string, tipoMime:string}|null} fotografia Imagen en base64.
 * @returns {Promise<{
 *   idCategoria:number|null, nivelConfianza:number, origen:string,
 *   justificacion:string, hayFalla:boolean, sistemaSugerido:string|null,
 *   hallazgo:string|null, tareasSugeridas:Array<{nombre:string,minutos:number}>
 * }>}
 */
async function clasificar(descripcion, fotografia = null) {
  if (!CLAVE) return clasificarLocal(descripcion);

  const conFotografia = Boolean(fotografia && fotografia.datos);
  const partes = [
    { text: `${construirInstruccion(conFotografia)}\n\nDescripcion del mecanico: ${descripcion}` },
  ];
  if (conFotografia) {
    partes.push({ inline_data: { mime_type: fotografia.tipoMime || 'image/jpeg', data: fotografia.datos } });
  }

  try {
    const cuerpo = await pedirAlServicio(partes, PRESUPUESTO_MS);
    const resultado = leerRespuesta(cuerpo);

    // Version exacta que atendio la peticion.
    //
    // El sistema consulta al modelo por su alias, gemini-flash-lite-latest, de
    // manera que el proveedor no lo retire de golpe y el taller quede sin
    // diagnostico. El alias tiene una contrapartida: se mueve sin aviso, y ese
    // movimiento ya provoco un rechazo del servicio el 28 de agosto de 2026.
    //
    // El proveedor informa dentro de cada respuesta la version concreta que
    // atendio. Registrarla deja constancia de con que version se obtuvo cada
    // resultado, que es lo que permite reproducir una medicion y responder con
    // que modelo se hizo la prueba. Para fijar una version, basta con declarar
    // GEMINI_MODELO dentro del entorno.
    const versionModelo = cuerpo?.modelVersion || MODELO;
    if (versionModelo !== ultimaVersionRegistrada) {
      ultimaVersionRegistrada = versionModelo;
      console.log(`Capa de interpretacion: el alias ${MODELO} resuelve hacia ${versionModelo}.`);
    }

    const origen = conFotografia ? 'MIXTO' : 'TEXTO';
    const confianza = Number(resultado.nivelConfianza || 0);
    const justificacion = String(resultado.justificacion || '').trim();
    const sistemaSugerido = resultado.sistemaAfectado ? String(resultado.sistemaAfectado).slice(0, 80) : null;
    const hallazgo = resultado.hallazgo ? String(resultado.hallazgo) : null;

    // El servicio declara que no hay falla dentro del contenido.
    //
    // Sin fotografia esa lectura se respeta: un texto administrativo o ajeno al
    // vehiculo existe y merece quedar registrado como tal.
    //
    // Con fotografia la lectura no se acepta tal cual. La instruccion le indica
    // al servicio que una fotografia de un componente ya constituye evidencia,
    // de modo que una negativa significa que desatendio la imagen. Antes de
    // descartar la respuesta se rescata lo que si haya aportado: si nombro el
    // sistema o describio un hallazgo, la orden se sostiene con eso.
    if (resultado.hayFalla === false) {
      if (!conFotografia) {
        return sinFalla(origen, justificacion || 'El contenido no describe una falla concreta.');
      }
      if (!sistemaSugerido && !hallazgo) {
        throw new FallaInterpretacion(
          'El servicio de interpretacion no logro leer la fotografia adjunta.',
          justificacion || 'Respondio que no hay falla pese a recibir una imagen del componente.'
        );
      }
    }

    const enCatalogo =
      resultado.idCategoria !== null &&
      resultado.idCategoria !== undefined &&
      CATEGORIAS.some((c) => c.idCategoria === resultado.idCategoria);

    // NIVEL 1. La categoria pertenece al catalogo y la confianza la sostiene.
    // A partir de aqui decide el motor de reglas del taller.
    if (enCatalogo && confianza >= UMBRAL_INTERPRETACION) {
      return {
        idCategoria: resultado.idCategoria,
        nivelConfianza: confianza,
        origen,
        justificacion,
        hayFalla: true,
        sistemaSugerido,
        hallazgo,
        tareasSugeridas: [],
      };
    }

    // NIVEL 2. Existe falla, pero el catalogo del taller no la cubre, o bien
    // la cubre con una confianza que no alcanza el umbral. La interpretacion
    // abierta sostiene la orden y viaja marcada como sugerencia.
    // El tope depende de la naturaleza del ingreso. Una averia se confirma con
    // pocas revisiones dirigidas; una revision preventiva vale por su cobertura.
    const preventiva = String(resultado.tipoLectura || '').toUpperCase() === 'PREVENTIVA';
    const tope = preventiva ? MAXIMO_TAREAS_PREVENTIVAS : MAXIMO_TAREAS_SUGERIDAS;

    let tareasSugeridas = depurarTareas(resultado.tareasSugeridas, tope);

    // El servicio nombro el sistema afectado pero no propuso con que revisarlo.
    // En lugar de descartar la lectura completa, la orden arranca con una
    // revision anclada a ese sistema. No es un diagnostico fino, pero le dice
    // al mecanico por donde empezar, que es infinitamente mas que una orden en
    // blanco.
    if (tareasSugeridas.length === 0 && sistemaSugerido) {
      tareasSugeridas = [{ nombre: `Revision de ${sistemaSugerido}`.slice(0, 160), minutos: 30 }];
    }

    if (tareasSugeridas.length > 0) {
      // El motivo distingue las tres procedencias, porque el mecanico lo lee en
      // la pantalla y "queda fuera del catalogo" resulta desconcertante frente
      // a un ingreso que nunca reporto una averia.
      let motivo;
      if (preventiva) {
        motivo = 'Ingreso sin averia reportada: corresponde a una revision preventiva.';
      } else if (enCatalogo) {
        motivo =
          `Confianza de ${(confianza * 100).toFixed(0)} % por debajo del umbral de ` +
          `${(UMBRAL_INTERPRETACION * 100).toFixed(0)} %, de modo que la categoria del catalogo no se aplica.`;
      } else {
        motivo = 'La averia queda fuera de las doce categorias del catalogo del taller.';
      }

      return {
        idCategoria: null,
        nivelConfianza: confianza,
        origen: 'GENERATIVO',
        tipoLectura: preventiva ? 'PREVENTIVA' : 'FALLA',
        justificacion: `${motivo} ${justificacion}`.trim(),
        hayFalla: true,
        sistemaSugerido,
        hallazgo,
        tareasSugeridas,
      };
    }

    // Existe falla declarada pero el servicio no aporto ni categoria valida ni
    // La respuesta declara falla pero no aporta categoria valida, ni sistema,
    // ni tareas: resulta inservible. Queda el respaldo lexico, que solo lee
    // texto y por lo tanto solo sirve cuando el catalogo cubre lo escrito.
    const respaldo = clasificarLocal(descripcion);
    if (respaldo.hayFalla) {
      return {
        ...respaldo,
        justificacion:
          'Respaldo lexico del catalogo del taller. El servicio declaro falla sin entregar ' +
          `categoria, sistema ni tareas. ${justificacion}`.trim(),
      };
    }

    throw new FallaInterpretacion(
      'El servicio de interpretacion respondio sin contenido aprovechable.',
      justificacion || 'Declaro falla pero no entrego categoria, sistema ni tareas.'
    );
  } catch (error) {
    // Una falla ya calificada viaja tal cual hacia la ruta.
    if (error.interpretacionFallida) throw error;

    // El servicio no respondio.
    //
    // Con fotografia no hay nada que hacer del lado del taller: el respaldo
    // lexico solo lee texto y la evidencia esta dentro de la imagen. Justamente
    // el caso de la orden RSKFQB65, que traia la fotografia de la caja y quedo
    // en blanco porque el servicio vencio su plazo y nadie miro la foto.
    //
    // Sin fotografia el respaldo lexico todavia puede resolver, siempre que lo
    // escrito caiga dentro del catalogo. Si tampoco resuelve, la orden quedaria
    // vacia y por lo tanto no se registra.
    if (conFotografia) {
      throw new FallaInterpretacion(
        'El servicio de interpretacion no respondio y la fotografia quedo sin leer.',
        error.message
      );
    }

    const respaldo = clasificarLocal(descripcion);
    if (respaldo.hayFalla) {
      return {
        ...respaldo,
        justificacion: `Respaldo lexico del catalogo del taller. Detalle: ${error.message}`,
      };
    }

    throw new FallaInterpretacion(
      'El servicio de interpretacion no respondio y la descripcion no coincide con el catalogo del taller.',
      error.message
    );
  }
}

// --------------------------------------------------------------------------
//  PROFUNDIDAD COMPLEMENTARIA SOBRE EL NIVEL 1
// --------------------------------------------------------------------------

/** Instruccion de la peticion de profundidad complementaria. */
function construirInstruccionComplemento({ categoria, sistema, tareasDelTaller, maximo, conFotografia }) {
  const yaAsignadas = tareasDelTaller.map((t, i) => `${i + 1}. ${t}`).join('\n');

  return [
    'Actuas como jefe de taller mecanico que revisa una orden de trabajo ya',
    'generada. El taller clasifico la averia y su base de conocimiento asigno',
    'las tareas de revision obligatorias. Tu labor no consiste en repetirlas ni',
    'en discutirlas, sino en detectar que le falta a ESTE caso concreto.',
    '',
    `Categoria determinada por el taller: ${categoria} (${sistema}).`,
    '',
    'Tareas que la orden ya incluye:',
    yaAsignadas,
    '',
    conFotografia
      ? 'La fotografia muestra el componente reportado. Observala con detenimiento: ' +
        'el estado de la pieza, el desgaste, las fugas, las roturas y las piezas ' +
        'contiguas que una averia asi suele arrastrar. Propone la revision que ' +
        'ese estado concreto reclama.'
      : 'No acompana fotografia. Apoyate unicamente en el detalle del texto.',
    '',
    'PROPOSITO. El taller busca evitar el reclamo posterior del cliente. Una',
    'revision que pasa por alto la pieza contigua devuelve el vehiculo con la',
    'falla a medias. Propone lo que un jefe de taller con experiencia mandaria',
    'a revisar antes de entregar.',
    '',
    `LIMITE. Como maximo ${maximo} tareas adicionales. Ninguna debe repetir ni`,
    'reformular las que la orden ya incluye.',
    '',
    'ARREGLO VACIO. Cuando la evidencia no sustente ninguna revision adicional,',
    'devuelve el arreglo vacio. Una tarea generica agregada por compromiso le',
    'hace perder tiempo al mecanico e infla el tiempo estimado de la orden. La',
    'respuesta vacia constituye una respuesta correcta y esperada.',
    '',
    'Cada tarea lleva un nombre concreto y accionable, con verbo de accion y',
    'pieza o sistema nombrado, y su tiempo en minutos. Ordenalas de la mas',
    'reveladora a la menos reveladora.',
    '',
    'Responde unicamente con un objeto JSON con esta forma exacta:',
    '{',
    '  "tareas": [{"nombre": "<tarea>", "minutos": <entero>}],',
    '  "motivo": "<en una linea, que observaste para proponerlas, o por que no propones ninguna>"',
    '}',
    'No agregues explicaciones fuera del objeto JSON.',
  ].join('\n');
}

/**
 * Propone la revision adicional que reclama un caso ya resuelto por el motor
 * de reglas. Corresponde al nivel 1 con profundidad complementaria.
 *
 * La funcion nunca interrumpe la generacion de la orden: ante cualquier falla
 * devuelve una propuesta vacia y la orden conserva las tareas del taller.
 *
 * @param {object} entrada
 * @param {string} entrada.descripcion Texto libre del mecanico.
 * @param {object|null} entrada.fotografia Imagen en base64.
 * @param {string} entrada.categoria Nombre de la categoria que fijo el taller.
 * @param {string} entrada.sistema Sistema vehicular de esa categoria.
 * @param {string[]} entrada.tareasDelTaller Nombres de las tareas ya asignadas.
 * @returns {Promise<{tareas:Array<{nombre:string,minutos:number}>, motivo:string, evidencia:number}>}
 */
async function complementar({ descripcion, fotografia, categoria, sistema, tareasDelTaller = [] }) {
  const conFotografia = Boolean(fotografia && fotografia.datos);
  const evidencia = medirEvidencia(descripcion, conFotografia);

  const vacio = (motivo) => ({ tareas: [], motivo, evidencia });

  // Sin evidencia no hay nada que profundizar, y la orden no gasta una
  // peticion contra el servicio.
  if (evidencia === 0) {
    return vacio('La descripcion no aporta detalle ni fotografia que sustente una revision mas amplia.');
  }
  if (!CLAVE) return vacio('La capa de interpretacion opera sin clave de servicio.');

  // El tope de la orden manda sobre la escala de evidencia.
  const espacioDisponible = TOPE_TAREAS_ORDEN - tareasDelTaller.length;
  if (espacioDisponible <= 0) {
    return vacio(`La orden alcanzo el tope de ${TOPE_TAREAS_ORDEN} tareas con las del taller.`);
  }
  const maximo = Math.min(evidencia, espacioDisponible);

  const instruccion = construirInstruccionComplemento({
    categoria,
    sistema,
    tareasDelTaller,
    maximo,
    conFotografia,
  });

  const partes = [{ text: `${instruccion}\n\nDescripcion del mecanico: ${descripcion}` }];
  if (conFotografia) {
    partes.push({ inline_data: { mime_type: fotografia.tipoMime || 'image/jpeg', data: fotografia.datos } });
  }

  try {
    const resultado = leerRespuesta(await pedirAlServicio(partes, PRESUPUESTO_COMPLEMENTO_MS));
    const tareas = depurarTareas(resultado.tareas, maximo, tareasDelTaller);
    return {
      tareas,
      motivo: String(resultado.motivo || '').trim(),
      evidencia,
    };
  } catch (error) {
    // La profundidad constituye una mejora, nunca un requisito. La orden se
    // genera igual con las tareas del taller.
    return vacio(`La revision complementaria no se obtuvo. Detalle: ${error.message}`);
  }
}

module.exports = {
  clasificar,
  clasificarLocal,
  complementar,
  medirEvidencia,
  FallaInterpretacion,
  MODELO,
  UMBRAL_INTERPRETACION,
  TOPE_TAREAS_ORDEN,
};
