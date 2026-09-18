/**
 * PRUEBA DEL TIPO DE CAJA DENTRO DEL MOTOR DE REGLAS.
 *
 * ORIGEN. La orden RS7MNWKJ, del 18 de septiembre de 2026, declaraba
 * "reparacion de la caja automatica" y el sistema le asigno "Revision de
 * embrague", treinta y cinco minutos de un trabajo que una caja automatica no
 * admite. La categoria Transmision cubria los dos tipos de caja con un solo
 * paquete de tareas.
 *
 * La prueba no toca la red ni la base de datos.
 *
 * Ejecutar con: npm run prueba:transmision
 */

const { evaluar, tipoDeCaja } = require('../src/servicios/motorReglas');

const CATEGORIA_TRANSMISION = 7;
const EMBRAGUE = 'Revision de embrague';

let aciertos = 0;
let total = 0;

function comprobar(afirmacion, condicion, detalle = '') {
  total += 1;
  if (condicion) {
    aciertos += 1;
    console.log(`  CORRECTO  ${afirmacion}`);
  } else {
    console.log(`  FALLA     ${afirmacion}${detalle ? `  ${detalle}` : ''}`);
  }
}

function diagnosticar(descripcion, tipoTransmision) {
  return evaluar({
    idCategoria: CATEGORIA_TRANSMISION,
    descripcion,
    nivelConfianza: 0.95,
    kilometraje: 90000,
    tipoTransmision,
  });
}

function nombres(resultado) {
  return (resultado.tareas || []).map((t) => t.nombre);
}

console.log('\n  Prueba del tipo de caja dentro del motor de reglas\n');

// --------------------------------------------------------------------------
console.log('  Caso 1: caja automatica declarada en la ficha del vehiculo.');
const automatica = diagnosticar('Sensacion de golpe al realizar cambios de marcha', 'AUTOMATICA');

comprobar('El motor resuelve la orden', automatica.aplicada === true);
comprobar(
  'NO manda revisar el embrague',
  !nombres(automatica).includes(EMBRAGUE),
  `tareas: ${nombres(automatica).join(', ')}`
);
comprobar(
  'Manda revisar el aceite de transmision',
  nombres(automatica).some((n) => /aceite de transmision/i.test(n))
);
comprobar(
  'Manda revisar solenoides y cuerpo de valvulas',
  nombres(automatica).some((n) => /solenoides/i.test(n))
);
comprobar('El tipo proviene de la ficha', automatica.transmision?.procedencia === 'FICHA');

// --------------------------------------------------------------------------
console.log('\n  Caso 2: caja mecanica declarada en la ficha del vehiculo.');
const mecanica = diagnosticar('El embrague patina y no entra cambio', 'MECANICA');

comprobar('El motor resuelve la orden', mecanica.aplicada === true);
comprobar('SI manda revisar el embrague', nombres(mecanica).includes(EMBRAGUE));
comprobar(
  'NO manda tareas propias de la automatica',
  !nombres(mecanica).some((n) => /solenoides|convertidor de par/i.test(n)),
  `tareas: ${nombres(mecanica).join(', ')}`
);

// --------------------------------------------------------------------------
console.log('\n  Caso 3: la ficha no tiene el dato y la descripcion lo declara.');
const porTexto = diagnosticar('Reparacion de la caja automatica, golpe en los cambios', null);

comprobar(
  'El tipo se reconoce dentro de la descripcion',
  porTexto.transmision?.tipo === 'AUTOMATICA',
  `obtenido ${porTexto.transmision?.tipo}`
);
comprobar('Queda constancia de que salio del texto', porTexto.transmision?.procedencia === 'DESCRIPCION');
comprobar('Tampoco manda revisar el embrague', !nombres(porTexto).includes(EMBRAGUE));

// --------------------------------------------------------------------------
console.log('\n  Caso 4: ni la ficha ni la descripcion dicen el tipo.');
const desconocida = diagnosticar('No entra cambio y se escucha un ruido en la caja', null);

comprobar('El tipo queda en desconocido', desconocida.transmision?.tipo === null);
comprobar('El motor resuelve igual, con lo comun a ambas cajas', desconocida.aplicada === true);
comprobar(
  'No inventa el embrague ante la duda',
  !nombres(desconocida).includes(EMBRAGUE),
  `tareas: ${nombres(desconocida).join(', ')}`
);
comprobar(
  'Tampoco inventa las tareas de la automatica',
  !nombres(desconocida).some((n) => /solenoides|convertidor de par/i.test(n))
);
comprobar(
  'La orden conserva al menos una tarea',
  (desconocida.tareas || []).length >= 1,
  `${(desconocida.tareas || []).length} tareas`
);

// --------------------------------------------------------------------------
console.log('\n  Caso 5: el reconocimiento por texto no se equivoca con palabras parecidas.');
comprobar(
  'La ficha manda sobre lo que diga el texto',
  tipoDeCaja({ descripcion: 'caja automatica', tipoTransmision: 'MECANICA' }).tipo === 'MECANICA'
);
comprobar(
  'Un texto sin senas no arroja tipo',
  tipoDeCaja({ descripcion: 'El carro hace un ruido raro', tipoTransmision: null }).tipo === null
);
comprobar(
  'Un valor invalido en la ficha no se toma por bueno',
  tipoDeCaja({ descripcion: 'ruido en la caja', tipoTransmision: 'CUALQUIERA' }).tipo === null
);

// --------------------------------------------------------------------------
console.log('\n  Caso 6: el tiempo estimado ya no carga trabajo que no corresponde.');
const conEmbrague = mecanica.tiempoEstimadoMin;
const sinEmbrague = automatica.tiempoEstimadoMin;
console.log(`      Caja mecanica:   ${conEmbrague} min  (${nombres(mecanica).length} tareas)`);
console.log(`      Caja automatica: ${sinEmbrague} min  (${nombres(automatica).length} tareas)`);
comprobar('Cada tipo de caja arroja su propio tiempo', conEmbrague !== sinEmbrague);

console.log(`\n  Resultado: ${aciertos} de ${total} comprobaciones\n`);
process.exit(aciertos === total ? 0 : 1);
