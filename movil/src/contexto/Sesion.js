/**
 * CONTEXTO DE SESION - MODULO M1.
 *
 * Conserva el testigo de acceso y el perfil del usuario dentro del
 * almacenamiento del dispositivo, de manera que el mecanico no repita el
 * inicio de sesion cada vez que abre la aplicacion.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api, establecerTestigo } from '../api/cliente';

const LLAVE = 'rapiservicios.sesion';

const ContextoSesion = createContext(null);

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Recuperacion de la sesion resguardada dentro del dispositivo.
  useEffect(() => {
    (async () => {
      try {
        const guardada = await AsyncStorage.getItem(LLAVE);
        if (guardada) {
          const datos = JSON.parse(guardada);
          establecerTestigo(datos.testigo);
          // El servidor confirma que el testigo conserva validez.
          try {
            const { usuario } = await api.perfil();
            setSesion({ ...datos, usuario });
          } catch (error) {
            await AsyncStorage.removeItem(LLAVE);
            establecerTestigo(null);
          }
        }
      } finally {
        setCargando(false);
      }
    })();
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
      ingresar,
      salir,
      usuario: sesion?.usuario || null,
      esPropietario: sesion?.usuario?.rol === 'PROPIETARIO',
    }),
    [sesion, cargando]
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
