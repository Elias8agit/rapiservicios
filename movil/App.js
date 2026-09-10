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
import { Ionicons } from '@expo/vector-icons';

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
import Cuenta from './src/pantallas/Cuenta';

const Pila = createNativeStackNavigator();
const Pestanas = createBottomTabNavigator();

/** Opciones del encabezado, derivadas de la paleta activa. */
function usarOpcionesEncabezado() {
  const { colores } = useTema();
  return {
    headerStyle: { backgroundColor: colores.primario },
    headerTintColor: '#FFFFFF',
    headerTitleStyle: { fontWeight: '700', fontSize: 17 },
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
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

  return (
    <NavigationContainer theme={temaNavegacion}>
      {sesion ? <NavegacionTaller /> : <NavegacionAcceso />}
    </NavigationContainer>
  );
}

/** Barra de estado del sistema, con el contraste que pide la paleta activa. */
function BarraEstado() {
  const { esOscuro } = useTema();
  return <StatusBar style={esOscuro ? 'light' : 'light'} backgroundColor="transparent" translucent />;
}

export default function App() {
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
