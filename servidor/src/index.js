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

const rutasAutenticacion = require('./rutas/autenticacion');
const rutasUsuarios = require('./rutas/usuarios');
const rutasClientes = require('./rutas/clientes');
const rutasVehiculos = require('./rutas/vehiculos');
const rutasOrdenes = require('./rutas/ordenes');
const rutasDiagnostico = require('./rutas/diagnostico');
const rutasConsulta = require('./rutas/consulta');

const app = express();

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
    version: '0.3.0',
    estado: 'operativo',
    supabase: configurado ? 'configurado' : 'sin configurar',
    baseDatos: 'sin verificar',
    demoraBaseMs: null,
    interpretacion: process.env.GEMINI_API_KEY ? 'Gemini' : 'respaldo local',
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
app.use('/api/consulta', rutasConsulta);

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
