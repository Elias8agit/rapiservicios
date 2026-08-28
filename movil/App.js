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
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ProveedorSesion, useSesion } from './src/contexto/Sesion';
import PantallaEnlace from './src/componentes/PantallaEnlace';
import { COLORES } from './src/tema';

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

const OPCIONES_ENCABEZADO = {
  headerStyle: { backgroundColor: COLORES.primario },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '700' },
};

function PilaOrdenes() {
  return (
    <Pila.Navigator screenOptions={OPCIONES_ENCABEZADO}>
      <Pila.Screen name="OrdenesLista" component={Ordenes} options={{ title: 'Ordenes de trabajo' }} />
      <Pila.Screen name="OrdenNueva" component={OrdenNueva} options={{ title: 'Ingreso de vehiculo' }} />
      <Pila.Screen name="OrdenDetalle" component={OrdenDetalle} options={{ title: 'Detalle de la orden' }} />
    </Pila.Navigator>
  );
}

function PilaClientes() {
  return (
    <Pila.Navigator screenOptions={OPCIONES_ENCABEZADO}>
      <Pila.Screen name="ClientesLista" component={Clientes} options={{ title: 'Clientes' }} />
      <Pila.Screen name="ClienteFormulario" component={ClienteFormulario} />
    </Pila.Navigator>
  );
}

function PilaVehiculos() {
  return (
    <Pila.Navigator screenOptions={OPCIONES_ENCABEZADO}>
      <Pila.Screen name="VehiculosLista" component={Vehiculos} options={{ title: 'Vehiculos' }} />
      <Pila.Screen name="VehiculoFormulario" component={VehiculoFormulario} />
    </Pila.Navigator>
  );
}

function PilaCuenta() {
  return (
    <Pila.Navigator screenOptions={OPCIONES_ENCABEZADO}>
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
  return (
    <Pestanas.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORES.primario,
        tabBarInactiveTintColor: COLORES.textoSuave,
        tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
  return (
    <Pila.Navigator screenOptions={OPCIONES_ENCABEZADO}>
      <Pila.Screen name="IniciarSesion" component={IniciarSesion} options={{ headerShown: false }} />
      <Pila.Screen name="ConsultaCliente" component={ConsultaCliente} options={{ title: 'Consulta del cliente' }} />
    </Pila.Navigator>
  );
}

function Raiz() {
  const { sesion, cargando, enlace, segundosEspera, reintentarEnlace } = useSesion();

  // El enlace con el servidor antecede a cualquier pantalla: sin servicio
  // disponible, ni el ingreso ni la sesion resguardada resultan operables.
  if (enlace === 'ENLAZANDO' || enlace === 'SIN_ENLACE') {
    return <PantallaEnlace estado={enlace} segundos={segundosEspera} alReintentar={reintentarEnlace} />;
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORES.fondo }}>
        <ActivityIndicator size="large" color={COLORES.primario} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {sesion ? <NavegacionTaller /> : <NavegacionAcceso />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ProveedorSesion>
        <Raiz />
      </ProveedorSesion>
    </SafeAreaProvider>
  );
}
