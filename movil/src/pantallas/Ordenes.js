/**
 * MODULO M6 - LISTADO DE ORDENES DE TRABAJO.
 */

import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { AvisoConReintento, Cargando, Distintivo } from '../componentes/Comunes';
import { COLORES, ESPACIO, estilos } from '../tema';
import { ESTADOS_ORDEN } from '../../configuracion';

const COLOR_ESTADO = {
  RECIBIDO: '#5A6B7B',
  'EN DIAGNOSTICO': '#B26A00',
  'EN REPARACION': '#1D5586',
  LISTO: '#1E7A46',
  ENTREGADO: '#3F5060',
};

export default function Ordenes({ navigation }) {
  const [ordenes, setOrdenes] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintentando, setReintentando] = useState(false);

  const consultar = useCallback(async (estado = '') => {
    setError(null);
    try {
      const datos = await api.listarOrdenes(estado);
      setOrdenes(datos.ordenes);
    } catch (falla) {
      setError(falla);
    } finally {
      setCargando(false);
      setReintentando(false);
    }
  }, []);

  async function reintentar() {
    setReintentando(true);
    await consultar(filtro);
  }

  useFocusEffect(
    useCallback(() => {
      consultar(filtro);
    }, [consultar, filtro])
  );

  return (
    <View style={estilos.pantalla}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 56 }}
        contentContainerStyle={{ paddingHorizontal: ESPACIO.md, paddingVertical: ESPACIO.sm, gap: 8 }}
      >
        {['', ...ESTADOS_ORDEN].map((estado) => (
          <TouchableOpacity
            key={estado || 'todas'}
            onPress={() => setFiltro(estado)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: filtro === estado ? COLORES.primario : COLORES.tarjeta,
              borderWidth: 1,
              borderColor: filtro === estado ? COLORES.primario : COLORES.borde,
            }}
          >
            <Text style={{ color: filtro === estado ? '#FFFFFF' : COLORES.textoSuave, fontSize: 12, fontWeight: '600' }}>
              {estado || 'TODAS'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: ESPACIO.md }}>
        <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />
      </View>

      {cargando ? (
        <Cargando texto="Consultando ordenes..." />
      ) : (
        <FlatList
          data={ordenes}
          keyExtractor={(item) => String(item.id_orden)}
          contentContainerStyle={{ paddingHorizontal: ESPACIO.md, paddingBottom: 100, paddingTop: ESPACIO.sm }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => consultar(filtro)} />}
          ListEmptyComponent={<Text style={estilos.vacio}>Sin ordenes de trabajo en este filtro.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={estilos.tarjeta}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('OrdenDetalle', { idOrden: item.id_orden })}
            >
              <View style={estilos.fila}>
                <Text style={estilos.tarjetaTitulo}>{item.codigo_consulta}</Text>
                <Distintivo
                  texto={item.estado?.nombre_estado || ''}
                  color={COLOR_ESTADO[item.estado?.nombre_estado] || COLORES.primarioClaro}
                />
              </View>
              <Text style={estilos.tarjetaDetalle}>
                {item.vehiculo?.placa} · {item.vehiculo?.marca} {item.vehiculo?.linea}
              </Text>
              <Text style={estilos.tarjetaDetalle} numberOfLines={2}>
                {item.descripcion_falla}
              </Text>
              <Text style={[estilos.tarjetaDetalle, { marginTop: 6 }]}>
                {item.vehiculo?.cliente?.nombre_completo}
                {item.tiempo_estimado_min ? ` · ${item.tiempo_estimado_min} min estimados` : ''}
              </Text>
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
        onPress={() => navigation.navigate('OrdenNueva')}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
