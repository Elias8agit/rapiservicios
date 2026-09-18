/**
 * MODULO M2 - REGISTRO DE VEHICULOS.
 * MODULO M7 - HISTORIAL VEHICULAR.
 *
 * Cada vehiculo pertenece a un cliente y la placa opera como identificador
 * unico dentro del taller. El historial se resuelve mediante la vista
 * v_historial_vehiculo que define el esquema de la base de datos.
 *
 * Rutas
 *   GET  /api/vehiculos                  Listado con busqueda por placa o marca
 *   GET  /api/vehiculos/:id              Detalle con el cliente propietario
 *   GET  /api/vehiculos/:id/historial    Ordenes previas del vehiculo
 *   POST /api/vehiculos                  Alta
 *   PUT  /api/vehiculos/:id              Modificacion
 */

const express = require('express');
const { clienteServicio } = require('../config/supabase');
const { requiereSesion } = require('../middleware/autenticacion');
const { TIPOS_TRANSMISION } = require('../servicios/motorReglas');

const enrutador = express.Router();

enrutador.use(requiereSesion);

const ANIO_MAXIMO = new Date().getFullYear() + 1;

/** Valida el cuerpo del alta y de la modificacion. */
function validar(cuerpo) {
  const errores = [];
  const placa = String(cuerpo.placa || '').trim().toUpperCase();
  const marca = String(cuerpo.marca || '').trim();
  const linea = String(cuerpo.linea || '').trim();
  const anio = Number(cuerpo.modeloAnio || 0);
  const kilometraje = cuerpo.kilometraje === undefined || cuerpo.kilometraje === null
    ? null
    : Number(cuerpo.kilometraje);

  // Tipo de caja. Campo opcional: los vehiculos registrados antes del 18 de
  // septiembre de 2026 carecen de el, y obligarlo impediria modificar esas
  // fichas. Un valor ausente significa que el taller todavia no lo constato, y
  // el motor de reglas se abstiene de las tareas propias de un tipo en lugar de
  // suponerlo.
  const transmisionCruda = String(cuerpo.tipoTransmision || '').trim().toUpperCase();
  const tipoTransmision = transmisionCruda || null;

  if (tipoTransmision && !TIPOS_TRANSMISION.includes(tipoTransmision)) {
    errores.push(`El tipo de transmision admite ${TIPOS_TRANSMISION.join(' o ')}.`);
  }

  if (!cuerpo.idCliente) errores.push('El cliente propietario resulta obligatorio.');
  if (placa.length < 4) errores.push('La placa requiere al menos cuatro caracteres.');
  if (marca.length < 2) errores.push('La marca resulta obligatoria.');
  if (linea.length < 1) errores.push('La linea resulta obligatoria.');
  if (!Number.isInteger(anio) || anio < 1950 || anio > ANIO_MAXIMO) {
    errores.push(`El anio del modelo corresponde al rango entre 1950 y ${ANIO_MAXIMO}.`);
  }
  if (kilometraje !== null && (Number.isNaN(kilometraje) || kilometraje < 0)) {
    errores.push('El kilometraje requiere un numero mayor o igual que cero.');
  }

  return {
    errores,
    valores: {
      id_cliente: Number(cuerpo.idCliente),
      placa,
      marca,
      linea,
      modelo_anio: anio,
      color: cuerpo.color ? String(cuerpo.color).trim() : null,
      kilometraje,
      tipo_transmision: tipoTransmision,
    },
  };
}

/** Listado de vehiculos con busqueda opcional. */
enrutador.get('/', async (peticion, respuesta) => {
  const busqueda = String(peticion.query.busqueda || '').trim();
  const idCliente = peticion.query.idCliente;

  let consulta = clienteServicio
    .from('vehiculo')
    .select('id_vehiculo, placa, marca, linea, modelo_anio, color, kilometraje, tipo_transmision, fecha_registro, cliente:cliente(id_cliente, nombre_completo, telefono)')
    .order('placa');

  if (idCliente) consulta = consulta.eq('id_cliente', Number(idCliente));
  if (busqueda) consulta = consulta.or(`placa.ilike.%${busqueda}%,marca.ilike.%${busqueda}%,linea.ilike.%${busqueda}%`);

  const { data, error } = await consulta;
  if (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al consultar los vehiculos.', detalle: error.message });
  }
  return respuesta.json({ total: data.length, vehiculos: data });
});

/** Detalle de un vehiculo. */
enrutador.get('/:id', async (peticion, respuesta) => {
  const { data, error } = await clienteServicio
    .from('vehiculo')
    .select('id_vehiculo, placa, marca, linea, modelo_anio, color, kilometraje, tipo_transmision, fecha_registro, cliente:cliente(id_cliente, nombre_completo, telefono, correo)')
    .eq('id_vehiculo', Number(peticion.params.id))
    .maybeSingle();

  if (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al consultar el vehiculo.', detalle: error.message });
  }
  if (!data) {
    return respuesta.status(404).json({ error: 'El vehiculo solicitado no existe.' });
  }
  return respuesta.json({ vehiculo: data });
});

/** Historial de ordenes previas del vehiculo. */
enrutador.get('/:id/historial', async (peticion, respuesta) => {
  const { data, error } = await clienteServicio
    .from('v_historial_vehiculo')
    .select('*')
    .eq('id_vehiculo', Number(peticion.params.id))
    .order('fecha_ingreso', { ascending: false });

  if (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al consultar el historial.', detalle: error.message });
  }
  return respuesta.json({ total: data.length, historial: data });
});

/** Alta de vehiculo. */
enrutador.post('/', async (peticion, respuesta) => {
  const { errores, valores } = validar(peticion.body || {});
  if (errores.length) return respuesta.status(400).json({ error: errores.join(' ') });

  const { data, error } = await clienteServicio
    .from('vehiculo')
    .insert(valores)
    .select('id_vehiculo, placa, marca, linea, modelo_anio, color, kilometraje, tipo_transmision')
    .single();

  if (error) {
    const duplicada = error.code === '23505';
    return respuesta.status(400).json({
      error: duplicada
        ? `La placa ${valores.placa} ya corresponde a un vehiculo registrado.`
        : 'No se logro registrar el vehiculo.',
      detalle: error.message,
    });
  }
  return respuesta.status(201).json({ vehiculo: data });
});

/** Modificacion de vehiculo. */
enrutador.put('/:id', async (peticion, respuesta) => {
  const { errores, valores } = validar(peticion.body || {});
  if (errores.length) return respuesta.status(400).json({ error: errores.join(' ') });

  const { data, error } = await clienteServicio
    .from('vehiculo')
    .update(valores)
    .eq('id_vehiculo', Number(peticion.params.id))
    .select('id_vehiculo, placa, marca, linea, modelo_anio, color, kilometraje, tipo_transmision')
    .maybeSingle();

  if (error) {
    return respuesta.status(400).json({ error: 'No se logro actualizar el vehiculo.', detalle: error.message });
  }
  if (!data) {
    return respuesta.status(404).json({ error: 'El vehiculo solicitado no existe.' });
  }
  return respuesta.json({ vehiculo: data });
});

module.exports = enrutador;
