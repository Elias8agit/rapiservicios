/**
 * MODULO M2 - LISTADO DE VEHICULOS.
 *
 * El taller nombra los vehiculos por su placa, de modo que la placa encabeza la
 * tarjeta y la marca con la linea quedan debajo, igual que el codigo encabeza la
 * tarjeta del listado de ordenes.
 *
 * AL TOCAR EL VEHICULO SE ABRE SU HISTORIAL, NO EL FORMULARIO. Lo que el taller
 * hace con un vehiculo registrado es consultar por que ha venido antes; corregir
 * la placa o el kilometraje ocurre pocas veces y lleva su propio boton con
 * lapiz.
 *
 * LA BUSQUEDA OPERA SOBRE LA LISTA YA RECIBIDA, por la misma razon que en el
 * listado de clientes: antes se consultaba al servidor en cada letra escrita.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Texto, EntradaTexto } from '../componentes/Texto';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { AvisoConReintento, Cargando, EstadoVacio } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

/**
 * Rotulo e icono del tipo de caja.
 *
 * El dato permanece a la vista porque determina las revisiones que el motor de
 * reglas asigna: una caja automatica no tiene embrague de pedal y una mecanica
 * no tiene cuerpo de valvulas. Un vehiculo sin el dato recibe unicamente las
 * tareas comunes a las dos cajas, es decir una orden mas corta, y eso conviene
 * que se note desde el listado y no al leer la orden ya generada.
 */
function marcaDeCaja(tipo, colores) {
  if (tipo === 'MECANICA') {
    return { texto: 'Caja mecanica', icono: 'git-commit-outline', color: colores.textoSuave, resalta: false };
  }
  if (tipo === 'AUTOMATICA') {
    return { texto: 'Caja automatica', icono: 'sync-outline', color: colores.textoSuave, resalta: false };
  }
  return { texto: 'Caja sin dato', icono: 'help-circle-outline', color: colores.aviso, resalta: true };
}

export default function Vehiculos({ navigation }) {
  const { colores, estilos, sombra } = useTema();
  const margenes = useSafeAreaInsets();

  const [vehiculos, setVehiculos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintentando, setReintentando] = useState(false);

  const consultar = useCallback(async () => {
    setError(null);
    try {
      const datos = await api.listarVehiculos();
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
    await consultar();
  }

  useFocusEffect(
    useCallback(() => {
      consultar();
    }, [consultar])
  );

  // Filtrado local sobre placa, marca, linea y nombre del propietario.
  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return vehiculos;
    return vehiculos.filter((v) =>
      [v.placa, v.marca, v.linea, v.color, v.cliente?.nombre_completo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termino)
    );
  }, [vehiculos, busqueda]);

  return (
    <View style={estilos.pantalla}>
      {/* Buscador */}
      <View style={{ paddingHorizontal: ESPACIO.md, paddingTop: ESPACIO.md }}>
        <View style={{ justifyContent: 'center' }}>
          <EntradaTexto
            style={[estilos.campo, { paddingLeft: 42, paddingRight: busqueda ? 42 : ESPACIO.md }]}
            placeholder="Buscar por placa, marca o cliente"
            placeholderTextColor={colores.textoSuave}
            value={busqueda}
            onChangeText={setBusqueda}
            autoCorrect={false}
            autoCapitalize="characters"
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

        <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />
      </View>

      {cargando ? (
        <Cargando texto="Consultando vehiculos..." />
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(item) => String(item.id_vehiculo)}
          contentContainerStyle={{
            paddingHorizontal: ESPACIO.md,
            paddingTop: ESPACIO.sm,
            paddingBottom: 120 + margenes.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={consultar}
              tintColor={colores.acento}
              colors={[colores.acento]}
            />
          }
          ListHeaderComponent={
            visibles.length ? (
              <Texto
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: colores.textoSuave,
                  letterSpacing: 0.5,
                  marginBottom: ESPACIO.xs,
                }}
              >
                {visibles.length} {visibles.length === 1 ? 'VEHICULO' : 'VEHICULOS'}
                {busqueda ? ' QUE COINCIDEN' : ' REGISTRADOS'}
              </Texto>
            ) : null
          }
          ListEmptyComponent={
            busqueda ? (
              <EstadoVacio
                icono="search-outline"
                titulo="Ningun vehiculo coincide"
                detalle={`No se encontro "${busqueda}" entre los vehiculos registrados.`}
              />
            ) : (
              <EstadoVacio
                icono="car-sport-outline"
                titulo="Todavia no hay vehiculos"
                detalle="Al registrar el primer vehiculo aparecera aqui con su historial de visitas."
              />
            )
          }
          renderItem={({ item }) => {
            const caja = marcaDeCaja(item.tipo_transmision, colores);

            return (
              <Pressable
                style={({ pressed }) => [estilos.tarjeta, pressed && { opacity: 0.75 }]}
                onPress={() => navigation.navigate('HistorialVehiculo', { vehiculo: item })}
              >
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
                      <Ionicons name="car-sport" size={18} color={colores.textoSuave} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Texto
                        style={{ fontSize: 17, fontWeight: '800', color: colores.texto, letterSpacing: 0.5 }}
                      >
                        {item.placa}
                      </Texto>
                      <Texto style={{ fontSize: 12, color: colores.textoSuave, fontWeight: '600' }} numberOfLines={1}>
                        {item.marca} {item.linea} {item.modelo_anio}
                      </Texto>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colores.textoSuave} />
                </View>

                <View style={estilos.separador} />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="person-outline" size={13} color={colores.textoSuave} />
                  <Texto style={{ fontSize: 12, color: colores.textoSuave, flex: 1 }} numberOfLines={1}>
                    {item.cliente?.nombre_completo}
                  </Texto>
                </View>

                {/* Renglon de datos de la ficha. Cada dato lleva icono propio,
                    de modo que se reconoce sin leer el rotulo. */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: ESPACIO.md,
                    marginTop: ESPACIO.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name={caja.icono} size={13} color={caja.color} />
                    <Texto
                      style={{
                        fontSize: 12,
                        color: caja.color,
                        fontWeight: caja.resalta ? '700' : '600',
                      }}
                    >
                      {caja.texto}
                    </Texto>
                  </View>

                  {item.color ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="color-palette-outline" size={13} color={colores.textoSuave} />
                      <Texto style={{ fontSize: 12, color: colores.textoSuave }}>{item.color}</Texto>
                    </View>
                  ) : null}

                  {item.kilometraje !== null && item.kilometraje !== undefined ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="speedometer-outline" size={13} color={colores.textoSuave} />
                      <Texto style={{ fontSize: 12, color: colores.textoSuave }}>
                        {item.kilometraje} km
                      </Texto>
                    </View>
                  ) : null}
                </View>

                <View style={[estilos.fila, { marginTop: ESPACIO.md }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="time-outline" size={14} color={colores.enlace} />
                    <Texto style={{ fontSize: 12, fontWeight: '700', color: colores.enlace }}>
                      Ver historial
                    </Texto>
                  </View>

                  <Pressable
                    onPress={() => navigation.navigate('VehiculoFormulario', { vehiculo: item })}
                    hitSlop={10}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: RADIO.completo,
                        borderWidth: 1,
                        borderColor: colores.borde,
                        backgroundColor: colores.superficie,
                      },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Ionicons name="pencil" size={13} color={colores.textoSuave} />
                    <Texto style={{ fontSize: 12, fontWeight: '600', color: colores.textoSuave }}>
                      Editar ficha
                    </Texto>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}

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
        onPress={() => navigation.navigate('VehiculoFormulario', {})}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Texto style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Nuevo vehiculo</Texto>
      </Pressable>
    </View>
  );
}
