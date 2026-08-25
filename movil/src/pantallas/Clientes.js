/**
 * MODULO M2 - LISTADO DE CLIENTES.
 */

import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { AvisoConReintento, Cargando } from '../componentes/Comunes';
import { COLORES, ESPACIO, estilos } from '../tema';

export default function Clientes({ navigation }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintentando, setReintentando] = useState(false);

  const consultar = useCallback(async (texto = '') => {
    setError(null);
    try {
      const datos = await api.listarClientes(texto);
      setClientes(datos.clientes);
    } catch (falla) {
      setError(falla);
    } finally {
      setCargando(false);
      setReintentando(false);
    }
  }, []);

  async function reintentar() {
    setReintentando(true);
    await consultar(busqueda);
  }

  useFocusEffect(
    useCallback(() => {
      consultar(busqueda);
    }, [consultar, busqueda])
  );

  return (
    <View style={estilos.pantalla}>
      <View style={{ padding: ESPACIO.md, paddingBottom: ESPACIO.sm }}>
        <TextInput
          style={estilos.campo}
          placeholder="Buscar por nombre o telefono"
          placeholderTextColor={COLORES.textoSuave}
          value={busqueda}
          onChangeText={setBusqueda}
          onSubmitEditing={() => consultar(busqueda)}
          returnKeyType="search"
        />
        <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />
      </View>

      {cargando ? (
        <Cargando texto="Consultando clientes..." />
      ) : (
        <FlatList
          data={clientes}
          keyExtractor={(item) => String(item.id_cliente)}
          contentContainerStyle={{ paddingHorizontal: ESPACIO.md, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => consultar(busqueda)} />}
          ListEmptyComponent={<Text style={estilos.vacio}>Sin clientes registrados todavia.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={estilos.tarjeta}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ClienteFormulario', { cliente: item })}
            >
              <Text style={estilos.tarjetaTitulo}>{item.nombre_completo}</Text>
              <Text style={estilos.tarjetaDetalle}>Telefono {item.telefono}</Text>
              {item.correo ? <Text style={estilos.tarjetaDetalle}>{item.correo}</Text> : null}
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={{
          position: 'absolute',
          right: ESPACIO.lg,
          bottom: ESPACIO.lg,
          backgroundColor: COLORES.acento,
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
        }}
        onPress={() => navigation.navigate('ClienteFormulario', {})}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
