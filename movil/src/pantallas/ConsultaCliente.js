/**
 * MODULO M8 - CONSULTA DEL CLIENTE.
 *
 * El cliente del taller consulta el avance de la reparacion con el codigo que
 * recibe al momento del ingreso. La pantalla opera sin cuenta de acceso.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Texto } from '../componentes/Texto';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { Aviso, Boton, Campo } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

export default function ConsultaCliente() {
  const { colores, estilos } = useTema();
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
        <Texto style={estilos.titulo}>Estado de la reparacion</Texto>
        <Texto style={estilos.subtitulo}>
          Escribir el codigo que entrego el taller al momento de recibir el vehiculo.
        </Texto>

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
              <Texto style={estilos.tarjetaTitulo}>{resultado.vehiculo}</Texto>
              <Texto style={estilos.tarjetaDetalle}>Placa {resultado.placa}</Texto>
              <Texto
                style={{
                  marginTop: ESPACIO.md,
                  fontSize: 20,
                  fontWeight: '700',
                  color: colores.acento,
                }}
              >
                {resultado.estado}
              </Texto>
              <Texto style={estilos.tarjetaDetalle}>Etapa {resultado.etapa}</Texto>
            </View>

            <View style={estilos.tarjeta}>
              <View style={estilos.fila}>
                <Texto style={estilos.tarjetaTitulo}>Avance de revisiones</Texto>
                <Texto style={{ color: colores.enlace, fontWeight: '700' }}>{resultado.avance.porcentaje} %</Texto>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: colores.borde,
                  borderRadius: 4,
                  marginTop: ESPACIO.sm,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${resultado.avance.porcentaje}%`,
                    height: 8,
                    backgroundColor: colores.exito,
                  }}
                />
              </View>
              {resultado.revisiones.map((r, indice) => (
                <View key={indice} style={{ flexDirection: 'row', alignItems: 'center', marginTop: ESPACIO.sm }}>
                  <Ionicons
                    name={r.completada ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={r.completada ? colores.exito : colores.textoSuave}
                  />
                  <Texto style={{ marginLeft: 8, color: colores.texto, fontSize: 13, flex: 1 }}>{r.nombre}</Texto>
                </View>
              ))}
              {/* El numero corresponde al trabajo del mecanico sobre este
                  vehiculo, no al tiempo que falta para la entrega. Presentado
                  sin esa aclaracion, el cliente lo lee como una promesa y
                  llega al taller antes de tiempo. */}
              {resultado.tiempoEstimadoMin ? (
                <View
                  style={{
                    marginTop: ESPACIO.md,
                    paddingTop: ESPACIO.md,
                    borderTopWidth: 1,
                    borderTopColor: colores.borde,
                  }}
                >
                  <Texto style={[estilos.tarjetaDetalle, { fontWeight: '600' }]}>
                    Trabajo de revision estimado: {resultado.tiempoEstimadoMin} minutos
                  </Texto>
                  <Texto style={[estilos.tarjetaDetalle, { marginTop: ESPACIO.xs }]}>
                    Corresponde al tiempo de mano de obra sobre el vehiculo. No incluye la espera
                    por los demas vehiculos en el taller, ni la consecucion de repuestos. La fecha
                    de entrega la confirma el taller.
                  </Texto>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
