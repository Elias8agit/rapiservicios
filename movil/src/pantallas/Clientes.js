/**
 * MODULO M2 - LISTADO DE CLIENTES.
 *
 * Pantalla de consulta del padron de clientes del taller. Resuelve dos tareas:
 * ubicar a una persona por nombre o telefono, y abrir su ficha para corregir
 * un dato.
 *
 * LA BUSQUEDA OPERA SOBRE LA LISTA YA RECIBIDA. Antes consultaba al servidor en
 * cada letra escrita, porque el termino de busqueda figuraba entre las
 * dependencias del efecto de enfoque. Eso producia una peticion por pulsacion y,
 * con la señal del taller, las respuestas podian llegar desordenadas y una
 * busqueda vieja sobrescribia a la nueva. El padron de un taller de barrio cabe
 * holgadamente en memoria, de modo que se recibe una vez y se filtra aqui: la
 * lista responde a cada letra sin gastar red ni esperar.
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
 * Iniciales del nombre, para la insignia de la tarjeta.
 *
 * Cumple la misma funcion que el icono de etapa en el listado de ordenes: dar
 * un punto de anclaje a la vista mientras se recorre la lista. Con dos letras
 * basta, y con una sola palabra se toma solo la primera.
 */
function iniciales(nombre) {
  const partes = String(nombre || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export default function Clientes({ navigation }) {
  const { colores, estilos, sombra } = useTema();
  const margenes = useSafeAreaInsets();

  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintentando, setReintentando] = useState(false);

  const consultar = useCallback(async () => {
    setError(null);
    try {
      const datos = await api.listarClientes();
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
    await consultar();
  }

  useFocusEffect(
    useCallback(() => {
      consultar();
    }, [consultar])
  );

  // Filtrado local sobre nombre, telefono y correo.
  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return clientes;
    return clientes.filter((c) =>
      [c.nombre_completo, c.telefono, c.correo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termino)
    );
  }, [clientes, busqueda]);

  return (
    <View style={estilos.pantalla}>
      {/* Buscador */}
      <View style={{ paddingHorizontal: ESPACIO.md, paddingTop: ESPACIO.md }}>
        <View style={{ justifyContent: 'center' }}>
          <EntradaTexto
            style={[estilos.campo, { paddingLeft: 42, paddingRight: busqueda ? 42 : ESPACIO.md }]}
            placeholder="Buscar por nombre o telefono"
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

        <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />
      </View>

      {cargando ? (
        <Cargando texto="Consultando clientes..." />
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(item) => String(item.id_cliente)}
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
                {visibles.length} {visibles.length === 1 ? 'CLIENTE' : 'CLIENTES'}
                {busqueda ? ' QUE COINCIDEN' : ' REGISTRADOS'}
              </Texto>
            ) : null
          }
          ListEmptyComponent={
            busqueda ? (
              <EstadoVacio
                icono="search-outline"
                titulo="Ningun cliente coincide"
                detalle={`No se encontro "${busqueda}" dentro del padron del taller.`}
              />
            ) : (
              <EstadoVacio
                icono="people-outline"
                titulo="Todavia no hay clientes"
                detalle="Al registrar el primer cliente aparecera aqui. Tambien se puede dar de alta sin salir del ingreso de un vehiculo."
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [estilos.tarjeta, pressed && { opacity: 0.75 }]}
              onPress={() => navigation.navigate('ClienteFormulario', { cliente: item })}
            >
              <View style={estilos.fila}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm, flex: 1 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: RADIO.completo,
                      backgroundColor: colores.superficieAlterna,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Texto style={{ fontSize: 14, fontWeight: '800', color: colores.textoSuave }}>
                      {iniciales(item.nombre_completo)}
                    </Texto>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Texto
                      style={{ fontSize: 16, fontWeight: '700', color: colores.texto, letterSpacing: -0.2 }}
                      numberOfLines={1}
                    >
                      {item.nombre_completo}
                    </Texto>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Ionicons name="call-outline" size={13} color={colores.textoSuave} />
                      <Texto style={{ fontSize: 13, color: colores.textoSuave, fontWeight: '600' }}>
                        {item.telefono}
                      </Texto>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colores.textoSuave} />
              </View>

              {item.correo ? (
                <>
                  <View style={estilos.separador} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="mail-outline" size={13} color={colores.textoSuave} />
                    <Texto style={{ fontSize: 12, color: colores.textoSuave, flex: 1 }} numberOfLines={1}>
                      {item.correo}
                    </Texto>
                  </View>
                </>
              ) : null}
            </Pressable>
          )}
        />
      )}

      {/* Accion principal. Lleva texto ademas del signo, en correspondencia con
          el listado de ordenes: un icono solo obliga a deducir lo que hace. */}
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
        onPress={() => navigation.navigate('ClienteFormulario', {})}
      >
        <Ionicons name="person-add" size={21} color="#FFFFFF" />
        <Texto style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Nuevo cliente</Texto>
      </Pressable>
    </View>
  );
}
