/**
 * LIMITE DE INTENTOS SOBRE LA CONSULTA PUBLICA DEL CLIENTE
 * Y, DESDE EL 18 DE OCTUBRE DE 2026, SOBRE EL INICIO DE SESION (al final).
 *
 * MOTIVO
 *
 * La consulta del cliente es el unico servicio del sistema que atiende sin
 * cuenta de acceso: basta con el codigo que el taller entrega al momento del
 * ingreso. Ese codigo tiene ocho caracteres de un alfabeto de treinta y uno, de
 * modo que adivinarlo al azar resulta impracticable. Lo que si resulta
 * practicable, y hasta hoy nada lo impedia, es recorrer codigos de forma
 * sistematica hasta topar con alguno valido, o repetir la consulta miles de
 * veces para agotar la cuota de la base de datos.
 *
 * Cada orden revela la placa del vehiculo, su marca y su linea, junto con el
 * avance de la reparacion. Es informacion de un cliente del taller y no
 * corresponde exponerla a quien va probando.
 *
 * DOS PRESUPUESTOS DISTINTOS, Y ESA ES LA IDEA CENTRAL
 *
 * Un limite unico por cantidad de peticiones castiga por igual a quien consulta
 * su propia orden diez veces al dia y a quien prueba codigos al azar. El
 * comportamiento que delata a este ultimo no es la cantidad de consultas sino
 * la cantidad de consultas FALLIDAS: quien conoce su codigo acierta siempre,
 * quien adivina falla casi siempre.
 *
 *   Presupuesto de flujo    Treinta peticiones por minuto, cualquiera sea su
 *                           resultado. Contiene la avalancha.
 *
 *   Presupuesto de fallos   Ocho codigos inexistentes dentro de diez minutos.
 *                           Al agotarlo, la direccion queda en espera un cuarto
 *                           de hora. Una consulta acertada no gasta de este
 *                           presupuesto, de manera que el cliente legitimo
 *                           nunca lo alcanza.
 *
 * ALCANCE DE ESTA MEDIDA, DICHO SIN ADORNOS
 *
 * El registro vive en la memoria del proceso. Un reinicio del servidor lo
 * borra, y con varias instancias en ejecucion cada una llevaria su propia
 * cuenta. La capa gratuita del proveedor de alojamiento ejecuta una sola
 * instancia, de modo que hoy la medida cumple; ante un crecimiento del taller
 * corresponderia trasladar el registro a la base de datos o a un almacen
 * compartido.
 *
 * Tampoco detiene a quien disponga de muchas direcciones distintas. Lo que
 * detiene es el recorrido sistematico desde un mismo origen, que es la forma en
 * que ocurren estos intentos.
 */

/** Ventana y tope del presupuesto de flujo. */
const VENTANA_FLUJO_MS = 60 * 1000;
const MAXIMO_FLUJO = 30;

/** Ventana y tope del presupuesto de fallos. */
const VENTANA_FALLOS_MS = 10 * 60 * 1000;
const MAXIMO_FALLOS = 8;

/** Tiempo de espera que se impone al agotar el presupuesto de fallos. */
const BLOQUEO_MS = 15 * 60 * 1000;

/** Periodo de la limpieza del registro. */
const BARRIDO_MS = 5 * 60 * 1000;

/** Registro por direccion de origen. */
const registro = new Map();

/** Descarta las marcas anteriores al inicio de la ventana. */
function vigentes(marcas, ahora, ventanaMs) {
  return marcas.filter((marca) => ahora - marca < ventanaMs);
}

/** Obtiene o crea el asiento de una direccion. */
function asientoDe(direccion) {
  let asiento = registro.get(direccion);
  if (!asiento) {
    asiento = { flujo: [], fallos: [], esperaHasta: 0 };
    registro.set(direccion, asiento);
  }
  return asiento;
}

/**
 * Retira del registro las direcciones sin actividad reciente.
 *
 * Sin esta limpieza el registro crece con cada direccion que consulta una sola
 * vez y nunca vuelve, hasta consumir la memoria del proceso.
 */
function barrer(ahora = Date.now()) {
  for (const [direccion, asiento] of registro.entries()) {
    const sinFlujo = vigentes(asiento.flujo, ahora, VENTANA_FLUJO_MS).length === 0;
    const sinFallos = vigentes(asiento.fallos, ahora, VENTANA_FALLOS_MS).length === 0;
    const sinEspera = asiento.esperaHasta <= ahora;
    if (sinFlujo && sinFallos && sinEspera) registro.delete(direccion);
  }
}

// El temporizador no retiene el proceso: sin unref, una prueba que termina
// quedaria colgada a la espera de un barrido que ya no interesa.
const temporizador = setInterval(barrer, BARRIDO_MS);
if (typeof temporizador.unref === 'function') temporizador.unref();

/** Segundos que restan, redondeados hacia arriba, para informar la espera. */
function segundosRestantes(hasta, ahora) {
  return Math.max(1, Math.ceil((hasta - ahora) / 1000));
}

/**
 * Middleware que aplica ambos presupuestos sobre la consulta publica.
 *
 * El resultado de la peticion se conoce despues de atenderla, de modo que el
 * presupuesto de fallos se actualiza cuando la respuesta concluye. Un codigo
 * inexistente responde 404 y uno mal formado responde 400: ambos cuentan como
 * fallo. Una falla del propio servidor no cuenta, porque el origen de esa falla
 * reside en el taller y no en quien consulta.
 */
function limitarConsulta(peticion, respuesta, siguiente) {
  const ahora = Date.now();
  const direccion = peticion.ip || peticion.socket?.remoteAddress || 'desconocida';
  const asiento = asientoDe(direccion);

  if (asiento.esperaHasta > ahora) {
    const espera = segundosRestantes(asiento.esperaHasta, ahora);
    respuesta.set('Retry-After', String(espera));
    return respuesta.status(429).json({
      codigo: 'DEMASIADOS_INTENTOS',
      error:
        'Se alcanzo el limite de codigos incorrectos. Conviene esperar unos minutos y ' +
        'verificar el codigo que entrego el taller.',
      esperaSegundos: espera,
    });
  }

  asiento.flujo = vigentes(asiento.flujo, ahora, VENTANA_FLUJO_MS);
  if (asiento.flujo.length >= MAXIMO_FLUJO) {
    const espera = segundosRestantes(asiento.flujo[0] + VENTANA_FLUJO_MS, ahora);
    respuesta.set('Retry-After', String(espera));
    return respuesta.status(429).json({
      codigo: 'DEMASIADAS_CONSULTAS',
      error: 'Se recibieron demasiadas consultas seguidas. Conviene esperar un momento.',
      esperaSegundos: espera,
    });
  }
  asiento.flujo.push(ahora);

  respuesta.on('finish', () => {
    if (respuesta.statusCode !== 404 && respuesta.statusCode !== 400) return;

    const instante = Date.now();
    asiento.fallos = vigentes(asiento.fallos, instante, VENTANA_FALLOS_MS);
    asiento.fallos.push(instante);

    if (asiento.fallos.length >= MAXIMO_FALLOS) {
      asiento.esperaHasta = instante + BLOQUEO_MS;
      asiento.fallos = [];
      console.warn(
        `Consulta publica: la direccion ${direccion} agoto ${MAXIMO_FALLOS} codigos incorrectos ` +
          `y queda en espera ${BLOQUEO_MS / 60000} minutos.`
      );
    }
  });

  return siguiente();
}

// ==========================================================================
//  LIMITE DE INTENTOS SOBRE EL INICIO DE SESION (18 de octubre de 2026)
// ==========================================================================
//
// Hasta esta fecha el inicio de sesion aceptaba contrasenas sin freno: desde
// un mismo origen se podian probar todas las que se quisiera contra la cuenta
// del propietario. El proveedor de autenticacion tiene sus propios limites,
// pero los aplica a la direccion de quien le pregunta, y quien le pregunta es
// siempre este servidor: un limite suyo frenaria a todo el taller a la vez, no
// a quien esta probando.
//
// Solo cuentan las contrasenas rechazadas (respuesta 401). Una persona que
// entra bien no gasta nada, y un servicio caido (503) no es culpa de quien
// intenta.
//
// DOS LLAVES, POR LA MISMA RAZON QUE EN LA CONSULTA
//
//   Por direccion de origen    Frena a quien prueba muchas cuentas o muchas
//                              contrasenas desde un mismo lugar.
//   Por cuenta (correo)        Frena a quien prueba contra una misma cuenta
//                              cambiando de direccion.
//
// El costo conocido de la llave por cuenta: alguien que conozca el correo del
// propietario podria dejarlo quince minutos sin entrar a proposito, fallando
// diez veces. En un taller de tres personas se acepta ese costo a cambio de
// proteger la cuenta que lo administra todo; la alternativa es dejarla
// expuesta a que adivinen su contrasena.

/** Fallos admitidos dentro de la ventana antes de imponer la espera. */
const MAXIMO_FALLOS_INGRESO = 10;
const VENTANA_INGRESO_MS = 15 * 60 * 1000;
const BLOQUEO_INGRESO_MS = 15 * 60 * 1000;

/** Registro del inicio de sesion, aparte del de la consulta publica. */
const registroIngreso = new Map();

function asientoIngreso(llave) {
  let asiento = registroIngreso.get(llave);
  if (!asiento) {
    asiento = { fallos: [], esperaHasta: 0 };
    registroIngreso.set(llave, asiento);
  }
  return asiento;
}

function barrerIngreso(ahora = Date.now()) {
  for (const [llave, asiento] of registroIngreso.entries()) {
    const sinFallos = vigentes(asiento.fallos, ahora, VENTANA_INGRESO_MS).length === 0;
    if (sinFallos && asiento.esperaHasta <= ahora) registroIngreso.delete(llave);
  }
}

const temporizadorIngreso = setInterval(barrerIngreso, BARRIDO_MS);
if (typeof temporizadorIngreso.unref === 'function') temporizadorIngreso.unref();

/** Registra un fallo y, si corresponde, impone la espera. */
function anotarFalloIngreso(llave, instante) {
  const asiento = asientoIngreso(llave);
  asiento.fallos = vigentes(asiento.fallos, instante, VENTANA_INGRESO_MS);
  asiento.fallos.push(instante);
  if (asiento.fallos.length >= MAXIMO_FALLOS_INGRESO) {
    asiento.esperaHasta = instante + BLOQUEO_INGRESO_MS;
    asiento.fallos = [];
    console.warn(
      `Inicio de sesion: ${llave} acumulo ${MAXIMO_FALLOS_INGRESO} contrasenas rechazadas ` +
        `y queda en espera ${BLOQUEO_INGRESO_MS / 60000} minutos.`
    );
  }
}

/**
 * Middleware del inicio de sesion. Va antes de la ruta /ingreso.
 *
 * El mensaje de espera es el mismo para las dos llaves y no confirma si el
 * correo existe: decir "esta cuenta esta bloqueada" le revelaria a quien
 * prueba que dio con un correo real.
 */
function limitarIngreso(peticion, respuesta, siguiente) {
  const ahora = Date.now();
  const direccion = `ip:${peticion.ip || peticion.socket?.remoteAddress || 'desconocida'}`;
  // En el cambio de contrasena la persona ya inicio sesion y el correo viene
  // de su perfil, no del cuerpo: asi un intento fallido cuenta contra su
  // propia cuenta igual que en el inicio de sesion.
  const correo = String(peticion.body?.correo || peticion.usuario?.correo || '').trim().toLowerCase();
  const cuenta = correo ? `cuenta:${correo}` : null;

  const esperas = [registroIngreso.get(direccion), cuenta && registroIngreso.get(cuenta)]
    .filter(Boolean)
    .map((asiento) => asiento.esperaHasta)
    .filter((hasta) => hasta > ahora);

  if (esperas.length) {
    const espera = segundosRestantes(Math.max(...esperas), ahora);
    respuesta.set('Retry-After', String(espera));
    return respuesta.status(429).json({
      codigo: 'DEMASIADOS_INTENTOS',
      error:
        'Se alcanzo el limite de contrasenas incorrectas. Conviene esperar unos minutos; ' +
        'si la contrasena se olvido, el propietario la puede restablecer.',
      esperaSegundos: espera,
    });
  }

  respuesta.on('finish', () => {
    if (respuesta.statusCode !== 401) return;
    const instante = Date.now();
    anotarFalloIngreso(direccion, instante);
    if (cuenta) anotarFalloIngreso(cuenta, instante);
  });

  return siguiente();
}

/** Vacia los registros. Corresponde a las pruebas, no a la operacion. */
function reiniciarRegistro() {
  registro.clear();
  registroIngreso.clear();
}

module.exports = {
  limitarConsulta,
  limitarIngreso,
  reiniciarRegistro,
  registroIngreso,
  MAXIMO_FALLOS_INGRESO,
  VENTANA_INGRESO_MS,
  BLOQUEO_INGRESO_MS,
  barrer,
  registro,
  VENTANA_FLUJO_MS,
  MAXIMO_FLUJO,
  VENTANA_FALLOS_MS,
  MAXIMO_FALLOS,
  BLOQUEO_MS,
};
