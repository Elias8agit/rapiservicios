/**
 * MODULO M1 - CUENTA Y ADMINISTRACION DEL PERSONAL.
 *
 * Presenta el perfil de la sesion activa. Cuando el rol corresponde al
 * propietario del taller, la pantalla habilita el alta del personal operativo.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { Aviso, AvisoConReintento, Boton, Campo, Distintivo } from '../componentes/Comunes';
import { useSesion } from '../contexto/Sesion';
import { COLORES, ESPACIO, estilos } from '../tema';

export default function Cuenta() {
  const { usuario, esPropietario, salir } = useSesion();

  const [personal, setPersonal] = useState([]);
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState('');
  const [reintentando, setReintentando] = useState(false);

  const consultarPersonal = useCallback(async () => {
    if (!esPropietario) return;
    setError(null);
    try {
      const datos = await api.listarUsuarios();
      setPersonal(datos.usuarios);
    } catch (falla) {
      setError(falla);
    } finally {
      setReintentando(false);
    }
  }, [esPropietario]);

  async function reintentar() {
    setReintentando(true);
    await consultarPersonal();
  }

  useFocusEffect(
    useCallback(() => {
      consultarPersonal();
    }, [consultarPersonal])
  );

  async function registrarMecanico() {
    setError(null);
    setExito('');
    setOcupado(true);
    try {
      await api.crearUsuario({ nombreCompleto, correo, telefono, contrasena, rol: 'MECANICO' });
      setExito(`El mecanico ${nombreCompleto} quedo registrado.`);
      setNombreCompleto('');
      setCorreo('');
      setTelefono('');
      setContrasena('');
      setFormularioVisible(false);
      consultarPersonal();
    } catch (falla) {
      setError(falla);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <View style={estilos.tarjeta}>
        <View style={{ alignItems: 'center', paddingVertical: ESPACIO.md }}>
          <Ionicons name="person-circle-outline" size={64} color={COLORES.primario} />
          <Text style={[estilos.tarjetaTitulo, { marginTop: ESPACIO.sm }]}>{usuario?.nombre}</Text>
          <Text style={estilos.tarjetaDetalle}>{usuario?.correo}</Text>
          <View style={{ marginTop: ESPACIO.sm }}>
            <Distintivo texto={usuario?.rol} color={COLORES.acento} />
          </View>
        </View>
      </View>

      {esPropietario ? (
        <View style={estilos.tarjeta}>
          <Text style={estilos.tarjetaTitulo}>Personal del taller</Text>
          {personal.map((p) => (
            <View key={p.id_usuario} style={{ marginTop: ESPACIO.sm }}>
              <View style={estilos.fila}>
                <Text style={{ color: COLORES.texto, fontSize: 14 }}>{p.nombre_completo}</Text>
                <Distintivo
                  texto={p.rol?.nombre_rol}
                  color={p.rol?.nombre_rol === 'PROPIETARIO' ? COLORES.primario : COLORES.primarioClaro}
                />
              </View>
              <Text style={estilos.tarjetaDetalle}>
                {p.correo}
                {p.activo ? '' : ' · inactivo'}
              </Text>
            </View>
          ))}

          {formularioVisible ? (
            <View style={{ marginTop: ESPACIO.md }}>
              <Campo etiqueta="Nombre completo" value={nombreCompleto} onChangeText={setNombreCompleto} />
              <Campo
                etiqueta="Correo"
                value={correo}
                onChangeText={setCorreo}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Campo etiqueta="Telefono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
              <Campo
                etiqueta="Contrasena (minimo ocho caracteres)"
                value={contrasena}
                onChangeText={setContrasena}
                secureTextEntry
              />
              <Boton titulo="Registrar mecanico" alPresionar={registrarMecanico} ocupado={ocupado} />
              <Boton titulo="Cancelar" variante="secundario" alPresionar={() => setFormularioVisible(false)} />
            </View>
          ) : (
            <Boton titulo="Agregar mecanico" variante="secundario" alPresionar={() => setFormularioVisible(true)} />
          )}
        </View>
      ) : null}

      <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />
      <Aviso mensaje={exito} tipo="exito" />

      <Boton titulo="Cerrar sesion" alPresionar={salir} variante="acento" />
    </ScrollView>
  );
}
