/**
 * PRUEBA DEL LIMITE DE INTENTOS SOBRE LA CONSULTA PUBLICA.
 *
 * La prueba no toca la red ni la base de datos: ejercita el middleware con
 * peticiones y respuestas simuladas. De ahi que corra en cualquier momento, aun
 * con el proveedor de datos en pausa, y que su resultado no dependa de la
 * demora de ningun servicio externo.
 *
 * Ejecutar con: npm run prueba:limite
 */

const {
  limitarConsulta,
  reiniciarRegistro,
  registro,
  MAXIMO_FLUJO,
  MAXIMO_FALLOS,
} = require('../src/middleware/limitador');

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

/**
 * Simula una peticion a la consulta publica.
 *
 * @param {string} direccion Origen de la peticion.
 * @param {number} estadoFinal Estado con el que respondera la ruta.
 * @returns {{atendida:boolean, estado:number, cuerpo:object}}
 */
function consultar(direccion, estadoFinal) {
  const peticion = { ip: direccion };
  const salida = { atendida: false, estado: 0, cuerpo: null };
  const oyentes = [];

  const respuesta = {
    statusCode: 200,
    set() {},
    status(codigo) {
      salida.estado = codigo;
      respuesta.statusCode = codigo;
      return respuesta;
    },
    json(cuerpo) {
      salida.cuerpo = cuerpo;
      return respuesta;
    },
    on(evento, oyente) {
      if (evento === 'finish') oyentes.push(oyente);
    },
  };

  limitarConsulta(peticion, respuesta, () => {
    salida.atendida = true;
    salida.estado = estadoFinal;
    respuesta.statusCode = estadoFinal;
  });

  // La ruta concluye y el servidor emite el evento de cierre, momento en que el
  // middleware anota el resultado.
  oyentes.forEach((oyente) => oyente());
  return salida;
}

console.log('\n  Prueba del limite de intentos sobre la consulta publica');
console.log(`  Presupuesto de flujo: ${MAXIMO_FLUJO} por minuto`);
console.log(`  Presupuesto de fallos: ${MAXIMO_FALLOS} codigos incorrectos por diez minutos\n`);

// --------------------------------------------------------------------------
console.log('  Caso 1: el cliente que conoce su codigo nunca queda bloqueado.');
reiniciarRegistro();

let todasAtendidas = true;
for (let i = 0; i < MAXIMO_FALLOS * 3; i += 1) {
  if (!consultar('10.0.0.1', 200).atendida) todasAtendidas = false;
}
comprobar(
  `${MAXIMO_FALLOS * 3} consultas acertadas seguidas se atienden todas`,
  todasAtendidas
);
comprobar(
  'Una consulta acertada no gasta del presupuesto de fallos',
  registro.get('10.0.0.1').fallos.length === 0
);

// --------------------------------------------------------------------------
console.log('\n  Caso 2: quien prueba codigos al azar queda detenido.');
reiniciarRegistro();

let detenidoEn = null;
for (let i = 1; i <= MAXIMO_FALLOS + 3; i += 1) {
  const resultado = consultar('10.0.0.2', 404);
  if (!resultado.atendida && detenidoEn === null) detenidoEn = i;
}

comprobar(
  `La direccion queda detenida al intento ${MAXIMO_FALLOS + 1}`,
  detenidoEn === MAXIMO_FALLOS + 1,
  `se detuvo en ${detenidoEn}`
);

const bloqueada = consultar('10.0.0.2', 404);
comprobar('La respuesta del bloqueo usa el estado 429', bloqueada.estado === 429);
comprobar(
  'El cuerpo identifica el motivo con un codigo propio',
  bloqueada.cuerpo?.codigo === 'DEMASIADOS_INTENTOS'
);
comprobar(
  'La respuesta informa cuantos segundos restan',
  Number(bloqueada.cuerpo?.esperaSegundos) > 0
);
comprobar(
  'El mensaje no revela si el codigo existe',
  typeof bloqueada.cuerpo?.error === 'string' &&
    !/existe|encontr|valido/i.test(bloqueada.cuerpo.error)
);

// --------------------------------------------------------------------------
console.log('\n  Caso 3: el bloqueo alcanza solo a la direccion que lo provoco.');
comprobar('Otra direccion sigue atendida con normalidad', consultar('10.0.0.3', 200).atendida);

// --------------------------------------------------------------------------
console.log('\n  Caso 4: un codigo mal formado tambien cuenta como fallo.');
reiniciarRegistro();
consultar('10.0.0.4', 400);
comprobar(
  'El estado 400 suma al presupuesto de fallos',
  registro.get('10.0.0.4').fallos.length === 1
);

// --------------------------------------------------------------------------
console.log('\n  Caso 5: una falla del propio servidor no castiga a quien consulta.');
reiniciarRegistro();
consultar('10.0.0.5', 500);
comprobar(
  'El estado 500 no suma al presupuesto de fallos',
  registro.get('10.0.0.5').fallos.length === 0
);

// --------------------------------------------------------------------------
console.log('\n  Caso 6: la avalancha de consultas acertadas tambien se contiene.');
reiniciarRegistro();

let contenidoEn = null;
for (let i = 1; i <= MAXIMO_FLUJO + 5; i += 1) {
  const resultado = consultar('10.0.0.6', 200);
  if (!resultado.atendida && contenidoEn === null) contenidoEn = i;
}
comprobar(
  `El presupuesto de flujo detiene en el intento ${MAXIMO_FLUJO + 1}`,
  contenidoEn === MAXIMO_FLUJO + 1,
  `se detuvo en ${contenidoEn}`
);

const desbordada = consultar('10.0.0.6', 200);
comprobar(
  'El desborde de flujo se distingue del de codigos incorrectos',
  desbordada.cuerpo?.codigo === 'DEMASIADAS_CONSULTAS'
);

// --------------------------------------------------------------------------
console.log(`\n  Resultado: ${aciertos} de ${total} comprobaciones\n`);
process.exit(aciertos === total ? 0 : 1);
