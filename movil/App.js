/**
 * APLICACION MOVIL DEL TALLER RAPISERVICIOS.
 *
 * Sistema con inteligencia artificial para generar ordenes de trabajo y
 * diagnostico en el taller mecanico Rapiservicios, municipio de Villa Nueva.
 * Universidad Mariano Galvez de Guatemala.
 * Autor: Walter Estuardo Elias Ochoa, carne 0900228982.
 *
 * La navegacion se organiza en dos regiones. Cuando la sesion permanece
 * cerrada, la aplicacion presenta el ingreso y la consulta publica del
 * cliente. Cuando la sesion queda abierta, el personal del taller accede a las
 * pestanas de ordenes, clientes, vehiculos y cuenta.
 */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import { FUENTE_FUERTE } from './src/componentes/Texto';

import { ProveedorSesion, useSesion } from './src/contexto/Sesion';
import PantallaEnlace from './src/componentes/PantallaEnlace';
import { ProveedorTema, useTema } from './src/tema';

import IniciarSesion from './src/pantallas/IniciarSesion';
import ConsultaCliente from './src/pantallas/ConsultaCliente';
import Ordenes from './src/pantallas/Ordenes';
import OrdenNueva from './src/pantallas/OrdenNueva';
import OrdenDetalle from './src/pantallas/OrdenDetalle';
import Clientes from './src/pantallas/Clientes';
import ClienteFormulario from './src/pantallas/ClienteFormulario';
import Vehiculos from './src/pantallas/Vehiculos';
import VehiculoFormulario from './src/pantallas/VehiculoFormulario';
import HistorialVehiculo from './src/pantallas/HistorialVehiculo';
import Cuenta from './src/pantallas/Cuenta';

const Pila = createNativeStackNavigator();
const Pestanas = createBottomTabNavigator();

/** Opciones del encabezado, derivadas de la paleta activa. */
function usarOpcionesEncabezado() {
  const { colores } = useTema();
  return {
    headerStyle: { backgroundColor: colores.primario },
    headerTintColor: '#FFFFFF',
    // El color del titulo se declara aparte del tinte. Cuando el tema de la
    // navegacion cambia, el tinte por si solo no siempre alcanza al titulo y
    // este termina tomando el color del tema en lugar del encabezado.
    //
    // La familia tipografica se nombra aqui de forma explicita: el encabezado
    // es una vista nativa y no atraviesa el componente Texto, de modo que sin
    // esta linea el titulo seguiria tomando la fuente del sistema mientras el
    // resto de la aplicacion ya usa la propia. El peso viaja dentro del nombre
    // del archivo, no en fontWeight.
    headerTitleStyle: { fontFamily: FUENTE_FUERTE, fontSize: 17, color: '#FFFFFF' },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colores.fondo },
  };
}

function PilaOrdenes() {
  const opciones = usarOpcionesEncabezado();
  return (
    <Pila.Navigator screenOptions={opciones}>
      <Pila.Screen name="OrdenesLista" component={Ordenes} options={{ title: 'Ordenes de trabajo' }} />
      <Pila.Screen name="OrdenNueva" component={OrdenNueva} options={{ title: 'Ingreso de vehiculo' }} />
      <Pila.Screen name="OrdenDetalle" component={OrdenDetalle} options={{ title: 'Detalle de la orden' }} />
      {/* El historial tambien se alcanza desde el detalle de una orden: al
          diagnosticar conviene saber si el vehiculo ya vino por lo mismo. La
          pantalla reside en las dos pilas para que el boton de retroceso
          devuelva a donde el mecanico estaba y no lo cambie de pestaña. */}
      <Pila.Screen
        name="HistorialVehiculo"
        component={HistorialVehiculo}
        options={{ title: 'Historial del vehiculo' }}
      />
    </Pila.Navigator>
  );
}

function PilaClientes() {
  const opciones = usarOpcionesEncabezado();
  return (
    <Pila.Navigator screenOptions={opciones}>
      <Pila.Screen name="ClientesLista" component={Clientes} options={{ title: 'Clientes' }} />
      <Pila.Screen name="ClienteFormulario" component={ClienteFormulario} />
    </Pila.Navigator>
  );
}

function PilaVehiculos() {
  const opciones = usarOpcionesEncabezado();
  return (
    <Pila.Navigator screenOptions={opciones}>
      <Pila.Screen name="VehiculosLista" component={Vehiculos} options={{ title: 'Vehiculos' }} />
      <Pila.Screen
        name="HistorialVehiculo"
        component={HistorialVehiculo}
        options={{ title: 'Historial del vehiculo' }}
      />
      {/* El detalle de la orden se registra tambien aqui para que, al abrir una
          visita desde el historial, el retroceso devuelva al historial y no
          traslade al mecanico a la pestaña de ordenes. */}
      <Pila.Screen name="OrdenDetalle" component={OrdenDetalle} options={{ title: 'Detalle de la orden' }} />
      <Pila.Screen name="VehiculoFormulario" component={VehiculoFormulario} />
    </Pila.Navigator>
  );
}

function PilaCuenta() {
  const opciones = usarOpcionesEncabezado();
  return (
    <Pila.Navigator screenOptions={opciones}>
      <Pila.Screen name="CuentaInicio" component={Cuenta} options={{ title: 'Cuenta' }} />
    </Pila.Navigator>
  );
}

const ICONOS = {
  Ordenes: ['clipboard', 'clipboard-outline'],
  Clientes: ['people', 'people-outline'],
  Vehiculos: ['car-sport', 'car-sport-outline'],
  Cuenta: ['person-circle', 'person-circle-outline'],
};

function NavegacionTaller() {
  const { colores } = useTema();
  const margenes = useSafeAreaInsets();

  return (
    <Pestanas.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colores.acento,
        tabBarInactiveTintColor: colores.textoSuave,
        // La altura incorpora el margen inferior del dispositivo. Sin ese
        // margen la barra queda por debajo de los botones de navegacion del
        // telefono y las pestanas resultan inalcanzables.
        tabBarStyle: {
          height: 60 + margenes.bottom,
          paddingBottom: margenes.bottom + 6,
          paddingTop: 8,
          backgroundColor: colores.superficie,
          borderTopColor: colores.borde,
          borderTopWidth: 1,
        },
        // La etiqueta de la pestaña tampoco atraviesa el componente Texto: la
        // dibuja la barra de la navegacion. Se le nombra la familia igual que
        // al titulo del encabezado.
        tabBarLabelStyle: { fontSize: 11, fontFamily: FUENTE_FUERTE },
        tabBarIcon: ({ focused, color, size }) => {
          const [activo, inactivo] = ICONOS[route.name] || ICONOS.Cuenta;
          return <Ionicons name={focused ? activo : inactivo} size={size} color={color} />;
        },
      })}
    >
      <Pestanas.Screen name="Ordenes" component={PilaOrdenes} />
      <Pestanas.Screen name="Clientes" component={PilaClientes} />
      <Pestanas.Screen name="Vehiculos" component={PilaVehiculos} />
      <Pestanas.Screen name="Cuenta" component={PilaCuenta} />
    </Pestanas.Navigator>
  );
}

function NavegacionAcceso() {
  const opciones = usarOpcionesEncabezado();
  return (
    <Pila.Navigator screenOptions={opciones}>
      <Pila.Screen name="IniciarSesion" component={IniciarSesion} options={{ headerShown: false }} />
      <Pila.Screen name="ConsultaCliente" component={ConsultaCliente} options={{ title: 'Consulta del cliente' }} />
    </Pila.Navigator>
  );
}

function Raiz() {
  const { sesion, cargando, enlace, segundosEspera, detalleEnlace, reintentarEnlace } = useSesion();
  const { colores, esOscuro } = useTema();

  // El enlace con el servidor antecede a cualquier pantalla: sin servicio
  // disponible, ni el ingreso ni la sesion resguardada resultan operables.
  if (enlace !== 'ENLAZADO') {
    return (
      <PantallaEnlace
        estado={enlace}
        segundos={segundosEspera}
        detalle={detalleEnlace}
        alReintentar={reintentarEnlace}
      />
    );
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo }}>
        <ActivityIndicator size="large" color={colores.acento} />
      </View>
    );
  }

  // El tema de la navegacion acompana al de la aplicacion, de manera que el
  // fondo de las transiciones entre pantallas no destelle en blanco.
  const temaNavegacion = {
    ...(esOscuro ? DarkTheme : DefaultTheme),
    colors: {
      ...(esOscuro ? DarkTheme : DefaultTheme).colors,
      primary: colores.acento,
      background: colores.fondo,
      card: colores.superficie,
      text: colores.texto,
      border: colores.borde,
    },
  };

  // Margen superior del dispositivo: quien lo reserva.
  //
  // Android 15 impone el modo de borde a borde y la aplicacion dibuja siempre
  // por debajo de la barra de estado, de modo que alguien debe reservar ese
  // margen o el contenido queda detras del reloj.
  //
  // Ese alguien es el encabezado de la navegacion. El encabezado de
  // @react-navigation/native-stack es una vista nativa de Android y consulta
  // los margenes directamente a la ventana del sistema, sin pasar por el
  // contexto de margen seguro de JavaScript. Por eso envolver la raiz en una
  // vista de margen seguro no descuenta nada para el encabezado: el margen se
  // suma dos veces y sobre el titulo aparece una franja vacia.
  //
  // La raiz solo aporta el color de fondo, que es el que se ve por detras del
  // encabezado en la franja de la barra de estado. Las dos pantallas que
  // prescinden de encabezado, el ingreso y el enlace con el servidor, reservan
  // su propio margen con useSafeAreaInsets.
  return (
    <View style={{ flex: 1, backgroundColor: colores.primario }}>
      <NavigationContainer theme={temaNavegacion}>
        {sesion ? <NavegacionTaller /> : <NavegacionAcceso />}
      </NavigationContainer>
    </View>
  );
}

/**
 * Barra de estado del sistema.
 *
 * Solo se declara el contraste de los iconos. El color de fondo no se declara
 * aqui porque bajo el modo de borde a borde de Android 15 el sistema lo ignora:
 * lo que se ve detras de la barra de estado es el encabezado de la navegacion.
 */
function BarraEstado() {
  return <StatusBar style="light" />;
}

export default function App() {
  // Carga de las tipografias, antes de dibujar cualquier pantalla.
  //
  // La de iconos se declara de forma explicita. El paquete de iconos registra
  // su fuente por cuenta propia, pero esa carga automatica depende de la
  // version del modulo de tipografias que quede instalada, y una version
  // desalineada no falla de forma ruidosa: simplemente no dibuja ningun icono,
  // y la aplicacion parece perder la mitad de su interfaz.
  //
  // Las cinco variantes de Inter constituyen la tipografia de la aplicacion.
  // En Android cada peso reside en un archivo propio y hay que cargarlos todos:
  // el sistema no deriva la negrita de la variante regular. El componente Texto
  // se encarga de elegir cual corresponde a cada fontWeight declarado.
  const [fuentesListas] = useFonts({
    ...Ionicons.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fuentesListas) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0D10', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#F04A4F" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ProveedorTema>
        <BarraEstado />
        <ProveedorSesion>
          <Raiz />
        </ProveedorSesion>
      </ProveedorTema>
    </SafeAreaProvider>
  );
}
