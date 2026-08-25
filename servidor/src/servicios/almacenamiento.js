/**
 * SERVICIO DE ALMACENAMIENTO DE FOTOGRAFIAS.
 *
 * Las imagenes que captura el mecanico viajan hacia el servidor codificadas en
 * base64 y se resguardan dentro del almacenamiento de Supabase. La base de
 * datos conserva unicamente la ruta del archivo, conforme al campo
 * ruta_almacenamiento de la tabla fotografia.
 *
 * La ruta sigue el patron  orden-<id>/<etapa>-<marca de tiempo>.<extension>
 * de manera que el historial fotografico de cada orden queda agrupado.
 */

const { clienteServicio, BUCKET_FOTOGRAFIAS } = require('../config/supabase');

const EXTENSIONES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ETAPAS = ['INGRESO', 'DIAGNOSTICO', 'REPARACION', 'ENTREGA'];

/**
 * Sube una fotografia y devuelve la ruta dentro del almacenamiento.
 * @param {{datos:string, tipoMime:string}} fotografia Imagen en base64.
 * @param {number} idOrden Identificador de la orden de trabajo.
 * @param {string} etapa Etapa del proceso donde se capturo la imagen.
 * @returns {Promise<string>} Ruta del archivo dentro del almacenamiento.
 */
async function subirFotografia(fotografia, idOrden, etapa = 'INGRESO') {
  if (!fotografia || !fotografia.datos) {
    throw new Error('La fotografia carece de contenido.');
  }
  if (!ETAPAS.includes(etapa)) {
    throw new Error(`La etapa ${etapa} no corresponde al catalogo del proceso.`);
  }

  const tipoMime = fotografia.tipoMime || 'image/jpeg';
  const extension = EXTENSIONES[tipoMime];
  if (!extension) {
    throw new Error(`El formato ${tipoMime} carece de soporte. Se admite JPEG, PNG y WEBP.`);
  }

  // El texto en base64 llega en ocasiones con el prefijo de tipo de datos.
  const limpio = String(fotografia.datos).replace(/^data:[^;]+;base64,/, '');
  const contenido = Buffer.from(limpio, 'base64');

  const ruta = `orden-${idOrden}/${etapa.toLowerCase()}-${Date.now()}.${extension}`;

  const { error } = await clienteServicio.storage
    .from(BUCKET_FOTOGRAFIAS)
    .upload(ruta, contenido, { contentType: tipoMime, upsert: false });

  if (error) {
    throw new Error(`No se logro resguardar la fotografia. Detalle: ${error.message}`);
  }

  return ruta;
}

/**
 * Devuelve un enlace temporal de lectura para una fotografia resguardada.
 * @param {string} ruta Ruta dentro del almacenamiento.
 * @param {number} segundos Vigencia del enlace.
 */
async function obtenerEnlace(ruta, segundos = 3600) {
  const { data, error } = await clienteServicio.storage
    .from(BUCKET_FOTOGRAFIAS)
    .createSignedUrl(ruta, segundos);

  if (error) return null;
  return data?.signedUrl || null;
}

module.exports = { subirFotografia, obtenerEnlace, ETAPAS };
