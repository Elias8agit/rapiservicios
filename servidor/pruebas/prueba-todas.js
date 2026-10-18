/**
 * EJECUCION CONJUNTA DE LAS SUITES DE VERIFICACION.
 *
 * Corre las suites que admiten conteo y presenta un resumen unico, apto como
 * evidencia de verificacion para el informe: una sola pantalla acredita el
 * estado de las comprobaciones automatizadas.
 *
 * QUE CORRE Y QUE NO, Y POR QUE
 *
 *   Incluidas por omision: nucleo de diagnostico, conexion del catalogo,
 *   niveles de interpretacion, comparativo de clasificacion, limite de
 *   intentos, tipo de caja, y edicion y anulacion de ordenes.
 *
 *   `prueba:flujo` queda FUERA por omision. Escribe registros reales en la
 *   base: crea clientes, vehiculos y ordenes. Correrla solo para obtener una
 *   captura ensucia los mismos datos que despues se presentan como evidencia.
 *   Para incluirla:  npm run prueba:todas -- --con-flujo correo contrasena
 *
 *   `prueba:modelos` queda FUERA siempre. No arroja un conteo de aciertos,
 *   sino un inventario de los modelos que admite la clave con la demora de
 *   cada uno, de modo que no encaja en una fila de "X de Y". Ademas consume
 *   cuota del servicio externo.
 *
 * REQUISITOS
 *   - Archivo .env con la clave del servicio de interpretacion.
 *   - Supabase despierto, para la suite de conexion.
 *   - Solo con --con-flujo: el servidor en ejecucion (npm run iniciar) y las
 *     credenciales de una cuenta del sistema.
 *
 * Ejecutar con: npm run prueba:todas
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const args = process.argv.slice(2);
const conFlujo = args.includes('--con-flujo');
const credenciales = args.filter((a) => !a.startsWith('--'));

const SUITES = [
  {
    clave: 'prueba', archivo: 'prueba-diagnostico.js',
    nombre: 'Nucleo de diagnostico', necesita: 'clave del servicio',
  },
  {
    clave: 'prueba:conexion', archivo: 'prueba-conexion.js',
    nombre: 'Conexion del catalogo', necesita: 'base de datos',
  },
  {
    clave: 'prueba:niveles', archivo: 'prueba-niveles.js',
    nombre: 'Niveles de interpretacion', necesita: 'clave del servicio',
  },
  {
    clave: 'prueba:gemini', archivo: 'prueba-gemini.js',
    nombre: 'Comparativo de clasificacion', necesita: 'clave del servicio',
    comparativo: true,
  },
  {
    clave: 'prueba:limite', archivo: 'prueba-limite.js',
    nombre: 'Limite de intentos', necesita: 'nada, corre sin red',
  },
  {
    clave: 'prueba:transmision', archivo: 'prueba-transmision.js',
    nombre: 'Tipo de caja', necesita: 'nada, corre sin red',
  },
  {
    clave: 'prueba:anulacion', archivo: 'prueba-anulacion.js',
    nombre: 'Edicion, anulacion, fotos y roles', necesita: 'nada, corre sin red',
  },
];

if (conFlujo) {
  SUITES.splice(2, 0, {
    clave: 'prueba:flujo', archivo: 'prueba-flujo.js',
    nombre: 'Recorrido completo', necesita: 'servidor activo, escribe datos',
    argumentos: credenciales,
  });
}

const LINEA = '='.repeat(78);

/** Ultimo conteo con forma "N de M" que la suite haya impreso. */
function conteo(salida) {
  const marcas = [...String(salida).matchAll(/(\d+)\s+de\s+(\d+)/g)];
  if (!marcas.length) return null;
  const u = marcas[marcas.length - 1];
  return { aciertos: Number(u[1]), total: Number(u[2]) };
}

/**
 * El comparativo imprime dos conteos y despues una linea de respaldo, de modo
 * que el extractor generico tomaria la linea equivocada. Se leen por rotulo.
 */
function conteoComparativo(salida) {
  const local = /Clasificador local\s*:\s*(\d+)\s+de\s+(\d+)/.exec(salida);
  const modelo = /Google Gemini\s*:\s*(\d+)\s+de\s+(\d+)/.exec(salida);
  if (!local || !modelo) return null;
  return {
    local: { aciertos: Number(local[1]), total: Number(local[2]) },
    modelo: { aciertos: Number(modelo[1]), total: Number(modelo[2]) },
  };
}

function ejecutar(suite) {
  const inicio = Date.now();
  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, suite.archivo), ...(suite.argumentos || [])],
    { encoding: 'utf8', timeout: 240000, env: process.env },
  );
  const salida = `${r.stdout || ''}\n${r.stderr || ''}`;
  return {
    ...suite,
    salida,
    codigo: r.status,
    conteo: suite.comparativo ? null : conteo(salida),
    comparacion: suite.comparativo ? conteoComparativo(salida) : null,
    segundos: ((Date.now() - inicio) / 1000).toFixed(1),
  };
}

function porcentaje(c) {
  return ((c.aciertos / c.total) * 100).toFixed(1);
}

function principal() {
  console.log(LINEA);
  console.log('  VERIFICACION DEL SERVIDOR  ·  Sistema Rapiservicios');
  console.log(`  ${new Date().toLocaleString('es-GT')}`);
  console.log(LINEA);
  if (!conFlujo) {
    console.log('  El recorrido completo queda fuera: escribe registros reales en la base.');
    console.log('  El inventario de modelos queda fuera: no arroja conteo de aciertos.');
  }
  console.log('');

  const resultados = [];
  for (const suite of SUITES) {
    process.stdout.write(`  Ejecutando ${suite.nombre.padEnd(30)} `);
    const r = ejecutar(suite);
    resultados.push(r);
    let marca = '-';
    if (r.comparacion) marca = `${r.comparacion.modelo.aciertos} de ${r.comparacion.modelo.total}`;
    else if (r.conteo) marca = `${r.conteo.aciertos} de ${r.conteo.total}`;
    console.log(`${marca.padStart(12)}   ${r.segundos.padStart(6)} s`);
  }

  const conFallas = resultados.filter((r) => r.codigo !== 0);
  if (conFallas.length) {
    console.log('');
    console.log('  Detalle de las suites con fallas:');
    for (const f of conFallas) {
      console.log(`\n  --- ${f.nombre} (${f.clave}) ---`);
      console.log(f.salida.split('\n').filter((l) => l.trim()).slice(-8).join('\n'));
    }
  }

  console.log('');
  console.log(LINEA);
  console.log('  RESUMEN DE LA VERIFICACION');
  console.log(LINEA);
  console.log(`  ${'Suite'.padEnd(30)}${'Resultado'.padStart(12)}   ${'Estado'.padEnd(15)}Necesita`);
  console.log(`  ${'-'.repeat(74)}`);

  let satisfactorias = 0;
  let evaluadas = 0;

  for (const r of resultados) {
    let marca;
    let estado;
    if (r.comparativo) {
      marca = r.comparacion ? `${r.comparacion.modelo.aciertos} de ${r.comparacion.modelo.total}` : '-';
      estado = 'COMPARATIVO';
    } else {
      marca = r.conteo ? `${r.conteo.aciertos} de ${r.conteo.total}` : '-';
      evaluadas += 1;
      const bien = r.codigo === 0 && r.conteo && r.conteo.aciertos === r.conteo.total;
      if (bien) satisfactorias += 1;
      estado = bien ? 'SATISFACTORIA' : 'CON FALLAS';
    }
    console.log(`  ${r.nombre.padEnd(30)}${marca.padStart(12)}   ${estado.padEnd(15)}${r.necesita}`);
  }

  console.log(`  ${'-'.repeat(74)}`);

  const comp = resultados.find((r) => r.comparativo);
  if (comp && comp.comparacion) {
    const { local, modelo } = comp.comparacion;
    console.log('  Comparativo de clasificacion sobre el mismo conjunto de descripciones:');
    console.log(`     Interpretacion del lenguaje natural : ${modelo.aciertos} de ${modelo.total}  (${porcentaje(modelo)} %)`);
    console.log(`     Clasificador lexico tradicional     : ${local.aciertos} de ${local.total}  (${porcentaje(local)} %)`);
  }

  console.log(`  TOTAL: ${satisfactorias} de ${evaluadas} suites satisfactorias`);
  console.log(LINEA);

  process.exit(conFallas.length ? 1 : 0);
}

principal();
