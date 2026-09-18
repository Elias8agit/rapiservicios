/**
 * PRUEBA DE LOS DOS NIVELES DE INTERPRETACION.
 *
 * Verifica que la capa de interpretacion distinga tres situaciones distintas
 * y responda a cada una como corresponde:
 *
 *   Nivel 1  La averia pertenece al catalogo del taller. La capa entrega la
 *            categoria y ninguna tarea, porque las tareas las decide el motor
 *            de reglas a partir de la base de conocimiento del taller.
 *
 *   Nivel 2  El vehiculo presenta una averia que el catalogo de doce
 *            categorias no contempla. La capa entrega sistema, hallazgo y
 *            tareas de revision, todo marcado con origen GENERATIVO.
 *
 *   Nivel 0  El contenido carece de una falla concreta. La capa se abstiene y
 *            deja constancia del motivo, sin inventar tareas.
 *
 * Ejecutar con: npm run prueba:niveles
 *
 * La prueba requiere GEMINI_API_KEY dentro del archivo .env. Sin esa clave el
 * respaldo local atiende todos los casos y el nivel dos no se ejercita.
 */

require('dotenv').config();

const { clasificar, MODELO, UMBRAL_INTERPRETACION } = require('../src/servicios/interpretacion');
const { evaluar } = require('../src/servicios/motorReglas');

const CASOS = [
  {
    nivel: 1,
    descripcion: 'El carro chilla y hace un ruido metalico al frenar, sobre todo en bajada.',
    espera: 'Una categoria del catalogo, sin tareas propias.',
  },
  {
    nivel: 2,
    descripcion: 'Check engine encendido y falla de airbag',
    espera: 'Sin categoria del catalogo, con sistema, hallazgo y tareas sugeridas.',
  },
  {
    nivel: 2,
    descripcion: 'Se encendio la luz del ABS y el radio dejo de funcionar.',
    espera: 'Sin categoria del catalogo, con tareas sugeridas.',
  },
  // Revision preventiva. Caso reclasificado del nivel 0 al nivel 2 el 12 de
  // septiembre de 2026.
  //
  // Hasta esa fecha la capa se abstenia ante este texto y la orden nacia vacia.
  // El usuario la reviso y determino que la abstencion estaba equivocada: un
  // cliente que deja el vehiculo para que se lo revisen antes de viajar
  // constituye trabajo real del taller, y una orden sin una sola tarea no le
  // sirve al mecanico. Textual: "la cosa es que no quede en blanco eso".
  //
  // La ausencia de sintoma no equivale a la ausencia de trabajo.
  {
    nivel: 2,
    descripcion: 'El cliente solicita una revision general antes de un viaje.',
    espera: 'Una revision preventiva con tareas, aunque no exista un sintoma concreto.',
  },

  // Abstencion legitima.
  //
  // Este caso sustituye al anterior como guardian del nivel 0 y existe por una
  // razon precisa: al retirarle a la capa el permiso de abstenerse ante un
  // texto pobre, queda el riesgo contrario, que no sepa abstenerse nunca y
  // fabrique una averia a partir de cualquier renglon. Un recado administrativo
  // no menciona el vehiculo ni sintoma alguno, de modo que la respuesta
  // correcta sigue siendo no interpretar.
  {
    nivel: 0,
    descripcion: 'Recordarle a don Julio que quedo debiendo el saldo del trabajo anterior.',
    espera: 'Sin falla, sin tareas: el texto trata de un cobro y no del vehiculo.',
  },
];

let aciertos = 0;
let total = 0;

function comprobar(rotulo, condicion, detalle = '') {
  total += 1;
  if (condicion) aciertos += 1;
  const marca = condicion ? 'CORRECTO' : 'FALLA   ';
  console.log(`  ${marca}  ${rotulo}${detalle ? `  ${detalle}` : ''}`);
}

/** Determina el nivel que efectivamente atendio la interpretacion. */
function nivelObtenido(lectura) {
  if (!lectura.hayFalla) return 0;
  if (lectura.idCategoria) return 1;
  if (lectura.tareasSugeridas.length > 0) return 2;
  return -1;
}

async function principal() {
  console.log('');
  console.log('  Prueba de los dos niveles de interpretacion');
  console.log(`  Modelo: ${MODELO}   Umbral: ${(UMBRAL_INTERPRETACION * 100).toFixed(0)} %`);
  console.log(`  Clave del servicio: ${process.env.GEMINI_API_KEY ? 'presente' : 'AUSENTE, opera el respaldo local'}`);
  console.log('');

  for (const caso of CASOS) {
    console.log(`  Caso nivel ${caso.nivel}: "${caso.descripcion}"`);
    console.log(`  Se espera: ${caso.espera}`);

    const inicio = Date.now();
    const lectura = await clasificar(caso.descripcion);
    const demora = Date.now() - inicio;

    const obtenido = nivelObtenido(lectura);
    console.log(
      `  Resultado: nivel ${obtenido}  ·  origen ${lectura.origen}  ·  ` +
        `confianza ${(Number(lectura.nivelConfianza) * 100).toFixed(1)} %  ·  ${demora} ms`
    );
    if (lectura.sistemaSugerido) console.log(`  Sistema senalado: ${lectura.sistemaSugerido}`);
    if (lectura.hallazgo) console.log(`  Hallazgo: ${lectura.hallazgo}`);
    if (lectura.justificacion) console.log(`  Justificacion: ${lectura.justificacion}`);

    comprobar(`El nivel corresponde al esperado (${caso.nivel})`, obtenido === caso.nivel, `obtenido ${obtenido}`);

    if (caso.nivel === 1) {
      comprobar('La categoria pertenece al catalogo', Boolean(lectura.idCategoria));
      comprobar('La capa no invade la decision del taller', lectura.tareasSugeridas.length === 0);

      const diagnostico = evaluar({
        idCategoria: lectura.idCategoria,
        descripcion: caso.descripcion,
        nivelConfianza: lectura.nivelConfianza,
        kilometraje: 0,
      });
      comprobar(
        `El motor de reglas resolvio la orden: ${diagnostico.categoria || 'sin categoria'}`,
        Boolean(diagnostico.aplicada) && diagnostico.tareas.length > 0,
        diagnostico.aplicada ? `${diagnostico.tareas.length} tareas, ${diagnostico.tiempoEstimadoMin} min` : ''
      );
    }

    if (caso.nivel === 2) {
      comprobar('La orden no queda vacia: hay tareas sugeridas', lectura.tareasSugeridas.length > 0);
      comprobar('El origen queda marcado como GENERATIVO', lectura.origen === 'GENERATIVO');
      comprobar('Cada tarea trae nombre y tiempo utilizable',
        lectura.tareasSugeridas.every((t) => t.nombre && t.minutos >= 5 && t.minutos <= 240));
      lectura.tareasSugeridas.forEach((t, i) => {
        console.log(`      ${i + 1}. ${t.nombre}  (${t.minutos} min)`);
      });
    }

    if (caso.nivel === 0) {
      comprobar('La capa se abstiene en lugar de inventar', lectura.tareasSugeridas.length === 0);
      comprobar('Queda constancia del motivo', Boolean(lectura.justificacion));
    }

    console.log('');
  }

  console.log(`  Resultado: ${aciertos} de ${total} comprobaciones`);
  console.log('');
  process.exit(aciertos === total ? 0 : 1);
}

principal().catch((error) => {
  console.error('  La prueba termino por una falla inesperada:', error.message);
  process.exit(1);
});
