/**
 * SISTEMA VISUAL DE LA APLICACION.
 *
 * Resuelve tres asuntos: la paleta segun el modo elegido, la persistencia de
 * esa eleccion dentro del dispositivo, y los estilos derivados de la paleta.
 *
 * MODOS
 *
 *   claro     Fondo claro. Corresponde al patio del taller, donde el mecanico
 *             consulta el telefono bajo luz directa.
 *   oscuro    Fondo oscuro. Corresponde a la oficina y a la consulta nocturna.
 *   sistema   Sigue la preferencia del telefono y cambia con ella.
 *
 * El modo predeterminado es 'sistema', de manera que la aplicacion respeta lo
 * que la persona ya configuro en su telefono sin obligarla a decidir de nuevo.
 *
 * IDENTIDAD
 *
 * La paleta procede del logo del taller: negro grafito, plata y rojo. El rojo
 * queda reservado para la accion principal de cada pantalla y para las marcas
 * de identidad. El estado de error no se distingue unicamente por el color,
 * porque el rojo tambien pertenece a la marca: lleva ademas fondo tenue, borde
 * propio e icono, de modo que se reconoce sin depender del tono.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LLAVE_MODO = 'rapiservicios.tema';

export const ESPACIO = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const RADIO = { sm: 8, md: 12, lg: 16, completo: 999 };

/** Paleta del modo claro. */
const PALETA_CLARA = {
  esquema: 'claro',

  fondo: '#F4F6F8',
  superficie: '#FFFFFF',
  superficieAlterna: '#EEF1F4',

  // Grafito del logo. Encabezados, barras y texto principal.
  primario: '#15191E',
  primarioSuave: '#2B333C',

  // Rojo del logo. Accion principal y marcas de identidad.
  acento: '#D32127',
  acentoTenue: '#FDECEC',

  // Plata del logo. Detalles y separadores con caracter.
  plata: '#B9C2CB',

  texto: '#15191E',
  textoSuave: '#5C6874',
  textoInverso: '#FFFFFF',

  // Texto de accion secundaria. Se separa de 'primario' porque ese tono sirve
  // de fondo de encabezado y, sobre fondo oscuro, como texto desaparece.
  enlace: '#15191E',

  borde: '#DFE4E9',
  bordeFuerte: '#C3CBD3',

  exito: '#12703F',
  exitoTenue: '#E6F3EC',
  alerta: '#B3241C',
  alertaTenue: '#FDECEA',
  aviso: '#9A5B00',
  avisoTenue: '#FFF4E3',

  sombra: '#0B0F14',
};

/** Paleta del modo oscuro. */
const PALETA_OSCURA = {
  esquema: 'oscuro',

  fondo: '#0D1014',
  superficie: '#171C22',
  superficieAlterna: '#1F262E',

  primario: '#080B0E',
  primarioSuave: '#212932',

  acento: '#F04A4F',
  acentoTenue: '#2A1618',

  plata: '#8A949E',

  texto: '#ECEFF3',
  textoSuave: '#98A3AE',
  textoInverso: '#0D1014',

  enlace: '#F04A4F',

  borde: '#262E37',
  bordeFuerte: '#39434E',

  exito: '#3FBE77',
  exitoTenue: '#122A1E',
  alerta: '#FF6B6B',
  alertaTenue: '#2E1618',
  aviso: '#E0A33A',
  avisoTenue: '#2B2113',

  sombra: '#000000',
};

/** Sombra suave, con la intensidad que corresponde a cada esquema. */
function sombraDe(colores, elevacion = 2) {
  const oscuro = colores.esquema === 'oscuro';
  return {
    shadowColor: colores.sombra,
    shadowOpacity: oscuro ? 0.4 : 0.08,
    shadowRadius: elevacion * 3,
    shadowOffset: { width: 0, height: elevacion },
    elevation: elevacion,
  };
}

/** Construye la hoja de estilos que corresponde a una paleta. */
function crearEstilos(c) {
  return StyleSheet.create({
    pantalla: {
      flex: 1,
      backgroundColor: c.fondo,
    },
    contenido: {
      padding: ESPACIO.md,
      paddingBottom: ESPACIO.xl,
    },
    titulo: {
      fontSize: 22,
      fontWeight: '800',
      color: c.texto,
      letterSpacing: -0.3,
      marginBottom: ESPACIO.xs,
    },
    subtitulo: {
      fontSize: 14,
      color: c.textoSuave,
      marginBottom: ESPACIO.md,
      lineHeight: 20,
    },
    tarjeta: {
      backgroundColor: c.superficie,
      borderRadius: RADIO.lg,
      padding: ESPACIO.md,
      marginBottom: ESPACIO.sm,
      borderWidth: 1,
      borderColor: c.borde,
      ...sombraDe(c, 1),
    },
    tarjetaTitulo: {
      fontSize: 16,
      fontWeight: '700',
      color: c.texto,
      letterSpacing: -0.2,
    },
    tarjetaDetalle: {
      fontSize: 13,
      color: c.textoSuave,
      marginTop: 2,
      lineHeight: 18,
    },
    etiqueta: {
      fontSize: 13,
      fontWeight: '700',
      color: c.texto,
      marginBottom: ESPACIO.xs,
      marginTop: ESPACIO.md,
    },
    ayuda: {
      fontSize: 12,
      color: c.textoSuave,
      marginTop: ESPACIO.xs,
      lineHeight: 17,
    },
    campo: {
      backgroundColor: c.superficie,
      borderWidth: 1,
      borderColor: c.borde,
      borderRadius: RADIO.md,
      paddingHorizontal: ESPACIO.md,
      paddingVertical: 13,
      fontSize: 16,
      color: c.texto,
    },
    campoActivo: {
      borderColor: c.acento,
      borderWidth: 2,
      paddingVertical: 12,
    },
    campoInvalido: {
      borderColor: c.alerta,
    },
    campoAmplio: {
      minHeight: 120,
      textAlignVertical: 'top',
      paddingTop: ESPACIO.md,
    },
    boton: {
      backgroundColor: c.acento,
      borderRadius: RADIO.md,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      marginTop: ESPACIO.md,
      ...sombraDe(c, 2),
    },
    botonSecundario: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: c.bordeFuerte,
      shadowOpacity: 0,
      elevation: 0,
    },
    botonNeutro: {
      backgroundColor: c.primario,
    },
    botonInactivo: {
      opacity: 0.45,
    },
    botonTexto: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    botonTextoSecundario: {
      color: c.texto,
    },
    aviso: {
      borderRadius: RADIO.md,
      padding: ESPACIO.md,
      marginTop: ESPACIO.sm,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: ESPACIO.sm,
    },
    avisoError: {
      backgroundColor: c.alertaTenue,
      borderColor: c.alerta,
    },
    avisoExito: {
      backgroundColor: c.exitoTenue,
      borderColor: c.exito,
    },
    avisoAtencion: {
      backgroundColor: c.avisoTenue,
      borderColor: c.aviso,
    },
    vacio: {
      textAlign: 'center',
      color: c.textoSuave,
      marginTop: ESPACIO.xl,
      fontSize: 14,
      lineHeight: 20,
    },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    distintivo: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: RADIO.completo,
      backgroundColor: c.primarioSuave,
    },
    distintivoTexto: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    separador: {
      height: 1,
      backgroundColor: c.borde,
      marginVertical: ESPACIO.md,
    },
  });
}

// --------------------------------------------------------------------------
//  CONTEXTO
// --------------------------------------------------------------------------

const ContextoTema = createContext(null);

const MODOS = ['sistema', 'claro', 'oscuro'];

export function ProveedorTema({ children }) {
  const esquemaTelefono = useColorScheme();
  const [modo, setModo] = useState('sistema');
  const [listo, setListo] = useState(false);

  // Recuperacion de la eleccion resguardada dentro del dispositivo.
  useEffect(() => {
    (async () => {
      try {
        const guardado = await AsyncStorage.getItem(LLAVE_MODO);
        if (guardado && MODOS.includes(guardado)) setModo(guardado);
      } catch (error) {
        // La preferencia visual no resulta indispensable: ante una falla de
        // lectura la aplicacion arranca con el modo del telefono.
      } finally {
        setListo(true);
      }
    })();
  }, []);

  async function cambiarModo(nuevo) {
    if (!MODOS.includes(nuevo)) return;
    setModo(nuevo);
    try {
      await AsyncStorage.setItem(LLAVE_MODO, nuevo);
    } catch (error) {
      // El cambio surte efecto dentro de la sesion aunque no se resguarde.
    }
  }

  const valor = useMemo(() => {
    const esOscuro = modo === 'oscuro' || (modo === 'sistema' && esquemaTelefono === 'dark');
    const colores = esOscuro ? PALETA_OSCURA : PALETA_CLARA;
    return {
      modo,
      esOscuro,
      listo,
      cambiarModo,
      colores,
      COLORES: colores,
      estilos: crearEstilos(colores),
      sombra: (elevacion) => sombraDe(colores, elevacion),
    };
  }, [modo, esquemaTelefono, listo]);

  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

export function useTema() {
  const contexto = useContext(ContextoTema);
  if (!contexto) {
    throw new Error('useTema requiere que la pantalla resida dentro de ProveedorTema.');
  }
  return contexto;
}

/**
 * Paleta clara de referencia, para los pocos lugares que requieren un color
 * fuera del arbol de componentes, como la configuracion de la barra de estado
 * antes de montar el proveedor.
 */
export const COLORES_BASE = PALETA_CLARA;
