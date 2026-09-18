/**
 * Punto de entrada del servidor de aplicacion.
 * Sistema con inteligencia artificial para generar ordenes de trabajo y
 * diagnostico en el taller mecanico Rapiservicios.
 *
 * El servidor concentra la logica del negocio y opera como unico intermediario
 * entre la aplicacion movil y los servicios de Supabase, conforme al diagrama
 * de arquitectura del Capitulo V. Las claves de servicio permanecen dentro del
 * servidor y nunca viajan hacia el dispositivo del mecanico.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { configurado, clienteServicio } = require('./config/supabase');
const { CATEGORIAS, TAREAS, REGLAS } = require('./datos/catalogo');

const rutasAutenticacion = require('./rutas/autenticacion');
const rutasUsuarios = require('./rutas/usuarios');
const rutasClientes = require('./rutas/clientes');
const rutasVehiculos = require('./rutas/vehiculos');
const rutasOrdenes = require('./rutas/ordenes');
const rutasDiagnostico = require('./rutas/diagnostico');
const rutasConsulta = require('./rutas/consulta');
const { limitarConsulta } = require('./middleware/limitador');

const app = express();

/**
 * Confianza en el proxy del proveedor de alojamiento.
 *
 * Render no entrega las peticiones de forma directa: las recibe su propio
 * proxy y las reenvia al proceso. Sin esta linea, Express informa como origen
 * la direccion del proxy, la misma para todo el mundo, y el limite de intentos
 * de la consulta publica contaria a todos los clientes del taller dentro de un
 * solo presupuesto: el primero que se equivocara ocho veces dejaria sin
 * servicio a los demas.
 *
 * Con la confianza declarada, Express toma la direccion real del encabezado
 * X-Forwarded-For. El valor 1 corresponde a un unico proxy por delante, que es
 * la disposicion del proveedor; declarar mas saltos de los que existen
 * permitiria falsificar el origen.
 */
app.set('trust proxy', 1);

// El proveedor de alojamiento asigna el puerto de escucha por medio de la
// variable PORT y lo cambia entre despliegues. La variable PUERTO conserva la
// ejecucion local dentro de la computadora del taller.
const PUERTO = process.env.PORT || process.env.PUERTO || 3000;

app.use(cors());
app.use(express.json({ limit: '12mb' }));

/**
 * Verificacion del estado del servicio.
 *
 * La comprobacion ejecuta una lectura real contra la base de datos. Hasta el
 * 10 de septiembre de 2026 este servicio se limitaba a informar que las
 * credenciales existian dentro del archivo de configuracion, de manera que
 * durante una pausa del proveedor respondia que todo marchaba bien mientras la
 * base permanecia inalcanzable. Una comprobacion que no comprueba resulta peor
 * que ninguna, porque genera confianza sin sustento.
 *
 * El servicio devuelve estado 200 cuando la base responde y 503 cuando no, de
 * modo que un supervisor externo distinga ambas condiciones sin leer el cuerpo.
 */
app.get('/api/salud', async (peticion, respuesta) => {
  const informe = {
    servicio: 'Rapiservicios API',
    version: '0.5.0',
    estado: 'operativo',
    supabase: configurado ? 'configurado' : 'sin configurar',
    baseDatos: 'sin verificar',
    demoraBaseMs: null,
    interpretacion: process.env.GEMINI_API_KEY ? 'Gemini' : 'respaldo local',
    limiteConsulta: 'activo',
    // Tamaño de la base de conocimiento que el proceso tiene cargada.
    //
    // Sirve para comprobar que el despliegue tomo el codigo nuevo, y resulta
    // mas confiable que el numero de version: la version es una etiqueta que
    // alguien debe acordarse de subir, y el 18 de septiembre de 2026 los
    // cambios del tipo de caja salieron sin tocarla, de modo que el informe se
    // veia identico antes y despues. Estas cifras cambian solas cuando el
    // catalogo cambia.
    catalogo: {
      categorias: CATEGORIAS.length,
      tareas: TAREAS.length,
      reglas: REGLAS.length,
    },
    fecha: new Date().toISOString(),
  };

  if (!configurado) {
    informe.estado = 'degradado';
    return respuesta.status(503).json(informe);
  }

  const inicio = Date.now();
  try {
    // Consulta minima sobre un catalogo estable. Basta con que el proveedor
    // conteste: el contenido no interesa.
    const { error } = await clienteServicio.from('estado_orden').select('id_estado').limit(1);
    informe.demoraBaseMs = Date.now() - inicio;

    if (error) {
      informe.estado = 'degradado';
      informe.baseDatos = 'sin respuesta';
      informe.detalle = error.message;
      return respuesta.status(503).json(informe);
    }

    informe.baseDatos = 'operativa';
    return respuesta.json(informe);
  } catch (error) {
    informe.demoraBaseMs = Date.now() - inicio;
    informe.estado = 'degradado';
    informe.baseDatos = 'sin respuesta';
    informe.detalle = error.message;
    return respuesta.status(503).json(informe);
  }
});

app.use('/api/autenticacion', rutasAutenticacion);
app.use('/api/usuarios', rutasUsuarios);
app.use('/api/clientes', rutasClientes);
app.use('/api/vehiculos', rutasVehiculos);
app.use('/api/ordenes', rutasOrdenes);
app.use('/api/diagnostico', rutasDiagnostico);
// La consulta del cliente atiende sin cuenta de acceso, de modo que es el
// unico servicio expuesto a quien no pertenece al taller. Lleva por delante el
// limite de intentos.
app.use('/api/consulta', limitarConsulta, rutasConsulta);

app.use((peticion, respuesta) => {
  respuesta.status(404).json({ error: 'El recurso solicitado no existe.' });
});

// El servidor escucha en todas las interfaces de red para que el telefono del
// mecanico alcance el servicio dentro de la red local del taller.
app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`Servidor de Rapiservicios en escucha por el puerto ${PUERTO}`);
  console.log(`Estado de Supabase: ${configurado ? 'configurado' : 'sin configurar'}`);
});

module.exports = app;
