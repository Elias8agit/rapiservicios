/**
 * CAPA DE ACCESO A LOS SERVICIOS REST DEL TALLER.
 *
 * Concentra el consumo de la interfaz de programacion del servidor. Cada
 * peticion adjunta el testigo de acceso de la sesion activa y traduce las
 * respuestas de error hacia un mensaje comprensible para el mecanico.
 *
 * Tolerancia a cortes de red: la señal inalambrica dentro de un taller
 * resulta inestable. Cada peticion cuenta con un limite de espera y con un
 * reintento automatico, de manera que una interrupcion breve no obliga al
 * mecanico a repetir la operacion. Cuando el reintento tampoco prospera, el
 * error indica la naturaleza de la falla para que la pantalla ofrezca la
 * accion correspondiente.
 */

import { URL_API } from '../../configuracion';

/** Milisegundos que se aguarda antes de dar por perdida una peticion. */
const LIMITE_ESPERA = 12000;

/**
 * Limite ampliado para las operaciones que involucran a la capa de
 * interpretacion o el envio de una fotografia. La generacion de una orden
 * recorre el servicio externo de interpretacion, el motor de reglas, cinco
 * escrituras en la base de datos y la subida de la imagen, de modo que
 * requiere mas holgura que una consulta de listado.
 *
 * El valor subio de 30 a 45 segundos el 28 de agosto de 2026, cuando el
 * presupuesto de la capa de interpretacion paso de 8 a 20 segundos. El limite
 * del cliente debe superar al del servidor, de lo contrario el telefono
 * abandona la peticion mientras el servidor todavia trabaja y la orden queda
 * creada sin que el mecanico lo sepa.
 */
const LIMITE_ESPERA_AMPLIO = 45000;

/** Milisegundos entre el primer intento y el reintento automatico. */
const PAUSA_REINTENTO = 1200;

/**
 * Presupuesto para despertar el servidor de aplicacion.
 *
 * La capa gratuita del proveedor de alojamiento suspende el servicio despues
 * de quince minutos sin peticiones y lo restablece cuando llega la siguiente.
 * Ese restablecimiento comprende la descarga de la imagen y el arranque del
 * proceso, de modo que la primera peticion del dia tarda cerca de un minuto,
 * muy por encima del limite ordinario de doce segundos.
 *
 * La aplicacion consulta el estado del servicio al abrirse y aguarda dentro de
 * este presupuesto antes de mostrar el ingreso. El mecanico observa un aviso
 * en lugar de una pantalla detenida.
 */
const LIMITE_DESPERTAR_TOTAL = 90000;

/** Limite de cada intento individual dentro del despertar. */
const LIMITE_DESPERTAR_INTENTO = 20000;

let testigoActual = null;

/** Registra el testigo que acompana a las peticiones siguientes. */
export function establecerTestigo(testigo) {
  testigoActual = testigo || null;
}

/** Detiene la ejecucion durante los milisegundos indicados. */
function esperar(milisegundos) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

/**
 * Construye el error de comunicacion con la naturaleza de la falla.
 * tipo ESPERA   El servidor no respondio dentro del limite de tiempo.
 * tipo RED      El telefono no alcanza al servidor.
 */
function fallaDeComunicacion(tipo, metodo = 'GET') {
  const mensajes = {
    ESPERA:
      metodo === 'GET'
        ? 'El servidor del taller tardo demasiado en responder. Verificar la señal del telefono y volver a intentar.'
        : 'El servidor del taller tardo demasiado en responder. Antes de repetir la operacion, revisar el listado: el registro pudo quedar guardado.',
    RED:
      'Sin comunicacion con el servidor del taller. Verificar que el telefono ' +
      'conserve señal y que el servidor permanezca en ejecucion.',
  };
  const error = new Error(mensajes[tipo] || mensajes.RED);
  error.tipo = tipo;
  error.recuperable = true;
  error.direccion = URL_API;
  return error;
}

/**
 * Ejecuta una peticion contra el servidor del taller.
 * @param {string} ruta Trayecto del servicio.
 * @param {object} opciones Opciones de la peticion.
 * @param {{limite?:number, reintentos?:number}} ajustes Limite de espera y
 *        cantidad de reintentos automaticos.
 */
async function peticion(ruta, opciones = {}, ajustes = {}) {
  const metodo = (opciones.method || 'GET').toUpperCase();
  const limite = ajustes.limite || LIMITE_ESPERA;

  // El reintento automatico corresponde unicamente a las consultas. Repetir
  // por cuenta propia un alta o una modificacion produciria registros
  // duplicados cuando la peticion original si llego al servidor y lo que se
  // perdio fue la respuesta.
  const permiteReintento = metodo === 'GET';
  const reintentosRestantes =
    ajustes.reintentos !== undefined ? ajustes.reintentos : permiteReintento ? 1 : 0;

  const encabezados = { 'Content-Type': 'application/json', ...(opciones.headers || {}) };
  if (testigoActual) encabezados.Authorization = `Bearer ${testigoActual}`;

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), limite);

  let respuesta;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      ...opciones,
      headers: encabezados,
      signal: controlador.signal,
    });
  } catch (error) {
    // Una interrupcion breve de la señal no debe interrumpir el trabajo del
    // mecanico: se concede un reintento antes de informar la falla.
    if (reintentosRestantes > 0) {
      await esperar(PAUSA_REINTENTO);
      return peticion(ruta, opciones, { limite, reintentos: reintentosRestantes - 1 });
    }
    throw fallaDeComunicacion(error.name === 'AbortError' ? 'ESPERA' : 'RED', metodo);
  } finally {
    clearTimeout(temporizador);
  }

  const texto = await respuesta.text();
  let cuerpo = {};
  try {
    cuerpo = texto ? JSON.parse(texto) : {};
  } catch (error) {
    const falla = new Error('El servidor devolvio una respuesta con formato inesperado.');
    falla.tipo = 'FORMATO';
    falla.recuperable = true;
    throw falla;
  }

  if (!respuesta.ok) {
    const falla = new Error(cuerpo.error || `El servidor respondio con estado ${respuesta.status}.`);
    falla.estado = respuesta.status;
    falla.detalle = cuerpo.detalle;
    falla.tipo = respuesta.status >= 500 ? 'SERVIDOR' : 'SOLICITUD';
    // Una falla del servidor amerita reintentar; una solicitud incorrecta no.
    falla.recuperable = respuesta.status >= 500;
    throw falla;
  }

  return cuerpo;
}

const obtener = (ruta, ajustes) => peticion(ruta, {}, ajustes);

/**
 * Consulta el estado del servidor hasta obtener respuesta o agotar el
 * presupuesto. Devuelve el cuerpo de /salud cuando el servicio responde.
 *
 * @param {(segundos:number)=>void} alAvanzar Recibe los segundos transcurridos
 *        despues de cada intento fallido, para que la pantalla informe la
 *        espera al mecanico en lugar de mostrar un indicador mudo.
 */
export async function despertarServidor(alAvanzar) {
  const inicio = Date.now();
  let intento = 0;

  while (Date.now() - inicio < LIMITE_DESPERTAR_TOTAL) {
    intento += 1;
    try {
      return await peticion('/salud', {}, { limite: LIMITE_DESPERTAR_INTENTO, reintentos: 0 });
    } catch (error) {
      // Una respuesta con estado de error igual acredita que el servicio ya
      // atiende peticiones, de modo que el despertar concluye.
      if (error.estado && error.estado < 500) return { estado: 'operativo' };

      if (typeof alAvanzar === 'function') {
        alAvanzar(Math.round((Date.now() - inicio) / 1000));
      }
      if (Date.now() - inicio >= LIMITE_DESPERTAR_TOTAL) break;
      await esperar(intento === 1 ? 500 : 2000);
    }
  }

  throw fallaDeComunicacion('RED');
}

const enviar = (ruta, cuerpo, ajustes) => peticion(ruta, { method: 'POST', body: JSON.stringify(cuerpo) }, ajustes);
const reemplazar = (ruta, cuerpo) => peticion(ruta, { method: 'PUT', body: JSON.stringify(cuerpo) });
const modificar = (ruta, cuerpo) => peticion(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo) });

/** Ajuste para las operaciones que atraviesan la capa de interpretacion. */
const AMPLIO = { limite: LIMITE_ESPERA_AMPLIO };

export const api = {
  salud: () => obtener('/salud'),

  // Modulo M1
  //
  // El ingreso y la consulta de perfil constituyen la primera operacion real
  // contra el servidor despues del despertar. Ese primer trabajo carga la
  // conexion con el proveedor de datos y resulta mas lento que los siguientes,
  // de modo que ambos reciben el limite ampliado. Con el limite ordinario, el
  // mecanico observaba una falla por tiempo agotado y lograba entrar recien al
  // segundo intento.
  ingresar: (correo, contrasena) => enviar('/autenticacion/ingreso', { correo, contrasena }, AMPLIO),
  perfil: () => obtener('/autenticacion/perfil', AMPLIO),
  salir: () => enviar('/autenticacion/salida', {}),
  listarUsuarios: () => obtener('/usuarios'),
  crearUsuario: (datos) => enviar('/usuarios', datos),

  // Modulo M2
  listarClientes: (busqueda = '') => obtener(`/clientes${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ''}`),
  verCliente: (id) => obtener(`/clientes/${id}`),
  crearCliente: (datos) => enviar('/clientes', datos),
  actualizarCliente: (id, datos) => reemplazar(`/clientes/${id}`, datos),

  listarVehiculos: (busqueda = '') => obtener(`/vehiculos${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ''}`),
  verVehiculo: (id) => obtener(`/vehiculos/${id}`),
  crearVehiculo: (datos) => enviar('/vehiculos', datos),
  actualizarVehiculo: (id, datos) => reemplazar(`/vehiculos/${id}`, datos),
  historialVehiculo: (id) => obtener(`/vehiculos/${id}/historial`),

  // Modulos M3, M5 y M6
  listarOrdenes: (estado = '') => obtener(`/ordenes${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`),
  verOrden: (id) => obtener(`/ordenes/${id}`),
  crearOrden: (datos) => enviar('/ordenes', datos, AMPLIO),
  cambiarEstado: (id, nombreEstado, comentario) => modificar(`/ordenes/${id}/estado`, { nombreEstado, comentario }),
  marcarTarea: (idOrden, idDetalle, completada) => modificar(`/ordenes/${idOrden}/tareas/${idDetalle}`, { completada }),
  agregarFotografia: (idOrden, fotografia, etapa, descripcion) =>
    enviar(`/ordenes/${idOrden}/fotografias`, { fotografia, etapa, descripcion }, AMPLIO),

  // Modulo M4
  categorias: () => obtener('/diagnostico/categorias'),

  // Modulo M8
  consultarPorCodigo: (codigo) => obtener(`/consulta/${encodeURIComponent(codigo)}`),
};
