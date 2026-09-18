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

/** Tipos de transmision que el taller distingue. */
const TIPOS_TRANSMISION = ['MECANICA', 'AUTOMATICA'];

/** Elimina tildes y normaliza el texto para la comparacion de palabras. */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Expresiones con las que el taller nombra cada tipo de caja.
 *
 * Sirven unicamente al reconocimiento de respaldo descrito en tipoDeCaja.
 */
const SENAS_TRANSMISION = {
  AUTOMATICA: ['automatica', 'automatico', 'caja auto', ' at ', 'cvt', 'tiptronic', 'convertidor de par'],
  MECANICA: ['mecanica', 'manual', 'estandar', 'embrague', 'clutch', 'sincronizado'],
};

/**
 * Determina el tipo de caja del vehiculo, en tres pasos y por ese orden.
 *
 *   1. El dato que consta en la ficha del vehiculo. Es la fuente de verdad:
 *      lo captura el taller al registrar el vehiculo y no depende de como
 *      redacte la orden quien la ingresa.
 *
 *   2. A falta de ese dato, lo que la propia descripcion declare. Los
 *      vehiculos registrados antes del 18 de septiembre de 2026 carecen del
 *      campo, y sin este paso perderian las tareas propias de su caja hasta
 *      que alguien complete la ficha.
 *
 *   3. Si ninguno resuelve, el tipo queda en desconocido y la orden recibe
 *      solo las tareas comunes a ambas cajas. Vale mas una orden corta y
 *      correcta que una larga con trabajo que no corresponde, que fue
 *      exactamente el defecto que origino este cambio.
 *
 * @returns {{tipo:(string|null), procedencia:string}}
 */
function tipoDeCaja(entrada) {
  const declarado = String(entrada.tipoTransmision || '').toUpperCase();
  if (TIPOS_TRANSMISION.includes(declarado)) {
    return { tipo: declarado, procedencia: 'FICHA' };
  }

  // El texto se rodea de espacios para que una sena corta como " at " no
  // coincida dentro de otra palabra.
  const texto = ` ${normalizar(entrada.descripcion)} `;
  for (const tipo of TIPOS_TRANSMISION) {
    if (SENAS_TRANSMISION[tipo].some((sena) => texto.includes(normalizar(sena)))) {
      return { tipo, procedencia: 'DESCRIPCION' };
    }
  }

  return { tipo: null, procedencia: 'DESCONOCIDA' };
}

/** Verifica si una regla se cumple para la entrada recibida. */
function seCumple(regla, entrada, tipoCaja) {
  if (!regla.activa) return false;
  if (regla.idCategoria !== entrada.idCategoria) return false;

  const kilometraje = Number(entrada.kilometraje || 0);
  if (kilometraje < Number(regla.condicion.kmMinimo || 0)) return false;

  // Regla sujeta a un tipo de caja. Sin tipo conocido no se aplica: el motor
  // de reglas no adivina cual de las dos tiene el vehiculo enfrente.
  if (Array.isArray(regla.condicion.transmision)) {
    if (!tipoCaja) return false;
    if (!regla.condicion.transmision.includes(tipoCaja)) return false;
  }

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
 * @param {{idCategoria:number, descripcion:string, nivelConfianza:number,
 *          kilometraje:number, tipoTransmision:(string|null)}} entrada
 */
function evaluar(entrada) {
  const categoria = CATEGORIAS.find((c) => c.idCategoria === entrada.idCategoria);
  if (!categoria) {
    return { aplicada: false, motivo: 'La categoria recibida no existe en el catalogo.' };
  }

  const caja = tipoDeCaja(entrada);

  const aplicables = REGLAS
    .filter((r) => seCumple(r, entrada, caja.tipo))
    .sort((a, b) => calcularPeso(b, entrada) - calcularPeso(a, entrada));

  if (aplicables.length === 0) {
    return {
      aplicada: false,
      categoria: categoria.nombre,
      transmision: caja,
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
    // Tipo de caja con el que se resolvio, y de donde salio. La procedencia
    // importa: una orden resuelta con el dato de la ficha es mas confiable que
    // una resuelta con lo que alguien escribio de prisa.
    transmision: caja,
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

module.exports = { evaluar, normalizar, tipoDeCaja, UMBRAL_CONFIANZA, TIPOS_TRANSMISION };
