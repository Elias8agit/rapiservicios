# Sistema con inteligencia artificial para generar órdenes de trabajo y diagnóstico

**Taller mecánico Rapiservicios — Villa Nueva, Guatemala**

Proyecto de Graduación II · Universidad Mariano Gálvez de Guatemala
Facultad de Ingeniería en Sistemas y Ciencias de la Computación
Autor: Walter Estuardo Elías Ochoa — Carné 0900228982

---

## Descripción

El sistema traslada el registro manual de órdenes de trabajo del taller hacia una
aplicación móvil que genera un diagnóstico sugerido a partir de la descripción en
texto libre del mecánico y de las fotografías del componente afectado.

La solución combina dos componentes de inteligencia artificial:

| Capa | Función | Tecnología |
|---|---|---|
| Interpretación | Traduce texto libre y fotografía hacia una categoría de falla del catálogo | Google Gemini Flash-Lite |
| Decisión | Aplica las reglas del taller y determina tareas y tiempo estimado | Motor de reglas propio |

La decisión del diagnóstico permanece siempre en el motor de reglas. El servicio
externo únicamente clasifica.

---

## Arquitectura

La aplicación móvil conversa de forma exclusiva con el servidor de aplicación. El
servidor concentra la lógica del negocio y opera como único intermediario frente a
Supabase, de manera que las claves de servicio nunca residen dentro del teléfono.

```
Aplicación móvil  →  Servidor Express  →  Supabase (PostgreSQL, Auth, Storage)
   React Native            Node.js       →  Google Gemini (interpretación)
```

---

## Módulos

| Código | Módulo |
|---|---|
| M1 | Autenticación y control de acceso |
| M2 | Registro de clientes y vehículos |
| M3 | Recepción y captura de fallas |
| M4 | Interpretación inteligente |
| M5 | Motor de reglas y diagnóstico |
| M6 | Órdenes de trabajo |
| M7 | Historial vehicular |
| M8 | Consulta del cliente |

---

## Estructura del repositorio

```
├── basedatos/
│   ├── 01_esquema.sql             Estructura relacional (14 tablas + 1 vista)
│   ├── 02_datos_iniciales.sql     Base de conocimiento del taller
│   └── 03_usuario_inicial.sql     Perfil del propietario enlazado con Supabase Auth
├── servidor/
│   └── src/
│       ├── config/supabase.js          Clientes público y de servicio
│       ├── middleware/autenticacion.js Validación del testigo y control por rol
│       ├── servicios/
│       │   ├── interpretacion.js       Capa de interpretación (Gemini + respaldo local)
│       │   ├── motorReglas.js          Motor de reglas experto
│       │   └── almacenamiento.js       Fotografías sobre Supabase Storage
│       ├── rutas/                      Servicios REST por módulo
│       ├── utilidades/codigo.js        Código de consulta del cliente
│       └── index.js                    Punto de entrada
├── movil/                          Aplicación React Native + Expo
│   ├── configuracion.js            Dirección del servidor
│   ├── App.js                      Navegación
│   └── src/  api · contexto · componentes · pantallas
└── documentacion/                  Diagramas UML y entidad-relación
```

---

## Requisitos

- Node.js 20 o superior
- Cuenta de Supabase (PostgreSQL, Auth y Storage)
- Aplicación Expo Go dentro del teléfono
- Clave de API de Google AI Studio (opcional: sin ella opera el clasificador local)

---

## Puesta en marcha

### 0. Obtener el código

```bash
git clone https://github.com/Elias8agit/rapiservicios.git
cd rapiservicios
```

### 1. Base de datos

Dentro del editor de consultas de Supabase, ejecutar en orden `01_esquema.sql` y
`02_datos_iniciales.sql`. Crear después el depósito privado `fotografias-ordenes`
dentro de Storage y la cuenta de acceso del propietario dentro de Authentication.
Ejecutar por último `03_usuario_inicial.sql`.

### 2. Servidor

```bash
cd rapiservicios/servidor
npm install
copy .env.ejemplo .env      # completar las credenciales
npm run iniciar             # servidor en el puerto 3000
```

Pruebas disponibles:

```bash
npm run prueba              # motor de reglas, sin base de datos ni servicio externo
npm run prueba:conexion     # conexión con Supabase y catálogos cargados
npm run prueba:flujo -- correo contrasena   # recorrido completo del sistema
npm run prueba:modelos      # inventario y medición de modelos de interpretación
npm run prueba:gemini       # comparación entre el clasificador local y el servicio
```

### 3. Aplicación móvil

```bash
cd movil
npm install
npx expo start
```

Leer el código de respuesta rápida con la aplicación Expo Go. El teléfono y la
computadora requieren la misma red inalámbrica. La dirección del servidor se
resuelve de forma automática; para apuntar hacia otra dirección, editar la
constante `DIRECCION_MANUAL` dentro de `movil/configuracion.js`.

---

## Servicios disponibles

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/salud` | Verificación del estado del servicio |
| POST | `/api/autenticacion/ingreso` | Inicio de sesión |
| POST | `/api/autenticacion/renovar` | Renovación del testigo |
| GET | `/api/autenticacion/perfil` | Perfil de la sesión activa |
| POST | `/api/autenticacion/salida` | Cierre de sesión |
| GET POST PATCH | `/api/usuarios` | Personal del taller (rol propietario) |
| GET POST PUT | `/api/clientes` | Registro de clientes |
| GET POST PUT | `/api/vehiculos` | Registro de vehículos |
| GET | `/api/vehiculos/:id/historial` | Historial vehicular |
| GET POST | `/api/ordenes` | Órdenes de trabajo |
| GET | `/api/ordenes/:id` | Detalle con diagnóstico, tareas, fotografías y bitácora |
| PATCH | `/api/ordenes/:id/estado` | Avance del estado |
| PATCH | `/api/ordenes/:id/tareas/:idDetalle` | Marca de tarea concluida |
| POST | `/api/ordenes/:id/fotografias` | Evidencia en cualquier etapa |
| GET | `/api/diagnostico/categorias` | Catálogo de categorías de falla |
| POST | `/api/diagnostico` | Diagnóstico sugerido sin registro de orden |
| GET | `/api/consulta/:codigo` | Consulta del cliente, sin sesión |

---

## Resguardo de la información del cliente

- La placa del vehículo permanece dentro de la base de datos del taller y nunca
  viaja hacia el servicio externo de interpretación.
- Hacia la interfaz de Gemini únicamente viajan la descripción en texto libre y la
  fotografía del componente, sin datos que identifiquen al cliente.
- Las claves de servicio residen dentro del archivo `.env` del servidor, excluido
  del control de versiones.
- La seguridad a nivel de fila permanece activa dentro de Supabase.

---

## Estado del desarrollo

- [x] Diseño de la arquitectura del sistema
- [x] Modelo de datos y diagrama entidad-relación
- [x] Definición de módulos y tecnologías
- [x] Diagramas UML (casos de uso, secuencia, clases)
- [x] Motor de reglas funcional con pruebas
- [x] Capa de interpretación con respaldo local
- [x] Servicios REST de autenticación, clientes, vehículos y órdenes
- [x] Aplicación móvil React Native con navegación y pantallas
- [x] Prueba de extremo a extremo contra Supabase (27 de 27 verificaciones)
- [x] Integración con el servicio de interpretación y medición de modelos
- [ ] Pantalla de historial vehicular
- [ ] Despliegue productivo
