/**
 * MODULO M3 - RECEPCION Y CAPTURA DE FALLAS.
 *
 * El mecanico describe el problema con palabras propias y adjunta fotografias
 * del componente. El servidor traslada esa informacion hacia la capa de
 * interpretacion y despues hacia el motor de reglas, que devuelve las tareas
 * de revision y el tiempo estimado de la orden.
 *
 * CRITERIOS DE LA PANTALLA
 *
 * El mecanico opera con el vehiculo enfrente, el cliente esperando y a menudo
 * una sola mano libre. De ahi tres decisiones:
 *
 *   - La eleccion del vehiculo parte del cliente. Los vehiculos aparecen
 *     agrupados bajo su dueño, y cuando el cliente posee uno solo, el toque
 *     sobre su nombre ya selecciona ese vehiculo. Un paso menos.
 *   - Las fotografias se reducen dentro del telefono antes de viajar. Una
 *     imagen de la camara ronda varios megabytes, y esa carga atraviesa dos
 *     tramos: hacia el servidor del taller y de ahi hacia el servicio de
 *     interpretacion. La orden RSKFQB65 del 10 de septiembre de 2026 quedo sin
 *     diagnostico porque el servicio no alcanzo a responder dentro del plazo.
 *   - La accion principal permanece fija al pie, por encima de los botones del
 *     telefono, de modo que no obliga a desplazar la pantalla para enviarla.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { Aviso, Boton, Campo, Cargando, Distintivo, EstadoVacio } from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

/** Cantidad maxima de fotografias por orden. */
const MAXIMO_FOTOGRAFIAS = 4;

/** Ancho al que se reduce cada fotografia antes de enviarla, en pixeles. */
const ANCHO_ENVIO = 1280;

/** Longitud minima de la descripcion segun exista o no evidencia fotografica. */
const MINIMO_CON_FOTO = 4;
const MINIMO_SIN_FOTO = 10;

/**
 * Reduce una imagen y devuelve su contenido en base64.
 *
 * Ante una falla del reductor devuelve la imagen original, porque una orden
 * con una fotografia pesada resulta preferible a una orden sin evidencia.
 */
async function prepararImagen(activo) {
  try {
    const resultado = await ImageManipulator.manipulateAsync(
      activo.uri,
      [{ resize: { width: ANCHO_ENVIO } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return {
      uri: resultado.uri,
      base64: resultado.base64,
      tipoMime: 'image/jpeg',
      reducida: true,
    };
  } catch (error) {
    return {
      uri: activo.uri,
      base64: activo.base64,
      tipoMime: activo.mimeType || 'image/jpeg',
      reducida: false,
    };
  }
}

export default function OrdenNueva({ navigation }) {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();

  const [vehiculo, setVehiculo] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [imagenes, setImagenes] = useState([]);
  const [ventanaVisible, setVentanaVisible] = useState(false);

  const [preparando, setPreparando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const minimoTexto = imagenes.length ? MINIMO_CON_FOTO : MINIMO_SIN_FOTO;
  const listo = Boolean(vehiculo) && descripcion.trim().length >= minimoTexto;

  /** Incorpora una imagen recien capturada o elegida. */
  async function incorporar(activo) {
    setPreparando(true);
    try {
      const preparada = await prepararImagen(activo);
      setImagenes((previas) => [...previas, preparada].slice(0, MAXIMO_FOTOGRAFIAS));
    } finally {
      setPreparando(false);
    }
  }

  async function tomarFotografia() {
    setError('');
    if (imagenes.length >= MAXIMO_FOTOGRAFIAS) return;

    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError('La aplicacion requiere permiso de camara para adjuntar la evidencia.');
      return;
    }
    const captura = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (!captura.canceled && captura.assets?.length) await incorporar(captura.assets[0]);
  }

  async function elegirFotografia() {
    setError('');
    const restantes = MAXIMO_FOTOGRAFIAS - imagenes.length;
    if (restantes <= 0) return;

    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError('La aplicacion requiere permiso de galeria para adjuntar la evidencia.');
      return;
    }
    const eleccion = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ['images'],
      allowsMultipleSelection: restantes > 1,
      selectionLimit: restantes,
    });
    if (eleccion.canceled || !eleccion.assets?.length) return;

    setPreparando(true);
    try {
      const preparadas = [];
      for (const activo of eleccion.assets.slice(0, restantes)) {
        preparadas.push(await prepararImagen(activo));
      }
      setImagenes((previas) => [...previas, ...preparadas].slice(0, MAXIMO_FOTOGRAFIAS));
    } finally {
      setPreparando(false);
    }
  }

  function quitarImagen(indice) {
    setImagenes((previas) => previas.filter((_, i) => i !== indice));
  }

  async function registrar() {
    setError('');
    setResultado(null);

    if (!vehiculo) {
      setError('Falta elegir el vehiculo que ingresa al taller.');
      return;
    }
    if (descripcion.trim().length < minimoTexto) {
      setError(
        imagenes.length
          ? 'La descripcion requiere al menos cuatro caracteres.'
          : 'Sin fotografia, la descripcion requiere al menos diez caracteres. Con una imagen adjunta bastan cuatro.'
      );
      return;
    }

    setOcupado(true);
    try {
      const cuerpo = {
        idVehiculo: vehiculo.id_vehiculo,
        descripcionFalla: descripcion.trim(),
      };
      if (kilometraje !== '') cuerpo.kilometraje = Number(kilometraje);

      const utiles = imagenes.filter((i) => i.base64);
      if (utiles.length) {
        cuerpo.fotografias = utiles.map((i) => ({ datos: i.base64, tipoMime: i.tipoMime }));
      }

      setResultado(await api.crearOrden(cuerpo));
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  function reiniciar() {
    setResultado(null);
    setVehiculo(null);
    setDescripcion('');
    setKilometraje('');
    setImagenes([]);
  }

  // ------------------------------------------------------------------------
  //  RESULTADO
  // ------------------------------------------------------------------------
  if (resultado) {
    const { orden, interpretacion, diagnostico } = resultado;
    const generativo = interpretacion.origen === 'GENERATIVO';
    const conTareas = diagnostico.aplicada || (resultado.tareasSugeridas || []).length > 0;
    const tareas = diagnostico.aplicada
      ? diagnostico.tareas.map((t) => ({ nombre: t.nombre, minutos: t.minutos, sugerida: false }))
      : (resultado.tareasSugeridas || []).map((t) => ({ ...t, sugerida: true }));
    const minutos = tareas.reduce((total, t) => total + t.minutos, 0);

    return (
      <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
        <View
          style={[
            estilos.tarjeta,
            { alignItems: 'center', paddingVertical: ESPACIO.lg, borderColor: colores.exito, borderWidth: 1.5 },
          ]}
        >
          <Ionicons name="checkmark-circle" size={40} color={colores.exito} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: colores.texto, marginTop: ESPACIO.sm }}>
            Orden generada
          </Text>
          <Text style={{ fontSize: 12, color: colores.textoSuave, marginTop: 2 }}>
            Codigo de consulta para el cliente
          </Text>
          <Text
            style={{
              fontSize: 34,
              fontWeight: '800',
              color: colores.acento,
              letterSpacing: 4,
              marginTop: ESPACIO.sm,
            }}
          >
            {orden.codigo_consulta}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colores.textoSuave,
              textAlign: 'center',
              marginTop: ESPACIO.sm,
              lineHeight: 17,
            }}
          >
            Con este codigo el cliente consulta el avance sin llamar al taller.
          </Text>
        </View>

        <View style={estilos.tarjeta}>
          <Text style={estilos.tarjetaTitulo}>Interpretacion de la falla</Text>
          <Text style={[estilos.tarjetaDetalle, { color: colores.texto, fontSize: 15, marginTop: ESPACIO.xs }]}>
            {diagnostico.categoria || interpretacion.sistemaSugerido || 'Sin correspondencia dentro del catalogo'}
          </Text>
          {interpretacion.hallazgo ? (
            <Text style={estilos.tarjetaDetalle}>{interpretacion.hallazgo}</Text>
          ) : null}
          <Text style={estilos.tarjetaDetalle}>
            Confianza {(Number(interpretacion.nivelConfianza) * 100).toFixed(0)} % · origen{' '}
            {interpretacion.origen}
          </Text>

          {generativo ? (
            <View style={[estilos.aviso, estilos.avisoAtencion, { marginTop: ESPACIO.sm }]}>
              <Ionicons name="information-circle" size={18} color={colores.aviso} />
              <Text style={{ color: colores.aviso, fontSize: 12, flex: 1, lineHeight: 17 }}>
                Lectura del asistente, fuera del catalogo del taller. Conviene confirmarla con
                criterio propio.
              </Text>
            </View>
          ) : null}
        </View>

        {conTareas ? (
          <View style={estilos.tarjeta}>
            <View style={estilos.fila}>
              <Text style={estilos.tarjetaTitulo}>Tareas de revision</Text>
              <Distintivo texto={`${minutos} MIN`} color={colores.acento} />
            </View>
            {tareas.map((tarea, indice) => (
              <View
                key={`${tarea.nombre}-${indice}`}
                style={{ flexDirection: 'row', gap: ESPACIO.sm, marginTop: ESPACIO.sm }}
              >
                <Text style={{ color: colores.textoSuave, fontSize: 13, fontWeight: '700', width: 20 }}>
                  {indice + 1}.
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colores.texto, fontSize: 14 }}>{tarea.nombre}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm, marginTop: 2 }}>
                    <Text style={estilos.tarjetaDetalle}>{tarea.minutos} minutos</Text>
                    {tarea.sugerida ? (
                      <View
                        style={{
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: RADIO.completo,
                          backgroundColor: colores.avisoTenue,
                          borderWidth: 1,
                          borderColor: colores.aviso,
                        }}
                      >
                        <Text style={{ color: colores.aviso, fontSize: 10, fontWeight: '800' }}>SUGERIDA</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={estilos.tarjeta}>
            <Text style={estilos.tarjetaTitulo}>Revision manual</Text>
            <Text style={estilos.tarjetaDetalle}>{diagnostico.motivo}</Text>
          </View>
        )}

        <Boton
          titulo="Ver la orden completa"
          icono="document-text-outline"
          alPresionar={() => navigation.replace('OrdenDetalle', { idOrden: orden.id_orden })}
        />
        <Boton titulo="Registrar otro ingreso" variante="secundario" icono="add" alPresionar={reiniciar} />
      </ScrollView>
    );
  }

  // ------------------------------------------------------------------------
  //  FORMULARIO
  // ------------------------------------------------------------------------
  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: 120 + margenes.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Vehiculo */}
        <Text style={[estilos.etiqueta, { marginTop: 0 }]}>Vehiculo que ingresa</Text>
        <Pressable
          style={({ pressed }) => [
            estilos.campo,
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: ESPACIO.sm,
              paddingVertical: vehiculo ? 12 : 14,
              borderColor: vehiculo ? colores.borde : colores.bordeFuerte,
            },
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setVentanaVisible(true)}
        >
          <Ionicons
            name={vehiculo ? 'car-sport' : 'car-sport-outline'}
            size={22}
            color={vehiculo ? colores.acento : colores.textoSuave}
          />
          <View style={{ flex: 1 }}>
            {vehiculo ? (
              <>
                <Text style={{ color: colores.texto, fontSize: 15, fontWeight: '700' }}>
                  {vehiculo.placa} · {vehiculo.marca} {vehiculo.linea}
                </Text>
                <Text style={{ color: colores.textoSuave, fontSize: 12 }}>
                  {vehiculo.cliente?.nombre_completo}
                </Text>
              </>
            ) : (
              <Text style={{ color: colores.textoSuave, fontSize: 15 }}>Elegir cliente y vehiculo</Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={18} color={colores.textoSuave} />
        </Pressable>

        {/* Descripcion */}
        <Campo
          etiqueta="Que reporta el cliente"
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Al frenar se escucha un ruido metalico y el pedal se siente esponjoso."
          ayuda={
            imagenes.length
              ? 'Con fotografia adjunta, unas pocas palabras bastan: el asistente lee la imagen.'
              : 'Escribir con palabras propias. Mientras mas concreto el sintoma, mejor la revision.'
          }
          amplio
        />

        {/* Kilometraje */}
        <Campo
          etiqueta="Kilometraje"
          value={kilometraje}
          onChangeText={setKilometraje}
          placeholder="85000"
          keyboardType="number-pad"
          icono="speedometer-outline"
          ayuda="Opcional. Al guardarlo, el kilometraje del vehiculo queda actualizado."
        />

        {/* Fotografias */}
        <View style={[estilos.fila, { marginTop: ESPACIO.md }]}>
          <Text style={[estilos.etiqueta, { marginTop: 0, marginBottom: 0 }]}>Evidencia fotografica</Text>
          <Text style={{ color: colores.textoSuave, fontSize: 12, fontWeight: '600' }}>
            {imagenes.length} de {MAXIMO_FOTOGRAFIAS}
          </Text>
        </View>
        <Text style={[estilos.ayuda, { marginTop: 0, marginBottom: ESPACIO.sm }]}>
          La primera imagen acompana a la interpretacion. Las demas quedan como respaldo de la orden.
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACIO.sm }}>
          {imagenes.map((imagen, indice) => (
            <View key={`${imagen.uri}-${indice}`}>
              <Image
                source={{ uri: imagen.uri }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: RADIO.md,
                  borderWidth: 1,
                  borderColor: colores.borde,
                }}
              />
              {indice === 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 4,
                    bottom: 4,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: RADIO.completo,
                    backgroundColor: colores.acento,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>ANALIZA</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => quitarImagen(indice)}
                hitSlop={8}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colores.alerta,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}

          {imagenes.length < MAXIMO_FOTOGRAFIAS ? (
            <>
              <Pressable
                onPress={tomarFotografia}
                disabled={preparando}
                style={({ pressed }) => [
                  {
                    width: 96,
                    height: 96,
                    borderRadius: RADIO.md,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: colores.bordeFuerte,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colores.superficie,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                {preparando ? (
                  <ActivityIndicator color={colores.acento} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={24} color={colores.acento} />
                    <Text style={{ fontSize: 11, color: colores.textoSuave, marginTop: 4 }}>Camara</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={elegirFotografia}
                disabled={preparando}
                style={({ pressed }) => [
                  {
                    width: 96,
                    height: 96,
                    borderRadius: RADIO.md,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: colores.bordeFuerte,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colores.superficie,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="images-outline" size={24} color={colores.textoSuave} />
                <Text style={{ fontSize: 11, color: colores.textoSuave, marginTop: 4 }}>Galeria</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        <Aviso mensaje={error} />

        <Text
          style={{
            marginTop: ESPACIO.lg,
            fontSize: 11,
            color: colores.textoSuave,
            textAlign: 'center',
            lineHeight: 16,
          }}
        >
          La placa del vehiculo permanece dentro de la base de datos del taller y no viaja hacia el
          servicio externo de interpretacion.
        </Text>
      </ScrollView>

      {/* Accion principal fija al pie */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: ESPACIO.md,
          paddingTop: ESPACIO.sm,
          paddingBottom: ESPACIO.sm + margenes.bottom,
          backgroundColor: colores.superficie,
          borderTopWidth: 1,
          borderTopColor: colores.borde,
        }}
      >
        {!listo ? (
          <Text style={{ fontSize: 12, color: colores.textoSuave, textAlign: 'center', marginBottom: 4 }}>
            {!vehiculo ? 'Falta elegir el vehiculo' : 'Falta describir la falla'}
          </Text>
        ) : null}
        <Boton
          titulo={ocupado ? 'Generando el diagnostico' : 'Generar la orden de trabajo'}
          icono="sparkles-outline"
          alPresionar={registrar}
          ocupado={ocupado}
          deshabilitado={!listo || preparando}
        />
      </View>

      <SelectorVehiculo
        visible={ventanaVisible}
        alCerrar={() => setVentanaVisible(false)}
        alSeleccionar={(elegido) => {
          setVehiculo(elegido);
          if (elegido.kilometraje !== null && elegido.kilometraje !== undefined) {
            setKilometraje(String(elegido.kilometraje));
          }
          setVentanaVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * Ventana de seleccion, organizada por cliente.
 *
 * El mecanico piensa en el dueño antes que en la placa, de modo que la lista
 * parte del cliente y despliega los vehiculos que le pertenecen. Cuando el
 * cliente posee un solo vehiculo, el toque sobre su nombre lo selecciona de
 * una vez.
 */
function SelectorVehiculo({ visible, alCerrar, alSeleccionar }) {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();

  const [vehiculos, setVehiculos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setCargando(true);
      setError('');
      try {
        const datos = await api.listarVehiculos();
        setVehiculos(datos.vehiculos);
      } catch (falla) {
        setError(falla.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [visible]);

  // Agrupacion por cliente, con el filtro aplicado sobre ambos niveles.
  const clientes = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    const coincide = (v) =>
      !termino ||
      [v.placa, v.marca, v.linea, String(v.modelo_anio), v.cliente?.nombre_completo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termino);

    const mapa = new Map();
    vehiculos.filter(coincide).forEach((v) => {
      const id = v.cliente?.id_cliente ?? 0;
      if (!mapa.has(id)) {
        mapa.set(id, {
          idCliente: id,
          nombre: v.cliente?.nombre_completo || 'Cliente sin nombre',
          telefono: v.cliente?.telefono || '',
          vehiculos: [],
        });
      }
      mapa.get(id).vehiculos.push(v);
    });

    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [vehiculos, busqueda]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={alCerrar}>
      <View style={[estilos.pantalla, { paddingTop: margenes.top + ESPACIO.sm }]}>
        <View style={{ paddingHorizontal: ESPACIO.md }}>
          <View style={estilos.fila}>
            <Text style={estilos.titulo}>Elegir vehiculo</Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <Ionicons name="close" size={26} color={colores.textoSuave} />
            </Pressable>
          </View>

          <View style={{ justifyContent: 'center', marginTop: ESPACIO.xs }}>
            <TextInput
              style={[estilos.campo, { paddingLeft: 42 }]}
              placeholder="Buscar por cliente, placa o marca"
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
          </View>

          <Aviso mensaje={error} />
        </View>

        {cargando ? (
          <Cargando texto="Consultando vehiculos..." />
        ) : (
          <FlatList
            data={clientes}
            keyExtractor={(item) => String(item.idCliente)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: ESPACIO.md,
              paddingTop: ESPACIO.sm,
              paddingBottom: ESPACIO.xl + margenes.bottom,
            }}
            ListEmptyComponent={
              <EstadoVacio
                icono="people-outline"
                titulo={busqueda ? 'Sin coincidencias' : 'Todavia no hay vehiculos'}
                detalle={
                  busqueda
                    ? 'Ningun cliente ni vehiculo corresponde a esa busqueda.'
                    : 'Los vehiculos se registran desde la pestaña Vehiculos, asociados a su cliente.'
                }
              />
            }
            renderItem={({ item }) => {
              const unico = item.vehiculos.length === 1;
              const desplegado = abierto === item.idCliente || unico || Boolean(busqueda);

              return (
                <View style={[estilos.tarjeta, { padding: 0, overflow: 'hidden' }]}>
                  <Pressable
                    onPress={() => (unico ? alSeleccionar(item.vehiculos[0]) : setAbierto(desplegado && !unico ? null : item.idCliente))}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: ESPACIO.sm,
                        padding: ESPACIO.md,
                      },
                      pressed && { backgroundColor: colores.superficieAlterna },
                    ]}
                  >
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
                      <Ionicons name="person" size={18} color={colores.textoSuave} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colores.texto }}>
                        {item.nombre}
                      </Text>
                      <Text style={{ fontSize: 12, color: colores.textoSuave }}>
                        {item.vehiculos.length === 1
                          ? '1 vehiculo'
                          : `${item.vehiculos.length} vehiculos`}
                        {item.telefono ? ` · ${item.telefono}` : ''}
                      </Text>
                    </View>
                    <Ionicons
                      name={unico ? 'chevron-forward' : desplegado ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colores.textoSuave}
                    />
                  </Pressable>

                  {desplegado
                    ? item.vehiculos.map((v) => (
                        <Pressable
                          key={v.id_vehiculo}
                          onPress={() => alSeleccionar(v)}
                          style={({ pressed }) => [
                            {
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: ESPACIO.sm,
                              paddingVertical: ESPACIO.sm + 2,
                              paddingHorizontal: ESPACIO.md,
                              borderTopWidth: 1,
                              borderTopColor: colores.borde,
                              backgroundColor: colores.superficieAlterna,
                            },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Ionicons name="car-sport-outline" size={18} color={colores.acento} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colores.texto }}>
                              {v.placa}
                            </Text>
                            <Text style={{ fontSize: 12, color: colores.textoSuave }}>
                              {v.marca} {v.linea} {v.modelo_anio}
                              {v.kilometraje ? ` · ${v.kilometraje} km` : ''}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colores.textoSuave} />
                        </Pressable>
                      ))
                    : null}
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}
