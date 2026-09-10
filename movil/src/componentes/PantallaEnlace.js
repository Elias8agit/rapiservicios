/**
 * PANTALLA DE ENLACE CON EL SERVIDOR DEL TALLER.
 *
 * Antecede a cualquier otra pantalla y resuelve tres situaciones:
 *
 *   ENLAZANDO   El servidor de aplicacion despierta. La capa gratuita del
 *               proveedor suspende el servicio tras quince minutos sin
 *               peticiones y la primera consulta del dia espera el arranque
 *               del proceso, cerca de un minuto.
 *   DEGRADADO   El servidor responde pero la base de datos no. Corresponde a
 *               una pausa del proveedor de datos y se resuelve desde su panel,
 *               no desde el telefono ni reintentando.
 *   SIN_ENLACE  El telefono no alcanza al servidor.
 *
 * La distincion importa. Un indicador mudo durante un minuto se interpreta
 * como una aplicacion trabada y lleva a cerrarla y abrirla varias veces; y un
 * mensaje de red equivocado manda a revisar la señal cuando el problema reside
 * en otro lugar.
 *
 * La pantalla conserva el fondo oscuro de la marca en ambos modos: presenta el
 * logo del taller y ese es su cometido.
 */

import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Boton } from './Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

const FONDO = '#0A0D10';
const TEXTO_SUAVE = '#9AA7B4';

const LOGO = require('../../assets/logo-rapiservicios.png');

/** Marco comun de la pantalla, con el logo del taller sobre fondo oscuro. */
function Marco({ children }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: FONDO,
        alignItems: 'center',
        justifyContent: 'center',
        padding: ESPACIO.lg,
      }}
    >
      <Image source={LOGO} style={{ width: '82%', height: 130, marginBottom: ESPACIO.xl }} resizeMode="contain" />
      {children}
    </View>
  );
}

function Titulo({ children }) {
  return (
    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' }}>{children}</Text>
  );
}

function Parrafo({ children }) {
  return (
    <Text
      style={{
        color: TEXTO_SUAVE,
        fontSize: 13,
        textAlign: 'center',
        marginTop: ESPACIO.sm,
        lineHeight: 19,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * @param {'ENLAZANDO'|'DEGRADADO'|'SIN_ENLACE'} estado Situacion del enlace.
 * @param {number} segundos Tiempo transcurrido dentro del intento en curso.
 * @param {string} detalle Mensaje tecnico que devuelve el servidor.
 * @param {Function} alReintentar Repite el intento de enlace.
 */
export default function PantallaEnlace({ estado, segundos = 0, detalle = '', alReintentar }) {
  const { colores } = useTema();

  if (estado === 'DEGRADADO') {
    return (
      <Marco>
        <Ionicons name="server-outline" size={34} color={colores.aviso} />
        <View style={{ height: ESPACIO.md }} />
        <Titulo>La base de datos del taller no responde</Titulo>
        <Parrafo>
          El servidor si atiende, de modo que la señal del telefono se encuentra bien. Lo que no
          contesta es el almacen de datos, y eso se reactiva desde el panel del proveedor.
        </Parrafo>
        {detalle ? (
          <View
            style={{
              marginTop: ESPACIO.md,
              padding: ESPACIO.sm,
              borderRadius: RADIO.sm,
              backgroundColor: '#141A20',
              alignSelf: 'stretch',
            }}
          >
            <Text style={{ color: TEXTO_SUAVE, fontSize: 11 }} numberOfLines={3}>
              {detalle}
            </Text>
          </View>
        ) : null}
        <View style={{ width: '100%' }}>
          <Boton titulo="Volver a comprobar" alPresionar={alReintentar} icono="refresh" />
        </View>
      </Marco>
    );
  }

  if (estado === 'SIN_ENLACE') {
    return (
      <Marco>
        <Ionicons name="cloud-offline-outline" size={34} color={colores.alerta} />
        <View style={{ height: ESPACIO.md }} />
        <Titulo>Sin comunicacion con el servidor del taller</Titulo>
        <Parrafo>
          Conviene verificar que el telefono conserve conexion a internet. Cuando la señal resulte
          estable, el enlace se restablece con el boton de abajo.
        </Parrafo>
        <View style={{ width: '100%' }}>
          <Boton titulo="Reintentar el enlace" alPresionar={alReintentar} icono="refresh" />
        </View>
      </Marco>
    );
  }

  const demorado = segundos >= 8;

  return (
    <Marco>
      <ActivityIndicator size="large" color={colores.acento} />
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: ESPACIO.md }}>
        {demorado ? 'Encendiendo el servidor del taller' : 'Enlazando con el servidor del taller'}
      </Text>

      {demorado ? (
        <>
          <Parrafo>
            El servidor entra en reposo cuando pasa un rato sin uso. El primer ingreso del dia
            aguarda cerca de un minuto mientras arranca. Los siguientes responden de inmediato.
          </Parrafo>
          <Text style={{ color: colores.acento, fontSize: 13, fontWeight: '700', marginTop: ESPACIO.md }}>
            {segundos} segundos
          </Text>
        </>
      ) : null}
    </Marco>
  );
}
