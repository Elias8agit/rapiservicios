/**
 * MODULO M6 - DETALLE DE LA ORDEN DE TRABAJO.
 *
 * Reune el diagnostico sugerido, las tareas de revision, la evidencia
 * fotografica y la bitacora de trazabilidad de la orden. Desde esta pantalla
 * el mecanico marca las tareas concluidas y hace avanzar el estado.
 */

import React, { useCallback, useState } from 'react';
import { Image, ScrollView, TouchableOpacity, View } from 'react-native';
import { Texto } from '../componentes/Texto';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { AvisoConReintento, Boton, Cargando, Distintivo } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';
import { ESTADOS_ORDEN } from '../../configuracion';

export default function OrdenDetalle({ route, navigation }) {
  const { colores, estilos } = useTema();
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
          <Texto style={estilos.titulo}>{orden.codigo_consulta}</Texto>
          <Distintivo texto={orden.estado?.nombre_estado} color={colores.primarioSuave} />
        </View>
        <Texto style={estilos.tarjetaDetalle}>
          {orden.vehiculo?.placa} · {orden.vehiculo?.marca} {orden.vehiculo?.linea} {orden.vehiculo?.modelo_anio}
        </Texto>
        <Texto style={estilos.tarjetaDetalle}>Cliente: {orden.vehiculo?.cliente?.nombre_completo}</Texto>
        <Texto style={estilos.tarjetaDetalle}>Telefono: {orden.vehiculo?.cliente?.telefono}</Texto>
        <Texto style={estilos.tarjetaDetalle}>Recibio: {orden.usuario?.nombre_completo}</Texto>
        <Texto style={[estilos.tarjetaDetalle, { marginTop: ESPACIO.sm, color: colores.texto }]}>
          {orden.descripcion_falla}
        </Texto>

        {/* Acceso al historial del vehiculo.
            Reside aqui porque es al diagnosticar cuando hace falta: si el
            vehiculo ya vino por lo mismo hace dos meses, el mecanico parte de
            esa revision en lugar de repetirla. */}
        {orden.vehiculo?.id_vehiculo ? (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('HistorialVehiculo', {
                vehiculo: orden.vehiculo,
                idVehiculo: orden.vehiculo.id_vehiculo,
              })
            }
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: ESPACIO.md,
              paddingTop: ESPACIO.sm,
              borderTopWidth: 1,
              borderTopColor: colores.borde,
            }}
          >
            <Ionicons name="time-outline" size={16} color={colores.enlace} />
            <Texto style={{ fontSize: 13, fontWeight: '700', color: colores.enlace, flex: 1 }}>
              Ver historial de este vehiculo
            </Texto>
            <Ionicons name="chevron-forward" size={16} color={colores.textoSuave} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={estilos.tarjeta}>
        <Texto style={estilos.tarjetaTitulo}>Diagnostico sugerido</Texto>
        {diagnosticos.length === 0 ? (
          <Texto style={estilos.tarjetaDetalle}>La descripcion se derivo a revision manual.</Texto>
        ) : (
          diagnosticos.map((d) => {
            const generativo = d.origen_interpretacion === 'GENERATIVO';
            const sinLectura = !d.categoria && !generativo;

            return (
              <View key={d.id_diagnostico} style={{ marginTop: ESPACIO.sm }}>
                <Texto style={{ color: colores.texto, fontSize: 15, fontWeight: '600' }}>
                  {d.categoria?.nombre_categoria ||
                    d.sistema_sugerido ||
                    'Sin correspondencia dentro del catalogo'}
                </Texto>

                {/* Sin categoria del catalogo, el titulo ya presenta el
                    sistema que senala el asistente, de modo que repetirlo aqui
                    solo ocupa pantalla. */}
                {d.categoria ? (
                  <Texto style={estilos.tarjetaDetalle}>Sistema: {d.categoria.sistema_vehicular}</Texto>
                ) : !d.sistema_sugerido ? (
                  <Texto style={estilos.tarjetaDetalle}>
                    La descripcion no permitio ubicar un sistema del vehiculo.
                  </Texto>
                ) : null}

                {d.hallazgo ? (
                  <Texto style={[estilos.tarjetaDetalle, { color: colores.texto, marginTop: ESPACIO.xs }]}>
                    {d.hallazgo}
                  </Texto>
                ) : null}

                <Texto style={estilos.tarjetaDetalle}>
                  Confianza: {(Number(d.nivel_confianza) * 100).toFixed(1)} % · origen{' '}
                  {d.origen_interpretacion}
                </Texto>

                {d.texto_interpretado ? (
                  <Texto style={estilos.tarjetaDetalle}>{d.texto_interpretado}</Texto>
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
                      borderRadius: RADIO.sm,
                      backgroundColor: colores.avisoTenue,
                      borderWidth: 1,
                      borderColor: colores.aviso,
                    }}
                  >
                    <Texto style={{ color: colores.aviso, fontSize: 12, lineHeight: 17 }}>
                      Esta lectura proviene del asistente, no de las reglas del taller. La averia
                      queda fuera del catalogo de doce categorias. Conviene confirmarla con criterio
                      propio antes de trabajar.
                    </Texto>
                  </View>
                ) : null}

                {sinLectura ? (
                  <Texto style={[estilos.tarjetaDetalle, { marginTop: ESPACIO.xs, fontStyle: 'italic' }]}>
                    La orden queda a criterio del mecanico.
                  </Texto>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <View style={estilos.tarjeta}>
        <View style={estilos.fila}>
          <Texto style={estilos.tarjetaTitulo}>Tareas de revision</Texto>
          <Texto style={estilos.tarjetaDetalle}>
            {completadas} de {tareas.length}
          </Texto>
        </View>
        {tareas.length === 0 ? (
          <Texto style={estilos.tarjetaDetalle}>Sin tareas asignadas.</Texto>
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
                  color={t.completada ? colores.exito : colores.textoSuave}
                />
                <View style={{ marginLeft: ESPACIO.sm, flex: 1 }}>
                  <Texto style={{ color: colores.texto, fontSize: 14 }}>{nombre}</Texto>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Texto style={estilos.tarjetaDetalle}>{minutos} minutos estimados</Texto>
                    {sugerida ? (
                      <View
                        style={{
                          marginLeft: ESPACIO.sm,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 10,
                          backgroundColor: colores.avisoTenue,
                          borderWidth: 1,
                          borderColor: colores.aviso,
                        }}
                      >
                        <Texto style={{ color: colores.aviso, fontSize: 10, fontWeight: '700' }}>
                          SUGERIDA
                        </Texto>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        {orden.tiempo_estimado_min ? (
          <Texto style={[estilos.tarjetaDetalle, { marginTop: ESPACIO.md, fontWeight: '600' }]}>
            Tiempo total estimado: {orden.tiempo_estimado_min} minutos
          </Texto>
        ) : null}
      </View>

      <View style={estilos.tarjeta}>
        <View style={estilos.fila}>
          <Texto style={estilos.tarjetaTitulo}>Evidencia fotografica</Texto>
          <TouchableOpacity onPress={agregarEvidencia}>
            <Ionicons name="camera" size={22} color={colores.primario} />
          </TouchableOpacity>
        </View>
        {fotografias.length === 0 ? (
          <Texto style={estilos.tarjetaDetalle}>Sin fotografias resguardadas.</Texto>
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
                      backgroundColor: colores.borde,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="image-outline" size={28} color={colores.textoSuave} />
                  </View>
                )}
                <Texto style={[estilos.tarjetaDetalle, { textAlign: 'center' }]}>{f.etapa}</Texto>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={estilos.tarjeta}>
        <Texto style={estilos.tarjetaTitulo}>Bitacora de estados</Texto>
        {bitacora.map((b) => (
          <View key={b.id_bitacora} style={{ marginTop: ESPACIO.sm }}>
            <Texto style={{ color: colores.texto, fontSize: 14 }}>{b.estado?.nombre_estado}</Texto>
            <Texto style={estilos.tarjetaDetalle}>
              {new Date(b.fecha_cambio).toLocaleString()} · {b.usuario?.nombre_completo}
            </Texto>
            {b.comentario ? <Texto style={estilos.tarjetaDetalle}>{b.comentario}</Texto> : null}
          </View>
        ))}
      </View>

      <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />

      {siguienteEstado ? (
        <Boton
          titulo={`Avanzar hacia ${siguienteEstado}`}
          alPresionar={() => avanzarEstado(siguienteEstado)}
          ocupado={ocupado}
          variante="principal"
        />
      ) : (
        <Texto style={[estilos.vacio, { marginTop: ESPACIO.md }]}>La orden concluyo el ciclo de estados.</Texto>
      )}
    </ScrollView>
  );
}
