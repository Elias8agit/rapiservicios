/**
 * CONTEXTO DE SESION - MODULO M1.
 *
 * Conserva el testigo de acceso y el perfil del usuario dentro del
 * almacenamiento del dispositivo, de manera que el mecanico no repita el
 * inicio de sesion cada vez que abre la aplicacion.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api, despertarServidor, establecerTestigo } from '../api/cliente';

const LLAVE = 'rapiservicios.sesion';

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
      const guardada = await AsyncStorage.getItem(LLAVE);
      if (guardada) {
        const datos = JSON.parse(guardada);
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
            await AsyncStorage.removeItem(LLAVE);
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
    await AsyncStorage.setItem(LLAVE, JSON.stringify(nueva));
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
    await AsyncStorage.removeItem(LLAVE);
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
