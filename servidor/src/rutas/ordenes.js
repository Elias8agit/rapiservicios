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
const { clasificar, complementar } = require('../servicios/interpretacion');
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
      .select('id_diagnostico, origen_interpretacion, nivel_confianza, texto_interpretado, sistema_sugerido, hallazgo, fecha_generacion, categoria:categoria_falla(id_categoria, nombre_categoria, sistema_vehicular)')
      .eq('id_orden', idOrden),
    clienteServicio.from('detalle_orden')
      .select('id_detalle, origen, nombre_tarea_sugerida, tiempo_sugerido_min, completada, tiempo_real_min, observacion, tarea:tarea_revision(id_tarea, nombre_tarea, descripcion, tiempo_estimado_min)')
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
    fotografias = null,
    observaciones = null,
  } = peticion.body || {};

  // La aplicacion movil admite varias fotografias por orden desde el 10 de
  // septiembre de 2026. El campo singular se conserva para las versiones de la
  // aplicacion que todavia lo envian.
  const listaFotografias = (Array.isArray(fotografias) ? fotografias : fotografia ? [fotografia] : [])
    .filter((f) => f && f.datos)
    .slice(0, 6);

  if (!idVehiculo) {
    return respuesta.status(400).json({ error: 'El vehiculo resulta obligatorio.' });
  }

  // Longitud minima de la descripcion. Una fotografia aporta informacion por
  // si misma y la capa de interpretacion la aprovecha, de modo que la
  // exigencia sobre el texto disminuye cuando el mecanico adjunta imagen.
  const hayFotografia = listaFotografias.length > 0;
  const minimoTexto = hayFotografia ? 4 : 10;
  if (!descripcionFalla || String(descripcionFalla).trim().length < minimoTexto) {
    return respuesta.status(400).json({
      error: hayFotografia
        ? 'La descripcion de la falla requiere al menos cuatro caracteres.'
        : 'La descripcion de la falla requiere al menos diez caracteres. Con una fotografia adjunta bastan cuatro.',
    });
  }

  try {
    const { data: vehiculo } = await clienteServicio
      .from('vehiculo')
      .select('id_vehiculo, placa, kilometraje, tipo_transmision')
      .eq('id_vehiculo', Number(idVehiculo))
      .maybeSingle();

    if (!vehiculo) {
      return respuesta.status(404).json({ error: 'El vehiculo indicado no existe.' });
    }

    const kilometrajeUsado = Number(kilometraje ?? vehiculo.kilometraje ?? 0);

    // Capa de interpretacion. La placa del vehiculo permanece dentro de la
    // base de datos del taller y nunca viaja hacia el servicio externo.
    // La interpretacion recibe unicamente la primera imagen. Enviar varias
    // multiplicaria la demora del servicio externo sin aportar certeza: la
    // primera es la que el mecanico eligio para mostrar la falla.
    // La orden no se registra sin lectura. Decision del usuario del 12 de
    // septiembre de 2026: una orden en blanco no es un resultado aceptable, de
    // modo que ante una falla de la capa de interpretacion nada se escribe y el
    // mecanico reintenta con el formulario intacto.
    let interpretacion;
    try {
      interpretacion = await clasificar(String(descripcionFalla), listaFotografias[0] || null);
    } catch (falla) {
      if (!falla.interpretacionFallida) throw falla;
      return respuesta.status(503).json({
        codigo: 'INTERPRETACION',
        error:
          'El diagnostico asistido no logro interpretar el ingreso, de modo que la orden no se ' +
          'registro. Nada se perdio: al reintentar se envian de nuevo la descripcion y las ' +
          'fotografias.',
        detalle: `${falla.message}${falla.detalle ? ` ${falla.detalle}` : ''}`,
      });
    }

    // NIVEL 1. La categoria pertenece al catalogo del taller, de modo que la
    // base de conocimiento propia decide las tareas y el tiempo.
    const diagnostico = interpretacion.idCategoria
      ? evaluar({
          idCategoria: interpretacion.idCategoria,
          descripcion: String(descripcionFalla),
          nivelConfianza: interpretacion.nivelConfianza,
          kilometraje: kilometrajeUsado,
          // Tipo de caja de la ficha del vehiculo. Sin ese dato el motor lo
          // busca dentro de la descripcion, y a falta de ambos se abstiene de
          // las tareas propias de un tipo en lugar de suponerlo.
          tipoTransmision: vehiculo.tipo_transmision || null,
        })
      : { aplicada: false, motivo: 'La averia no corresponde a ninguna categoria del catalogo.' };

    // NIVEL 2. El catalogo no cubre la averia y la capa de interpretacion
    // propuso tareas por cuenta propia. Esas tareas sostienen la orden y
    // quedan marcadas como sugerencia, nunca como decision del taller.
    //
    // PROFUNDIDAD COMPLEMENTARIA sobre el nivel 1. Cuando el motor de reglas si
    // resolvio, se le consulta al servicio que le falta a ESTE caso concreto,
    // pasandole las tareas que el taller ya asigno junto con la fotografia. El
    // servicio complementa una decision tomada; no la discute ni la repite. La
    // profundidad guarda proporcion con la evidencia recibida.
    let tareasSugeridas = [];
    let motivoComplemento = null;

    if (diagnostico.aplicada) {
      const complemento = await complementar({
        descripcion: String(descripcionFalla),
        fotografia: listaFotografias[0] || null,
        categoria: diagnostico.categoria,
        sistema: diagnostico.sistemaVehicular,
        tareasDelTaller: (diagnostico.tareas || []).map((t) => t.nombre),
      });
      tareasSugeridas = complemento.tareas;
      motivoComplemento = complemento.motivo || null;
    } else if (interpretacion.hayFalla) {
      tareasSugeridas = interpretacion.tareasSugeridas || [];
    }

    const tiempoSugeridoTotal = tareasSugeridas.reduce((total, t) => total + t.minutos, 0);

    // El tiempo de la orden reune las dos procedencias: el que fijo el motor de
    // reglas y el de la revision complementaria, porque ambas se ejecutan.
    const tiempoEstimadoOrden = diagnostico.aplicada
      ? (diagnostico.tiempoEstimadoMin || 0) + tiempoSugeridoTotal || null
      : tiempoSugeridoTotal || null;

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
        tiempo_estimado_min: tiempoEstimadoOrden,
        observaciones,
      })
      .select('id_orden, codigo_consulta, fecha_ingreso, tiempo_estimado_min')
      .single();

    if (errorOrden) {
      return respuesta.status(400).json({ error: 'No se logro registrar la orden.', detalle: errorOrden.message });
    }

    // Asiento del diagnostico. El registro procede siempre, incluso sin
    // categoria: la ausencia de categoria tambien constituye un resultado, y
    // el motivo de esa ausencia es la evidencia que el mecanico necesita para
    // entender por que la orden llego sin tareas del taller. Hasta el 28 de
    // agosto de 2026 ese registro se omitia y la justificacion se perdia.
    const origenInterpretacion = ['TEXTO', 'FOTOGRAFIA', 'MIXTO', 'MANUAL', 'GENERATIVO'].includes(
      interpretacion.origen
    )
      ? interpretacion.origen
      : 'TEXTO';

    await clienteServicio.from('diagnostico').insert({
      id_orden: orden.id_orden,
      id_categoria: interpretacion.idCategoria || null,
      origen_interpretacion: origenInterpretacion,
      nivel_confianza: Number(interpretacion.nivelConfianza || 0),
      // La justificacion conserva ademas el motivo de la revision
      // complementaria. Deja constancia de que observo el servicio para
      // proponer esas tareas, o de por que no propuso ninguna, que es lo que
      // permite despues revisar si la capa aporta o estorba.
      texto_interpretado:
        [interpretacion.justificacion, motivoComplemento && `Revision complementaria: ${motivoComplemento}`]
          .filter(Boolean)
          .join(' ') || null,
      sistema_sugerido: interpretacion.sistemaSugerido || null,
      hallazgo: interpretacion.hallazgo || null,
    });

    // Detalle de tareas del nivel uno, decididas por el motor de reglas.
    if (diagnostico.aplicada && diagnostico.tareas.length) {
      await clienteServicio.from('detalle_orden').insert(
        diagnostico.tareas.map((t) => ({
          id_orden: orden.id_orden,
          id_tarea: t.idTarea,
          origen: 'REGLA',
        }))
      );
    }

    // Detalle de tareas del nivel dos, sugeridas por la capa de interpretacion.
    if (tareasSugeridas.length) {
      await clienteServicio.from('detalle_orden').insert(
        tareasSugeridas.map((t) => ({
          id_orden: orden.id_orden,
          id_tarea: null,
          origen: 'GENERATIVO',
          nombre_tarea_sugerida: t.nombre,
          tiempo_sugerido_min: t.minutos,
        }))
      );
    }

    // Primer asiento de la bitacora de trazabilidad.
    await clienteServicio.from('bitacora_estado').insert({
      id_orden: orden.id_orden,
      id_estado: idEstadoInicial,
      id_usuario: peticion.usuario.idUsuario,
      comentario: 'Ingreso del vehiculo y generacion del diagnostico sugerido.',
    });

    // Evidencia fotografica de la etapa de ingreso. Cada imagen se resguarda
    // dentro de su propio intento: la falla de una no debe descartar a las
    // demas ni invalidar la orden, que ya quedo registrada.
    let fotografiasResguardadas = 0;
    for (const [indice, imagen] of listaFotografias.entries()) {
      try {
        const ruta = await subirFotografia(imagen, orden.id_orden, 'INGRESO');
        await clienteServicio.from('fotografia').insert({
          id_orden: orden.id_orden,
          id_usuario: peticion.usuario.idUsuario,
          ruta_almacenamiento: ruta,
          etapa: 'INGRESO',
          descripcion:
            indice === 0
              ? 'Componente reportado por el mecanico. Acompano a la interpretacion.'
              : 'Evidencia adicional del ingreso.',
        });
        fotografiasResguardadas += 1;
      } catch (errorFoto) {
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
      tareasSugeridas,
      nivelAtencion: diagnostico.aplicada ? 1 : tareasSugeridas.length ? 2 : 0,
      fotografiasResguardadas,
      fotografiaResguardada: fotografiasResguardadas > 0,
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
