/**
 * MODULO M7 - HISTORIAL VEHICULAR.
 *
 * Reune todas las visitas de un vehiculo al taller, de la mas reciente a la
 * mas antigua. El servicio las resuelve mediante la vista v_historial_vehiculo,
 * que agrega a cada orden su diagnostico, su avance de tareas y su cantidad de
 * fotografias.
 *
 * PARA QUE SIRVE. Un vehiculo que regresa por la misma averia no es lo mismo
 * que uno que llega por primera vez: si la caja ya se reviso hace dos meses, el
 * mecanico parte de ahi en lugar de empezar de cero. El historial responde esa
 * pregunta antes de abrir el capo, y la responde con lo que el taller registro,
 * no con lo que alguien recuerde.
 *
 * La pantalla encabeza con un resumen del vehiculo: cuantas visitas acumula,
 * cuando fue la ultima y que sistemas se le han intervenido. Ese resumen es lo
 * que el propietario consulta cuando el cliente pregunta por telefono.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Texto } from '../componentes/Texto';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { AvisoConReintento, Cargando, Distintivo, EstadoVacio } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

/** Color e icono de cada etapa, en correspondencia con el listado de ordenes. */
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

/** Fecha en formato corto del pais, sin la hora. */
function fechaCorta(valor) {
  if (!valor) return null;
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return null;
  return f.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Distancia en lenguaje corriente entre la fecha indicada y hoy.
 *
 * El mecanico razona en "hace dos meses", no en una fecha absoluta: lo que le
 * importa es si la intervencion anterior queda cerca o lejos.
 */
function hace(valor) {
  if (!valor) return null;
  const dias = Math.floor((Date.now() - new Date(valor).getTime()) / 86400000);
  if (Number.isNaN(dias) || dias < 0) return null;
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const anios = Math.floor(dias / 365);
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
}

export default function HistorialVehiculo({ route, navigation }) {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();

  const vehiculo = route.params?.vehiculo || {};
  const idVehiculo = route.params?.idVehiculo ?? vehiculo.id_vehiculo;

  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintentando, setReintentando] = useState(false);

  const consultar = useCallback(async () => {
    if (!idVehiculo) {
      setCargando(false);
      return;
    }
    setError(null);
    try {
      const datos = await api.historialVehiculo(idVehiculo);
      setHistorial(datos.historial || []);
    } catch (falla) {
      setError(falla);
    } finally {
      setCargando(false);
      setReintentando(false);
    }
  }, [idVehiculo]);

  async function reintentar() {
    setReintentando(true);
    await consultar();
  }

  useFocusEffect(
    useCallback(() => {
      consultar();
    }, [consultar])
  );

  /**
   * Resumen del vehiculo a partir del propio historial.
   *
   * Los sistemas intervenidos se reunen sin repetir: el valor de la vista llega
   * como una linea con varios nombres separados por coma, de modo que hay que
   * partirla antes de contarla. Un sistema que aparece en tres visitas indica
   * una averia que reincide, y eso es precisamente lo que conviene ver arriba.
   */
  const resumen = useMemo(() => {
    const sistemas = new Map();
    for (const visita of historial) {
      const linea = visita.categorias_diagnosticadas;
      if (!linea) continue;
      for (const nombre of String(linea).split(',')) {
        const limpio = nombre.trim();
        if (limpio) sistemas.set(limpio, (sistemas.get(limpio) || 0) + 1);
      }
    }
    return {
      visitas: historial.length,
      ultima: historial[0]?.fecha_ingreso || null,
      sistemas: [...sistemas.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [historial]);

  const encabezado = (
    <View>
      <View style={estilos.tarjeta}>
        <View style={estilos.fila}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm, flex: 1 }}>
            <Ionicons name="car-sport" size={22} color={colores.acento} />
            <Texto style={[estilos.tarjetaTitulo, { marginBottom: 0 }]}>
              {vehiculo.marca} {vehiculo.linea}
            </Texto>
          </View>
          <Distintivo texto={vehiculo.placa} />
        </View>

        <Texto style={[estilos.tarjetaDetalle, { marginTop: 4 }]}>
          {vehiculo.modelo_anio ? `Modelo ${vehiculo.modelo_anio}` : null}
          {vehiculo.color ? ` · ${vehiculo.color}` : ''}
          {vehiculo.cliente?.nombre_completo ? ` · ${vehiculo.cliente.nombre_completo}` : ''}
        </Texto>

        {!cargando && resumen.visitas > 0 ? (
          <>
            <View style={estilos.separador} />
            <View style={{ flexDirection: 'row', gap: ESPACIO.lg }}>
              <View>
                <Texto style={{ fontSize: 22, fontWeight: '800', color: colores.texto }}>
                  {resumen.visitas}
                </Texto>
                <Texto style={{ fontSize: 11, color: colores.textoSuave }}>
                  {resumen.visitas === 1 ? 'visita' : 'visitas'}
                </Texto>
              </View>
              <View style={{ flex: 1 }}>
                <Texto style={{ fontSize: 13, fontWeight: '700', color: colores.texto }}>
                  {hace(resumen.ultima) || 'sin fecha'}
                </Texto>
                <Texto style={{ fontSize: 11, color: colores.textoSuave }}>ultimo ingreso</Texto>
              </View>
            </View>

            {resumen.sistemas.length ? (
              <View style={{ marginTop: ESPACIO.md }}>
                <Texto style={{ fontSize: 11, color: colores.textoSuave, marginBottom: 6 }}>
                  Sistemas intervenidos
                </Texto>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {resumen.sistemas.map(([nombre, veces]) => (
                    <View
                      key={nombre}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: RADIO.completo,
                        // Un sistema que reincide se destaca: es la senal de
                        // que la averia no quedo resuelta la vez anterior.
                        backgroundColor: veces > 1 ? colores.avisoTenue : colores.superficieAlterna,
                        borderWidth: 1,
                        borderColor: veces > 1 ? colores.aviso : colores.borde,
                      }}
                    >
                      <Texto
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: veces > 1 ? colores.aviso : colores.textoSuave,
                        }}
                      >
                        {nombre}
                      </Texto>
                      {veces > 1 ? (
                        <Texto style={{ fontSize: 11, fontWeight: '800', color: colores.aviso }}>
                          {veces}x
                        </Texto>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />

      {!cargando && historial.length ? (
        <Texto
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: colores.textoSuave,
            letterSpacing: 0.5,
            marginTop: ESPACIO.sm,
            marginBottom: ESPACIO.xs,
          }}
        >
          VISITAS, DE LA MAS RECIENTE
        </Texto>
      ) : null}
    </View>
  );

  if (cargando) {
    return (
      <View style={estilos.pantalla}>
        <Cargando texto="Consultando el historial..." />
      </View>
    );
  }

  return (
    <View style={estilos.pantalla}>
      <FlatList
        data={historial}
        keyExtractor={(item) => String(item.id_orden)}
        contentContainerStyle={{
          paddingHorizontal: ESPACIO.md,
          paddingTop: ESPACIO.md,
          paddingBottom: ESPACIO.xl + margenes.bottom,
        }}
        ListHeaderComponent={encabezado}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={consultar}
            tintColor={colores.acento}
            colors={[colores.acento]}
          />
        }
        ListEmptyComponent={
          error ? null : (
            <EstadoVacio
              icono="time-outline"
              titulo="Este vehiculo no registra visitas"
              detalle="Cuando ingrese al taller, la orden aparecera aqui con su diagnostico y las tareas que se le hicieron."
            />
          )
        }
        renderItem={({ item }) => {
          const marca = marcaDeEstado(item.nombre_estado, colores);
          const total = Number(item.total_tareas) || 0;
          const hechas = Number(item.tareas_completadas) || 0;
          const fotos = Number(item.total_fotografias) || 0;

          return (
            <Pressable
              style={({ pressed }) => [estilos.tarjeta, pressed && { opacity: 0.75 }]}
              onPress={() => navigation.navigate('OrdenDetalle', { idOrden: item.id_orden })}
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
                    <Ionicons name={marca.icono} size={18} color={marca.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Texto
                      style={{ fontSize: 16, fontWeight: '800', color: colores.texto, letterSpacing: 0.5 }}
                    >
                      {item.codigo_consulta || `Orden ${item.id_orden}`}
                    </Texto>
                    <Texto style={{ fontSize: 11, fontWeight: '700', color: marca.color, letterSpacing: 0.4 }}>
                      {item.nombre_estado}
                    </Texto>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Texto style={{ fontSize: 12, fontWeight: '600', color: colores.texto }}>
                    {fechaCorta(item.fecha_ingreso) || 'sin fecha'}
                  </Texto>
                  <Texto style={{ fontSize: 11, color: colores.textoSuave }}>
                    {hace(item.fecha_ingreso)}
                  </Texto>
                </View>
              </View>

              <View style={estilos.separador} />

              <Texto style={{ fontSize: 13, color: colores.texto }} numberOfLines={2}>
                {item.descripcion_falla}
              </Texto>

              {item.categorias_diagnosticadas ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: ESPACIO.sm,
                  }}
                >
                  <Ionicons name="medical-outline" size={13} color={colores.textoSuave} />
                  <Texto style={{ fontSize: 12, color: colores.textoSuave, flex: 1 }}>
                    {item.categorias_diagnosticadas}
                  </Texto>
                </View>
              ) : null}

              {/* Renglon de cifras. Resume la visita sin obligar a abrirla. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.md, marginTop: ESPACIO.sm }}>
                {total ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons
                      name={hechas === total ? 'checkmark-done' : 'ellipse-outline'}
                      size={13}
                      color={hechas === total ? colores.exito : colores.textoSuave}
                    />
                    <Texto
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: hechas === total ? colores.exito : colores.textoSuave,
                      }}
                    >
                      {hechas} de {total} tareas
                    </Texto>
                  </View>
                ) : null}

                {fotos ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="camera-outline" size={13} color={colores.textoSuave} />
                    <Texto style={{ fontSize: 12, color: colores.textoSuave }}>
                      {fotos} {fotos === 1 ? 'foto' : 'fotos'}
                    </Texto>
                  </View>
                ) : null}

                {item.tiempo_estimado_min ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={13} color={colores.textoSuave} />
                    <Texto style={{ fontSize: 12, color: colores.textoSuave }}>
                      {item.tiempo_estimado_min} min
                    </Texto>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
