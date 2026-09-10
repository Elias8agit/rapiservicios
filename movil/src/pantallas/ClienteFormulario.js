/**
 * MODULO M2 - ALTA Y MODIFICACION DE CLIENTES.
 */

import React, { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { api } from '../api/cliente';
import { Aviso, Boton, Campo } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

export default function ClienteFormulario({ navigation, route }) {
  const { colores, estilos } = useTema();
  const cliente = route.params?.cliente || null;
  const esModificacion = Boolean(cliente);

  const [nombreCompleto, setNombreCompleto] = useState(cliente?.nombre_completo || '');
  const [telefono, setTelefono] = useState(cliente?.telefono || '');
  const [correo, setCorreo] = useState(cliente?.correo || '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: esModificacion ? 'Modificar cliente' : 'Cliente nuevo' });
  }, [navigation, esModificacion]);

  async function guardar() {
    setError('');
    setExito('');
    setOcupado(true);
    try {
      const datos = { nombreCompleto, telefono, correo };
      if (esModificacion) {
        await api.actualizarCliente(cliente.id_cliente, datos);
        setExito('El cliente quedo actualizado.');
      } else {
        await api.crearCliente(datos);
        setExito('El cliente quedo registrado.');
      }
      setTimeout(() => navigation.goBack(), 700);
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Campo
          etiqueta="Nombre completo"
          value={nombreCompleto}
          onChangeText={setNombreCompleto}
          placeholder="Nombre y apellido del cliente"
        />
        <Campo
          etiqueta="Telefono"
          value={telefono}
          onChangeText={setTelefono}
          placeholder="00000000"
          keyboardType="phone-pad"
        />
        <Campo
          etiqueta="Correo (opcional)"
          value={correo}
          onChangeText={setCorreo}
          placeholder="correo@ejemplo.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Aviso mensaje={error} />
        <Aviso mensaje={exito} tipo="exito" />

        <Boton titulo={esModificacion ? 'Guardar cambios' : 'Registrar cliente'} alPresionar={guardar} ocupado={ocupado} />
        <Boton titulo="Cancelar" variante="secundario" alPresionar={() => navigation.goBack()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
