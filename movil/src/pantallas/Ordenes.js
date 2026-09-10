/**
 * MODULO M6 - LISTADO DE ORDENES DE TRABAJO.
 *
 * Pantalla de entrada del personal del taller. Concentra tres tareas: ubicar
 * una orden concreta, reconocer de un vistazo en que etapa se encuentra cada
 * vehiculo, y abrir el ingreso de uno nuevo.
 *
 * La busqueda opera sobre la lista ya recibida y no vuelve a consultar al
 * servidor, de modo que responde a cada letra sin gastar red ni esperar.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { AvisoConReintento, Cargando, EstadoVacio } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';
import { ESTADOS_ORDEN } from '../../configuracion';

/** Color e icono que corresponden a cada etapa del ciclo de la orden. */
function marcaDeEstado(nombre, colores) {
  const mapa = {
    RECIBIDO: { color: colores.textoSuave, icono: 'download-outline' },
    'EN DIAGNOSTICO': { color: colores.aviso, icono: 'search-outline' },
    'EN REPARACION': { color: colores.acento, icono: 'construct-outline' },
    LISTO: { color: colores.exito, icono: 'checkmark-done-outline' },
    ENTREGADO: { color: colores.plata, icono: 'car-outline' },
  };
  return mapa[nombre] || { color: colores.textoSuave, icono: 'ellipse-outline' };
}

export default function Ordenes({ navigation }) {
  const { colores, estilos, sombra } = useTema();
  const margenes = useSafeAreaInsets();

  const [ordenes, setOrdenes] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
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

  // Filtrado local sobre codigo, placa, vehiculo y cliente.
  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return ordenes;
    return ordenes.filter((o) =>
      [
        o.codigo_consulta,
        o.vehiculo?.placa,
        o.vehiculo?.marca,
        o.vehiculo?.linea,
        o.vehiculo?.cliente?.nombre_completo,
        o.descripcion_falla,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termino)
    );
  }, [ordenes, busqueda]);

  return (
    <View style={estilos.pantalla}>
      {/* Buscador */}
      <View style={{ paddingHorizontal: ESPACIO.md, paddingTop: ESPACIO.md }}>
        <View style={{ justifyContent: 'center' }}>
          <TextInput
            style={[estilos.campo, { paddingLeft: 42, paddingRight: busqueda ? 42 : ESPACIO.md }]}
            placeholder="Buscar por codigo, placa o cliente"
            placeholderTextColor={colores.textoSuave}
            value={busqueda}
            onChangeText={setBusqueda}
            autoCorrect={false}
          />
          <Ionicons
            name="search"
            size={19}
            color={colores.textoSuave}
            style={{ position: 'absolute', left: 14 }}
          />
          {busqueda ? (
            <Pressable
              onPress={() => setBusqueda('')}
              hitSlop={10}
              style={{ position: 'absolute', right: 14 }}
            >
              <Ionicons name="close-circle" size={19} color={colores.textoSuave} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filtros por etapa */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 60, flexGrow: 0 }}
        contentContainerStyle={{
          paddingHorizontal: ESPACIO.md,
          paddingVertical: ESPACIO.sm,
          gap: ESPACIO.sm,
          alignItems: 'center',
        }}
      >
        {['', ...ESTADOS_ORDEN].map((estado) => {
          const activo = filtro === estado;
          const marca = estado ? marcaDeEstado(estado, colores) : null;
          return (
            <Pressable
              key={estado || 'todas'}
              onPress={() => setFiltro(estado)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: RADIO.completo,
                backgroundColor: activo ? colores.primario : colores.superficie,
                borderWidth: 1,
                borderColor: activo ? colores.primario : colores.borde,
              }}
            >
              {marca ? (
                <Ionicons
                  name={marca.icono}
                  size={14}
                  color={activo ? '#FFFFFF' : marca.color}
                />
              ) : null}
              <Text
                style={{
                  color: activo ? '#FFFFFF' : colores.textoSuave,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.3,
                }}
              >
                {estado || 'TODAS'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: ESPACIO.md }}>
        <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />
      </View>

      {cargando ? (
        <Cargando texto="Consultando ordenes..." />
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(item) => String(item.id_orden)}
          contentContainerStyle={{
            paddingHorizontal: ESPACIO.md,
            paddingTop: ESPACIO.xs,
            paddingBottom: 120 + margenes.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => consultar(filtro)}
              tintColor={colores.acento}
              colors={[colores.acento]}
            />
          }
          ListEmptyComponent={
            busqueda ? (
              <EstadoVacio
                icono="search-outline"
                titulo="Ninguna orden coincide"
                detalle={`No se encontro "${busqueda}" dentro de las ordenes de este filtro.`}
              />
            ) : (
              <EstadoVacio
                icono="clipboard-outline"
                titulo={filtro ? `Sin ordenes en ${filtro}` : 'Todavia no hay ordenes'}
                detalle={
                  filtro
                    ? 'Ninguna orden se encuentra en esta etapa. Probar con el filtro TODAS.'
                    : 'Al ingresar un vehiculo, la orden aparece aqui con su codigo de consulta.'
                }
              />
            )
          }
          renderItem={({ item }) => {
            const marca = marcaDeEstado(item.estado?.nombre_estado, colores);
            return (
              <Pressable
                style={({ pressed }) => [estilos.tarjeta, pressed && { opacity: 0.75 }]}
                onPress={() => navigation.navigate('OrdenDetalle', { idOrden: item.id_orden })}
              >
                {/* Franja de etapa mas codigo */}
                <View style={estilos.fila}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm, flex: 1 }}>
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
                      <Ionicons name={marca.icono} size={18} color={marca.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: colores.texto, letterSpacing: 0.5 }}>
                        {item.codigo_consulta}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: marca.color, letterSpacing: 0.4 }}>
                        {item.estado?.nombre_estado}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colores.textoSuave} />
                </View>

                <View style={{ height: 1, backgroundColor: colores.borde, marginVertical: ESPACIO.sm }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="car-sport-outline" size={14} color={colores.textoSuave} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colores.texto }}>
                    {item.vehiculo?.placa}
                  </Text>
                  <Text style={{ fontSize: 13, color: colores.textoSuave }}>
                    {item.vehiculo?.marca} {item.vehiculo?.linea}
                  </Text>
                </View>

                <Text style={[estilos.tarjetaDetalle, { marginTop: 6 }]} numberOfLines={2}>
                  {item.descripcion_falla}
                </Text>

                <View style={[estilos.fila, { marginTop: ESPACIO.sm }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Ionicons name="person-outline" size={13} color={colores.textoSuave} />
                    <Text style={{ fontSize: 12, color: colores.textoSuave }} numberOfLines={1}>
                      {item.vehiculo?.cliente?.nombre_completo}
                    </Text>
                  </View>
                  {item.tiempo_estimado_min ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="time-outline" size={13} color={colores.textoSuave} />
                      <Text style={{ fontSize: 12, color: colores.textoSuave, fontWeight: '600' }}>
                        {item.tiempo_estimado_min} min
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Accion principal. Lleva texto ademas del signo, porque un icono solo
          obliga a deducir lo que hace. Se eleva por encima de los botones del
          telefono mediante el margen seguro del dispositivo. */}
      <Pressable
        style={({ pressed }) => [
          {
            position: 'absolute',
            right: ESPACIO.md,
            bottom: ESPACIO.md + margenes.bottom,
            backgroundColor: colores.acento,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 16,
            paddingRight: 20,
            height: 54,
            borderRadius: RADIO.completo,
            ...sombra(4),
          },
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => navigation.navigate('OrdenNueva')}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Nueva orden</Text>
      </Pressable>
    </View>
  );
}
