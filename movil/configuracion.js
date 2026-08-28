/**
 * CONFIGURACION DE LA APLICACION MOVIL.
 *
 * La aplicacion conversa unicamente con el servidor del taller.
 *
 * El servidor reside desde el 28 de agosto de 2026 dentro del proveedor
 * Render, con lo cual el telefono del mecanico alcanza el servicio desde
 * cualquier red y sin la computadora del desarrollador en ejecucion. Esa
 * condicion resulta indispensable para la prueba dentro del taller, donde la
 * red inalambrica pertenece al negocio.
 *
 * Cuando DIRECCION_MANUAL queda vacia, la aplicacion vuelve a resolver la
 * direccion de forma automatica a partir de la maquina donde corre el
 * empaquetador de Expo. Esa via sirve durante el desarrollo contra un servidor
 * local y exige que el telefono comparta la red inalambrica.
 */

import Constants from 'expo-constants';

const DIRECCION_MANUAL = 'https://rapiservicios-api.onrender.com';

const PUERTO_SERVIDOR = 3000;

/** Extrae la direccion de red de la computadora donde corre Expo. */
function resolverDireccion() {
  if (DIRECCION_MANUAL) return DIRECCION_MANUAL.replace(/\/$/, '');

  const anfitrion =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    '';

  const direccionIp = anfitrion.split(':')[0];

  if (direccionIp) return `http://${direccionIp}:${PUERTO_SERVIDOR}`;

  // Direccion de reserva para el emulador de Android.
  return `http://10.0.2.2:${PUERTO_SERVIDOR}`;
}

export const URL_API = `${resolverDireccion()}/api`;

export const NOMBRE_TALLER = 'Rapiservicios';

export const ESTADOS_ORDEN = [
  'RECIBIDO',
  'EN DIAGNOSTICO',
  'EN REPARACION',
  'LISTO',
  'ENTREGADO',
];
