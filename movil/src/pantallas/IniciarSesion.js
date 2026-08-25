/**
 * MODULO M1 - PANTALLA DE INICIO DE SESION.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Aviso, Boton, Campo } from '../componentes/Comunes';
import { useSesion } from '../contexto/Sesion';
import { COLORES, ESPACIO, estilos } from '../tema';
import { NOMBRE_TALLER, URL_API } from '../../configuracion';

export default function IniciarSesion({ navigation }) {
  const { ingresar } = useSesion();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function alIngresar() {
    setError('');
    if (!correo.trim() || !contrasena) {
      setError('El correo y la contrasena resultan obligatorios.');
      return;
    }
    setOcupado(true);
    try {
      await ingresar(correo.trim(), contrasena);
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: ESPACIO.lg, paddingTop: 72 }}>
        <View style={{ alignItems: 'center', marginBottom: ESPACIO.xl }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 20,
              backgroundColor: COLORES.primario,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: ESPACIO.md,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '800' }}>RS</Text>
          </View>
          <Text style={estilos.titulo}>Taller {NOMBRE_TALLER}</Text>
          <Text style={estilos.subtitulo}>Ordenes de trabajo y diagnostico asistido</Text>
        </View>

        <Campo
          etiqueta="Correo"
          value={correo}
          onChangeText={setCorreo}
          placeholder="correo@rapiservicios.gt"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <Campo
          etiqueta="Contrasena"
          value={contrasena}
          onChangeText={setContrasena}
          placeholder="Contrasena de acceso"
          secureTextEntry
        />

        <Aviso mensaje={error} />

        <Boton titulo="Ingresar" alPresionar={alIngresar} ocupado={ocupado} />

        <TouchableOpacity
          style={{ marginTop: ESPACIO.lg, alignItems: 'center' }}
          onPress={() => navigation.navigate('ConsultaCliente')}
        >
          <Text style={{ color: COLORES.primario, fontSize: 14, fontWeight: '600' }}>
            Consultar el estado de una orden
          </Text>
        </TouchableOpacity>

        <Text style={{ marginTop: ESPACIO.xl, fontSize: 11, color: COLORES.textoSuave, textAlign: 'center' }}>
          Servidor: {URL_API}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
