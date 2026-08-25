/**
 * INVENTARIO Y MEDICION DE MODELOS DISPONIBLES.
 *
 * Consulta al proveedor cuales modelos admite la clave de servicio del
 * proyecto y mide el tiempo de respuesta de los candidatos frente a una
 * peticion de clasificacion equivalente a la que emite el sistema.
 *
 * El proposito consiste en sustentar con medicion propia la eleccion del
 * modelo, en lugar de adoptar el primero que aparezca en la documentacion.
 * La demora importa: el mecanico opera con el vehiculo enfrente y el telefono
 * en la mano.
 *
 * Ejecucion:
 *   npm run prueba:modelos
 *   npm run prueba:modelos -- gemini-flash-lite-latest gemini-3.1-flash-lite
 *
 * Sin argumentos mide una seleccion automatica de variantes ligeras. Con
 * argumentos mide unicamente los modelos indicados, lo cual permite contrastar
 * candidatos concretos sin gastar cuota en el resto del catalogo.
 */

require('dotenv').config();

const { CATEGORIAS } = require('../src/datos/catalogo');

const CLAVE = process.env.GEMINI_API_KEY || '';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const LINEA = '='.repeat(78);

/** Descripcion de prueba, escrita sin las palabras clave del catalogo. */
const DESCRIPCION =
  'Vehiculo sufrio sobrecalentamiento de motor y fue recorrido aproximadamente ' +
  '2 kilometros con el motor sobrecalentado';

/** Cantidad de mediciones por modelo, para descartar una demora aislada. */
const MEDICIONES = 3;

function instruccion() {
  const listado = CATEGORIAS.map((c) => `${c.idCategoria}. ${c.nombre} (${c.sistema})`).join('\n');
  return [
    'Actua como clasificador de fallas automotrices para un taller mecanico.',
    'Clasifica la descripcion dentro de UNA de las siguientes categorias:',
    listado,
    '',
    'Responde unicamente con un objeto JSON con esta forma exacta:',
    '{"idCategoria": <numero>, "nivelConfianza": <decimal entre 0 y 1>, "justificacion": "<texto breve>"}',
  ].join('\n');
}

/** Recupera el catalogo de modelos que admite la clave de servicio. */
async function listarModelos() {
  const respuesta = await fetch(`${URL_BASE}/models?pageSize=200`, {
    headers: { 'x-goog-api-key': CLAVE },
  });

  if (!respuesta.ok) {
    const detalle = (await respuesta.text()).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`Estado ${respuesta.status}. ${detalle}`);
  }

  const cuerpo = await respuesta.json();
  return (cuerpo.models || []).filter((m) =>
    (m.supportedGenerationMethods || []).includes('generateContent')
  );
}

/** Ejecuta una clasificacion contra un modelo y devuelve la medicion. */
async function medir(nombreModelo) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 70000);
  const inicio = Date.now();

  try {
    const respuesta = await fetch(`${URL_BASE}/${nombreModelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CLAVE },
      signal: controlador.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${instruccion()}\n\nDescripcion del mecanico: ${DESCRIPCION}` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });

    const demora = Date.now() - inicio;

    if (!respuesta.ok) {
      const detalle = (await respuesta.text()).replace(/\s+/g, ' ');
      const codigo = detalle.match(/"status":\s*"([A-Z_]+)"/);
      return { ok: false, demora, motivo: `${respuesta.status} ${codigo ? codigo[1] : ''}`.trim() };
    }

    const cuerpo = await respuesta.json();
    const texto = cuerpo?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let resultado = {};
    try {
      resultado = JSON.parse(texto);
    } catch (error) {
      return { ok: false, demora, motivo: 'respuesta sin formato JSON' };
    }

    const categoria = CATEGORIAS.find((c) => c.idCategoria === resultado.idCategoria);
    return {
      ok: true,
      demora,
      idCategoria: resultado.idCategoria,
      categoria: categoria ? categoria.nombre : 'fuera del catalogo',
      confianza: Number(resultado.nivelConfianza || 0),
    };
  } catch (error) {
    return {
      ok: false,
      demora: Date.now() - inicio,
      motivo: error.name === 'AbortError' ? 'sin respuesta en 70 segundos' : error.message,
    };
  } finally {
    clearTimeout(temporizador);
  }
}

async function principal() {
  console.log(LINEA);
  console.log('  INVENTARIO Y MEDICION DE MODELOS DE INTERPRETACION');
  console.log(LINEA);
  console.log();

  if (!CLAVE) {
    console.log('  Completar GEMINI_API_KEY dentro de servidor/.env antes de ejecutar.');
    process.exit(1);
  }

  // 1. Inventario -----------------------------------------------------------
  console.log('1. MODELOS QUE ADMITE LA CLAVE DE SERVICIO');
  let modelos;
  try {
    modelos = await listarModelos();
  } catch (error) {
    console.log(`  No se logro recuperar el catalogo de modelos.\n  ${error.message}`);
    process.exit(1);
  }

  console.log(`  Total con generacion de contenido: ${modelos.length}`);
  console.log();
  modelos.forEach((m) => {
    const nombre = m.name.replace('models/', '');
    console.log(`  ${nombre.padEnd(42)} ${m.displayName || ''}`);
  });
  console.log();

  // 2. Candidatos -----------------------------------------------------------
  // Se miden las variantes ligeras, que son las que corresponden a una tarea
  // de clasificacion breve. Un modelo de razonamiento extenso resulta
  // innecesario para elegir entre doce categorias.
  const solicitados = process.argv.slice(2).filter((a) => !a.startsWith('-'));

  const disponibles = modelos.map((m) => m.name.replace('models/', ''));

  let candidatos;
  if (solicitados.length) {
    const ausentes = solicitados.filter((s) => !disponibles.includes(s));
    if (ausentes.length) {
      console.log(`  ATENCION: la clave no ofrece ${ausentes.join(', ')}`);
      console.log();
    }
    candidatos = solicitados.filter((s) => disponibles.includes(s)).map((s) => `models/${s}`);
  } else {
    candidatos = modelos
      .map((m) => m.name)
      .filter((n) => /flash|lite/i.test(n))
      .filter((n) => !/thinking|image|audio|live|tts|embedding|robotics|computer|banana/i.test(n))
      .slice(0, 6);
  }

  if (candidatos.length === 0) {
    console.log('  Sin candidatos ligeros dentro del catalogo. Revisar la lista de arriba.');
    process.exit(1);
  }

  console.log('2. MEDICION DE DEMORA Y ACIERTO');
  console.log(`  Descripcion de prueba: "${DESCRIPCION}"`);
  console.log('  Respuesta correcta esperada: Enfriamiento o Motor');
  console.log(`  Mediciones por modelo: ${MEDICIONES}`);
  console.log();

  const resumen = [];

  for (const nombre of candidatos) {
    const corto = nombre.replace('models/', '');
    console.log(`  ${corto}`);

    const demoras = [];
    let aciertos = 0;
    let ultimaCategoria = '';
    let ultimoMotivo = '';

    for (let i = 0; i < MEDICIONES; i += 1) {
      const medicion = await medir(nombre);
      if (medicion.ok) {
        demoras.push(medicion.demora);
        ultimaCategoria = `${medicion.categoria} (${(medicion.confianza * 100).toFixed(0)} %)`;
        if ([4, 8].includes(medicion.idCategoria)) aciertos += 1;
        console.log(`    intento ${i + 1}: ${String(medicion.demora).padStart(6)} ms  ${ultimaCategoria}`);
      } else {
        ultimoMotivo = medicion.motivo;
        console.log(`    intento ${i + 1}: ${String(medicion.demora).padStart(6)} ms  FALLA  ${medicion.motivo}`);
      }
    }

    const promedio = demoras.length
      ? Math.round(demoras.reduce((s, d) => s + d, 0) / demoras.length)
      : null;

    resumen.push({
      modelo: corto,
      exitos: demoras.length,
      promedio,
      aciertos,
      categoria: ultimaCategoria,
      motivo: ultimoMotivo,
    });

    console.log();
  }

  // 3. Cuadro comparativo ---------------------------------------------------
  console.log(LINEA);
  console.log('  CUADRO COMPARATIVO');
  console.log();
  console.log('  MODELO                                RESPUESTAS  PROMEDIO   ACIERTOS');
  console.log('  ' + '-'.repeat(74));

  resumen
    .sort((a, b) => (a.promedio ?? Infinity) - (b.promedio ?? Infinity))
    .forEach((r) => {
      const promedio = r.promedio === null ? 'sin dato' : `${r.promedio} ms`;
      console.log(
        `  ${r.modelo.padEnd(38)}${String(`${r.exitos}/${MEDICIONES}`).padEnd(12)}${promedio.padEnd(11)}${r.aciertos}/${MEDICIONES}`
      );
      if (r.motivo) console.log(`    ultimo motivo de falla: ${r.motivo}`);
    });

  console.log();
  const mejor = resumen.filter((r) => r.exitos > 0 && r.aciertos > 0).sort((a, b) => a.promedio - b.promedio)[0];
  if (mejor) {
    console.log(`  Candidato con mejor demora entre los que aciertan: ${mejor.modelo} (${mejor.promedio} ms)`);
    console.log(`  Para adoptarlo: GEMINI_MODELO=${mejor.modelo} dentro de servidor/.env`);
  } else {
    console.log('  Ningun candidato respondio de forma correcta. Revisar el detalle de arriba.');
  }
  console.log(LINEA);
}

principal().catch((error) => {
  console.error();
  console.error('  La prueba se interrumpio por una falla inesperada:');
  console.error(`  ${error.message}`);
  process.exit(1);
});
