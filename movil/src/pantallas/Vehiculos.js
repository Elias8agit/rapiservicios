/**
 * MODULO M2 - LISTADO DE VEHICULOS.
 */

import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { AvisoConReintento, Cargando, Distintivo } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

export default function Vehiculos({ navigation }) {
  const { colores, estilos, sombra } = useTema();
  const margenes = useSafeAreaInsets();
  const [vehiculos, setVehiculos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintentando, setReintentando] = useState(false);

  const consultar = useCallback(async (texto = '') => {
    setError(null);
    try {
      const datos = await api.listarVehiculos(texto);
      setVehiculos(datos.vehiculos);
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
          placeholder="Buscar por placa, marca o linea"
          placeholderTextColor={colores.textoSuave}
          value={busqueda}
          onChangeText={setBusqueda}
          onSubmitEditing={() => consultar(busqueda)}
          returnKeyType="search"
          autoCapitalize="characters"
        />
        <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />
      </View>

      {cargando ? (
        <Cargando texto="Consultando vehiculos..." />
      ) : (
        <FlatList
          data={vehiculos}
          keyExtractor={(item) => String(item.id_vehiculo)}
          contentContainerStyle={{ paddingHorizontal: ESPACIO.md, paddingBottom: 110 + margenes.bottom }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => consultar(busqueda)} />}
          ListEmptyComponent={<Text style={estilos.vacio}>Sin vehiculos registrados todavia.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={estilos.tarjeta}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('VehiculoFormulario', { vehiculo: item })}
            >
              <View style={estilos.fila}>
                <Text style={estilos.tarjetaTitulo}>
                  {item.marca} {item.linea}
                </Text>
                <Distintivo texto={item.placa} />
              </View>
              <Text style={estilos.tarjetaDetalle}>
                Modelo {item.modelo_anio}
                {item.color ? ` · ${item.color}` : ''}
                {item.kilometraje !== null ? ` · ${item.kilometraje} km` : ''}
              </Text>
              <Text style={estilos.tarjetaDetalle}>Cliente: {item.cliente?.nombre_completo}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={{
          position: 'absolute',
          right: ESPACIO.lg,
          bottom: ESPACIO.md + margenes.bottom,
          backgroundColor: colores.acento,
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: 'center',
          justifyContent: 'center',
          ...sombra(4),
        }}
        onPress={() => navigation.navigate('VehiculoFormulario', {})}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
