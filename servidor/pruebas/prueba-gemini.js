/**
 * PRUEBA COMPARATIVA DE LA CAPA DE INTERPRETACION.
 *
 * Somete un conjunto de descripciones redactadas en lenguaje natural a las dos
 * vias de clasificacion del sistema y contrasta el resultado:
 *
 *   Clasificador local   Coincidencia lexica contra las palabras clave de la
 *                        base de conocimiento. Opera sin conexion.
 *   Google Gemini        Modelo de lenguaje que interpreta el sentido de la
 *                        frase y la ubica dentro del mismo catalogo.
 *
 * El proposito de la comparacion consiste en documentar el aporte de la capa
 * de interpretacion frente al respaldo local, evidencia que corresponde al
 * Capitulo VI del documento.
 *
 * Ejecucion:  npm run prueba:gemini
 */

require('dotenv').config();

// La prueba mide al proveedor sin la restriccion de tiempo que aplica durante
// la operacion normal. En produccion el presupuesto permanece corto a
// proposito, porque el mecanico no espera; aqui interesa conocer la demora
// real del servicio.
process.env.GEMINI_LIMITE_MS = process.env.GEMINI_LIMITE_MS_PRUEBA || '60000';

const { clasificar, clasificarLocal, MODELO } = require('../src/servicios/interpretacion');
const { CATEGORIAS } = require('../src/datos/catalogo');

const LINEA = '='.repeat(78);

/**
 * Casos redactados como los escribiria un mecanico, sin emplear de forma
 * deliberada las palabras clave que registra la base de conocimiento.
 */
const CASOS = [
  {
    descripcion:
      'Vehiculo sufrio sobrecalentamiento de motor y fue recorrido aproximadamente ' +
      '2 kilometros con el motor sobrecalentado',
    esperadas: [8, 4],
    nota: 'Caso reportado durante la prueba en el telefono el 19 de agosto',
  },
  {
    descripcion: 'Al frenar se escucha un ruido metalico y el pedal se siente esponjoso',
    esperadas: [1],
    nota: 'Contiene palabras clave registradas, ambas vias deben acertar',
  },
  {
    descripcion: 'El carro ya no rinde en las subidas y se siente pesado al acelerar',
    esperadas: [4],
    nota: 'Perdida de potencia expresada sin las palabras previstas',
  },
  {
    descripcion: 'Ayer se me quedo tirado y tuve que pedir que me lo empujaran para arrancarlo',
    esperadas: [5, 6],
    nota: 'Arranque deficiente descrito de forma coloquial',
  },
  {
    descripcion: 'El timon vibra bastante cuando paso de los ochenta kilometros por hora',
    esperadas: [11, 3],
    nota: 'Vibracion de rodamiento o direccion. AMBIGUEDAD CONOCIDA del catalogo: las categorias Suspension, Direccion y Neumaticos comparten sintomas',
  },
  {
    descripcion: 'Sale un olor raro adentro del carro cuando prendo la ventilacion',
    esperadas: [12],
    nota: 'Confort, descrito sin mencionar aire acondicionado',
  },
  {
    descripcion: 'Quiero que le den una revisada general porque voy a salir de viaje',
    esperadas: [],
    nota: 'Sin falla concreta, corresponde derivar a revision manual. Verifica la abstencion del servicio',
  },
];

/** Devuelve el nombre de una categoria a partir del identificador. */
function nombreCategoria(id) {
  if (!id) return 'sin correspondencia';
  const categoria = CATEGORIAS.find((c) => c.idCategoria === id);
  return categoria ? `${categoria.nombre} (${id})` : `desconocida (${id})`;
}

/** Verifica si el resultado corresponde a alguna de las categorias esperadas. */
function acierta(idObtenido, esperadas) {
  if (esperadas.length === 0) return idObtenido === null;
  return esperadas.includes(idObtenido);
}

async function principal() {
  console.log(LINEA);
  console.log('  PRUEBA COMPARATIVA DE LA CAPA DE INTERPRETACION');
  console.log('  Clasificador local frente a Google Gemini');
  console.log(LINEA);
  console.log();

  const hayClave = Boolean(process.env.GEMINI_API_KEY);

  console.log(`  Modelo configurado : ${MODELO}`);
  console.log(`  Clave de servicio  : ${hayClave ? 'presente' : 'AUSENTE'}`);
  console.log(`  Casos de prueba    : ${CASOS.length}`);
  console.log();

  if (!hayClave) {
    console.log('  Sin la clave de Google AI Studio la prueba carece de sentido, porque');
    console.log('  ambas columnas mostrarian el mismo resultado del respaldo local.');
    console.log('  Completar GEMINI_API_KEY dentro de servidor/.env y repetir.');
    process.exit(1);
  }

  let aciertosLocal = 0;
  let aciertosGemini = 0;
  let fallosServicio = 0;
  let tiempoTotal = 0;

  for (let i = 0; i < CASOS.length; i += 1) {
    const caso = CASOS[i];

    console.log(`CASO ${i + 1}`);
    console.log(`  Descripcion : "${caso.descripcion}"`);
    console.log(`  Nota        : ${caso.nota}`);
    console.log(`  Esperado    : ${caso.esperadas.length ? caso.esperadas.map(nombreCategoria).join(' o ') : 'sin correspondencia'}`);
    console.log();

    // Via uno: clasificador local.
    const local = clasificarLocal(caso.descripcion);
    const localAcierta = acierta(local.idCategoria, caso.esperadas);
    if (localAcierta) aciertosLocal += 1;

    console.log(`  LOCAL   ${localAcierta ? 'CORRECTO' : 'FALLA   '}  ${nombreCategoria(local.idCategoria)}`);
    console.log(`                    confianza ${(local.nivelConfianza * 100).toFixed(1)} %`);

    // Via dos: servicio de interpretacion.
    const inicio = Date.now();
    const remoto = await clasificar(caso.descripcion, null);
    const demora = Date.now() - inicio;
    tiempoTotal += demora;

    // El respaldo se activa cuando el servicio externo no responde.
    const respondioElServicio = remoto.origen !== 'LOCAL';
    if (!respondioElServicio) fallosServicio += 1;

    const remotoAcierta = acierta(remoto.idCategoria, caso.esperadas);
    if (remotoAcierta) aciertosGemini += 1;

    console.log(`  GEMINI  ${remotoAcierta ? 'CORRECTO' : 'FALLA   '}  ${nombreCategoria(remoto.idCategoria)}`);
    console.log(`                    confianza ${(Number(remoto.nivelConfianza) * 100).toFixed(1)} %  ·  ${demora} ms  ·  origen ${remoto.origen}`);
    if (remoto.justificacion) {
      console.log(`                    ${remoto.justificacion}`);
    }
    if (!respondioElServicio) {
      console.log('                    ATENCION: respondio el respaldo local, el servicio externo fallo');
    }

    console.log('-'.repeat(78));
  }

  // Resumen -----------------------------------------------------------------
  const total = CASOS.length;
  console.log();
  console.log(LINEA);
  console.log('  RESUMEN COMPARATIVO');
  console.log();
  console.log(`  Clasificador local : ${aciertosLocal} de ${total} casos  (${((aciertosLocal / total) * 100).toFixed(1)} %)`);
  console.log(`  Google Gemini      : ${aciertosGemini} de ${total} casos  (${((aciertosGemini / total) * 100).toFixed(1)} %)`);
  console.log();
  console.log(`  Demora promedio del servicio externo : ${Math.round(tiempoTotal / total)} ms`);
  console.log(`  Peticiones atendidas por el respaldo : ${fallosServicio} de ${total}`);
  console.log(LINEA);

  process.exit(fallosServicio === total ? 1 : 0);
}

principal().catch((error) => {
  console.error();
  console.error('  La prueba se interrumpio por una falla inesperada:');
  console.error(`  ${error.message}`);
  process.exit(1);
});
