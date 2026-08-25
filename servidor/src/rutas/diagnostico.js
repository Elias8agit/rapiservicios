/**
 * Servicios REST del modulo de diagnostico.
 * Coordina la capa de interpretacion con el motor de reglas del taller.
 */

const express = require('express');
const { clasificar } = require('../servicios/interpretacion');
const { evaluar } = require('../servicios/motorReglas');
const { CATEGORIAS } = require('../datos/catalogo');

const enrutador = express.Router();

/** Devuelve el catalogo de categorias de falla del taller. */
enrutador.get('/categorias', (peticion, respuesta) => {
  respuesta.json({ total: CATEGORIAS.length, categorias: CATEGORIAS });
});

/**
 * Genera el diagnostico sugerido a partir de la descripcion en texto libre y
 * la fotografia opcional del componente.
 * Cuerpo esperado: { descripcion, kilometraje, fotografia: { datos, tipoMime } }
 */
enrutador.post('/', async (peticion, respuesta) => {
  const { descripcion, kilometraje = 0, fotografia = null } = peticion.body || {};

  if (!descripcion || String(descripcion).trim().length < 10) {
    return respuesta.status(400).json({
      error: 'La descripcion de la falla requiere al menos diez caracteres.',
    });
  }

  try {
    const interpretacion = await clasificar(descripcion, fotografia);

    if (!interpretacion.idCategoria) {
      return respuesta.json({
        aplicada: false,
        interpretacion,
        mensaje: 'La descripcion no corresponde a ninguna categoria del catalogo. Se deriva a revision manual.',
      });
    }

    const diagnostico = evaluar({
      idCategoria: interpretacion.idCategoria,
      descripcion,
      nivelConfianza: interpretacion.nivelConfianza,
      kilometraje,
    });

    return respuesta.json({ interpretacion, diagnostico });
  } catch (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al generar el diagnostico.', detalle: error.message });
  }
});

module.exports = enrutador;
