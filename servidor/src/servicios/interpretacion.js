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
 * La distincion importa para la arquitectura del sistema: la base de
 * conocimiento del taller conserva la ultima palabra dentro de su dominio, y
 * el servicio de interpretacion cubre unicamente el terreno que esa base
 * todavia no alcanza.
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
 * Cuando la clave de servicio no existe o el servicio no responde, opera el
 * clasificador local de respaldo por coincidencia lexica.
 */

const { CATEGORIAS, REGLAS } = require('../datos/catalogo');
const { normalizar } = require('./motorReglas');

const MODELO = process.env.GEMINI_MODELO || 'gemini-flash-lite-latest';
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
const PRESUPUESTO_MS = Number(process.env.GEMINI_LIMITE_MS || 8000);

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
const MAXIMO_TAREAS_SUGERIDAS = 6;

/** Margenes admisibles para el tiempo de una tarea sugerida, en minutos. */
const TIEMPO_MINIMO = 5;
const TIEMPO_MAXIMO = 240;

/** Construye la instruccion que delimita la respuesta del servicio externo. */
function construirInstruccion(conFotografia) {
  const listado = CATEGORIAS.map((c) => `${c.idCategoria}. ${c.nombre} (${c.sistema})`).join('\n');

  return [
    'Actuas como tecnico de diagnostico automotriz dentro de un taller mecanico.',
    'Recibes la descripcion de un mecanico y, en ocasiones, la fotografia de un componente.',
    '',
    'PASO 1. Determina si el contenido describe una falla del vehiculo.',
    'Una solicitud de revision general, un comentario administrativo o un texto',
    'sin sintomas no constituyen una falla. En ese caso responde hayFalla en falso.',
    '',
    'PASO 2. Cuando exista falla, intenta ubicarla dentro de este catalogo del taller:',
    listado,
    '',
    'Devuelve idCategoria con el numero correspondiente unicamente cuando la',
    'falla pertenezca de lleno a esa categoria. Ante duda, devuelve idCategoria',
    'en nulo: forzar una categoria equivocada resulta peor que omitirla.',
    '',
    'PASO 3. Cuando exista falla y ninguna categoria corresponda, describe la',
    'averia por cuenta propia y propone las tareas de revision que un tecnico',
    'ejecutaria para confirmarla. Ejemplos de averias fuera del catalogo: los',
    'testigos del tablero, la seguridad pasiva como el airbag, la carroceria,',
    'el sistema antibloqueo o el equipo de audio.',
    'Cada tarea lleva un nombre concreto y accionable y su tiempo en minutos.',
    `Propone entre dos y ${MAXIMO_TAREAS_SUGERIDAS} tareas, ordenadas de la mas`,
    'reveladora a la menos reveladora.',
    '',
    conFotografia
      ? 'La fotografia acompana al texto. Cuando el texto resulte breve o vago, la ' +
        'fotografia manda: describe lo que observas en ella, como los testigos ' +
        'encendidos dentro de un tablero, una fuga, una pieza rota o un desgaste. ' +
        'La brevedad del texto no justifica una respuesta sin contenido.'
      : 'No acompana fotografia. Trabaja unicamente con el texto.',
    '',
    'El campo nivelConfianza refleja la certeza real de tu lectura.',
    '',
    'Responde unicamente con un objeto JSON con esta forma exacta:',
    '{',
    '  "hayFalla": <true o false>,',
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
  ].join('\n');
}

/** Depura la lista de tareas que propone el servicio. */
function depurarTareas(crudas) {
  if (!Array.isArray(crudas)) return [];

  return crudas
    .map((t) => {
      const nombre = String(t?.nombre || '').trim().slice(0, 160);
      const minutos = Math.round(Number(t?.minutos));
      if (!nombre || !Number.isFinite(minutos)) return null;
      return { nombre, minutos: Math.min(Math.max(minutos, TIEMPO_MINIMO), TIEMPO_MAXIMO) };
    })
    .filter(Boolean)
    .slice(0, MAXIMO_TAREAS_SUGERIDAS);
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

  const vencimiento = Date.now() + PRESUPUESTO_MS;

  /** Emite una peticion al servicio dentro del tiempo que reste. */
  async function solicitar() {
    const restante = vencimiento - Date.now();
    if (restante <= 0) {
      const agotado = new Error(`Presupuesto de ${PRESUPUESTO_MS} ms agotado.`);
      agotado.pasajero = true;
      throw agotado;
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), restante);

    try {
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
        body: JSON.stringify({
          contents: [{ parts: partes }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      });

      if (!respuesta.ok) {
        // El detalle del cuerpo distingue una clave invalida de una cuota
        // agotada o de un modelo inexistente.
        const cuerpoError = await respuesta.text();
        const resumen = cuerpoError.replace(/\s+/g, ' ').slice(0, 240);
        const falla = new Error(`El servicio respondio con estado ${respuesta.status}. ${resumen}`);
        falla.pasajero = ESTADOS_PASAJEROS.includes(respuesta.status);
        throw falla;
      }

      return respuesta.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        const vencido = new Error(`El servicio no respondio dentro de ${PRESUPUESTO_MS} ms.`);
        vencido.pasajero = true;
        throw vencido;
      }
      throw error;
    } finally {
      clearTimeout(temporizador);
    }
  }

  try {
    let cuerpo;
    try {
      cuerpo = await solicitar();
    } catch (error) {
      // Una congestion pasajera del servicio amerita un segundo intento,
      // siempre que sobre tiempo dentro del presupuesto.
      if (error.pasajero && vencimiento - Date.now() > 1500) {
        cuerpo = await solicitar();
      } else {
        throw error;
      }
    }

    const texto = cuerpo?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const resultado = JSON.parse(texto);

    const origen = conFotografia ? 'MIXTO' : 'TEXTO';
    const confianza = Number(resultado.nivelConfianza || 0);
    const justificacion = String(resultado.justificacion || '').trim();
    const sistemaSugerido = resultado.sistemaAfectado ? String(resultado.sistemaAfectado).slice(0, 80) : null;
    const hallazgo = resultado.hallazgo ? String(resultado.hallazgo) : null;
    const tareasSugeridas = depurarTareas(resultado.tareasSugeridas);

    // El servicio no encontro una falla dentro del contenido. Corresponde
    // respetar esa lectura y dejar constancia del motivo, en lugar de
    // consultar al clasificador local, que dispone de menos informacion.
    if (resultado.hayFalla === false) {
      return sinFalla(origen, justificacion || 'El contenido no describe una falla concreta.');
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
    if (tareasSugeridas.length > 0) {
      const motivo = enCatalogo
        ? `Confianza de ${(confianza * 100).toFixed(0)} % por debajo del umbral de ` +
          `${(UMBRAL_INTERPRETACION * 100).toFixed(0)} %, de modo que la categoria del catalogo no se aplica.`
        : 'La averia queda fuera de las doce categorias del catalogo del taller.';

      return {
        idCategoria: null,
        nivelConfianza: confianza,
        origen: 'GENERATIVO',
        justificacion: `${motivo} ${justificacion}`.trim(),
        hayFalla: true,
        sistemaSugerido,
        hallazgo,
        tareasSugeridas,
      };
    }

    // Existe falla declarada pero el servicio no aporto ni categoria valida ni
    // tareas. La respuesta resulta inservible, de modo que opera el respaldo.
    return {
      ...clasificarLocal(descripcion),
      justificacion:
        'Respaldo local. El servicio declaro falla sin entregar categoria valida ni tareas. ' +
        justificacion,
    };
  } catch (error) {
    // La indisponibilidad del servicio externo no interrumpe la operacion
    // del taller: el clasificador local mantiene el flujo de trabajo.
    return { ...clasificarLocal(descripcion), justificacion: `Respaldo local. Detalle: ${error.message}` };
  }
}

module.exports = { clasificar, clasificarLocal, MODELO, UMBRAL_INTERPRETACION };
