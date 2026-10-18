/**
 * REGLAS DE EDICION Y ANULACION DE ORDENES.
 *
 * Reune las decisiones sobre que se puede cambiar de una orden ya creada y
 * cuando se puede anular. Vive aparte de la ruta para poder probarse sin red
 * ni base de datos (pruebas/prueba-anulacion.js): la ruta solo consulta, aplica
 * lo que estas funciones deciden y escribe.
 *
 * Alcance decidido el 18 de octubre de 2026:
 *
 *   - Se edita solo lo que no afecta al diagnostico: el kilometraje de
 *     ingreso y la nota del mecanico. La descripcion de la falla y el
 *     vehiculo quedan fijos porque el diagnostico se genero a partir de ellos.
 *   - Anular corresponde solo al propietario (el control de rol se aplica en
 *     la ruta con requiereRol), exige motivo y se admite hasta LISTO.
 *   - Una orden anulada queda congelada: no avanza de etapa, no marca tareas,
 *     no recibe fotografias ni ediciones.
 */

/** Etapas desde las que se admite anular. ENTREGADO queda fuera. */
const ETAPAS_ANULABLES = ['RECIBIDO', 'EN DIAGNOSTICO', 'EN REPARACION', 'LISTO'];

const MOTIVO_MINIMO = 5;
const MOTIVO_MAXIMO = 160;
const NOTA_MAXIMA = 500;

/** Kilometraje razonable para un vehiculo de taller. */
const KILOMETRAJE_MAXIMO = 2000000;

/**
 * Valida el cuerpo de una edicion y lo traduce a columnas.
 *
 * Solo se toman en cuenta los campos presentes en el cuerpo: un campo ausente
 * se deja como estaba, y un campo enviado con null se borra. Esa distincion
 * permite corregir el kilometraje sin tocar la nota, y vaciar la nota sin
 * tocar el kilometraje.
 *
 * Cualquier otro campo del cuerpo se rechaza de forma expresa. Si la
 * aplicacion manda la descripcion o el vehiculo, es preferible un error claro
 * a que el cambio se ignore en silencio y el mecanico crea que quedo hecho.
 *
 * @param {object} cuerpo Cuerpo de la peticion.
 * @returns {{ errores: string[], cambios: object }}
 */
function validarEdicion(cuerpo) {
  const errores = [];
  const cambios = {};
  const entrada = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};

  const permitidos = ['kilometraje', 'observaciones'];
  const ajenos = Object.keys(entrada).filter((clave) => !permitidos.includes(clave));
  if (ajenos.length) {
    errores.push(
      `Solo se editan el kilometraje y la nota del mecanico. La descripcion y el vehiculo ` +
        `quedan fijos porque el diagnostico se genero a partir de ellos; si estaban mal, ` +
        `conviene anular la orden y crear otra. Campos rechazados: ${ajenos.join(', ')}.`
    );
  }

  if ('kilometraje' in entrada) {
    const valor = entrada.kilometraje;
    if (valor === null || valor === '') {
      cambios.kilometraje_ingreso = null;
    } else {
      // Solo numero o texto con digitos. Number(true) da 1 y Number('  ') da
      // 0, y ninguno de los dos es un kilometraje que alguien haya escrito.
      const numero =
        typeof valor === 'number' || (typeof valor === 'string' && /^\s*\d+\s*$/.test(valor)) ? Number(valor) : NaN;
      if (!Number.isInteger(numero) || numero < 0 || numero > KILOMETRAJE_MAXIMO) {
        errores.push('El kilometraje requiere un numero entero entre 0 y 2000000.');
      } else {
        cambios.kilometraje_ingreso = numero;
      }
    }
  }

  if ('observaciones' in entrada) {
    const valor = entrada.observaciones;
    if (valor === null) {
      cambios.observaciones = null;
    } else if (typeof valor !== 'string') {
      errores.push('La nota del mecanico requiere texto.');
    } else {
      const limpio = valor.trim();
      if (limpio.length > NOTA_MAXIMA) {
        errores.push(`La nota del mecanico admite hasta ${NOTA_MAXIMA} caracteres.`);
      } else {
        cambios.observaciones = limpio || null;
      }
    }
  }

  if (!errores.length && Object.keys(cambios).length === 0) {
    errores.push('La peticion no trae ningun cambio: se espera kilometraje u observaciones.');
  }

  return { errores, cambios };
}

/**
 * Describe en una linea lo que cambio, para el asiento de la bitacora.
 *
 * Devuelve null cuando los valores nuevos son iguales a los guardados: una
 * edicion que no cambia nada no deja asiento, para que la bitacora no se
 * llene de ruido cuando el mecanico guarda dos veces.
 *
 * @param {object} anterior Fila actual de la orden.
 * @param {object} cambios  Columnas que devolvio validarEdicion.
 * @returns {string|null}
 */
function resumirEdicion(anterior, cambios) {
  const partes = [];

  if ('kilometraje_ingreso' in cambios && cambios.kilometraje_ingreso !== anterior.kilometraje_ingreso) {
    const antes = anterior.kilometraje_ingreso ?? 'sin dato';
    const despues = cambios.kilometraje_ingreso ?? 'sin dato';
    partes.push(`kilometraje de ${antes} a ${despues}`);
  }

  if ('observaciones' in cambios && (cambios.observaciones || null) !== (anterior.observaciones || null)) {
    partes.push(cambios.observaciones ? 'nota del mecanico actualizada' : 'nota del mecanico retirada');
  }

  if (!partes.length) return null;

  // La columna comentario de la bitacora admite 200 caracteres.
  return `Edicion: ${partes.join('; ')}.`.slice(0, 200);
}

/**
 * Valida el motivo de una anulacion.
 * @returns {{ error: string|null, motivo: string }}
 */
function validarMotivo(motivoCrudo) {
  const motivo = typeof motivoCrudo === 'string' ? motivoCrudo.trim() : '';
  if (motivo.length < MOTIVO_MINIMO) {
    return {
      error: `El motivo de la anulacion requiere al menos ${MOTIVO_MINIMO} caracteres. Queda en la bitacora como constancia.`,
      motivo,
    };
  }
  if (motivo.length > MOTIVO_MAXIMO) {
    return { error: `El motivo de la anulacion admite hasta ${MOTIVO_MAXIMO} caracteres.`, motivo };
  }
  return { error: null, motivo };
}

/**
 * Decide si una orden se puede anular en su situacion actual.
 *
 * @param {{ nombreEstado: string, anulada: boolean }} orden
 * @returns {{ permitido: boolean, motivo: string|null }}
 */
function puedeAnular({ nombreEstado, anulada }) {
  if (anulada) {
    return { permitido: false, motivo: 'La orden ya se encuentra anulada.' };
  }
  if (nombreEstado === 'ENTREGADO') {
    return {
      permitido: false,
      motivo: 'Una orden ENTREGADA ya salio del taller con el cliente y no se anula: es historia real del vehiculo.',
    };
  }
  if (!ETAPAS_ANULABLES.includes(nombreEstado)) {
    return { permitido: false, motivo: `La etapa ${nombreEstado} no admite anulacion.` };
  }
  return { permitido: true, motivo: null };
}

/** Texto del asiento de bitacora que deja una anulacion. */
function comentarioAnulacion(motivo) {
  return `Orden anulada. Motivo: ${motivo}`.slice(0, 200);
}

/** Mensaje uniforme cuando se intenta operar sobre una orden anulada. */
const MENSAJE_ANULADA =
  'La orden se encuentra anulada y no admite cambios. Su contenido se conserva como constancia.';

module.exports = {
  ETAPAS_ANULABLES,
  MOTIVO_MINIMO,
  MOTIVO_MAXIMO,
  NOTA_MAXIMA,
  KILOMETRAJE_MAXIMO,
  MENSAJE_ANULADA,
  validarEdicion,
  resumirEdicion,
  validarMotivo,
  puedeAnular,
  comentarioAnulacion,
};
