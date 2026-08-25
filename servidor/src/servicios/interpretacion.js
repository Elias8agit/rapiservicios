/**
 * MODULO DE INTERPRETACION - Capa de comprension de lenguaje e imagen.
 *
 * Traduce la descripcion en texto libre del mecanico, junto con la fotografia
 * del componente, hacia una de las categorias de falla que define el catalogo
 * del taller. El modulo unicamente clasifica: la decision del diagnostico
 * corresponde al motor de reglas.
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
 * Confianza minima que se exige a la clasificacion del servicio externo.
 *
 * Un modelo de lenguaje responde siempre, incluso cuando el texto carece de
 * una falla concreta. La confianza que el propio modelo declara distingue una
 * clasificacion sustentada de una respuesta emitida por compromiso. Por debajo
 * del umbral, la orden se deriva a revision manual del mecanico.
 */
const UMBRAL_INTERPRETACION = Number(process.env.GEMINI_UMBRAL || 0.60);

/** Construye la instruccion que delimita la respuesta del servicio externo. */
function construirInstruccion() {
  const listado = CATEGORIAS.map((c) => `${c.idCategoria}. ${c.nombre} (${c.sistema})`).join('\n');
  return [
    'Actua como clasificador de fallas automotrices para un taller mecanico.',
    'Recibes la descripcion de un mecanico y, en ocasiones, la fotografia de un componente.',
    'Clasifica el contenido dentro de UNA de las siguientes categorias:',
    listado,
    '',
    'Cuando el texto no describa una falla concreta, o cuando ninguna categoria',
    'corresponda, responde con idCategoria en nulo. Una solicitud de revision',
    'general, un comentario administrativo o un texto sin sintomas no pertenecen',
    'a ninguna categoria. Abstenerse resulta preferible a forzar una eleccion.',
    '',
    'El campo nivelConfianza debe reflejar la certeza real de la clasificacion.',
    '',
    'Responde unicamente con un objeto JSON con esta forma exacta:',
    '{"idCategoria": <numero o null>, "nivelConfianza": <decimal entre 0 y 1>, "justificacion": "<texto breve>"}',
    'No agregues explicaciones fuera del objeto JSON.',
  ].join('\n');
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
    return { idCategoria: null, nivelConfianza: 0, origen: 'LOCAL', justificacion: 'Sin coincidencia lexica.' };
  }

  const [idCategoria, puntaje] = [...puntajes.entries()].sort((a, b) => b[1] - a[1])[0];
  const total = [...puntajes.values()].reduce((s, v) => s + v, 0);

  return {
    idCategoria,
    nivelConfianza: Number(Math.min(puntaje / total, 0.95).toFixed(3)),
    origen: 'LOCAL',
    justificacion: 'Clasificacion por coincidencia lexica del catalogo del taller.',
  };
}

/**
 * Clasifica una descripcion y una fotografia opcional.
 * @param {string} descripcion Texto libre del mecanico.
 * @param {{datos:string, tipoMime:string}|null} fotografia Imagen en base64.
 * @returns {Promise<{idCategoria:number|null, nivelConfianza:number, origen:string, justificacion:string}>}
 */
async function clasificar(descripcion, fotografia = null) {
  if (!CLAVE) return clasificarLocal(descripcion);

  const partes = [{ text: `${construirInstruccion()}\n\nDescripcion del mecanico: ${descripcion}` }];
  if (fotografia && fotografia.datos) {
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
    const origen = fotografia ? 'MIXTO' : 'TEXTO';
    const confianza = Number(resultado.nivelConfianza || 0);

    // El servicio se abstuvo de forma deliberada. Corresponde respetar esa
    // abstencion y derivar a revision manual, en lugar de consultar al
    // clasificador local, que dispone de menos informacion.
    if (resultado.idCategoria === null || resultado.idCategoria === undefined) {
      return {
        idCategoria: null,
        nivelConfianza: 0,
        origen,
        justificacion: resultado.justificacion || 'El servicio no encontro una falla concreta.',
      };
    }

    // Una categoria fuera del catalogo indica una respuesta defectuosa, no una
    // abstencion. En ese caso opera el clasificador local.
    const valida = CATEGORIAS.some((c) => c.idCategoria === resultado.idCategoria);
    if (!valida) return clasificarLocal(descripcion);

    // Confianza insuficiente: el propio servicio manifiesta duda.
    if (confianza < UMBRAL_INTERPRETACION) {
      return {
        idCategoria: null,
        nivelConfianza: confianza,
        origen,
        justificacion:
          `Confianza de ${(confianza * 100).toFixed(0)} % por debajo del umbral de ` +
          `${(UMBRAL_INTERPRETACION * 100).toFixed(0)} %. ${resultado.justificacion || ''}`.trim(),
      };
    }

    return {
      idCategoria: resultado.idCategoria,
      nivelConfianza: confianza,
      origen,
      justificacion: resultado.justificacion || '',
    };
  } catch (error) {
    // La indisponibilidad del servicio externo no interrumpe la operacion
    // del taller: el clasificador local mantiene el flujo de trabajo.
    return { ...clasificarLocal(descripcion), justificacion: `Respaldo local. Detalle: ${error.message}` };
  }
}

module.exports = { clasificar, clasificarLocal, MODELO, UMBRAL_INTERPRETACION };
