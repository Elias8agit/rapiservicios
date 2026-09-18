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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Texto, EntradaTexto } from '../componentes/Texto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Distintivo,
  EstadoVacio,
  OPCIONES_TRANSMISION,
  SelectorSegmentado,
} from '../componentes/Comunes';
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
    // Las dos procedencias se muestran juntas.
    //
    // Desde la profundidad complementaria, una orden que el motor de reglas si
    // resolvio puede traer ademas tareas propuestas por la capa de
    // interpretacion. Antes esta pantalla mostraba una lista o la otra, de modo
    // que en ese caso las complementarias quedaban invisibles pese a estar
    // guardadas y contar dentro del tiempo estimado.
    //
    // La distincion se conserva: la tarea del taller y la sugerida se marcan
    // distinto, porque el mecanico debe saber cual proviene de la base de
    // conocimiento del taller y cual de una sugerencia.
    const tareas = [
      ...(diagnostico.aplicada
        ? diagnostico.tareas.map((t) => ({ nombre: t.nombre, minutos: t.minutos, sugerida: false }))
        : []),
      ...(resultado.tareasSugeridas || []).map((t) => ({
        nombre: t.nombre,
        minutos: t.minutos,
        sugerida: true,
      })),
    ];
    const conTareas = tareas.length > 0;
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
          <Texto style={{ fontSize: 15, fontWeight: '700', color: colores.texto, marginTop: ESPACIO.sm }}>
            Orden generada
          </Texto>
          <Texto style={{ fontSize: 12, color: colores.textoSuave, marginTop: 2 }}>
            Codigo de consulta para el cliente
          </Texto>
          <Texto
            style={{
              fontSize: 34,
              fontWeight: '800',
              color: colores.acento,
              letterSpacing: 4,
              marginTop: ESPACIO.sm,
            }}
          >
            {orden.codigo_consulta}
          </Texto>
          <Texto
            style={{
              fontSize: 12,
              color: colores.textoSuave,
              textAlign: 'center',
              marginTop: ESPACIO.sm,
              lineHeight: 17,
            }}
          >
            Con este codigo el cliente consulta el avance sin llamar al taller.
          </Texto>
        </View>

        <View style={estilos.tarjeta}>
          <Texto style={estilos.tarjetaTitulo}>Interpretacion de la falla</Texto>
          <Texto style={[estilos.tarjetaDetalle, { color: colores.texto, fontSize: 15, marginTop: ESPACIO.xs }]}>
            {diagnostico.categoria || interpretacion.sistemaSugerido || 'Sin correspondencia dentro del catalogo'}
          </Texto>
          {interpretacion.hallazgo ? (
            <Texto style={estilos.tarjetaDetalle}>{interpretacion.hallazgo}</Texto>
          ) : null}
          <Texto style={estilos.tarjetaDetalle}>
            Confianza {(Number(interpretacion.nivelConfianza) * 100).toFixed(0)} % · origen{' '}
            {interpretacion.origen}
          </Texto>

          {generativo ? (
            <View style={[estilos.aviso, estilos.avisoAtencion, { marginTop: ESPACIO.sm }]}>
              <Ionicons name="information-circle" size={18} color={colores.aviso} />
              <Texto style={{ color: colores.aviso, fontSize: 12, flex: 1, lineHeight: 17 }}>
                Lectura del asistente, fuera del catalogo del taller. Conviene confirmarla con
                criterio propio.
              </Texto>
            </View>
          ) : null}
        </View>

        {conTareas ? (
          <View style={estilos.tarjeta}>
            <View style={estilos.fila}>
              <Texto style={estilos.tarjetaTitulo}>Tareas de revision</Texto>
              <Distintivo texto={`${minutos} MIN`} color={colores.acento} />
            </View>
            {tareas.map((tarea, indice) => (
              <View
                key={`${tarea.nombre}-${indice}`}
                style={{ flexDirection: 'row', gap: ESPACIO.sm, marginTop: ESPACIO.sm }}
              >
                <Texto style={{ color: colores.textoSuave, fontSize: 13, fontWeight: '700', width: 20 }}>
                  {indice + 1}.
                </Texto>
                <View style={{ flex: 1 }}>
                  <Texto style={{ color: colores.texto, fontSize: 14 }}>{tarea.nombre}</Texto>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm, marginTop: 2 }}>
                    <Texto style={estilos.tarjetaDetalle}>{tarea.minutos} minutos</Texto>
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
                        <Texto style={{ color: colores.aviso, fontSize: 10, fontWeight: '800' }}>SUGERIDA</Texto>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={estilos.tarjeta}>
            <Texto style={estilos.tarjetaTitulo}>Revision manual</Texto>
            <Texto style={estilos.tarjetaDetalle}>{diagnostico.motivo}</Texto>
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
        <Texto style={[estilos.etiqueta, { marginTop: 0 }]}>Vehiculo que ingresa</Texto>
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
                <Texto style={{ color: colores.texto, fontSize: 15, fontWeight: '700' }}>
                  {vehiculo.placa} · {vehiculo.marca} {vehiculo.linea}
                </Texto>
                <Texto style={{ color: colores.textoSuave, fontSize: 12 }}>
                  {vehiculo.cliente?.nombre_completo}
                </Texto>
              </>
            ) : (
              <Texto style={{ color: colores.textoSuave, fontSize: 15 }}>Elegir cliente y vehiculo</Texto>
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
          <Texto style={[estilos.etiqueta, { marginTop: 0, marginBottom: 0 }]}>Evidencia fotografica</Texto>
          <Texto style={{ color: colores.textoSuave, fontSize: 12, fontWeight: '600' }}>
            {imagenes.length} de {MAXIMO_FOTOGRAFIAS}
          </Texto>
        </View>
        <Texto style={[estilos.ayuda, { marginTop: 0, marginBottom: ESPACIO.sm }]}>
          La primera imagen acompana a la interpretacion. Las demas quedan como respaldo de la orden.
        </Texto>

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
                  <Texto style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>ANALIZA</Texto>
                </View>
              ) : null}
              <Pressable
                onPress={() => quitarImagen(indice)}
                hitSlop={10}
                style={({ pressed }) => [
                  {
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: colores.alerta,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: colores.superficie,
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="trash" size={15} color="#FFFFFF" />
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
                    <Texto style={{ fontSize: 11, color: colores.textoSuave, marginTop: 4 }}>Camara</Texto>
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
                <Texto style={{ fontSize: 11, color: colores.textoSuave, marginTop: 4 }}>Galeria</Texto>
              </Pressable>
            </>
          ) : null}
        </View>

        <Aviso mensaje={error} />

        <Texto
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
        </Texto>
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
          <Texto style={{ fontSize: 12, color: colores.textoSuave, textAlign: 'center', marginBottom: 4 }}>
            {!vehiculo ? 'Falta elegir el vehiculo' : 'Falta describir la falla'}
          </Texto>
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
 *
 * La ventana tambien registra clientes y vehiculos nuevos. Un vehiculo que
 * llega por primera vez es el caso corriente del taller, y obligar a salir de
 * la orden, cambiar de pestaña, registrar y volver a empezar hace perder el
 * trabajo ya escrito. Al concluir el registro, el vehiculo queda elegido y la
 * ventana se cierra sola.
 */
function SelectorVehiculo({ visible, alCerrar, alSeleccionar }) {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();

  const [vista, setVista] = useState('lista');
  const [clienteDestino, setClienteDestino] = useState(null);

  const [vehiculos, setVehiculos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!visible) return;
    setVista('lista');
    setClienteDestino(null);
    consultar();
  }, [visible, consultar]);

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

  /** El cliente recien creado encadena de inmediato con su vehiculo. */
  function alCrearCliente(cliente) {
    setClienteDestino(cliente);
    setVista('vehiculo');
  }

  /** El vehiculo recien creado queda elegido, sin un paso adicional. */
  async function alCrearVehiculo(vehiculoNuevo, cliente) {
    await consultar();
    alSeleccionar({ ...vehiculoNuevo, cliente });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={alCerrar}>
      <View style={[estilos.pantalla, { paddingTop: margenes.top + ESPACIO.sm }]}>
        <View style={{ paddingHorizontal: ESPACIO.md }}>
          <View style={estilos.fila}>
            <Pressable
              onPress={() => (vista === 'lista' ? alCerrar() : setVista('lista'))}
              hitSlop={10}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
            >
              {vista !== 'lista' ? (
                <Ionicons name="arrow-back" size={22} color={colores.texto} />
              ) : null}
              <Texto style={estilos.titulo}>
                {vista === 'lista'
                  ? 'Elegir vehiculo'
                  : vista === 'cliente'
                  ? 'Cliente nuevo'
                  : 'Vehiculo nuevo'}
              </Texto>
            </Pressable>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <Ionicons name="close" size={26} color={colores.textoSuave} />
            </Pressable>
          </View>
        </View>

        {vista === 'cliente' ? (
          <FormularioClienteRapido
            alCancelar={() => setVista('lista')}
            alCrear={alCrearCliente}
            margenes={margenes}
          />
        ) : vista === 'vehiculo' ? (
          <FormularioVehiculoRapido
            cliente={clienteDestino}
            alCancelar={() => setVista('lista')}
            alCrear={alCrearVehiculo}
            margenes={margenes}
          />
        ) : (
          <>
            <View style={{ paddingHorizontal: ESPACIO.md }}>
              <View style={{ justifyContent: 'center', marginTop: ESPACIO.xs }}>
                <EntradaTexto
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

              <Pressable
                onPress={() => setVista('cliente')}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: ESPACIO.sm,
                    paddingVertical: 12,
                    borderRadius: RADIO.md,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: colores.bordeFuerte,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="person-add-outline" size={18} color={colores.acento} />
                <Texto style={{ color: colores.texto, fontSize: 14, fontWeight: '700' }}>
                  Cliente que viene por primera vez
                </Texto>
              </Pressable>

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
                        ? 'Ningun cliente ni vehiculo corresponde a esa busqueda. Se puede registrar desde el boton de arriba.'
                        : 'El primer cliente se registra desde el boton de arriba, junto con su vehiculo.'
                    }
                  />
                }
                renderItem={({ item }) => {
                  const unico = item.vehiculos.length === 1;
                  const desplegado = abierto === item.idCliente || Boolean(busqueda);

                  return (
                    <View style={[estilos.tarjeta, { padding: 0, overflow: 'hidden' }]}>
                      <Pressable
                        onPress={() =>
                          unico && !desplegado
                            ? alSeleccionar(item.vehiculos[0])
                            : setAbierto(desplegado ? null : item.idCliente)
                        }
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
                          <Texto style={{ fontSize: 15, fontWeight: '700', color: colores.texto }}>
                            {item.nombre}
                          </Texto>
                          <Texto style={{ fontSize: 12, color: colores.textoSuave }}>
                            {item.vehiculos.length === 1
                              ? '1 vehiculo'
                              : `${item.vehiculos.length} vehiculos`}
                            {item.telefono ? ` · ${item.telefono}` : ''}
                          </Texto>
                        </View>
                        <Ionicons
                          name={unico && !desplegado ? 'chevron-forward' : desplegado ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={colores.textoSuave}
                        />
                      </Pressable>

                      {desplegado ? (
                        <>
                          {item.vehiculos.map((v) => (
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
                                <Texto style={{ fontSize: 14, fontWeight: '700', color: colores.texto }}>
                                  {v.placa}
                                </Texto>
                                <Texto style={{ fontSize: 12, color: colores.textoSuave }}>
                                  {v.marca} {v.linea} {v.modelo_anio}
                                  {v.kilometraje ? ` · ${v.kilometraje} km` : ''}
                                </Texto>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color={colores.textoSuave} />
                            </Pressable>
                          ))}

                          <Pressable
                            onPress={() => {
                              setClienteDestino({
                                id_cliente: item.idCliente,
                                nombre_completo: item.nombre,
                                telefono: item.telefono,
                              });
                              setVista('vehiculo');
                            }}
                            style={({ pressed }) => [
                              {
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: ESPACIO.sm,
                                paddingVertical: ESPACIO.sm + 2,
                                paddingHorizontal: ESPACIO.md,
                                borderTopWidth: 1,
                                borderTopColor: colores.borde,
                              },
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Ionicons name="add-circle-outline" size={18} color={colores.textoSuave} />
                            <Texto style={{ fontSize: 13, color: colores.textoSuave, fontWeight: '600' }}>
                              Agregar otro vehiculo a {item.nombre.split(' ')[0]}
                            </Texto>
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                  );
                }}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

/** Alta rapida de cliente, dentro del ingreso de un vehiculo. */
function FormularioClienteRapido({ alCancelar, alCrear, margenes }) {
  const { estilos } = useTema();
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const listo = nombreCompleto.trim().length >= 3 && telefono.trim().length >= 8;

  async function guardar() {
    setError('');
    setOcupado(true);
    try {
      const respuesta = await api.crearCliente({
        nombreCompleto: nombreCompleto.trim(),
        telefono: telefono.trim(),
        correo: correo.trim(),
      });
      alCrear(respuesta.cliente);
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: ESPACIO.md, paddingBottom: ESPACIO.xl + margenes.bottom }}
      keyboardShouldPersistTaps="handled"
    >
      <Texto style={estilos.subtitulo}>
        Al guardar, sigue el registro del vehiculo y la orden continua donde quedo.
      </Texto>

      <Campo
        etiqueta="Nombre completo"
        value={nombreCompleto}
        onChangeText={setNombreCompleto}
        placeholder="Juan Perez Lopez"
        icono="person-outline"
        autoCapitalize="words"
      />
      <Campo
        etiqueta="Telefono"
        value={telefono}
        onChangeText={setTelefono}
        placeholder="45678901"
        keyboardType="phone-pad"
        icono="call-outline"
        ayuda="Por aqui se avisa cuando el vehiculo queda listo."
      />
      <Campo
        etiqueta="Correo"
        value={correo}
        onChangeText={setCorreo}
        placeholder="Opcional"
        autoCapitalize="none"
        keyboardType="email-address"
        icono="mail-outline"
      />

      <Aviso mensaje={error} />

      <Boton
        titulo="Guardar y seguir con el vehiculo"
        icono="arrow-forward"
        alPresionar={guardar}
        ocupado={ocupado}
        deshabilitado={!listo}
      />
      <Boton titulo="Cancelar" variante="secundario" icono="close-outline" alPresionar={alCancelar} />
    </ScrollView>
  );
}

/** Alta rapida de vehiculo para un cliente ya identificado. */
function FormularioVehiculoRapido({ cliente, alCancelar, alCrear, margenes }) {
  const { colores, estilos } = useTema();
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [linea, setLinea] = useState('');
  const [modeloAnio, setModeloAnio] = useState('');
  const [color, setColor] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [tipoTransmision, setTipoTransmision] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const anio = Number(modeloAnio);
  const listo =
    placa.trim().length >= 5 &&
    marca.trim().length >= 2 &&
    linea.trim().length >= 1 &&
    anio >= 1950 &&
    anio <= new Date().getFullYear() + 1;

  async function guardar() {
    setError('');
    setOcupado(true);
    try {
      const respuesta = await api.crearVehiculo({
        idCliente: cliente.id_cliente,
        placa: placa.trim().toUpperCase(),
        marca: marca.trim(),
        linea: linea.trim(),
        modeloAnio: anio,
        color: color.trim(),
        kilometraje: kilometraje === '' ? null : Number(kilometraje),
        tipoTransmision: tipoTransmision || null,
      });
      alCrear(respuesta.vehiculo, cliente);
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: ESPACIO.md, paddingBottom: ESPACIO.xl + margenes.bottom }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[estilos.tarjeta, { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm }]}>
        <Ionicons name="person" size={18} color={colores.acento} />
        <View style={{ flex: 1 }}>
          <Texto style={{ fontSize: 14, fontWeight: '700', color: colores.texto }}>
            {cliente?.nombre_completo}
          </Texto>
          <Texto style={{ fontSize: 12, color: colores.textoSuave }}>Propietario del vehiculo</Texto>
        </View>
      </View>

      <Campo
        etiqueta="Placa"
        value={placa}
        onChangeText={setPlaca}
        placeholder="P123ABC"
        autoCapitalize="characters"
        autoCorrect={false}
        icono="pricetag-outline"
      />
      <Campo etiqueta="Marca" value={marca} onChangeText={setMarca} placeholder="Toyota" autoCapitalize="words" />
      <Campo etiqueta="Linea" value={linea} onChangeText={setLinea} placeholder="Corolla" autoCapitalize="words" />
      <Campo
        etiqueta="Modelo"
        value={modeloAnio}
        onChangeText={setModeloAnio}
        placeholder="2015"
        keyboardType="number-pad"
        maxLength={4}
      />
      <Campo etiqueta="Color" value={color} onChangeText={setColor} placeholder="Opcional" autoCapitalize="words" />
      <Campo
        etiqueta="Kilometraje"
        value={kilometraje}
        onChangeText={setKilometraje}
        placeholder="Opcional"
        keyboardType="number-pad"
        icono="speedometer-outline"
      />

      {/* Tipo de caja. Se pide aqui, al dar de alta el vehiculo, porque es el
          momento en que el mecanico lo tiene enfrente. Determina que revisiones
          manda el taller en esta orden y en todas las que vengan despues. */}
      <Texto style={[estilos.etiqueta, { marginTop: ESPACIO.sm }]}>Tipo de caja</Texto>
      <Texto style={{ color: colores.textoSuave, fontSize: 12, marginBottom: ESPACIO.sm, lineHeight: 17 }}>
        Sin este dato la orden recibe solo las revisiones comunes a las dos cajas.
      </Texto>
      <SelectorSegmentado
        valor={tipoTransmision}
        alCambiar={setTipoTransmision}
        opciones={OPCIONES_TRANSMISION}
      />

      <Aviso mensaje={error} />

      <Boton
        titulo="Guardar y usar en esta orden"
        icono="checkmark"
        alPresionar={guardar}
        ocupado={ocupado}
        deshabilitado={!listo}
      />
      <Boton titulo="Cancelar" variante="secundario" icono="close-outline" alPresionar={alCancelar} />
    </ScrollView>
  );
}
