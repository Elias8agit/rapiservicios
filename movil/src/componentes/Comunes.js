/**
 * Componentes visuales compartidos por las pantallas.
 */

import React from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { COLORES, estilos } from '../tema';

/** Boton principal con estado de espera. */
export function Boton({ titulo, alPresionar, ocupado = false, variante = 'principal', deshabilitado = false }) {
  const inactivo = ocupado || deshabilitado;
  const estilosBoton = [
    estilos.boton,
    variante === 'secundario' && estilos.botonSecundario,
    variante === 'acento' && estilos.botonAcento,
    inactivo && estilos.botonInactivo,
  ];

  return (
    <TouchableOpacity style={estilosBoton} onPress={alPresionar} disabled={inactivo} activeOpacity={0.8}>
      {ocupado ? (
        <ActivityIndicator color={variante === 'secundario' ? COLORES.primario : '#FFFFFF'} />
      ) : (
        <Text style={[estilos.botonTexto, variante === 'secundario' && estilos.botonTextoSecundario]}>
          {titulo}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/** Campo de captura con etiqueta. */
export function Campo({ etiqueta, amplio = false, ...propiedades }) {
  return (
    <View>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        style={[estilos.campo, amplio && estilos.campoAmplio]}
        placeholderTextColor={COLORES.textoSuave}
        multiline={amplio}
        {...propiedades}
      />
    </View>
  );
}

/** Aviso de error o de confirmacion. */
export function Aviso({ mensaje, tipo = 'error' }) {
  if (!mensaje) return null;
  return (
    <View style={[estilos.aviso, tipo === 'error' ? estilos.avisoError : estilos.avisoExito]}>
      <Text style={{ color: tipo === 'error' ? COLORES.alerta : COLORES.exito, fontSize: 13 }}>
        {mensaje}
      </Text>
    </View>
  );
}

/**
 * Aviso de falla con accion de reintento.
 * Se emplea dentro de las pantallas que dependen de una consulta al servidor,
 * de manera que una interrupcion de la señal no obligue a salir de la pantalla.
 */
export function AvisoConReintento({ error, alReintentar, ocupado = false }) {
  if (!error) return null;

  const recuperable = error.recuperable !== false;

  return (
    <View style={[estilos.aviso, estilos.avisoError]}>
      <Text style={{ color: COLORES.alerta, fontSize: 13 }}>{error.message}</Text>

      {error.direccion ? (
        <Text style={{ color: COLORES.textoSuave, fontSize: 11, marginTop: 6 }}>
          Direccion consultada: {error.direccion}
        </Text>
      ) : null}

      {recuperable && alReintentar ? (
        <TouchableOpacity
          style={{
            marginTop: 12,
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORES.alerta,
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
          onPress={alReintentar}
          disabled={ocupado}
          activeOpacity={0.7}
        >
          {ocupado ? (
            <ActivityIndicator color={COLORES.alerta} size="small" />
          ) : (
            <Text style={{ color: COLORES.alerta, fontSize: 13, fontWeight: '700' }}>Reintentar</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Indicador de carga centrado. */
export function Cargando({ texto = 'Consultando...' }) {
  return (
    <View style={{ paddingVertical: 32, alignItems: 'center' }}>
      <ActivityIndicator color={COLORES.primario} size="large" />
      <Text style={{ marginTop: 8, color: COLORES.textoSuave, fontSize: 13 }}>{texto}</Text>
    </View>
  );
}

/** Distintivo de estado. */
export function Distintivo({ texto, color = COLORES.primarioClaro }) {
  return (
    <View style={[estilos.distintivo, { backgroundColor: color }]}>
      <Text style={estilos.distintivoTexto}>{texto}</Text>
    </View>
  );
}
