/**
 * CONFIGURACION DE LA APLICACION MOVIL.
 *
 * La aplicacion conversa unicamente con el servidor del taller. La direccion
 * del servidor se resuelve de forma automatica a partir de la direccion donde
 * corre el empaquetador de Expo, con lo cual el telefono alcanza la
 * computadora dentro de la misma red inalambrica sin configuracion manual.
 *
 * Cuando el servidor resida en otra maquina o ya se encuentre desplegado en
 * internet, basta con escribir la direccion completa dentro de
 * DIRECCION_MANUAL, por ejemplo 'https://rapiservicios.onrender.com'.
 */

import Constants from 'expo-constants';

const DIRECCION_MANUAL = '';

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
