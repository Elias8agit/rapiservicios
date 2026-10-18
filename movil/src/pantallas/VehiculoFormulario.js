/**
 * MODULO M2 - ALTA Y MODIFICACION DE VEHICULOS.
 *
 * Cada vehiculo pertenece a un cliente registrado. La seleccion del cliente se
 * resuelve mediante una ventana de busqueda para evitar la captura repetida de
 * los datos del propietario.
 *
 * ORDEN DE LOS CAMPOS. Primero el propietario, luego lo que identifica al
 * vehiculo (placa, marca, linea y anio), y al final lo que describe su estado
 * (color, kilometraje y tipo de caja). Ese es el orden en que el mecanico lee
 * la tarjeta de circulacion, de modo que la captura sigue la vista y no obliga
 * a saltar de un dato a otro.
 *
 * VALIDACION. Las condiciones que se comprueban aqui son las mismas de la ruta
 * de vehiculos del servidor. Se repiten del lado del telefono para no gastar un
 * viaje de red en un dato que ya se sabe incompleto. El servidor conserva la
 * ultima palabra.
 */

import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Texto, EntradaTexto } from '../componentes/Texto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  EstadoVacio,
  OPCIONES_TRANSMISION,
  SelectorSegmentado,
} from '../componentes/Comunes';
import { ESPACIO, RADIO, useTema } from '../tema';

/** Anio maximo que admite el servidor: el entrante, para un modelo nuevo. */
const ANIO_MAXIMO = new Date().getFullYear() + 1;

/** Rotulo de seccion del formulario. */
function Seccion({ texto }) {
  const { colores } = useTema();
  return (
    <Texto
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: colores.textoSuave,
        letterSpacing: 0.5,
        marginTop: ESPACIO.lg,
      }}
    >
      {texto}
    </Texto>
  );
}

export default function VehiculoFormulario({ navigation, route }) {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();

  const vehiculo = route.params?.vehiculo || null;
  const esModificacion = Boolean(vehiculo);

  const [cliente, setCliente] = useState(vehiculo?.cliente || route.params?.cliente || null);
  const [placa, setPlaca] = useState(vehiculo?.placa || '');
  const [marca, setMarca] = useState(vehiculo?.marca || '');
  const [linea, setLinea] = useState(vehiculo?.linea || '');
  const [modeloAnio, setModeloAnio] = useState(vehiculo ? String(vehiculo.modelo_anio) : '');
  const [color, setColor] = useState(vehiculo?.color || '');
  const [kilometraje, setKilometraje] = useState(
    vehiculo?.kilometraje !== null && vehiculo?.kilometraje !== undefined ? String(vehiculo.kilometraje) : ''
  );
  const [tipoTransmision, setTipoTransmision] = useState(vehiculo?.tipo_transmision || '');

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [ventanaVisible, setVentanaVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: esModificacion ? 'Modificar vehiculo' : 'Vehiculo nuevo' });
  }, [navigation, esModificacion]);

  /** Estado de cada condicion, en correspondencia con la ruta del servidor. */
  const revision = useMemo(() => {
    const anio = Number(modeloAnio);
    const anioValido = Number.isInteger(anio) && anio >= 1950 && anio <= ANIO_MAXIMO;
    const km = kilometraje.trim();
    const kmValido = km === '' || (!Number.isNaN(Number(km)) && Number(km) >= 0);

    return {
      placaCorta: placa.trim().length > 0 && placa.trim().length < 4,
      marcaCorta: marca.trim().length > 0 && marca.trim().length < 2,
      anioInvalido: modeloAnio.length > 0 && !anioValido,
      kilometrajeInvalido: !kmValido,
      completo:
        Boolean(cliente) &&
        placa.trim().length >= 4 &&
        marca.trim().length >= 2 &&
        linea.trim().length >= 1 &&
        anioValido &&
        kmValido,
    };
  }, [cliente, placa, marca, linea, modeloAnio, kilometraje]);

  async function guardar() {
    setError('');
    setExito('');

    if (!cliente) {
      setError('El cliente propietario resulta obligatorio.');
      return;
    }

    setOcupado(true);
    try {
      const datos = {
        idCliente: cliente.id_cliente,
        placa: placa.trim(),
        marca: marca.trim(),
        linea: linea.trim(),
        modeloAnio: Number(modeloAnio),
        color: color.trim(),
        kilometraje: kilometraje.trim() === '' ? null : Number(kilometraje),
        tipoTransmision: tipoTransmision || null,
      };

      if (esModificacion) {
        await api.actualizarVehiculo(vehiculo.id_vehiculo, datos);
        setExito('El vehiculo quedo actualizado.');
      } else {
        await api.crearVehiculo(datos);
        setExito('El vehiculo quedo registrado.');
      }
      setTimeout(() => navigation.goBack(), 700);
    } catch (falla) {
      setError(falla.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: ESPACIO.xl + margenes.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Propietario. Presenta el mismo control que el ingreso de la orden:
            un renglon con icono que abre la ventana de busqueda, de modo que
            quien ya uso una pantalla reconoce la otra. */}
        <Texto style={[estilos.etiqueta, { marginTop: 0 }]}>Cliente propietario</Texto>
        <Pressable
          style={({ pressed }) => [
            estilos.campo,
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: ESPACIO.sm,
              paddingVertical: cliente ? 12 : 14,
              borderColor: cliente ? colores.borde : colores.bordeFuerte,
            },
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setVentanaVisible(true)}
        >
          <Ionicons
            name={cliente ? 'person' : 'person-outline'}
            size={21}
            color={cliente ? colores.acento : colores.textoSuave}
          />
          <View style={{ flex: 1 }}>
            {cliente ? (
              <>
                <Texto style={{ color: colores.texto, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                  {cliente.nombre_completo}
                </Texto>
                {cliente.telefono ? (
                  <Texto style={{ color: colores.textoSuave, fontSize: 12 }}>{cliente.telefono}</Texto>
                ) : null}
              </>
            ) : (
              <Texto style={{ color: colores.textoSuave, fontSize: 15 }}>Seleccionar cliente</Texto>
            )}
          </View>
          <Ionicons name="chevron-down" size={18} color={colores.textoSuave} />
        </Pressable>

        <Seccion texto="IDENTIFICACION DEL VEHICULO" />

        <Campo
          etiqueta="Placa"
          value={placa}
          onChangeText={(texto) => setPlaca(texto.toUpperCase())}
          placeholder="P123ABC"
          autoCapitalize="characters"
          autoCorrect={false}
          icono="pricetag-outline"
          invalido={revision.placaCorta}
          ayuda={
            revision.placaCorta
              ? 'La placa requiere al menos cuatro caracteres.'
              : 'Es el identificador con el que el taller nombra al vehiculo.'
          }
        />
        <Campo
          etiqueta="Marca"
          value={marca}
          onChangeText={setMarca}
          placeholder="Toyota"
          icono="business-outline"
          invalido={revision.marcaCorta}
          ayuda={revision.marcaCorta ? 'La marca resulta obligatoria.' : null}
        />
        <Campo
          etiqueta="Linea"
          value={linea}
          onChangeText={setLinea}
          placeholder="Corolla"
          icono="car-outline"
        />
        <Campo
          etiqueta="Anio del modelo"
          value={modeloAnio}
          onChangeText={setModeloAnio}
          placeholder="2015"
          keyboardType="number-pad"
          icono="calendar-outline"
          invalido={revision.anioInvalido}
          ayuda={
            revision.anioInvalido
              ? `El anio corresponde al rango entre 1950 y ${ANIO_MAXIMO}.`
              : null
          }
        />

        <Seccion texto="ESTADO DE LA FICHA" />

        <Campo
          etiqueta="Color (opcional)"
          value={color}
          onChangeText={setColor}
          placeholder="Blanco"
          icono="color-palette-outline"
        />
        <Campo
          etiqueta="Kilometraje (opcional)"
          value={kilometraje}
          onChangeText={setKilometraje}
          placeholder="85000"
          keyboardType="number-pad"
          icono="speedometer-outline"
          invalido={revision.kilometrajeInvalido}
          ayuda={
            revision.kilometrajeInvalido
              ? 'El kilometraje requiere un numero mayor o igual que cero.'
              : 'Al ingresar el vehiculo con una orden, este dato queda actualizado solo.'
          }
        />

        {/* Tipo de caja.
            Determina que revisiones manda el taller: una caja automatica no
            tiene embrague de pedal y una mecanica no tiene cuerpo de valvulas.
            Con el dato en blanco la orden recibe solo lo comun a ambas, que es
            correcto pero corto. */}
        <Texto style={estilos.etiqueta}>Tipo de caja</Texto>
        <Texto style={[estilos.ayuda, { marginTop: 0, marginBottom: ESPACIO.sm }]}>
          Define las revisiones que el taller asigna a este vehiculo. Sin el dato, la orden recibe
          solo las tareas comunes a las dos cajas.
        </Texto>
        <SelectorSegmentado
          valor={tipoTransmision}
          alCambiar={setTipoTransmision}
          opciones={OPCIONES_TRANSMISION}
        />

        <Aviso mensaje={error} />
        <Aviso mensaje={exito} tipo="exito" />

        {!cliente ? (
          <Aviso mensaje="Falta elegir al cliente propietario del vehiculo." tipo="atencion" />
        ) : null}

        <Boton
          titulo={esModificacion ? 'Guardar cambios' : 'Registrar vehiculo'}
          icono={esModificacion ? 'save-outline' : 'add'}
          alPresionar={guardar}
          ocupado={ocupado}
          deshabilitado={!revision.completo}
        />
        <Boton titulo="Cancelar" variante="secundario" alPresionar={() => navigation.goBack()} />
      </ScrollView>

      <SelectorCliente
        visible={ventanaVisible}
        alCerrar={() => setVentanaVisible(false)}
        alSeleccionar={(elegido) => {
          setCliente(elegido);
          setVentanaVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * Ventana de busqueda y seleccion de clientes.
 *
 * El padron se recibe una vez al abrir la ventana y el filtrado ocurre aqui,
 * igual que en el listado de clientes: antes se consultaba al servidor en cada
 * letra escrita, lo que producia una peticion por pulsacion.
 */
export function SelectorCliente({ visible, alCerrar, alSeleccionar }) {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();

  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setCargando(true);
      setError('');
      try {
        const datos = await api.listarClientes();
        setClientes(datos.clientes);
      } catch (falla) {
        setError(falla.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [visible]);

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
    <Modal visible={visible} animationType="slide" onRequestClose={alCerrar}>
      {/* El margen superior sigue la misma solucion que la ventana de seleccion
          de vehiculo del ingreso, ya comprobada en el telefono del taller. */}
      <View style={[estilos.pantalla, { paddingTop: margenes.top + ESPACIO.sm }]}>
        <View style={{ paddingHorizontal: ESPACIO.md }}>
          <View style={[estilos.fila, { marginBottom: ESPACIO.sm }]}>
            <Texto style={[estilos.titulo, { marginBottom: 0 }]}>Seleccionar cliente</Texto>
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

          <Aviso mensaje={error} />
        </View>

        {cargando ? (
          <Cargando texto="Consultando clientes..." />
        ) : (
          <FlatList
            data={visibles}
            keyExtractor={(item) => String(item.id_cliente)}
            contentContainerStyle={{
              paddingHorizontal: ESPACIO.md,
              paddingTop: ESPACIO.md,
              paddingBottom: ESPACIO.xl + margenes.bottom,
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EstadoVacio
                icono="people-outline"
                titulo={busqueda ? 'Ningun cliente coincide' : 'Todavia no hay clientes'}
                detalle={
                  busqueda
                    ? `No se encontro "${busqueda}" dentro del padron del taller.`
                    : 'Conviene registrar primero al propietario desde la pantalla de clientes.'
                }
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [estilos.tarjeta, pressed && { opacity: 0.75 }]}
                onPress={() => alSeleccionar(item)}
              >
                <View style={estilos.fila}>
                  <View style={{ flex: 1 }}>
                    <Texto style={estilos.tarjetaTitulo} numberOfLines={1}>
                      {item.nombre_completo}
                    </Texto>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Ionicons name="call-outline" size={13} color={colores.textoSuave} />
                      <Texto style={{ fontSize: 13, color: colores.textoSuave }}>{item.telefono}</Texto>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colores.textoSuave} />
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
