/**
 * MODULO M2 - REGISTRO DE CLIENTES.
 *
 * El personal del taller registra y consulta a los clientes. El cliente no
 * captura informacion dentro del sistema, conforme a la definicion de actores
 * del Capitulo IV.
 *
 * Rutas
 *   GET    /api/clientes        Listado con busqueda por nombre o telefono
 *   GET    /api/clientes/:id    Detalle con los vehiculos del cliente
 *   POST   /api/clientes        Alta
 *   PUT    /api/clientes/:id    Modificacion
 */

const express = require('express');
const { clienteServicio } = require('../config/supabase');
const { requiereSesion } = require('../middleware/autenticacion');

const enrutador = express.Router();

enrutador.use(requiereSesion);

/** Valida el cuerpo del alta y de la modificacion. */
function validar(cuerpo) {
  const errores = [];
  const nombre = String(cuerpo.nombreCompleto || '').trim();
  const telefono = String(cuerpo.telefono || '').trim();
  const correo = String(cuerpo.correo || '').trim();

  if (nombre.length < 3) errores.push('El nombre completo requiere al menos tres caracteres.');
  if (telefono.length < 8) errores.push('El telefono requiere al menos ocho digitos.');
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) errores.push('El correo carece de un formato valido.');

  return { errores, valores: { nombre_completo: nombre, telefono, correo: correo || null } };
}

/** Listado de clientes con busqueda opcional. */
enrutador.get('/', async (peticion, respuesta) => {
  const busqueda = String(peticion.query.busqueda || '').trim();

  let consulta = clienteServicio
    .from('cliente')
    .select('id_cliente, nombre_completo, telefono, correo, fecha_registro')
    .order('nombre_completo');

  if (busqueda) {
    consulta = consulta.or(`nombre_completo.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`);
  }

  const { data, error } = await consulta;
  if (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al consultar los clientes.', detalle: error.message });
  }
  return respuesta.json({ total: data.length, clientes: data });
});

/** Detalle de un cliente con los vehiculos registrados. */
enrutador.get('/:id', async (peticion, respuesta) => {
  const { data, error } = await clienteServicio
    .from('cliente')
    .select('id_cliente, nombre_completo, telefono, correo, fecha_registro, vehiculos:vehiculo(id_vehiculo, placa, marca, linea, modelo_anio, color, kilometraje)')
    .eq('id_cliente', Number(peticion.params.id))
    .maybeSingle();

  if (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al consultar el cliente.', detalle: error.message });
  }
  if (!data) {
    return respuesta.status(404).json({ error: 'El cliente solicitado no existe.' });
  }
  return respuesta.json({ cliente: data });
});

/** Alta de cliente. */
enrutador.post('/', async (peticion, respuesta) => {
  const { errores, valores } = validar(peticion.body || {});
  if (errores.length) return respuesta.status(400).json({ error: errores.join(' ') });

  const { data, error } = await clienteServicio
    .from('cliente')
    .insert(valores)
    .select('id_cliente, nombre_completo, telefono, correo, fecha_registro')
    .single();

  if (error) {
    return respuesta.status(400).json({ error: 'No se logro registrar el cliente.', detalle: error.message });
  }
  return respuesta.status(201).json({ cliente: data });
});

/** Modificacion de cliente. */
enrutador.put('/:id', async (peticion, respuesta) => {
  const { errores, valores } = validar(peticion.body || {});
  if (errores.length) return respuesta.status(400).json({ error: errores.join(' ') });

  const { data, error } = await clienteServicio
    .from('cliente')
    .update(valores)
    .eq('id_cliente', Number(peticion.params.id))
    .select('id_cliente, nombre_completo, telefono, correo, fecha_registro')
    .maybeSingle();

  if (error) {
    return respuesta.status(400).json({ error: 'No se logro actualizar el cliente.', detalle: error.message });
  }
  if (!data) {
    return respuesta.status(404).json({ error: 'El cliente solicitado no existe.' });
  }
  return respuesta.json({ cliente: data });
});

module.exports = enrutador;
