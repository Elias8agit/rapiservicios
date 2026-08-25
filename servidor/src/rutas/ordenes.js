/**
 * MODULO M3 - RECEPCION Y CAPTURA DE FALLAS.
 * MODULO M6 - ORDENES DE TRABAJO.
 *
 * Este componente coordina el flujo completo del ingreso de un vehiculo:
 *
 *   1. Recibe la descripcion en texto libre y la fotografia del componente.
 *   2. La capa de interpretacion clasifica el contenido dentro del catalogo.
 *   3. El motor de reglas determina las tareas de revision y el tiempo.
 *   4. La orden queda registrada junto con el diagnostico, el detalle de
 *      tareas, la evidencia fotografica y el primer asiento de la bitacora.
 *
 * La correspondencia entre el catalogo en memoria y las tablas de la base de
 * datos descansa en el orden de insercion del archivo 02_datos_iniciales.sql,
 * donde las doce categorias y las veinticuatro tareas reciben identificadores
 * consecutivos a partir de uno.
 *
 * Rutas
 *   GET   /api/ordenes                      Listado con filtro por estado
 *   GET   /api/ordenes/:id                  Detalle completo de la orden
 *   POST  /api/ordenes                      Registro de una orden nueva
 *   PATCH /api/ordenes/:id/estado           Avance del estado de la orden
 *   PATCH /api/ordenes/:id/tareas/:idTarea  Marca una tarea como completada
 *   POST  /api/ordenes/:id/fotografias      Agrega evidencia en cualquier etapa
 */

const express = require('express');
const { clienteServicio } = require('../config/supabase');
const { requiereSesion } = require('../middleware/autenticacion');
const { clasificar } = require('../servicios/interpretacion');
const { evaluar } = require('../servicios/motorReglas');
const { subirFotografia, obtenerEnlace } = require('../servicios/almacenamiento');
const { generarCodigoConsulta } = require('../utilidades/codigo');

const enrutador = express.Router();

enrutador.use(requiereSesion);

const CAMPOS_ORDEN =
  'id_orden, codigo_consulta, descripcion_falla, fecha_ingreso, fecha_entrega, ' +
  'tiempo_estimado_min, observaciones, ' +
  'estado:estado_orden(id_estado, nombre_estado, orden_secuencia), ' +
  'vehiculo:vehiculo(id_vehiculo, placa, marca, linea, modelo_anio, cliente:cliente(id_cliente, nombre_completo, telefono)), ' +
  'usuario:usuario(id_usuario, nombre_completo)';

/** Recupera el identificador de un estado a partir del nombre. */
async function idDeEstado(nombreEstado) {
  const { data } = await clienteServicio
    .from('estado_orden')
    .select('id_estado')
    .eq('nombre_estado', nombreEstado)
    .maybeSingle();
  return data?.id_estado || null;
}

/** Reserva un codigo de consulta que no exista dentro de la tabla. */
async function reservarCodigo(intentos = 6) {
  for (let i = 0; i < intentos; i += 1) {
    const codigo = generarCodigoConsulta();
    const { data } = await clienteServicio
      .from('orden_trabajo')
      .select('id_orden')
      .eq('codigo_consulta', codigo)
      .maybeSingle();
    if (!data) return codigo;
  }
  throw new Error('No se logro generar un codigo de consulta disponible.');
}

/** Listado de ordenes con filtro opcional por estado. */
enrutador.get('/', async (peticion, respuesta) => {
  const { estado, idVehiculo } = peticion.query;

  let consulta = clienteServicio
    .from('orden_trabajo')
    .select(CAMPOS_ORDEN)
    .order('fecha_ingreso', { ascending: false });

  if (idVehiculo) consulta = consulta.eq('id_vehiculo', Number(idVehiculo));

  const { data, error } = await consulta;
  if (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al consultar las ordenes.', detalle: error.message });
  }

  const ordenes = estado ? data.filter((o) => o.estado?.nombre_estado === estado) : data;
  return respuesta.json({ total: ordenes.length, ordenes });
});

/** Detalle completo de una orden de trabajo. */
enrutador.get('/:id', async (peticion, respuesta) => {
  const idOrden = Number(peticion.params.id);

  const { data: orden, error } = await clienteServicio
    .from('orden_trabajo')
    .select(CAMPOS_ORDEN)
    .eq('id_orden', idOrden)
    .maybeSingle();

  if (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al consultar la orden.', detalle: error.message });
  }
  if (!orden) {
    return respuesta.status(404).json({ error: 'La orden solicitada no existe.' });
  }

  const [diagnosticos, tareas, fotografias, bitacora] = await Promise.all([
    clienteServicio.from('diagnostico')
      .select('id_diagnostico, origen_interpretacion, nivel_confianza, texto_interpretado, fecha_generacion, categoria:categoria_falla(id_categoria, nombre_categoria, sistema_vehicular)')
      .eq('id_orden', idOrden),
    clienteServicio.from('detalle_orden')
      .select('id_detalle, completada, tiempo_real_min, observacion, tarea:tarea_revision(id_tarea, nombre_tarea, descripcion, tiempo_estimado_min)')
      .eq('id_orden', idOrden)
      .order('id_detalle'),
    clienteServicio.from('fotografia')
      .select('id_fotografia, ruta_almacenamiento, etapa, descripcion, fecha_captura')
      .eq('id_orden', idOrden)
      .order('fecha_captura'),
    clienteServicio.from('bitacora_estado')
      .select('id_bitacora, fecha_cambio, comentario, estado:estado_orden(nombre_estado), usuario:usuario(nombre_completo)')
      .eq('id_orden', idOrden)
      .order('fecha_cambio'),
  ]);

  const listaFotografias = await Promise.all(
    (fotografias.data || []).map(async (foto) => ({
      ...foto,
      enlace: await obtenerEnlace(foto.ruta_almacenamiento),
    }))
  );

  return respuesta.json({
    orden,
    diagnosticos: diagnosticos.data || [],
    tareas: tareas.data || [],
    fotografias: listaFotografias,
    bitacora: bitacora.data || [],
  });
});

/** Registro de una orden de trabajo nueva. */
enrutador.post('/', async (peticion, respuesta) => {
  const {
    idVehiculo,
    descripcionFalla,
    kilometraje,
    fotografia = null,
    observaciones = null,
  } = peticion.body || {};

  if (!idVehiculo) {
    return respuesta.status(400).json({ error: 'El vehiculo resulta obligatorio.' });
  }
  if (!descripcionFalla || String(descripcionFalla).trim().length < 10) {
    return respuesta.status(400).json({ error: 'La descripcion de la falla requiere al menos diez caracteres.' });
  }

  try {
    const { data: vehiculo } = await clienteServicio
      .from('vehiculo')
      .select('id_vehiculo, placa, kilometraje')
      .eq('id_vehiculo', Number(idVehiculo))
      .maybeSingle();

    if (!vehiculo) {
      return respuesta.status(404).json({ error: 'El vehiculo indicado no existe.' });
    }

    const kilometrajeUsado = Number(kilometraje ?? vehiculo.kilometraje ?? 0);

    // Capa de interpretacion. La placa del vehiculo permanece dentro de la
    // base de datos del taller y nunca viaja hacia el servicio externo.
    const interpretacion = await clasificar(String(descripcionFalla), fotografia);

    // Motor de reglas del taller.
    const diagnostico = interpretacion.idCategoria
      ? evaluar({
          idCategoria: interpretacion.idCategoria,
          descripcion: String(descripcionFalla),
          nivelConfianza: interpretacion.nivelConfianza,
          kilometraje: kilometrajeUsado,
        })
      : { aplicada: false, motivo: 'La descripcion no corresponde a ninguna categoria del catalogo.' };

    const idEstadoInicial = await idDeEstado('RECIBIDO');
    if (!idEstadoInicial) {
      return respuesta.status(500).json({ error: 'El catalogo de estados carece del estado RECIBIDO.' });
    }

    const codigoConsulta = await reservarCodigo();

    const { data: orden, error: errorOrden } = await clienteServicio
      .from('orden_trabajo')
      .insert({
        id_vehiculo: vehiculo.id_vehiculo,
        id_usuario: peticion.usuario.idUsuario,
        id_estado: idEstadoInicial,
        codigo_consulta: codigoConsulta,
        descripcion_falla: String(descripcionFalla).trim(),
        tiempo_estimado_min: diagnostico.aplicada ? diagnostico.tiempoEstimadoMin : null,
        observaciones,
      })
      .select('id_orden, codigo_consulta, fecha_ingreso, tiempo_estimado_min')
      .single();

    if (errorOrden) {
      return respuesta.status(400).json({ error: 'No se logro registrar la orden.', detalle: errorOrden.message });
    }

    // Asiento del diagnostico sugerido.
    if (interpretacion.idCategoria) {
      const origen = ['TEXTO', 'FOTOGRAFIA', 'MIXTO', 'MANUAL'].includes(interpretacion.origen)
        ? interpretacion.origen
        : 'TEXTO';

      await clienteServicio.from('diagnostico').insert({
        id_orden: orden.id_orden,
        id_categoria: interpretacion.idCategoria,
        origen_interpretacion: origen,
        nivel_confianza: Number(interpretacion.nivelConfianza || 0),
        texto_interpretado: interpretacion.justificacion || null,
      });
    }

    // Detalle de tareas de revision que sugiere el motor de reglas.
    if (diagnostico.aplicada && diagnostico.tareas.length) {
      await clienteServicio.from('detalle_orden').insert(
        diagnostico.tareas.map((t) => ({ id_orden: orden.id_orden, id_tarea: t.idTarea }))
      );
    }

    // Primer asiento de la bitacora de trazabilidad.
    await clienteServicio.from('bitacora_estado').insert({
      id_orden: orden.id_orden,
      id_estado: idEstadoInicial,
      id_usuario: peticion.usuario.idUsuario,
      comentario: 'Ingreso del vehiculo y generacion del diagnostico sugerido.',
    });

    // Evidencia fotografica de la etapa de ingreso.
    let rutaFotografia = null;
    if (fotografia && fotografia.datos) {
      try {
        rutaFotografia = await subirFotografia(fotografia, orden.id_orden, 'INGRESO');
        await clienteServicio.from('fotografia').insert({
          id_orden: orden.id_orden,
          id_usuario: peticion.usuario.idUsuario,
          ruta_almacenamiento: rutaFotografia,
          etapa: 'INGRESO',
          descripcion: 'Componente reportado por el mecanico.',
        });
      } catch (errorFoto) {
        // La orden conserva validez aunque la imagen no se resguarde.
        rutaFotografia = null;
        console.warn(`Fotografia sin resguardar en la orden ${orden.id_orden}: ${errorFoto.message}`);
      }
    }

    // Actualizacion del kilometraje del vehiculo cuando el mecanico lo reporta.
    if (kilometraje !== undefined && kilometraje !== null && Number(kilometraje) >= 0) {
      await clienteServicio
        .from('vehiculo')
        .update({ kilometraje: Number(kilometraje) })
        .eq('id_vehiculo', vehiculo.id_vehiculo);
    }

    return respuesta.status(201).json({
      orden: { ...orden, placa: vehiculo.placa },
      interpretacion,
      diagnostico,
      fotografiaResguardada: Boolean(rutaFotografia),
    });
  } catch (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al registrar la orden.', detalle: error.message });
  }
});

/** Avance del estado de la orden con asiento en la bitacora. */
enrutador.patch('/:id/estado', async (peticion, respuesta) => {
  const idOrden = Number(peticion.params.id);
  const { nombreEstado, comentario = null } = peticion.body || {};

  if (!nombreEstado) {
    return respuesta.status(400).json({ error: 'El estado destino resulta obligatorio.' });
  }

  const idEstado = await idDeEstado(nombreEstado);
  if (!idEstado) {
    return respuesta.status(400).json({ error: `El estado ${nombreEstado} no existe dentro del catalogo.` });
  }

  const cambios = { id_estado: idEstado };
  if (nombreEstado === 'ENTREGADO') cambios.fecha_entrega = new Date().toISOString();

  const { data, error } = await clienteServicio
    .from('orden_trabajo')
    .update(cambios)
    .eq('id_orden', idOrden)
    .select('id_orden, codigo_consulta, fecha_entrega')
    .maybeSingle();

  if (error) {
    return respuesta.status(400).json({ error: 'No se logro actualizar el estado.', detalle: error.message });
  }
  if (!data) {
    return respuesta.status(404).json({ error: 'La orden solicitada no existe.' });
  }

  await clienteServicio.from('bitacora_estado').insert({
    id_orden: idOrden,
    id_estado: idEstado,
    id_usuario: peticion.usuario.idUsuario,
    comentario,
  });

  return respuesta.json({ orden: data, estado: nombreEstado });
});

/** Marca una tarea de revision como completada. */
enrutador.patch('/:id/tareas/:idDetalle', async (peticion, respuesta) => {
  const { completada, tiempoRealMin = null, observacion = null } = peticion.body || {};

  if (typeof completada !== 'boolean') {
    return respuesta.status(400).json({ error: 'El campo completada requiere un valor logico.' });
  }

  const { data, error } = await clienteServicio
    .from('detalle_orden')
    .update({ completada, tiempo_real_min: tiempoRealMin, observacion })
    .eq('id_detalle', Number(peticion.params.idDetalle))
    .eq('id_orden', Number(peticion.params.id))
    .select('id_detalle, completada, tiempo_real_min, observacion')
    .maybeSingle();

  if (error) {
    return respuesta.status(400).json({ error: 'No se logro actualizar la tarea.', detalle: error.message });
  }
  if (!data) {
    return respuesta.status(404).json({ error: 'La tarea solicitada no corresponde a la orden.' });
  }
  return respuesta.json({ tarea: data });
});

/** Agrega evidencia fotografica en cualquier etapa del proceso. */
enrutador.post('/:id/fotografias', async (peticion, respuesta) => {
  const idOrden = Number(peticion.params.id);
  const { fotografia, etapa = 'DIAGNOSTICO', descripcion = null } = peticion.body || {};

  if (!fotografia || !fotografia.datos) {
    return respuesta.status(400).json({ error: 'La fotografia resulta obligatoria.' });
  }

  const { data: orden } = await clienteServicio
    .from('orden_trabajo')
    .select('id_orden')
    .eq('id_orden', idOrden)
    .maybeSingle();

  if (!orden) {
    return respuesta.status(404).json({ error: 'La orden solicitada no existe.' });
  }

  try {
    const ruta = await subirFotografia(fotografia, idOrden, etapa);
    const { data, error } = await clienteServicio
      .from('fotografia')
      .insert({
        id_orden: idOrden,
        id_usuario: peticion.usuario.idUsuario,
        ruta_almacenamiento: ruta,
        etapa,
        descripcion,
      })
      .select('id_fotografia, ruta_almacenamiento, etapa, descripcion, fecha_captura')
      .single();

    if (error) {
      return respuesta.status(400).json({ error: 'No se logro registrar la fotografia.', detalle: error.message });
    }
    return respuesta.status(201).json({ fotografia: { ...data, enlace: await obtenerEnlace(ruta) } });
  } catch (error) {
    return respuesta.status(400).json({ error: error.message });
  }
});

module.exports = enrutador;
