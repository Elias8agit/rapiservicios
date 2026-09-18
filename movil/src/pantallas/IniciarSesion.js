/**
 * MODULO M1 - PANTALLA DE INICIO DE SESION.
 */

import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Texto } from '../componentes/Texto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Aviso, Boton, Campo } from '../componentes/Comunes';
import { useSesion } from '../contexto/Sesion';
import { ESPACIO, RADIO, useTema } from '../tema';
import { NOMBRE_TALLER, URL_API } from '../../configuracion';

const LOGO = require('../../assets/logo-rapiservicios.png');

export default function IniciarSesion({ navigation }) {
  const { colores, estilos } = useTema();
  const { ingresar } = useSesion();

  // Esta pantalla prescinde de encabezado, de modo que nadie reserva por ella
  // el margen de la barra de estado ni el de los botones de navegacion. Los
  // pide al sistema y los aplica al contenido desplazable. El valor varia entre
  // un telefono con muesca, uno sin ella y una tableta, y por eso se consulta
  // en lugar de fijarse.
  const margenes = useSafeAreaInsets();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [ayudaVisible, setAyudaVisible] = useState(false);

  async function alIngresar() {
    setError('');
    if (!correo.trim() || !contrasena) {
      setError('Falta el correo o la contrasena.');
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
      <ScrollView
        contentContainerStyle={{
          padding: ESPACIO.lg,
          paddingTop: margenes.top + ESPACIO.lg,
          paddingBottom: margenes.bottom + ESPACIO.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identidad del taller. El logo vive sobre negro, de modo que el
            recuadro conserva ese fondo en ambos modos. */}
        <View style={{ alignItems: 'center', marginBottom: ESPACIO.lg }}>
          <View
            style={{
              backgroundColor: '#0A0D10',
              borderRadius: RADIO.lg,
              paddingHorizontal: ESPACIO.lg,
              paddingVertical: ESPACIO.md,
              width: '100%',
            }}
          >
            <Image source={LOGO} style={{ width: '100%', height: 92 }} resizeMode="contain" />
          </View>
          <Texto style={[estilos.subtitulo, { marginTop: ESPACIO.md, marginBottom: 0, textAlign: 'center' }]}>
            Ordenes de trabajo y diagnostico asistido
          </Texto>
        </View>

        <Campo
          etiqueta="Correo"
          value={correo}
          onChangeText={setCorreo}
          placeholder="correo@rapiservicios.gt"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          icono="mail-outline"
        />

        <Campo
          etiqueta="Contrasena"
          value={contrasena}
          onChangeText={setContrasena}
          placeholder="Contrasena de acceso"
          secreto
          icono="lock-closed-outline"
          onSubmitEditing={alIngresar}
          returnKeyType="go"
        />

        <Pressable
          onPress={() => setAyudaVisible((previo) => !previo)}
          hitSlop={8}
          style={{ alignSelf: 'flex-end', marginTop: ESPACIO.sm, flexDirection: 'row', gap: 5 }}
        >
          <Ionicons name="help-circle-outline" size={16} color={colores.enlace} />
          <Texto style={{ color: colores.enlace, fontSize: 13, fontWeight: '600' }}>
            Olvide mi contrasena
          </Texto>
        </Pressable>

        {ayudaVisible ? (
          <View style={[estilos.aviso, estilos.avisoAtencion]}>
            <Ionicons name="information-circle" size={19} color={colores.aviso} />
            <Texto style={{ color: colores.aviso, fontSize: 13, flex: 1, lineHeight: 18 }}>
              El propietario del taller restablece la contrasena desde la pestaña Cuenta de su
              propio telefono. Las cuentas pertenecen al taller y no dependen de un correo
              personal, de modo que el restablecimiento ocurre dentro del negocio.
            </Texto>
          </View>
        ) : null}

        <Aviso mensaje={error} />

        <Boton titulo="Ingresar" alPresionar={alIngresar} ocupado={ocupado} icono="log-in-outline" />

        <Boton
          titulo="Consultar el estado de una orden"
          variante="secundario"
          icono="search-outline"
          alPresionar={() => navigation.navigate('ConsultaCliente')}
        />

        <Texto
          style={{
            marginTop: ESPACIO.xl,
            fontSize: 11,
            color: colores.textoSuave,
            textAlign: 'center',
          }}
        >
          Servidor: {URL_API}
        </Texto>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
