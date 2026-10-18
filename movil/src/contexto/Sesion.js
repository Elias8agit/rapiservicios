/**
 * CONTEXTO DE SESION - MODULO M1.
 *
 * Conserva el testigo de acceso y el perfil del usuario dentro del
 * dispositivo, de manera que el mecanico no repita el inicio de sesion cada
 * vez que abre la aplicacion.
 *
 * DONDE SE GUARDA CADA COSA (18 de octubre de 2026)
 *
 *   Testigos de acceso y de renovacion   Almacen cifrado del sistema
 *                                         (expo-secure-store, que en Android
 *                                         usa el Keystore). Son lo que permite
 *                                         actuar en nombre de la persona.
 *   Perfil (nombre, correo, rol)          AsyncStorage, sin cifrar. No es
 *                                         secreto y se muestra en pantalla.
 *
 * Hasta esta fecha todo iba junto en AsyncStorage, que guarda en claro: en un
 * telefono con acceso de administrador se podia leer el testigo y usarlo.
 * Los testigos van en dos llaves separadas porque el almacen cifrado admite
 * valores de hasta unos 2048 bytes y el testigo de acceso por si solo ronda
 * la mitad.
 *
 * Al arrancar, una sesion guardada con el formato anterior se traslada al
 * formato nuevo y la copia en claro se borra, de modo que nadie tiene que
 * volver a iniciar sesion por la actualizacion.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api, despertarServidor, establecerTestigo } from '../api/cliente';

/**
 * Almacen cifrado. Se carga con require dentro de un intento porque una
 * compilacion de desarrollo anterior a este cambio no trae el modulo nativo:
 * sin esta proteccion la aplicacion se cerraria al abrir mientras la
 * compilacion nueva espera en la cola. En ese caso, y solo en ese caso, los
 * testigos siguen en AsyncStorage como antes. El APK final incluye el modulo,
 * porque figura entre las dependencias.
 */
let AlmacenSeguro = null;
try {
  // eslint-disable-next-line global-require
  AlmacenSeguro = require('expo-secure-store');
} catch (error) {
  AlmacenSeguro = null;
}

/** Formato anterior: todo junto y en claro. Solo se lee para trasladarlo. */
const LLAVE_ANTERIOR = 'rapiservicios.sesion';

const LLAVE_TESTIGO = 'rapiservicios.testigo';
const LLAVE_RENOVACION = 'rapiservicios.renovacion';
const LLAVE_PERFIL = 'rapiservicios.perfil';

async function guardarSecreto(llave, valor) {
  if (AlmacenSeguro) {
    if (valor) await AlmacenSeguro.setItemAsync(llave, String(valor));
    else await AlmacenSeguro.deleteItemAsync(llave);
    return;
  }
  if (valor) await AsyncStorage.setItem(llave, String(valor));
  else await AsyncStorage.removeItem(llave);
}

async function leerSecreto(llave) {
  if (AlmacenSeguro) return AlmacenSeguro.getItemAsync(llave);
  return AsyncStorage.getItem(llave);
}

/** Guarda la sesion repartida entre el almacen cifrado y AsyncStorage. */
async function guardarSesion(datos) {
  await guardarSecreto(LLAVE_TESTIGO, datos.testigo);
  await guardarSecreto(LLAVE_RENOVACION, datos.testigoRenovacion);
  await AsyncStorage.setItem(LLAVE_PERFIL, JSON.stringify(datos.usuario || null));
}

/** Borra la sesion de todos los lugares, incluido el formato anterior. */
async function borrarSesion() {
  await guardarSecreto(LLAVE_TESTIGO, null);
  await guardarSecreto(LLAVE_RENOVACION, null);
  await AsyncStorage.multiRemove([LLAVE_PERFIL, LLAVE_ANTERIOR]);
}

/**
 * Recupera la sesion guardada, trasladando antes la del formato anterior si
 * existe. Devuelve null cuando no hay sesion.
 */
async function leerSesion() {
  const anterior = await AsyncStorage.getItem(LLAVE_ANTERIOR);
  if (anterior) {
    try {
      const datos = JSON.parse(anterior);
      await guardarSesion(datos);
    } finally {
      await AsyncStorage.removeItem(LLAVE_ANTERIOR);
    }
  }

  const testigo = await leerSecreto(LLAVE_TESTIGO);
  if (!testigo) return null;

  const testigoRenovacion = await leerSecreto(LLAVE_RENOVACION);
  let usuario = null;
  try {
    usuario = JSON.parse((await AsyncStorage.getItem(LLAVE_PERFIL)) || 'null');
  } catch (error) {
    usuario = null;
  }
  return { testigo, testigoRenovacion, usuario };
}

const ContextoSesion = createContext(null);

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Estado del enlace con el servidor: ENLAZANDO mientras responde la
  // consulta de salud, ENLAZADO cuando el servicio atiende, y SIN_ENLACE
  // cuando el presupuesto se agota sin respuesta.
  const [enlace, setEnlace] = useState('ENLAZANDO');
  const [segundosEspera, setSegundosEspera] = useState(0);
  const [detalleEnlace, setDetalleEnlace] = useState('');

  /**
   * Arranque de la aplicacion.
   *
   * Primero despierta al servidor y despues restablece la sesion resguardada.
   * El orden importa: una consulta de perfil contra un servicio dormido
   * vencería por tiempo y expulsaria al mecanico hacia la pantalla de ingreso
   * aun con la sesion vigente.
   */
  async function arrancar() {
    setEnlace('ENLAZANDO');
    setSegundosEspera(0);
    setDetalleEnlace('');
    setCargando(true);

    try {
      const estadoServidor = await despertarServidor(setSegundosEspera);

      // El servidor responde pero la base de datos no. Ninguna pantalla opera
      // en esa condicion, de modo que la aplicacion lo informa en lugar de
      // dejar que la persona lo descubra al intentar ingresar.
      if (estadoServidor?.estado === 'degradado' || estadoServidor?.baseDatos === 'sin respuesta') {
        setDetalleEnlace(estadoServidor.detalle || '');
        setEnlace('DEGRADADO');
        setCargando(false);
        return;
      }

      setEnlace('ENLAZADO');
    } catch (error) {
      setEnlace('SIN_ENLACE');
      setCargando(false);
      return;
    }

    try {
      const datos = await leerSesion();
      if (datos) {
        establecerTestigo(datos.testigo);
        try {
          const { usuario } = await api.perfil();
          setSesion({ ...datos, usuario });
        } catch (error) {
          // El descarte de la sesion corresponde unicamente al rechazo del
          // testigo por parte del servidor. Un vencimiento por tiempo o una
          // falla de red no acreditan que la sesion perdio validez, y borrarla
          // obligaria al mecanico a escribir la contrasena sin motivo.
          if (error.estado === 401 || error.estado === 403) {
            await borrarSesion();
            establecerTestigo(null);
          } else {
            setSesion(datos);
          }
        }
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    arrancar();
  }, []);

  async function ingresar(correo, contrasena) {
    const datos = await api.ingresar(correo, contrasena);
    const nueva = {
      testigo: datos.testigo,
      testigoRenovacion: datos.testigoRenovacion,
      usuario: datos.usuario,
    };
    establecerTestigo(nueva.testigo);
    await guardarSesion(nueva);
    setSesion(nueva);
    return nueva;
  }

  async function salir() {
    try {
      await api.salir();
    } catch (error) {
      // El cierre local procede aunque el servidor no responda.
    }
    establecerTestigo(null);
    await borrarSesion();
    setSesion(null);
  }

  const valor = useMemo(
    () => ({
      sesion,
      cargando,
      enlace,
      segundosEspera,
      detalleEnlace,
      reintentarEnlace: arrancar,
      ingresar,
      salir,
      usuario: sesion?.usuario || null,
      esPropietario: sesion?.usuario?.rol === 'PROPIETARIO',
    }),
    [sesion, cargando, enlace, segundosEspera, detalleEnlace]
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  const contexto = useContext(ContextoSesion);
  if (!contexto) {
    throw new Error('useSesion requiere que la pantalla resida dentro de ProveedorSesion.');
  }
  return contexto;
}
