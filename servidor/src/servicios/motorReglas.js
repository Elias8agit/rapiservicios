/**
 * MOTOR DE REGLAS - Componente experto del sistema.
 *
 * Recibe la categoria de falla que entrega la capa de interpretacion y
 * determina, con base en la base de conocimiento del taller, cuales tareas
 * de revision corresponden y cual es el tiempo estimado de atencion.
 *
 * La decision del diagnostico permanece dentro de este componente. El
 * servicio externo de interpretacion nunca define la orden de trabajo.
 */

const { CATEGORIAS, TAREAS, REGLAS } = require('../datos/catalogo');

const UMBRAL_CONFIANZA = 0.60;

/** Elimina tildes y normaliza el texto para la comparacion de palabras. */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Verifica si una regla se cumple para la entrada recibida. */
function seCumple(regla, entrada) {
  if (!regla.activa) return false;
  if (regla.idCategoria !== entrada.idCategoria) return false;

  const kilometraje = Number(entrada.kilometraje || 0);
  if (kilometraje < Number(regla.condicion.kmMinimo || 0)) return false;

  const texto = normalizar(entrada.descripcion);
  const coincidencias = regla.condicion.palabras.filter((p) => texto.includes(normalizar(p)));

  // La regla aplica cuando existe coincidencia lexica o cuando la capa de
  // interpretacion reporta confianza suficiente sobre la categoria.
  return coincidencias.length > 0 || Number(entrada.nivelConfianza || 0) >= UMBRAL_CONFIANZA;
}

/** Calcula el peso de una regla para el ordenamiento del resultado. */
function calcularPeso(regla, entrada) {
  const texto = normalizar(entrada.descripcion);
  const coincidencias = regla.condicion.palabras.filter((p) => texto.includes(normalizar(p))).length;
  return coincidencias * 10 + regla.nivelConfianza * 5 - regla.prioridad;
}

/**
 * Evalua la base de conocimiento y construye el diagnostico sugerido.
 * @param {{idCategoria:number, descripcion:string, nivelConfianza:number, kilometraje:number}} entrada
 */
function evaluar(entrada) {
  const categoria = CATEGORIAS.find((c) => c.idCategoria === entrada.idCategoria);
  if (!categoria) {
    return { aplicada: false, motivo: 'La categoria recibida no existe en el catalogo.' };
  }

  const aplicables = REGLAS
    .filter((r) => seCumple(r, entrada))
    .sort((a, b) => calcularPeso(b, entrada) - calcularPeso(a, entrada));

  if (aplicables.length === 0) {
    return {
      aplicada: false,
      categoria: categoria.nombre,
      motivo: 'Ninguna regla de la categoria satisface las condiciones. Se requiere revision manual.',
    };
  }

  // Union ordenada de tareas, sin duplicados entre reglas coincidentes.
  const vistas = new Set();
  const tareas = [];
  aplicables.forEach((regla) => {
    regla.tareas.forEach((idTarea) => {
      if (vistas.has(idTarea)) return;
      vistas.add(idTarea);
      const tarea = TAREAS.find((t) => t.idTarea === idTarea);
      if (tarea) tareas.push({ ...tarea, regla: regla.nombre });
    });
  });

  const tiempoEstimado = tareas.reduce((total, t) => total + t.minutos, 0);
  const confianza = Math.max(...aplicables.map((r) => r.nivelConfianza));

  return {
    aplicada: true,
    categoria: categoria.nombre,
    sistemaVehicular: categoria.sistema,
    reglasAplicadas: aplicables.map((r) => r.nombre),
    tareas,
    tiempoEstimadoMin: tiempoEstimado,
    tiempoEstimadoTexto: formatearTiempo(tiempoEstimado),
    nivelConfianza: Number(confianza.toFixed(3)),
  };
}

function formatearTiempo(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} minutos`;
  if (resto === 0) return `${horas} hora(s)`;
  return `${horas} hora(s) con ${resto} minutos`;
}

module.exports = { evaluar, normalizar, UMBRAL_CONFIANZA };
