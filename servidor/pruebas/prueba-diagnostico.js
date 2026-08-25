/**
 * PRUEBA FUNCIONAL DEL NUCLEO DE DIAGNOSTICO
 *
 * Ejecuta el flujo completo de interpretacion y aplicacion de reglas sobre un
 * conjunto de descripciones reales del taller. Permite verificar el
 * comportamiento del componente experto sin necesidad de la base de datos ni
 * del servicio externo de interpretacion.
 *
 * Ejecucion:  node pruebas/prueba-diagnostico.js
 */

const { clasificar } = require('../src/servicios/interpretacion');
const { evaluar } = require('../src/servicios/motorReglas');

const CASOS = [
  { descripcion: 'El carro hace un ruido metalico cuando freno y el pedal se siente esponjoso', kilometraje: 85000, esperado: 'Frenos' },
  { descripcion: 'Cuando paso un tumulo golpetea la suspension del lado derecho',               kilometraje: 120000, esperado: 'Suspension' },
  { descripcion: 'El motor se calienta demasiado y sale vapor del capo',                        kilometraje: 96000, esperado: 'Enfriamiento' },
  { descripcion: 'No enciende en las mananas, cuesta arrancar y luego funciona bien',           kilometraje: 74000, esperado: 'Encendido' },
  { descripcion: 'La bateria se descarga sola y enciende la luz de bateria en el tablero',      kilometraje: 55000, esperado: 'Sistema electrico' },
  { descripcion: 'El aire no enfria, solo sale aire caliente',                                  kilometraje: 61000, esperado: 'Aire acondicionado' },
  { descripcion: 'Se escucha un zumbido raro que no logro ubicar',                              kilometraje: 30000, esperado: null },
];

function separador(caracter = '-') {
  return caracter.repeat(78);
}

async function principal() {
  console.log(separador('='));
  console.log(' PRUEBA DEL NUCLEO DE DIAGNOSTICO - TALLER MECANICO RAPISERVICIOS');
  console.log(separador('='));

  let correctos = 0;
  let evaluados = 0;

  for (const caso of CASOS) {
    evaluados += 1;
    console.log(`\nCASO ${evaluados}`);
    console.log(`Descripcion  : "${caso.descripcion}"`);
    console.log(`Kilometraje  : ${caso.kilometraje.toLocaleString('es-GT')} km`);

    const interpretacion = await clasificar(caso.descripcion);

    if (!interpretacion.idCategoria) {
      console.log('Resultado    : sin categoria asignada. Se deriva a revision manual.');
      if (caso.esperado === null) {
        correctos += 1;
        console.log('Verificacion : CORRECTO (el caso no corresponde al catalogo)');
      } else {
        console.log(`Verificacion : INCORRECTO (se esperaba ${caso.esperado})`);
      }
      console.log(separador());
      continue;
    }

    const diagnostico = evaluar({
      idCategoria: interpretacion.idCategoria,
      descripcion: caso.descripcion,
      nivelConfianza: interpretacion.nivelConfianza,
      kilometraje: caso.kilometraje,
    });

    console.log(`Interpretado : ${diagnostico.categoria} (confianza ${interpretacion.nivelConfianza}, origen ${interpretacion.origen})`);

    if (!diagnostico.aplicada) {
      console.log(`Resultado    : ${diagnostico.motivo}`);
      console.log(separador());
      continue;
    }

    console.log(`Sistema      : ${diagnostico.sistemaVehicular}`);
    console.log(`Reglas       : ${diagnostico.reglasAplicadas.join(' | ')}`);
    console.log('Tareas sugeridas para la orden de trabajo:');
    diagnostico.tareas.forEach((t, i) => {
      console.log(`   ${String(i + 1).padStart(2, '0')}. ${t.nombre.padEnd(46)} ${String(t.minutos).padStart(3)} min`);
    });
    console.log(`Tiempo total : ${diagnostico.tiempoEstimadoTexto} (${diagnostico.tiempoEstimadoMin} minutos)`);

    const acierto = diagnostico.categoria === caso.esperado;
    if (acierto) correctos += 1;
    console.log(`Verificacion : ${acierto ? 'CORRECTO' : `INCORRECTO (se esperaba ${caso.esperado})`}`);
    console.log(separador());
  }

  const porcentaje = ((correctos / evaluados) * 100).toFixed(1);
  console.log(`\nRESUMEN: ${correctos} de ${evaluados} casos correctos (${porcentaje}%)`);
  console.log(separador('='));

  process.exit(correctos === evaluados ? 0 : 1);
}

principal();
