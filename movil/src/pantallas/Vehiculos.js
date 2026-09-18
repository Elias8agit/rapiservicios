/**
 * MODULO M2 - LISTADO DE VEHICULOS.
 */

import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, TouchableOpacity, View } from 'react-native';
import { Texto, EntradaTexto } from '../componentes/Texto';
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
        <EntradaTexto
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
          ListEmptyComponent={<Texto style={estilos.vacio}>Sin vehiculos registrados todavia.</Texto>}
          // Al tocar el vehiculo se abre su historial, no el formulario.
          //
          // Lo que el taller hace con un vehiculo registrado es consultar por
          // que ha venido antes; corregir la placa o el kilometraje ocurre
          // pocas veces y ahora lleva su propio boton con lapiz. Antes el toque
          // abria el formulario, de modo que la consulta mas frecuente no
          // tenia camino y la menos frecuente ocupaba la tarjeta entera.
          renderItem={({ item }) => (
            <TouchableOpacity
              style={estilos.tarjeta}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('HistorialVehiculo', { vehiculo: item })}
            >
              <View style={estilos.fila}>
                <Texto style={estilos.tarjetaTitulo}>
                  {item.marca} {item.linea}
                </Texto>
                <Distintivo texto={item.placa} />
              </View>
              <Texto style={estilos.tarjetaDetalle}>
                Modelo {item.modelo_anio}
                {item.color ? ` · ${item.color}` : ''}
                {item.kilometraje !== null ? ` · ${item.kilometraje} km` : ''}
              </Texto>
              <Texto style={estilos.tarjetaDetalle}>Cliente: {item.cliente?.nombre_completo}</Texto>

              <View style={[estilos.fila, { marginTop: ESPACIO.sm }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="time-outline" size={14} color={colores.enlace} />
                  <Texto style={{ fontSize: 12, fontWeight: '700', color: colores.enlace }}>
                    Ver historial
                  </Texto>
                </View>

                <TouchableOpacity
                  onPress={() => navigation.navigate('VehiculoFormulario', { vehiculo: item })}
                  hitSlop={10}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: RADIO.completo,
                    borderWidth: 1,
                    borderColor: colores.borde,
                  }}
                >
                  <Ionicons name="pencil" size={13} color={colores.textoSuave} />
                  <Texto style={{ fontSize: 12, fontWeight: '600', color: colores.textoSuave }}>
                    Editar
                  </Texto>
                </TouchableOpacity>
              </View>
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
