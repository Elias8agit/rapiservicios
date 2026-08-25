/**
 * MODULO M8 - CONSULTA DEL CLIENTE.
 *
 * El cliente del taller consulta el avance de la reparacion con el codigo que
 * recibe al momento del ingreso. La pantalla opera sin cuenta de acceso.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { Aviso, Boton, Campo } from '../componentes/Comunes';
import { COLORES, ESPACIO, estilos } from '../tema';

export default function ConsultaCliente() {
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  async function consultar() {
    setError('');
    setResultado(null);
    if (codigo.trim().length < 6) {
      setError('El codigo requiere al menos seis caracteres.');
      return;
    }
    setOcupado(true);
    try {
      setResultado(await api.consultarPorCodigo(codigo.trim().toUpperCase()));
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.titulo}>Estado de la reparacion</Text>
        <Text style={estilos.subtitulo}>
          Escribir el codigo que entrego el taller al momento de recibir el vehiculo.
        </Text>

        <Campo
          etiqueta="Codigo de consulta"
          value={codigo}
          onChangeText={(texto) => setCodigo(texto.toUpperCase())}
          placeholder="RSABCDEF"
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Aviso mensaje={error} />

        <Boton titulo="Consultar" alPresionar={consultar} ocupado={ocupado} />

        {resultado ? (
          <View style={{ marginTop: ESPACIO.lg }}>
            <View style={estilos.tarjeta}>
              <Text style={estilos.tarjetaTitulo}>{resultado.vehiculo}</Text>
              <Text style={estilos.tarjetaDetalle}>Placa {resultado.placa}</Text>
              <Text
                style={{
                  marginTop: ESPACIO.md,
                  fontSize: 20,
                  fontWeight: '700',
                  color: COLORES.acento,
                }}
              >
                {resultado.estado}
              </Text>
              <Text style={estilos.tarjetaDetalle}>Etapa {resultado.etapa}</Text>
            </View>

            <View style={estilos.tarjeta}>
              <View style={estilos.fila}>
                <Text style={estilos.tarjetaTitulo}>Avance de revisiones</Text>
                <Text style={{ color: COLORES.primario, fontWeight: '700' }}>{resultado.avance.porcentaje} %</Text>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: COLORES.borde,
                  borderRadius: 4,
                  marginTop: ESPACIO.sm,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${resultado.avance.porcentaje}%`,
                    height: 8,
                    backgroundColor: COLORES.exito,
                  }}
                />
              </View>
              {resultado.revisiones.map((r, indice) => (
                <View key={indice} style={{ flexDirection: 'row', alignItems: 'center', marginTop: ESPACIO.sm }}>
                  <Ionicons
                    name={r.completada ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={r.completada ? COLORES.exito : COLORES.textoSuave}
                  />
                  <Text style={{ marginLeft: 8, color: COLORES.texto, fontSize: 13, flex: 1 }}>{r.nombre}</Text>
                </View>
              ))}
              {resultado.tiempoEstimadoMin ? (
                <Text style={[estilos.tarjetaDetalle, { marginTop: ESPACIO.md }]}>
                  Tiempo estimado de atencion: {resultado.tiempoEstimadoMin} minutos
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
