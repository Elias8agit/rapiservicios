/**
 * MODULO M2 - ALTA Y MODIFICACION DE CLIENTES.
 *
 * La misma pantalla sirve para registrar a un cliente nuevo y para corregir los
 * datos de uno existente. La distincion la aporta el parametro de navegacion, y
 * el encabezado de la pantalla lo declara para que no quede duda de cual de las
 * dos cosas se esta haciendo.
 *
 * VALIDACION. Las tres condiciones que se comprueban aqui son las mismas que
 * aplica el servidor en la ruta de clientes. Se repiten del lado del telefono
 * por una razon concreta: en el taller la señal es intermitente y una peticion
 * que viaja para regresar con "el telefono requiere al menos ocho digitos"
 * cuesta varios segundos y una espera inutil. El servidor conserva la ultima
 * palabra; esto solo evita el viaje.
 */

import React, { useLayoutEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Texto } from '../componentes/Texto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { Aviso, Boton, Campo } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

/** Correo con la forma minima que admite el servidor. */
const FORMA_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function ClienteFormulario({ navigation, route }) {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();

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

  /**
   * Estado de cada condicion.
   *
   * Se calcula siempre, pero el aviso bajo el campo solo aparece cuando la
   * persona ya escribio algo: senalar un error en un campo todavia vacio
   * reprocha antes de que haya nada que reprochar.
   */
  const revision = useMemo(() => {
    const nombre = nombreCompleto.trim();
    const tel = telefono.trim();
    const cor = correo.trim();

    return {
      nombreCorto: nombre.length > 0 && nombre.length < 3,
      telefonoCorto: tel.length > 0 && tel.length < 8,
      correoInvalido: cor.length > 0 && !FORMA_CORREO.test(cor),
      completo: nombre.length >= 3 && tel.length >= 8 && (cor.length === 0 || FORMA_CORREO.test(cor)),
    };
  }, [nombreCompleto, telefono, correo]);

  async function guardar() {
    setError('');
    setExito('');
    setOcupado(true);
    try {
      const datos = {
        nombreCompleto: nombreCompleto.trim(),
        telefono: telefono.trim(),
        correo: correo.trim(),
      };

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
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: ESPACIO.xl + margenes.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Contexto de la pantalla. Al modificar, deja a la vista sobre quien
            se esta trabajando: la lista de clientes queda atras y el nombre
            del encabezado nativo no alcanza para distinguirlo. */}
        {esModificacion ? (
          <View
            style={[
              estilos.tarjeta,
              { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm, marginBottom: ESPACIO.md },
            ]}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: RADIO.sm,
                backgroundColor: colores.superficieAlterna,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person" size={18} color={colores.textoSuave} />
            </View>
            <View style={{ flex: 1 }}>
              <Texto style={{ fontSize: 11, color: colores.textoSuave, letterSpacing: 0.5, fontWeight: '700' }}>
                FICHA EN MODIFICACION
              </Texto>
              <Texto style={{ fontSize: 15, fontWeight: '700', color: colores.texto }} numberOfLines={1}>
                {cliente.nombre_completo}
              </Texto>
            </View>
          </View>
        ) : (
          <Texto style={estilos.subtitulo}>
            Con el cliente registrado, sus vehiculos quedan asociados a el y el historial de cada uno
            se consulta por separado.
          </Texto>
        )}

        <Campo
          etiqueta="Nombre completo"
          value={nombreCompleto}
          onChangeText={setNombreCompleto}
          placeholder="Nombre y apellido del cliente"
          icono="person-outline"
          invalido={revision.nombreCorto}
          ayuda={
            revision.nombreCorto
              ? 'El nombre requiere al menos tres caracteres.'
              : 'Como el taller lo nombra. Sirve para ubicarlo en la busqueda.'
          }
        />

        <Campo
          etiqueta="Telefono"
          value={telefono}
          onChangeText={setTelefono}
          placeholder="00000000"
          keyboardType="phone-pad"
          icono="call-outline"
          invalido={revision.telefonoCorto}
          ayuda={
            revision.telefonoCorto
              ? 'El telefono requiere al menos ocho digitos.'
              : 'Es el medio por el que el taller avisa que el vehiculo quedo listo.'
          }
        />

        <Campo
          etiqueta="Correo (opcional)"
          value={correo}
          onChangeText={setCorreo}
          placeholder="correo@ejemplo.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          icono="mail-outline"
          invalido={revision.correoInvalido}
          ayuda={revision.correoInvalido ? 'El correo carece de un formato valido.' : null}
        />

        <Aviso mensaje={error} />
        <Aviso mensaje={exito} tipo="exito" />

        <Boton
          titulo={esModificacion ? 'Guardar cambios' : 'Registrar cliente'}
          icono={esModificacion ? 'save-outline' : 'person-add-outline'}
          alPresionar={guardar}
          ocupado={ocupado}
          deshabilitado={!revision.completo}
        />
        <Boton titulo="Cancelar" variante="secundario" alPresionar={() => navigation.goBack()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
