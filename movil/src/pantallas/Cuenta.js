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
import { Aviso, AvisoConReintento, Boton, Campo, Distintivo, SelectorSegmentado } from '../componentes/Comunes';
import { useSesion } from '../contexto/Sesion';
import { ESPACIO, RADIO, useTema } from '../tema';

export default function Cuenta() {
  const { colores, estilos, modo, cambiarModo } = useTema();
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
          <Ionicons name="person-circle-outline" size={64} color={colores.primario} />
          <Text style={[estilos.tarjetaTitulo, { marginTop: ESPACIO.sm }]}>{usuario?.nombre}</Text>
          <Text style={estilos.tarjetaDetalle}>{usuario?.correo}</Text>
          <View style={{ marginTop: ESPACIO.sm }}>
            <Distintivo texto={usuario?.rol} color={colores.acento} />
          </View>
        </View>
      </View>

      {esPropietario ? (
        <View style={estilos.tarjeta}>
          <Text style={estilos.tarjetaTitulo}>Personal del taller</Text>
          {personal.map((p) => (
            <View key={p.id_usuario} style={{ marginTop: ESPACIO.sm }}>
              <View style={estilos.fila}>
                <Text style={{ color: colores.texto, fontSize: 14 }}>{p.nombre_completo}</Text>
                <Distintivo
                  texto={p.rol?.nombre_rol}
                  color={p.rol?.nombre_rol === 'PROPIETARIO' ? colores.primario : colores.primarioSuave}
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

      {/* Apariencia. El taller trabaja al patio y a la oficina, con luz muy
          distinta en cada sitio, de modo que la eleccion corresponde a quien
          usa el telefono y no a una preferencia fijada de antemano. */}
      <View style={estilos.tarjeta}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm }}>
          <Ionicons name="color-palette-outline" size={20} color={colores.acento} />
          <Text style={estilos.tarjetaTitulo}>Apariencia</Text>
        </View>
        <Text style={[estilos.tarjetaDetalle, { marginBottom: ESPACIO.md }]}>
          El modo claro se lee mejor bajo el sol del patio. El oscuro cansa menos la vista de
          noche y dentro de la oficina.
        </Text>
        <SelectorSegmentado
          valor={modo}
          alCambiar={cambiarModo}
          opciones={[
            { valor: 'claro', texto: 'Claro', icono: 'sunny-outline' },
            { valor: 'oscuro', texto: 'Oscuro', icono: 'moon-outline' },
            { valor: 'sistema', texto: 'Telefono', icono: 'phone-portrait-outline' },
          ]}
        />
      </View>

      <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />
      <Aviso mensaje={exito} tipo="exito" />

      <Boton titulo="Cerrar sesion" alPresionar={salir} variante="secundario" icono="log-out-outline" />
    </ScrollView>
  );
}
