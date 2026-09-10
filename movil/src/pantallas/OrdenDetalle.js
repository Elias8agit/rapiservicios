/**
 * MODULO M6 - DETALLE DE LA ORDEN DE TRABAJO.
 *
 * Reune el diagnostico sugerido, las tareas de revision, la evidencia
 * fotografica y la bitacora de trazabilidad de la orden. Desde esta pantalla
 * el mecanico marca las tareas concluidas y hace avanzar el estado.
 */

import React, { useCallback, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { AvisoConReintento, Boton, Cargando, Distintivo } from '../componentes/Comunes';
import { COLORES, ESPACIO, estilos } from '../tema';
import { ESTADOS_ORDEN } from '../../configuracion';

export default function OrdenDetalle({ route }) {
  const { idOrden } = route.params;

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintentando, setReintentando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const consultar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await api.verOrden(idOrden));
    } catch (falla) {
      setError(falla);
    } finally {
      setCargando(false);
      setReintentando(false);
    }
  }, [idOrden]);

  async function reintentar() {
    setReintentando(true);
    await consultar();
  }

  useFocusEffect(
    useCallback(() => {
      consultar();
    }, [consultar])
  );

  async function alternarTarea(tarea) {
    try {
      await api.marcarTarea(idOrden, tarea.id_detalle, !tarea.completada);
      consultar();
    } catch (falla) {
      setError(falla);
    }
  }

  async function avanzarEstado(nombreEstado) {
    setOcupado(true);
    setError(null);
    try {
      await api.cambiarEstado(idOrden, nombreEstado, null);
      await consultar();
    } catch (falla) {
      setError(falla);
    } finally {
      setOcupado(false);
    }
  }

  async function agregarEvidencia() {
    setError(null);
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError({ message: 'La aplicacion requiere permiso de camara.', recuperable: false });
      return;
    }
    const captura = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (captura.canceled || !captura.assets?.length) return;

    const etapaActual = {
      RECIBIDO: 'INGRESO',
      'EN DIAGNOSTICO': 'DIAGNOSTICO',
      'EN REPARACION': 'REPARACION',
      LISTO: 'ENTREGA',
      ENTREGADO: 'ENTREGA',
    }[datos?.orden?.estado?.nombre_estado] || 'DIAGNOSTICO';

    setOcupado(true);
    try {
      const imagen = captura.assets[0];
      await api.agregarFotografia(
        idOrden,
        { datos: imagen.base64, tipoMime: imagen.mimeType || 'image/jpeg' },
        etapaActual,
        null
      );
      await consultar();
    } catch (falla) {
      setError(falla);
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) return <Cargando texto="Consultando la orden..." />;
  if (!datos) {
    return (
      <View style={[estilos.pantalla, { padding: ESPACIO.md }]}>
        <AvisoConReintento
          error={error || { message: 'La orden no se logro recuperar.' }}
          alReintentar={reintentar}
          ocupado={reintentando}
        />
      </View>
    );
  }

  const { orden, diagnosticos, tareas, fotografias, bitacora } = datos;
  const secuenciaActual = orden.estado?.orden_secuencia || 1;
  const siguienteEstado = ESTADOS_ORDEN[secuenciaActual] || null;
  const completadas = tareas.filter((t) => t.completada).length;

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <View style={estilos.tarjeta}>
        <View style={estilos.fila}>
          <Text style={estilos.titulo}>{orden.codigo_consulta}</Text>
          <Distintivo texto={orden.estado?.nombre_estado} color={COLORES.primarioClaro} />
        </View>
        <Text style={estilos.tarjetaDetalle}>
          {orden.vehiculo?.placa} · {orden.vehiculo?.marca} {orden.vehiculo?.linea} {orden.vehiculo?.modelo_anio}
        </Text>
        <Text style={estilos.tarjetaDetalle}>Cliente: {orden.vehiculo?.cliente?.nombre_completo}</Text>
        <Text style={estilos.tarjetaDetalle}>Telefono: {orden.vehiculo?.cliente?.telefono}</Text>
        <Text style={estilos.tarjetaDetalle}>Recibio: {orden.usuario?.nombre_completo}</Text>
        <Text style={[estilos.tarjetaDetalle, { marginTop: ESPACIO.sm, color: COLORES.texto }]}>
          {orden.descripcion_falla}
        </Text>
      </View>

      <View style={estilos.tarjeta}>
        <Text style={estilos.tarjetaTitulo}>Diagnostico sugerido</Text>
        {diagnosticos.length === 0 ? (
          <Text style={estilos.tarjetaDetalle}>La descripcion se derivo a revision manual.</Text>
        ) : (
          diagnosticos.map((d) => {
            const generativo = d.origen_interpretacion === 'GENERATIVO';
            const sinLectura = !d.categoria && !generativo;

            return (
              <View key={d.id_diagnostico} style={{ marginTop: ESPACIO.sm }}>
                <Text style={{ color: COLORES.texto, fontSize: 15, fontWeight: '600' }}>
                  {d.categoria?.nombre_categoria ||
                    d.sistema_sugerido ||
                    'Sin correspondencia dentro del catalogo'}
                </Text>

                {/* Sin categoria del catalogo, el titulo ya presenta el
                    sistema que senala el asistente, de modo que repetirlo aqui
                    solo ocupa pantalla. */}
                {d.categoria ? (
                  <Text style={estilos.tarjetaDetalle}>Sistema: {d.categoria.sistema_vehicular}</Text>
                ) : !d.sistema_sugerido ? (
                  <Text style={estilos.tarjetaDetalle}>
                    La descripcion no permitio ubicar un sistema del vehiculo.
                  </Text>
                ) : null}

                {d.hallazgo ? (
                  <Text style={[estilos.tarjetaDetalle, { color: COLORES.texto, marginTop: ESPACIO.xs }]}>
                    {d.hallazgo}
                  </Text>
                ) : null}

                <Text style={estilos.tarjetaDetalle}>
                  Confianza: {(Number(d.nivel_confianza) * 100).toFixed(1)} % · origen{' '}
                  {d.origen_interpretacion}
                </Text>

                {d.texto_interpretado ? (
                  <Text style={estilos.tarjetaDetalle}>{d.texto_interpretado}</Text>
                ) : null}

                {/* La procedencia de la lectura permanece a la vista. Una
                    sugerencia del asistente no goza del respaldo de la base de
                    conocimiento del taller y el mecanico requiere saberlo
                    antes de trabajar sobre ella. */}
                {generativo ? (
                  <View
                    style={{
                      marginTop: ESPACIO.sm,
                      padding: ESPACIO.sm,
                      borderRadius: 8,
                      backgroundColor: '#FFF4E5',
                      borderWidth: 1,
                      borderColor: '#F0D2A8',
                    }}
                  >
                    <Text style={{ color: COLORES.aviso, fontSize: 12, lineHeight: 17 }}>
                      Esta lectura proviene del asistente, no de las reglas del taller. La averia
                      queda fuera del catalogo de doce categorias. Conviene confirmarla con criterio
                      propio antes de trabajar.
                    </Text>
                  </View>
                ) : null}

                {sinLectura ? (
                  <Text style={[estilos.tarjetaDetalle, { marginTop: ESPACIO.xs, fontStyle: 'italic' }]}>
                    La orden queda a criterio del mecanico.
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <View style={estilos.tarjeta}>
        <View style={estilos.fila}>
          <Text style={estilos.tarjetaTitulo}>Tareas de revision</Text>
          <Text style={estilos.tarjetaDetalle}>
            {completadas} de {tareas.length}
          </Text>
        </View>
        {tareas.length === 0 ? (
          <Text style={estilos.tarjetaDetalle}>Sin tareas asignadas.</Text>
        ) : (
          tareas.map((t) => {
            // Una tarea procede del catalogo del taller o de una sugerencia
            // del asistente. Ambas se marcan igual, pero se leen distinto.
            const sugerida = t.origen === 'GENERATIVO';
            const nombre = sugerida ? t.nombre_tarea_sugerida : t.tarea?.nombre_tarea;
            const minutos = sugerida ? t.tiempo_sugerido_min : t.tarea?.tiempo_estimado_min;

            return (
              <TouchableOpacity
                key={t.id_detalle}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: ESPACIO.sm }}
                onPress={() => alternarTarea(t)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={t.completada ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={t.completada ? COLORES.exito : COLORES.textoSuave}
                />
                <View style={{ marginLeft: ESPACIO.sm, flex: 1 }}>
                  <Text style={{ color: COLORES.texto, fontSize: 14 }}>{nombre}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={estilos.tarjetaDetalle}>{minutos} minutos estimados</Text>
                    {sugerida ? (
                      <View
                        style={{
                          marginLeft: ESPACIO.sm,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 10,
                          backgroundColor: '#FFF4E5',
                          borderWidth: 1,
                          borderColor: '#F0D2A8',
                        }}
                      >
                        <Text style={{ color: COLORES.aviso, fontSize: 10, fontWeight: '700' }}>
                          SUGERIDA
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        {orden.tiempo_estimado_min ? (
          <Text style={[estilos.tarjetaDetalle, { marginTop: ESPACIO.md, fontWeight: '600' }]}>
            Tiempo total estimado: {orden.tiempo_estimado_min} minutos
          </Text>
        ) : null}
      </View>

      <View style={estilos.tarjeta}>
        <View style={estilos.fila}>
          <Text style={estilos.tarjetaTitulo}>Evidencia fotografica</Text>
          <TouchableOpacity onPress={agregarEvidencia}>
            <Ionicons name="camera" size={22} color={COLORES.primario} />
          </TouchableOpacity>
        </View>
        {fotografias.length === 0 ? (
          <Text style={estilos.tarjetaDetalle}>Sin fotografias resguardadas.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: ESPACIO.sm }}>
            {fotografias.map((f) => (
              <View key={f.id_fotografia} style={{ marginRight: ESPACIO.sm }}>
                {f.enlace ? (
                  <Image source={{ uri: f.enlace }} style={{ width: 130, height: 130, borderRadius: 10 }} />
                ) : (
                  <View
                    style={{
                      width: 130,
                      height: 130,
                      borderRadius: 10,
                      backgroundColor: COLORES.borde,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="image-outline" size={28} color={COLORES.textoSuave} />
                  </View>
                )}
                <Text style={[estilos.tarjetaDetalle, { textAlign: 'center' }]}>{f.etapa}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={estilos.tarjeta}>
        <Text style={estilos.tarjetaTitulo}>Bitacora de estados</Text>
        {bitacora.map((b) => (
          <View key={b.id_bitacora} style={{ marginTop: ESPACIO.sm }}>
            <Text style={{ color: COLORES.texto, fontSize: 14 }}>{b.estado?.nombre_estado}</Text>
            <Text style={estilos.tarjetaDetalle}>
              {new Date(b.fecha_cambio).toLocaleString()} · {b.usuario?.nombre_completo}
            </Text>
            {b.comentario ? <Text style={estilos.tarjetaDetalle}>{b.comentario}</Text> : null}
          </View>
        ))}
      </View>

      <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />

      {siguienteEstado ? (
        <Boton
          titulo={`Avanzar hacia ${siguienteEstado}`}
          alPresionar={() => avanzarEstado(siguienteEstado)}
          ocupado={ocupado}
          variante="acento"
        />
      ) : (
        <Text style={[estilos.vacio, { marginTop: ESPACIO.md }]}>La orden concluyo el ciclo de estados.</Text>
      )}
    </ScrollView>
  );
}
