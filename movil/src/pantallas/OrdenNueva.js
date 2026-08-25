/**
 * MODULO M3 - RECEPCION Y CAPTURA DE FALLAS.
 *
 * El mecanico describe el problema con palabras propias y adjunta la
 * fotografia del componente. El servidor traslada esa informacion hacia la
 * capa de interpretacion y despues hacia el motor de reglas, que devuelve las
 * tareas de revision y el tiempo estimado de la orden.
 */

import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { Aviso, Boton, Campo, Cargando, Distintivo } from '../componentes/Comunes';
import { COLORES, ESPACIO, estilos } from '../tema';

export default function OrdenNueva({ navigation }) {
  const [vehiculo, setVehiculo] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [imagen, setImagen] = useState(null);
  const [ventanaVisible, setVentanaVisible] = useState(false);

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  /** Captura la fotografia con la camara del telefono. */
  async function tomarFotografia() {
    setError('');
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError('La aplicacion requiere permiso de camara para adjuntar la evidencia.');
      return;
    }
    const captura = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      base64: true,
      allowsEditing: false,
    });
    if (!captura.canceled && captura.assets?.length) {
      setImagen(captura.assets[0]);
    }
  }

  /** Selecciona una fotografia existente dentro del telefono. */
  async function elegirFotografia() {
    setError('');
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError('La aplicacion requiere permiso de galeria para adjuntar la evidencia.');
      return;
    }
    const eleccion = await ImagePicker.launchImageLibraryAsync({
      quality: 0.5,
      base64: true,
      mediaTypes: ['images'],
    });
    if (!eleccion.canceled && eleccion.assets?.length) {
      setImagen(eleccion.assets[0]);
    }
  }

  async function registrar() {
    setError('');
    setResultado(null);

    if (!vehiculo) {
      setError('El vehiculo resulta obligatorio.');
      return;
    }
    if (descripcion.trim().length < 10) {
      setError('La descripcion de la falla requiere al menos diez caracteres.');
      return;
    }

    setOcupado(true);
    try {
      const cuerpo = {
        idVehiculo: vehiculo.id_vehiculo,
        descripcionFalla: descripcion.trim(),
      };
      if (kilometraje !== '') cuerpo.kilometraje = Number(kilometraje);
      if (imagen?.base64) {
        cuerpo.fotografia = { datos: imagen.base64, tipoMime: imagen.mimeType || 'image/jpeg' };
      }

      const respuesta = await api.crearOrden(cuerpo);
      setResultado(respuesta);
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  // Vista del resultado con el diagnostico sugerido.
  if (resultado) {
    const { orden, interpretacion, diagnostico } = resultado;
    return (
      <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
        <View style={[estilos.tarjeta, { borderColor: COLORES.exito, borderWidth: 2 }]}>
          <Text style={estilos.titulo}>Orden generada</Text>
          <Text style={estilos.subtitulo}>Codigo de consulta para el cliente</Text>
          <Text style={{ fontSize: 30, fontWeight: '800', color: COLORES.acento, letterSpacing: 2 }}>
            {orden.codigo_consulta}
          </Text>
        </View>

        <View style={estilos.tarjeta}>
          <Text style={estilos.tarjetaTitulo}>Interpretacion de la falla</Text>
          <Text style={estilos.tarjetaDetalle}>
            Categoria: {diagnostico.categoria || 'sin correspondencia dentro del catalogo'}
          </Text>
          <Text style={estilos.tarjetaDetalle}>
            Nivel de confianza: {(Number(interpretacion.nivelConfianza) * 100).toFixed(1)} %
          </Text>
          <Text style={estilos.tarjetaDetalle}>Origen: {interpretacion.origen}</Text>
        </View>

        {diagnostico.aplicada ? (
          <View style={estilos.tarjeta}>
            <View style={estilos.fila}>
              <Text style={estilos.tarjetaTitulo}>Tareas de revision</Text>
              <Distintivo texto={diagnostico.tiempoEstimadoTexto} color={COLORES.acento} />
            </View>
            {diagnostico.tareas.map((tarea, indice) => (
              <View key={tarea.idTarea} style={{ marginTop: ESPACIO.sm }}>
                <Text style={{ color: COLORES.texto, fontSize: 14 }}>
                  {indice + 1}. {tarea.nombre}
                </Text>
                <Text style={estilos.tarjetaDetalle}>
                  {tarea.minutos} minutos · regla: {tarea.regla}
                </Text>
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
          alPresionar={() => navigation.replace('OrdenDetalle', { idOrden: orden.id_orden })}
        />
        <Boton titulo="Registrar otro ingreso" variante="secundario" alPresionar={() => {
          setResultado(null);
          setVehiculo(null);
          setDescripcion('');
          setKilometraje('');
          setImagen(null);
        }} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.etiqueta}>Vehiculo que ingresa</Text>
        <TouchableOpacity style={estilos.campo} onPress={() => setVentanaVisible(true)} activeOpacity={0.7}>
          <Text style={{ color: vehiculo ? COLORES.texto : COLORES.textoSuave, fontSize: 15 }}>
            {vehiculo
              ? `${vehiculo.placa} · ${vehiculo.marca} ${vehiculo.linea}`
              : 'Seleccionar vehiculo'}
          </Text>
        </TouchableOpacity>

        <Campo
          etiqueta="Descripcion de la falla"
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Describir el problema con palabras propias. Por ejemplo: al frenar se escucha un ruido metalico y el pedal se siente esponjoso."
          amplio
        />

        <Campo
          etiqueta="Kilometraje actual (opcional)"
          value={kilometraje}
          onChangeText={setKilometraje}
          placeholder="85000"
          keyboardType="number-pad"
        />

        <Text style={estilos.etiqueta}>Fotografia del componente (opcional)</Text>
        {imagen ? (
          <View>
            <Image
              source={{ uri: imagen.uri }}
              style={{ width: '100%', height: 220, borderRadius: 12, marginBottom: ESPACIO.sm }}
              resizeMode="cover"
            />
            <TouchableOpacity onPress={() => setImagen(null)}>
              <Text style={{ color: COLORES.alerta, fontSize: 13, fontWeight: '600' }}>Quitar la fotografia</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: ESPACIO.sm }}>
            <TouchableOpacity
              style={[estilos.tarjeta, { flex: 1, alignItems: 'center', paddingVertical: ESPACIO.lg }]}
              onPress={tomarFotografia}
            >
              <Ionicons name="camera-outline" size={26} color={COLORES.primario} />
              <Text style={[estilos.tarjetaDetalle, { marginTop: 6 }]}>Camara</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[estilos.tarjeta, { flex: 1, alignItems: 'center', paddingVertical: ESPACIO.lg }]}
              onPress={elegirFotografia}
            >
              <Ionicons name="images-outline" size={26} color={COLORES.primario} />
              <Text style={[estilos.tarjetaDetalle, { marginTop: 6 }]}>Galeria</Text>
            </TouchableOpacity>
          </View>
        )}

        <Aviso mensaje={error} />

        <Boton
          titulo={ocupado ? 'Generando el diagnostico...' : 'Generar la orden de trabajo'}
          alPresionar={registrar}
          ocupado={ocupado}
          variante="acento"
        />

        <Text style={{ marginTop: ESPACIO.md, fontSize: 11, color: COLORES.textoSuave, textAlign: 'center' }}>
          La placa del vehiculo permanece dentro de la base de datos del taller y no viaja hacia el
          servicio externo de interpretacion.
        </Text>
      </ScrollView>

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

/** Ventana de busqueda y seleccion de vehiculos. */
function SelectorVehiculo({ visible, alCerrar, alSeleccionar }) {
  const [vehiculos, setVehiculos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setCargando(true);
      setError('');
      try {
        const datos = await api.listarVehiculos(busqueda);
        setVehiculos(datos.vehiculos);
      } catch (falla) {
        setError(falla.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [visible, busqueda]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={alCerrar}>
      <View style={[estilos.pantalla, { paddingTop: 56 }]}>
        <View style={{ padding: ESPACIO.md }}>
          <View style={estilos.fila}>
            <Text style={estilos.titulo}>Seleccionar vehiculo</Text>
            <TouchableOpacity onPress={alCerrar}>
              <Text style={{ color: COLORES.primario, fontWeight: '600' }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={estilos.campo}
            placeholder="Buscar por placa, marca o linea"
            placeholderTextColor={COLORES.textoSuave}
            value={busqueda}
            onChangeText={setBusqueda}
            autoCapitalize="characters"
          />
          <Aviso mensaje={error} />
        </View>

        {cargando ? (
          <Cargando />
        ) : (
          <FlatList
            data={vehiculos}
            keyExtractor={(item) => String(item.id_vehiculo)}
            contentContainerStyle={{ paddingHorizontal: ESPACIO.md, paddingBottom: ESPACIO.xl }}
            ListEmptyComponent={<Text style={estilos.vacio}>Sin coincidencias.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={estilos.tarjeta} onPress={() => alSeleccionar(item)} activeOpacity={0.7}>
                <View style={estilos.fila}>
                  <Text style={estilos.tarjetaTitulo}>
                    {item.marca} {item.linea}
                  </Text>
                  <Distintivo texto={item.placa} />
                </View>
                <Text style={estilos.tarjetaDetalle}>
                  Modelo {item.modelo_anio} · {item.cliente?.nombre_completo}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
