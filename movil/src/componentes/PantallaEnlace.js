/**
 * PANTALLA DE ENLACE CON EL SERVIDOR DEL TALLER.
 *
 * La capa gratuita del proveedor de alojamiento suspende el servicio despues
 * de quince minutos sin peticiones, de modo que la primera consulta del dia
 * espera el arranque del proceso. Esa espera llega cerca del minuto.
 *
 * Un indicador mudo durante un minuto se interpreta como una aplicacion
 * trabada y lleva al mecanico a cerrarla y abrirla varias veces. Esta pantalla
 * nombra la espera, muestra los segundos transcurridos y explica el motivo
 * despues del octavo segundo, cuando la demora deja de resultar ordinaria.
 */

import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';

import { Boton } from './Comunes';
import { COLORES, ESPACIO } from '../tema';

const FONDO = '#0A0D10';

const LOGO = require('../../assets/logo-rapiservicios.png');

/** Marco comun de la pantalla, con el logo del taller sobre fondo oscuro. */
function Marco({ children }) {
  return (
    <View style={{ flex: 1, backgroundColor: FONDO, alignItems: 'center', justifyContent: 'center', padding: ESPACIO.lg }}>
      <Image
        source={LOGO}
        style={{ width: '82%', height: 130, marginBottom: ESPACIO.xl }}
        resizeMode="contain"
      />
      {children}
    </View>
  );
}

/**
 * @param {'ENLAZANDO'|'SIN_ENLACE'} estado Situacion del enlace.
 * @param {number} segundos Tiempo transcurrido dentro del intento en curso.
 * @param {Function} alReintentar Repite el intento de enlace.
 */
export default function PantallaEnlace({ estado, segundos = 0, alReintentar }) {
  if (estado === 'SIN_ENLACE') {
    return (
      <Marco>
        <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' }}>
          Sin comunicacion con el servidor del taller
        </Text>
        <Text
          style={{
            color: '#9AA7B4',
            fontSize: 13,
            textAlign: 'center',
            marginTop: ESPACIO.sm,
            lineHeight: 19,
          }}
        >
          Conviene verificar que el telefono conserve conexion a internet. Cuando la señal resulte
          estable, el enlace se restablece con el boton de abajo.
        </Text>
        <View style={{ width: '100%' }}>
          <Boton titulo="Reintentar el enlace" alPresionar={alReintentar} variante="acento" />
        </View>
      </Marco>
    );
  }

  const demorado = segundos >= 8;

  return (
    <Marco>
      <ActivityIndicator size="large" color={COLORES.acento} />
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: ESPACIO.md }}>
        {demorado ? 'Encendiendo el servidor del taller' : 'Enlazando con el servidor del taller'}
      </Text>

      {demorado ? (
        <>
          <Text
            style={{
              color: '#9AA7B4',
              fontSize: 13,
              textAlign: 'center',
              marginTop: ESPACIO.sm,
              lineHeight: 19,
            }}
          >
            El servidor entra en reposo cuando pasa un rato sin uso. El primer ingreso del dia
            aguarda cerca de un minuto mientras arranca. Los siguientes responden de inmediato.
          </Text>
          <Text style={{ color: COLORES.acento, fontSize: 13, fontWeight: '700', marginTop: ESPACIO.md }}>
            {segundos} segundos
          </Text>
        </>
      ) : null}
    </Marco>
  );
}
