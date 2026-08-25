/**
 * MODULO M8 - CONSULTA DEL CLIENTE.
 *
 * El cliente del taller consulta el avance de la reparacion mediante el codigo
 * que recibe al momento del ingreso. La consulta no requiere cuenta de acceso
 * y devuelve unicamente la informacion que corresponde al propio vehiculo.
 *
 * La respuesta omite de forma deliberada los datos del personal del taller y
 * el detalle interno del diagnostico, conforme al alcance definido para este
 * actor dentro del Capitulo IV.
 *
 * Ruta
 *   GET /api/consulta/:codigo
 */

const express = require('express');
const { clienteServicio, verificarConfiguracion } = require('../config/supabase');

const enrutador = express.Router();

enrutador.get('/:codigo', async (peticion, respuesta) => {
  const codigo = String(peticion.params.codigo || '').trim().toUpperCase();

  if (codigo.length < 6) {
    return respuesta.status(400).json({ error: 'El codigo de consulta carece de la longitud correcta.' });
  }

  try {
    verificarConfiguracion();

    const { data: orden, error } = await clienteServicio
      .from('orden_trabajo')
      .select(
        'id_orden, codigo_consulta, descripcion_falla, fecha_ingreso, fecha_entrega, tiempo_estimado_min, ' +
        'estado:estado_orden(nombre_estado, orden_secuencia), ' +
        'vehiculo:vehiculo(placa, marca, linea, modelo_anio)'
      )
      .eq('codigo_consulta', codigo)
      .maybeSingle();

    if (error) {
      return respuesta.status(500).json({ error: 'Ocurrio una falla al consultar la orden.', detalle: error.message });
    }
    if (!orden) {
      return respuesta.status(404).json({ error: 'El codigo no corresponde a ninguna orden de trabajo.' });
    }

    const { data: tareas } = await clienteServicio
      .from('detalle_orden')
      .select('completada, tarea:tarea_revision(nombre_tarea)')
      .eq('id_orden', orden.id_orden);

    const listaTareas = tareas || [];
    const completadas = listaTareas.filter((t) => t.completada).length;

    return respuesta.json({
      codigo: orden.codigo_consulta,
      vehiculo: `${orden.vehiculo.marca} ${orden.vehiculo.linea} ${orden.vehiculo.modelo_anio}`,
      placa: orden.vehiculo.placa,
      estado: orden.estado.nombre_estado,
      etapa: `${orden.estado.orden_secuencia} de 5`,
      fechaIngreso: orden.fecha_ingreso,
      fechaEntrega: orden.fecha_entrega,
      tiempoEstimadoMin: orden.tiempo_estimado_min,
      avance: {
        tareasTotales: listaTareas.length,
        tareasCompletadas: completadas,
        porcentaje: listaTareas.length ? Math.round((completadas / listaTareas.length) * 100) : 0,
      },
      revisiones: listaTareas.map((t) => ({ nombre: t.tarea.nombre_tarea, completada: t.completada })),
    });
  } catch (error) {
    return respuesta.status(error.codigoHttp || 500).json({ error: error.message });
  }
});

module.exports = enrutador;
