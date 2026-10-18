/**
 * MODULO M6 - DETALLE DE LA ORDEN DE TRABAJO.
 *
 * Reune el diagnostico sugerido, las tareas de revision, la evidencia
 * fotografica y la bitacora de trazabilidad de la orden. Desde esta pantalla
 * el mecanico marca las tareas concluidas y hace avanzar el estado.
 *
 * ORDEN DE LAS SECCIONES. Sigue el orden en que el mecanico usa la pantalla
 * frente al vehiculo: primero de que orden se trata y en que etapa va, luego
 * que sugiere el diagnostico, luego que hay que revisar, y al final la
 * evidencia y la bitacora, que se consultan menos y se escriben solas.
 *
 * ESTADOS DE ESPERA SEPARADOS. Avanzar la etapa, subir una fotografia y marcar
 * una tarea son tres peticiones distintas, y cada una indica su espera en su
 * propio lugar. Antes compartian un solo indicador que aparecia en el boton del
 * pie, de modo que al subir una fotografia el aviso de espera quedaba lejos de
 * lo que se habia tocado. Marcar una tarea, ademas, no bloqueaba un segundo
 * toque: dos toques rapidos enviaban dos cambios opuestos.
 *
 * EDICION Y ANULACION (migracion 07, 18 de octubre de 2026). Cualquier usuario
 * corrige el kilometraje de ingreso y la nota del mecanico; la descripcion y
 * el vehiculo quedan fijos porque el diagnostico salio de ellos. Solo el
 * propietario anula, con motivo, y hasta la etapa LISTO. Una orden anulada se
 * sigue pudiendo abrir y leer completa, pero no admite ningun cambio: la
 * pantalla oculta los controles y el servidor los rechaza igual.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Texto } from '../componentes/Texto';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { Aviso, AvisoConReintento, Boton, Campo, Cargando, etapaVisible, marcaDeEstado } from '../componentes/Comunes';
import { useSesion } from '../contexto/Sesion';
import { ESPACIO, RADIO, useTema } from '../tema';
import { ESTADOS_ORDEN } from '../../configuracion';

/** Fecha y hora en formato del pais, para la bitacora. */
function fechaHora(valor) {
  if (!valor) return '';
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return '';
  return f.toLocaleString('es-GT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Rotulo de seccion, con un dato opcional alineado a la derecha. */
function Rotulo({ texto, derecha = null }) {
  const { colores } = useTema();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: ESPACIO.md,
        marginBottom: ESPACIO.xs,
      }}
    >
      <Texto style={{ fontSize: 11, fontWeight: '700', color: colores.textoSuave, letterSpacing: 0.5 }}>
        {texto}
      </Texto>
      {derecha}
    </View>
  );
}

/** Renglon de dato con icono, para la ficha de la orden. */
function Dato({ icono, children, fuerte = false }) {
  const { colores } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <Ionicons name={icono} size={14} color={colores.textoSuave} />
      <Texto
        style={{
          fontSize: 13,
          color: fuerte ? colores.texto : colores.textoSuave,
          fontWeight: fuerte ? '600' : '400',
          flex: 1,
        }}
        numberOfLines={1}
      >
        {children}
      </Texto>
    </View>
  );
}

export default function OrdenDetalle({ route, navigation }) {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();
  const { idOrden } = route.params;

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintentando, setReintentando] = useState(false);

  const [avanzando, setAvanzando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [tareaEnCurso, setTareaEnCurso] = useState(null);
  const [editando, setEditando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const { esPropietario } = useSesion();

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
    // Un segundo toque sobre cualquier tarea mientras otra viaja se ignora.
    if (tareaEnCurso !== null) return;
    setTareaEnCurso(tarea.id_detalle);
    try {
      await api.marcarTarea(idOrden, tarea.id_detalle, !tarea.completada);
      await consultar();
    } catch (falla) {
      setError(falla);
    } finally {
      setTareaEnCurso(null);
    }
  }

  async function avanzarEstado(nombreEstado) {
    setAvanzando(true);
    setError(null);
    try {
      await api.cambiarEstado(idOrden, nombreEstado, null);
      await consultar();
    } catch (falla) {
      setError(falla);
    } finally {
      setAvanzando(false);
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

    setSubiendoFoto(true);
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
      setSubiendoFoto(false);
    }
  }

  if (cargando) {
    return (
      <View style={estilos.pantalla}>
        <Cargando texto="Consultando la orden..." />
      </View>
    );
  }

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
  const anulada = Boolean(orden.fecha_anulacion);
  const etapa = etapaVisible(orden);
  const marca = marcaDeEstado(etapa, colores);
  const admiteAnular = esPropietario && !anulada && orden.estado?.nombre_estado !== 'ENTREGADO';
  const marcaSiguiente = siguienteEstado ? marcaDeEstado(siguienteEstado, colores) : null;
  const proporcion = tareas.length ? completadas / tareas.length : 0;

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={[estilos.contenido, { paddingBottom: ESPACIO.xl + margenes.bottom }]}
    >
      {/* ---------------------------------------------------------------
          FICHA DE LA ORDEN
          --------------------------------------------------------------- */}
      <View style={estilos.tarjeta}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: RADIO.md,
              backgroundColor: colores.superficieAlterna,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={marca.icono} size={22} color={marca.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Texto style={{ fontSize: 22, fontWeight: '800', color: colores.texto, letterSpacing: 0.8 }}>
              {orden.codigo_consulta}
            </Texto>
            <Texto style={{ fontSize: 12, fontWeight: '700', color: marca.color, letterSpacing: 0.4 }}>
              {etapa}
            </Texto>
          </View>
        </View>

        {/* Constancia de la anulacion. Va arriba de todo porque cambia como
            se lee el resto: lo que sigue es historia, no trabajo pendiente. */}
        {anulada ? (
          <View style={[estilos.aviso, estilos.avisoError, { marginTop: ESPACIO.md }]}>
            <Ionicons name="close-circle" size={19} color={colores.alerta} />
            <View style={{ flex: 1 }}>
              <Texto style={{ color: colores.alerta, fontSize: 13, fontWeight: '700' }}>
                Anulada el {fechaHora(orden.fecha_anulacion)}, en la etapa {orden.estado?.nombre_estado}
              </Texto>
              <Texto style={{ color: colores.alerta, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                Motivo: {orden.motivo_anulacion}
              </Texto>
              <Texto style={{ color: colores.textoSuave, fontSize: 12, lineHeight: 17, marginTop: ESPACIO.xs }}>
                Su contenido se conserva como constancia y ya no admite cambios.
              </Texto>
            </View>
          </View>
        ) : null}

        {/* Recorrido de etapas. Muestra de un vistazo cuanto le falta a la
            orden para cerrar el ciclo, sin tener que leer la bitacora. */}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: ESPACIO.md }}>
          {ESTADOS_ORDEN.map((estado, indice) => (
            <View
              key={estado}
              style={{
                flex: 1,
                height: 5,
                borderRadius: RADIO.completo,
                backgroundColor: indice < secuenciaActual ? marca.color : colores.superficieAlterna,
              }}
            />
          ))}
        </View>
        <Texto style={{ fontSize: 11, color: colores.textoSuave, marginTop: 5 }}>
          Etapa {secuenciaActual} de {ESTADOS_ORDEN.length}
        </Texto>

        <View style={estilos.separador} />

        <Dato icono="car-sport-outline" fuerte>
          {orden.vehiculo?.placa} · {orden.vehiculo?.marca} {orden.vehiculo?.linea} {orden.vehiculo?.modelo_anio}
        </Dato>
        <Dato icono="person-outline">{orden.vehiculo?.cliente?.nombre_completo}</Dato>
        {orden.vehiculo?.cliente?.telefono ? (
          <Dato icono="call-outline">{orden.vehiculo.cliente.telefono}</Dato>
        ) : null}
        <Dato icono="clipboard-outline">Recibio {orden.usuario?.nombre_completo}</Dato>
        <Dato icono="speedometer-outline">
          {orden.kilometraje_ingreso !== null && orden.kilometraje_ingreso !== undefined
            ? `Ingreso con ${orden.kilometraje_ingreso} km`
            : 'Kilometraje de ingreso sin dato'}
        </Dato>

        {/* Lo que reporto el cliente, en palabras del mecanico. Se distingue
            del resto de la ficha porque es lo unico que no es un dato. */}
        <View
          style={{
            marginTop: ESPACIO.md,
            paddingLeft: ESPACIO.sm,
            borderLeftWidth: 3,
            borderLeftColor: colores.plata,
          }}
        >
          <Texto style={{ fontSize: 11, color: colores.textoSuave, fontWeight: '700', letterSpacing: 0.4 }}>
            REPORTE DEL CLIENTE
          </Texto>
          <Texto style={{ fontSize: 14, color: colores.texto, lineHeight: 20, marginTop: 2 }}>
            {orden.descripcion_falla}
          </Texto>
        </View>

        {orden.observaciones ? (
          <View
            style={{
              marginTop: ESPACIO.sm,
              paddingLeft: ESPACIO.sm,
              borderLeftWidth: 3,
              borderLeftColor: colores.aviso,
            }}
          >
            <Texto style={{ fontSize: 11, color: colores.textoSuave, fontWeight: '700', letterSpacing: 0.4 }}>
              NOTA DEL MECANICO
            </Texto>
            <Texto style={{ fontSize: 14, color: colores.texto, lineHeight: 20, marginTop: 2 }}>
              {orden.observaciones}
            </Texto>
          </View>
        ) : null}

        {!anulada ? (
          <Pressable
            onPress={() => setEditando(true)}
            hitSlop={8}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 5,
                marginTop: ESPACIO.md,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: RADIO.completo,
                borderWidth: 1,
                borderColor: colores.borde,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="pencil" size={13} color={colores.textoSuave} />
            <Texto style={{ fontSize: 12, fontWeight: '600', color: colores.textoSuave }}>
              Corregir kilometraje o nota
            </Texto>
          </Pressable>
        ) : null}

        {/* Acceso al historial del vehiculo.
            Reside aqui porque es al diagnosticar cuando hace falta: si el
            vehiculo ya vino por lo mismo hace dos meses, el mecanico parte de
            esa revision en lugar de repetirla. */}
        {orden.vehiculo?.id_vehiculo ? (
          <Pressable
            onPress={() =>
              navigation.navigate('HistorialVehiculo', {
                vehiculo: orden.vehiculo,
                idVehiculo: orden.vehiculo.id_vehiculo,
              })
            }
            hitSlop={8}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: ESPACIO.md,
                paddingTop: ESPACIO.sm,
                borderTopWidth: 1,
                borderTopColor: colores.borde,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="time-outline" size={16} color={colores.enlace} />
            <Texto style={{ fontSize: 13, fontWeight: '700', color: colores.enlace, flex: 1 }}>
              Ver historial de este vehiculo
            </Texto>
            <Ionicons name="chevron-forward" size={16} color={colores.textoSuave} />
          </Pressable>
        ) : null}
      </View>

      {/* ---------------------------------------------------------------
          DIAGNOSTICO
          --------------------------------------------------------------- */}
      <Rotulo texto="DIAGNOSTICO SUGERIDO" />
      <View style={estilos.tarjeta}>
        {diagnosticos.length === 0 ? (
          <Texto style={estilos.tarjetaDetalle}>La descripcion se derivo a revision manual.</Texto>
        ) : (
          diagnosticos.map((d, indice) => {
            const generativo = d.origen_interpretacion === 'GENERATIVO';
            const sinLectura = !d.categoria && !generativo;
            const confianza = Math.max(0, Math.min(1, Number(d.nivel_confianza) || 0));

            return (
              <View
                key={d.id_diagnostico}
                style={
                  indice > 0
                    ? { marginTop: ESPACIO.md, paddingTop: ESPACIO.md, borderTopWidth: 1, borderTopColor: colores.borde }
                    : null
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACIO.sm }}>
                  <Ionicons
                    name={generativo ? 'sparkles-outline' : sinLectura ? 'help-circle-outline' : 'medical-outline'}
                    size={20}
                    color={generativo ? colores.aviso : sinLectura ? colores.textoSuave : colores.acento}
                    style={{ marginTop: 1 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Texto style={{ color: colores.texto, fontSize: 16, fontWeight: '700' }}>
                      {d.categoria?.nombre_categoria ||
                        d.sistema_sugerido ||
                        'Sin correspondencia dentro del catalogo'}
                    </Texto>

                    {/* Sin categoria del catalogo, el titulo ya presenta el
                        sistema que senala el asistente, de modo que repetirlo
                        aqui solo ocupa pantalla. */}
                    {d.categoria ? (
                      <Texto style={estilos.tarjetaDetalle}>Sistema {d.categoria.sistema_vehicular}</Texto>
                    ) : !d.sistema_sugerido ? (
                      <Texto style={estilos.tarjetaDetalle}>
                        La descripcion no permitio ubicar un sistema del vehiculo.
                      </Texto>
                    ) : null}
                  </View>
                </View>

                {d.hallazgo ? (
                  <Texto style={{ color: colores.texto, fontSize: 14, lineHeight: 20, marginTop: ESPACIO.sm }}>
                    {d.hallazgo}
                  </Texto>
                ) : null}

                {d.texto_interpretado ? (
                  <Texto style={[estilos.tarjetaDetalle, { marginTop: ESPACIO.xs }]}>{d.texto_interpretado}</Texto>
                ) : null}

                {/* Confianza y procedencia de la lectura, en un solo renglon.
                    La barra traduce el numero a una impresion inmediata; el
                    numero permanece para quien quiera la cifra. */}
                <View style={{ marginTop: ESPACIO.sm }}>
                  <View style={estilos.fila}>
                    <Texto style={{ fontSize: 11, color: colores.textoSuave }}>
                      Confianza {(confianza * 100).toFixed(1)} %
                    </Texto>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: RADIO.completo,
                        backgroundColor: colores.superficieAlterna,
                      }}
                    >
                      <Texto style={{ fontSize: 10, fontWeight: '700', color: colores.textoSuave, letterSpacing: 0.4 }}>
                        {d.origen_interpretacion}
                      </Texto>
                    </View>
                  </View>
                  <View
                    style={{
                      height: 4,
                      borderRadius: RADIO.completo,
                      backgroundColor: colores.superficieAlterna,
                      marginTop: 5,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${confianza * 100}%`,
                        height: 4,
                        backgroundColor: generativo ? colores.aviso : colores.textoSuave,
                      }}
                    />
                  </View>
                </View>

                {/* La procedencia de la lectura permanece a la vista. Una
                    sugerencia del asistente no goza del respaldo de la base de
                    conocimiento del taller y el mecanico requiere saberlo
                    antes de trabajar sobre ella. */}
                {generativo ? (
                  <View style={[estilos.aviso, estilos.avisoAtencion, { marginTop: ESPACIO.sm }]}>
                    <Ionicons name="information-circle" size={17} color={colores.aviso} />
                    <Texto style={{ color: colores.aviso, fontSize: 12, lineHeight: 17, flex: 1 }}>
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

      {/* ---------------------------------------------------------------
          TAREAS DE REVISION
          --------------------------------------------------------------- */}
      <Rotulo
        texto="TAREAS DE REVISION"
        derecha={
          tareas.length ? (
            <Texto
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: completadas === tareas.length ? colores.exito : colores.textoSuave,
              }}
            >
              {completadas} de {tareas.length}
            </Texto>
          ) : null
        }
      />
      <View style={estilos.tarjeta}>
        {tareas.length ? (
          <View
            style={{
              height: 6,
              borderRadius: RADIO.completo,
              backgroundColor: colores.superficieAlterna,
              overflow: 'hidden',
              marginBottom: ESPACIO.xs,
            }}
          >
            <View
              style={{
                width: `${proporcion * 100}%`,
                height: 6,
                backgroundColor: completadas === tareas.length ? colores.exito : colores.acento,
              }}
            />
          </View>
        ) : null}

        {tareas.length === 0 ? (
          <Texto style={estilos.tarjetaDetalle}>Sin tareas asignadas.</Texto>
        ) : (
          tareas.map((t, indice) => {
            // Una tarea procede del catalogo del taller o de una sugerencia
            // del asistente. Ambas se marcan igual, pero se leen distinto.
            const sugerida = t.origen === 'GENERATIVO';
            const nombre = sugerida ? t.nombre_tarea_sugerida : t.tarea?.nombre_tarea;
            const minutos = sugerida ? t.tiempo_sugerido_min : t.tarea?.tiempo_estimado_min;
            const enCurso = tareaEnCurso === t.id_detalle;

            return (
              <Pressable
                key={t.id_detalle}
                onPress={() => alternarTarea(t)}
                disabled={tareaEnCurso !== null || anulada}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: ESPACIO.sm,
                    // Alto minimo de toque: el mecanico marca con el pulgar y
                    // a veces con guantes.
                    minHeight: 48,
                    paddingVertical: ESPACIO.sm,
                    borderTopWidth: indice === 0 ? 0 : 1,
                    borderTopColor: colores.borde,
                  },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <View style={{ width: 24, alignItems: 'center' }}>
                  {enCurso ? (
                    <ActivityIndicator size="small" color={colores.acento} />
                  ) : (
                    <Ionicons
                      name={t.completada ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={t.completada ? colores.exito : colores.bordeFuerte}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Texto
                    style={{
                      color: t.completada ? colores.textoSuave : colores.texto,
                      fontSize: 14,
                      fontWeight: '600',
                      lineHeight: 19,
                    }}
                  >
                    {nombre}
                  </Texto>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm, marginTop: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="time-outline" size={12} color={colores.textoSuave} />
                      <Texto style={{ fontSize: 12, color: colores.textoSuave }}>{minutos} min</Texto>
                    </View>
                    {sugerida ? (
                      <View
                        style={{
                          paddingHorizontal: 7,
                          paddingVertical: 1,
                          borderRadius: RADIO.completo,
                          backgroundColor: colores.avisoTenue,
                          borderWidth: 1,
                          borderColor: colores.aviso,
                        }}
                      >
                        <Texto style={{ color: colores.aviso, fontSize: 10, fontWeight: '700' }}>SUGERIDA</Texto>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}

        {orden.tiempo_estimado_min ? (
          <View
            style={[
              estilos.fila,
              { marginTop: ESPACIO.sm, paddingTop: ESPACIO.sm, borderTopWidth: 1, borderTopColor: colores.borde },
            ]}
          >
            <Texto style={{ fontSize: 13, color: colores.textoSuave }}>Tiempo total estimado</Texto>
            <Texto style={{ fontSize: 15, fontWeight: '800', color: colores.texto }}>
              {orden.tiempo_estimado_min} min
            </Texto>
          </View>
        ) : null}
      </View>

      {/* ---------------------------------------------------------------
          EVIDENCIA FOTOGRAFICA
          --------------------------------------------------------------- */}
      <Rotulo
        texto="EVIDENCIA FOTOGRAFICA"
        derecha={
          anulada ? null : (
          <Pressable
            onPress={agregarEvidencia}
            disabled={subiendoFoto}
            hitSlop={8}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: RADIO.completo,
                borderWidth: 1,
                borderColor: colores.bordeFuerte,
                backgroundColor: colores.superficie,
              },
              (pressed || subiendoFoto) && { opacity: 0.6 },
            ]}
          >
            {subiendoFoto ? (
              <ActivityIndicator size="small" color={colores.texto} />
            ) : (
              <Ionicons name="camera-outline" size={15} color={colores.texto} />
            )}
            <Texto style={{ fontSize: 12, fontWeight: '700', color: colores.texto }}>
              {subiendoFoto ? 'Subiendo...' : 'Agregar'}
            </Texto>
          </Pressable>
          )
        }
      />
      <View style={estilos.tarjeta}>
        {fotografias.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm }}>
            <Ionicons name="images-outline" size={20} color={colores.textoSuave} />
            <Texto style={[estilos.tarjetaDetalle, { marginTop: 0, flex: 1 }]}>
              Sin fotografias resguardadas. Cada fotografia queda marcada con la etapa en que se tomo.
            </Texto>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: ESPACIO.sm }}>
            {fotografias.map((f) => (
              <View key={f.id_fotografia}>
                {f.enlace ? (
                  <Image
                    source={{ uri: f.enlace }}
                    style={{
                      width: 130,
                      height: 130,
                      borderRadius: RADIO.md,
                      borderWidth: 1,
                      borderColor: colores.borde,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 130,
                      height: 130,
                      borderRadius: RADIO.md,
                      backgroundColor: colores.superficieAlterna,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="image-outline" size={28} color={colores.textoSuave} />
                  </View>
                )}
                <View
                  style={{
                    position: 'absolute',
                    left: 6,
                    bottom: 6,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: RADIO.completo,
                    backgroundColor: 'rgba(11, 15, 20, 0.72)',
                  }}
                >
                  <Texto style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 }}>
                    {f.etapa}
                  </Texto>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ---------------------------------------------------------------
          BITACORA
          --------------------------------------------------------------- */}
      <Rotulo texto="BITACORA DE ESTADOS" />
      <View style={estilos.tarjeta}>
        {bitacora.map((b, indice) => {
          const marcaAsiento = marcaDeEstado(b.estado?.nombre_estado, colores);
          const ultimo = indice === bitacora.length - 1;

          return (
            <View key={b.id_bitacora} style={{ flexDirection: 'row', gap: ESPACIO.sm }}>
              {/* Linea de tiempo: un punto por asiento y un trazo que los une. */}
              <View style={{ alignItems: 'center', width: 14 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: RADIO.completo,
                    backgroundColor: marcaAsiento.color,
                    marginTop: 3,
                  }}
                />
                {!ultimo ? <View style={{ flex: 1, width: 2, backgroundColor: colores.borde, marginTop: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: ultimo ? 0 : ESPACIO.md }}>
                <Texto style={{ color: colores.texto, fontSize: 14, fontWeight: '700' }}>
                  {b.estado?.nombre_estado}
                </Texto>
                <Texto style={{ fontSize: 12, color: colores.textoSuave, marginTop: 1 }}>
                  {fechaHora(b.fecha_cambio)}
                  {b.usuario?.nombre_completo ? ` · ${b.usuario.nombre_completo}` : ''}
                </Texto>
                {b.comentario ? (
                  <Texto style={{ fontSize: 13, color: colores.texto, marginTop: 3, lineHeight: 18 }}>
                    {b.comentario}
                  </Texto>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />

      {anulada ? null : siguienteEstado ? (
        <Boton
          titulo={`Avanzar hacia ${siguienteEstado}`}
          icono={marcaSiguiente?.icono}
          alPresionar={() => avanzarEstado(siguienteEstado)}
          ocupado={avanzando}
          variante="principal"
        />
      ) : (
        <View
          style={[
            estilos.aviso,
            estilos.avisoExito,
            { marginTop: ESPACIO.md, alignItems: 'center' },
          ]}
        >
          <Ionicons name="checkmark-circle" size={19} color={colores.exito} />
          <Texto style={{ color: colores.exito, fontSize: 13, fontWeight: '600', flex: 1 }}>
            La orden concluyo el ciclo de estados.
          </Texto>
        </View>
      )}

      {/* Anular queda al pie y con aspecto de accion secundaria, separado del
          boton de avanzar: es una decision poco frecuente y no debe tocarse
          por error al querer avanzar la etapa. Solo lo ve el propietario. */}
      {admiteAnular ? (
        <Pressable
          onPress={() => setAnulando(true)}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: ESPACIO.lg,
              paddingVertical: 12,
              borderRadius: RADIO.md,
              borderWidth: 1.5,
              borderColor: colores.alerta,
            },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="close-circle-outline" size={18} color={colores.alerta} />
          <Texto style={{ color: colores.alerta, fontSize: 14, fontWeight: '700' }}>Anular orden</Texto>
        </Pressable>
      ) : null}

      <VentanaEdicion
        visible={editando}
        orden={orden}
        alCerrar={() => setEditando(false)}
        alGuardar={async () => {
          setEditando(false);
          await consultar();
        }}
      />
      <VentanaAnulacion
        visible={anulando}
        orden={orden}
        alCerrar={() => setAnulando(false)}
        alAnular={async () => {
          setAnulando(false);
          await consultar();
        }}
      />
    </ScrollView>
  );
}

/** Marco comun de las dos ventanas: titulo, cierre y contenido desplazable. */
function MarcoVentana({ visible, titulo, alCerrar, children }) {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={alCerrar}>
      {/* Mismo margen superior que las ventanas de seleccion de cliente y de
          vehiculo, ya comprobadas en el telefono. */}
      <KeyboardAvoidingView
        style={[estilos.pantalla, { paddingTop: margenes.top + ESPACIO.sm }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[estilos.fila, { paddingHorizontal: ESPACIO.md, marginBottom: ESPACIO.sm }]}>
          <Texto style={[estilos.titulo, { marginBottom: 0, flex: 1 }]}>{titulo}</Texto>
          <Pressable
            onPress={alCerrar}
            hitSlop={10}
            style={({ pressed }) => [
              {
                width: 34,
                height: 34,
                borderRadius: RADIO.completo,
                backgroundColor: colores.superficieAlterna,
                alignItems: 'center',
                justifyContent: 'center',
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="close" size={20} color={colores.texto} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: ESPACIO.md,
            paddingBottom: ESPACIO.xl + margenes.bottom,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Correccion del kilometraje de ingreso y de la nota del mecanico.
 *
 * Los valores se cargan cada vez que la ventana se abre, de modo que si se
 * cancela una edicion a medias la siguiente apertura parte de lo guardado y no
 * de lo que quedo escrito.
 */
function VentanaEdicion({ visible, orden, alCerrar, alGuardar }) {
  const { estilos } = useTema();
  const [kilometraje, setKilometraje] = useState('');
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setKilometraje(
      orden?.kilometraje_ingreso !== null && orden?.kilometraje_ingreso !== undefined
        ? String(orden.kilometraje_ingreso)
        : ''
    );
    setNota(orden?.observaciones || '');
    setError('');
  }, [visible, orden]);

  const kmLimpio = kilometraje.trim();
  const kmValido = kmLimpio === '' || /^\d{1,7}$/.test(kmLimpio);

  async function guardar() {
    setError('');
    setOcupado(true);
    try {
      await api.editarOrden(orden.id_orden, {
        kilometraje: kmLimpio === '' ? null : Number(kmLimpio),
        observaciones: nota.trim() || null,
      });
      await alGuardar();
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <MarcoVentana visible={visible} titulo="Corregir datos" alCerrar={alCerrar}>
      <Texto style={estilos.subtitulo}>
        Solo se corrigen datos que no cambian el diagnostico. Si la descripcion de la falla o el
        vehiculo estaban mal, conviene que el propietario anule esta orden y crear otra.
      </Texto>

      <Campo
        etiqueta="Kilometraje de ingreso"
        value={kilometraje}
        onChangeText={(texto) => setKilometraje(texto.replace(/[^0-9]/g, ''))}
        placeholder="85000"
        keyboardType="number-pad"
        icono="speedometer-outline"
        maxLength={7}
        invalido={!kmValido}
        ayuda="Si esta es la visita mas reciente del vehiculo, tambien se actualiza su ficha."
      />

      <Campo
        etiqueta="Nota del mecanico (opcional)"
        value={nota}
        onChangeText={setNota}
        placeholder="Por ejemplo: avisar por telefono"
        amplio
        maxLength={500}
        ayuda={`${nota.length} de 500 caracteres. Queda a la vista en el detalle de la orden.`}
      />

      <Aviso mensaje={error} />

      <Boton
        titulo="Guardar correccion"
        icono="save-outline"
        alPresionar={guardar}
        ocupado={ocupado}
        deshabilitado={!kmValido}
      />
      <Boton titulo="Cancelar" variante="secundario" alPresionar={alCerrar} />
    </MarcoVentana>
  );
}

/**
 * Anulacion con motivo. Solo la abre el propietario.
 *
 * La ventana misma es la confirmacion: explica que pasa, exige el motivo y
 * pide un toque mas. No se usa un dialogo de "esta seguro" encima, porque
 * escribir el motivo ya obliga a detenerse.
 */
function VentanaAnulacion({ visible, orden, alCerrar, alAnular }) {
  const { colores, estilos } = useTema();
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMotivo('');
    setError('');
  }, [visible]);

  const motivoValido = motivo.trim().length >= 5;

  async function anular() {
    setError('');
    setOcupado(true);
    try {
      await api.anularOrden(orden.id_orden, motivo.trim());
      await alAnular();
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <MarcoVentana visible={visible} titulo={`Anular ${orden?.codigo_consulta || ''}`} alCerrar={alCerrar}>
      <View style={[estilos.aviso, estilos.avisoAtencion, { marginTop: 0 }]}>
        <Ionicons name="information-circle" size={19} color={colores.aviso} />
        <Texto style={{ color: colores.aviso, fontSize: 13, lineHeight: 18, flex: 1 }}>
          La orden sale del trabajo activo y ya no admite cambios. No se borra nada: diagnostico,
          tareas, fotografias y bitacora quedan como constancia. El cliente que consulte el codigo
          vera que fue anulada, sin el motivo.
        </Texto>
      </View>

      <Campo
        etiqueta="Motivo de la anulacion"
        value={motivo}
        onChangeText={setMotivo}
        placeholder="Por ejemplo: el cliente desistio"
        amplio
        maxLength={160}
        ayuda={`Obligatorio, al menos 5 caracteres. Queda en la bitacora. ${motivo.length} de 160.`}
      />

      <Aviso mensaje={error} />

      <Pressable
        onPress={anular}
        disabled={!motivoValido || ocupado}
        style={({ pressed }) => [
          estilos.boton,
          { backgroundColor: colores.alerta },
          (!motivoValido || ocupado) && estilos.botonInactivo,
          pressed && motivoValido && !ocupado && { opacity: 0.85 },
        ]}
      >
        {ocupado ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="close-circle-outline" size={19} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Texto style={estilos.botonTexto}>Anular la orden</Texto>
          </>
        )}
      </Pressable>
      <Boton titulo="Cancelar" variante="secundario" alPresionar={alCerrar} />
    </MarcoVentana>
  );
}
