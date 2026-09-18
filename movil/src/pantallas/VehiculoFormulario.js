/**
 * MODULO M2 - ALTA Y MODIFICACION DE VEHICULOS.
 *
 * Cada vehiculo pertenece a un cliente registrado. La seleccion del cliente se
 * resuelve mediante una ventana de busqueda para evitar la captura repetida de
 * los datos del propietario.
 */

import React, { useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { Texto, EntradaTexto } from '../componentes/Texto';

import { api } from '../api/cliente';
import { Aviso, Boton, Campo, Cargando } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

export default function VehiculoFormulario({ navigation, route }) {
  const { colores, estilos } = useTema();
  const vehiculo = route.params?.vehiculo || null;
  const esModificacion = Boolean(vehiculo);

  const [cliente, setCliente] = useState(vehiculo?.cliente || route.params?.cliente || null);
  const [placa, setPlaca] = useState(vehiculo?.placa || '');
  const [marca, setMarca] = useState(vehiculo?.marca || '');
  const [linea, setLinea] = useState(vehiculo?.linea || '');
  const [modeloAnio, setModeloAnio] = useState(vehiculo ? String(vehiculo.modelo_anio) : '');
  const [color, setColor] = useState(vehiculo?.color || '');
  const [kilometraje, setKilometraje] = useState(
    vehiculo?.kilometraje !== null && vehiculo?.kilometraje !== undefined ? String(vehiculo.kilometraje) : ''
  );

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [ventanaVisible, setVentanaVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: esModificacion ? 'Modificar vehiculo' : 'Vehiculo nuevo' });
  }, [navigation, esModificacion]);

  async function guardar() {
    setError('');
    setExito('');

    if (!cliente) {
      setError('El cliente propietario resulta obligatorio.');
      return;
    }

    setOcupado(true);
    try {
      const datos = {
        idCliente: cliente.id_cliente,
        placa,
        marca,
        linea,
        modeloAnio: Number(modeloAnio),
        color,
        kilometraje: kilometraje === '' ? null : Number(kilometraje),
      };

      if (esModificacion) {
        await api.actualizarVehiculo(vehiculo.id_vehiculo, datos);
        setExito('El vehiculo quedo actualizado.');
      } else {
        await api.crearVehiculo(datos);
        setExito('El vehiculo quedo registrado.');
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
        <Texto style={estilos.etiqueta}>Cliente propietario</Texto>
        <TouchableOpacity style={estilos.campo} onPress={() => setVentanaVisible(true)} activeOpacity={0.7}>
          <Texto style={{ color: cliente ? colores.texto : colores.textoSuave, fontSize: 15 }}>
            {cliente ? cliente.nombre_completo : 'Seleccionar cliente'}
          </Texto>
        </TouchableOpacity>

        <Campo
          etiqueta="Placa"
          value={placa}
          onChangeText={(texto) => setPlaca(texto.toUpperCase())}
          placeholder="P123ABC"
          autoCapitalize="characters"
        />
        <Campo etiqueta="Marca" value={marca} onChangeText={setMarca} placeholder="Toyota" />
        <Campo etiqueta="Linea" value={linea} onChangeText={setLinea} placeholder="Corolla" />
        <Campo
          etiqueta="Anio del modelo"
          value={modeloAnio}
          onChangeText={setModeloAnio}
          placeholder="2015"
          keyboardType="number-pad"
        />
        <Campo etiqueta="Color (opcional)" value={color} onChangeText={setColor} placeholder="Blanco" />
        <Campo
          etiqueta="Kilometraje (opcional)"
          value={kilometraje}
          onChangeText={setKilometraje}
          placeholder="85000"
          keyboardType="number-pad"
        />

        <Aviso mensaje={error} />
        <Aviso mensaje={exito} tipo="exito" />

        <Boton titulo={esModificacion ? 'Guardar cambios' : 'Registrar vehiculo'} alPresionar={guardar} ocupado={ocupado} />
        <Boton titulo="Cancelar" variante="secundario" alPresionar={() => navigation.goBack()} />
      </ScrollView>

      <SelectorCliente
        visible={ventanaVisible}
        alCerrar={() => setVentanaVisible(false)}
        alSeleccionar={(elegido) => {
          setCliente(elegido);
          setVentanaVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

/** Ventana de busqueda y seleccion de clientes. */
export function SelectorCliente({ visible, alCerrar, alSeleccionar }) {
  const { colores, estilos } = useTema();
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setCargando(true);
      setError('');
      try {
        const datos = await api.listarClientes(busqueda);
        setClientes(datos.clientes);
      } catch (falla) {
        setError(falla.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [visible, busqueda]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={alCerrar}>
      <View style={[estilos.pantalla, { paddingTop: 56 }]}>
        <View style={{ padding: ESPACIO.md }}>
          <View style={estilos.fila}>
            <Texto style={estilos.titulo}>Seleccionar cliente</Texto>
            <TouchableOpacity onPress={alCerrar}>
              <Texto style={{ color: colores.enlace, fontWeight: '600' }}>Cerrar</Texto>
            </TouchableOpacity>
          </View>
          <EntradaTexto
            style={estilos.campo}
            placeholder="Buscar por nombre o telefono"
            placeholderTextColor={colores.textoSuave}
            value={busqueda}
            onChangeText={setBusqueda}
          />
          <Aviso mensaje={error} />
        </View>

        {cargando ? (
          <Cargando />
        ) : (
          <FlatList
            data={clientes}
            keyExtractor={(item) => String(item.id_cliente)}
            contentContainerStyle={{ paddingHorizontal: ESPACIO.md, paddingBottom: ESPACIO.xl }}
            ListEmptyComponent={<Texto style={estilos.vacio}>Sin coincidencias.</Texto>}
            renderItem={({ item }) => (
              <TouchableOpacity style={estilos.tarjeta} onPress={() => alSeleccionar(item)} activeOpacity={0.7}>
                <Texto style={estilos.tarjetaTitulo}>{item.nombre_completo}</Texto>
                <Texto style={estilos.tarjetaDetalle}>Telefono {item.telefono}</Texto>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
