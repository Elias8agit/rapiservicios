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

const { configurado } = require('./config/supabase');

const rutasAutenticacion = require('./rutas/autenticacion');
const rutasUsuarios = require('./rutas/usuarios');
const rutasClientes = require('./rutas/clientes');
const rutasVehiculos = require('./rutas/vehiculos');
const rutasOrdenes = require('./rutas/ordenes');
const rutasDiagnostico = require('./rutas/diagnostico');
const rutasConsulta = require('./rutas/consulta');

const app = express();
const PUERTO = process.env.PUERTO || 3000;

app.use(cors());
app.use(express.json({ limit: '12mb' }));

/** Verificacion del estado del servicio. */
app.get('/api/salud', (peticion, respuesta) => {
  respuesta.json({
    servicio: 'Rapiservicios API',
    version: '0.2.0',
    estado: 'operativo',
    supabase: configurado ? 'configurado' : 'sin configurar',
    interpretacion: process.env.GEMINI_API_KEY ? 'Gemini' : 'respaldo local',
    fecha: new Date().toISOString(),
  });
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
