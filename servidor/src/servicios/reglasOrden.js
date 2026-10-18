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
 *
 * Permisos por rol, decididos el mismo 18 de octubre: el mecanico crea y
 * modifica clientes y vehiculos y ve todas las ordenes; solo el propietario
 * pasa una orden a ENTREGADO, porque entregar el vehiculo es cerrar con el
 * cliente. El mecanico la lleva hasta LISTO.
 *
 * Eliminacion de fotografias, decidida el mismo 18 de octubre:
 *
 *   - La elimina quien la tomo o el propietario.
 *   - La fotografia que leyo el asistente para el diagnostico queda
 *     protegida: es el respaldo visible de ese diagnostico.
 *   - Se admite hasta LISTO. En una orden ENTREGADA la evidencia ya es
 *     historia del vehiculo, y una orden anulada esta congelada.
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

/**
 * Descripcion con la que se guarda la fotografia que acompano a la
 * interpretacion. La ruta de ordenes la usa al registrar el ingreso y esta
 * funcion la usa para reconocerla. Cambiar el texto obliga a revisar
 * fotografiaAnalizada, porque las ordenes viejas conservan el anterior.
 */
const DESCRIPCION_FOTO_ANALIZADA = 'Componente reportado por el mecanico. Acompano a la interpretacion.';
const PREFIJO_FOTO_ANALIZADA = 'Componente reportado por el mecanico';

/** Margen para reconocer una fotografia subida durante el registro del ingreso. */
const MARGEN_INGRESO_MS = 3 * 60 * 1000;

/**
 * Identifica, entre las fotografias de una orden, la que leyo el asistente.
 *
 * Primero por su descripcion. Si ninguna la trae (ordenes registradas antes
 * de que se guardara ese texto), se toma la primera fotografia de INGRESO
 * subida dentro de los primeros minutos del registro de la orden: las que se
 * agregan despues desde el detalle no participaron en el diagnostico y no
 * deben quedar protegidas por error.
 *
 * @param {Array<object>} fotografias Filas con id_fotografia, etapa, descripcion y fecha_captura.
 * @param {string} fechaIngreso Fecha de registro de la orden.
 * @returns {number|null} Identificador de la fotografia protegida, o null.
 */
function fotografiaAnalizada(fotografias, fechaIngreso) {
  const deIngreso = (fotografias || []).filter((f) => f.etapa === 'INGRESO');

  const marcada = deIngreso.find((f) => String(f.descripcion || '').startsWith(PREFIJO_FOTO_ANALIZADA));
  if (marcada) return marcada.id_fotografia;

  const inicio = new Date(fechaIngreso).getTime();
  if (Number.isNaN(inicio)) return null;

  const delRegistro = deIngreso
    .filter((f) => {
      const captura = new Date(f.fecha_captura).getTime();
      return !Number.isNaN(captura) && captura - inicio >= 0 && captura - inicio <= MARGEN_INGRESO_MS;
    })
    .sort((a, b) => a.id_fotografia - b.id_fotografia);

  return delRegistro.length ? delRegistro[0].id_fotografia : null;
}

/**
 * Decide si un usuario puede eliminar una fotografia de una orden.
 *
 * @param {{ fotografia: object, idProtegida: number|null,
 *           usuario: { idUsuario: number, rol: string },
 *           nombreEstado: string, anulada: boolean }} datos
 * @returns {{ permitido: boolean, motivo: string|null, deUsuario: boolean }}
 *          deUsuario indica que el impedimento es de la persona (403) y no de
 *          la orden o de la fotografia (409).
 */
function puedeEliminarFotografia({ fotografia, idProtegida, usuario, nombreEstado, anulada }) {
  if (anulada) {
    return { permitido: false, motivo: MENSAJE_ANULADA, deUsuario: false };
  }
  if (nombreEstado === 'ENTREGADO') {
    return {
      permitido: false,
      motivo: 'La orden ya fue ENTREGADA: su evidencia fotografica se conserva como historia del vehiculo.',
      deUsuario: false,
    };
  }
  if (fotografia.id_fotografia === idProtegida) {
    return {
      permitido: false,
      motivo: 'Es la fotografia que leyo el asistente para el diagnostico y se conserva como su respaldo.',
      deUsuario: false,
    };
  }
  const esPropietario = usuario?.rol === 'PROPIETARIO';
  const esAutor = usuario?.idUsuario !== undefined && fotografia.id_usuario === usuario.idUsuario;
  if (!esPropietario && !esAutor) {
    return { permitido: false, motivo: 'Solo quien tomo la fotografia o el propietario pueden eliminarla.', deUsuario: true };
  }
  return { permitido: true, motivo: null, deUsuario: false };
}

/** Etapas que solo el propietario puede asignar. */
const ETAPAS_DEL_PROPIETARIO = ['ENTREGADO'];

/**
 * Decide si un rol puede llevar la orden a una etapa.
 * @returns {{ permitido: boolean, motivo: string|null }}
 */
function puedeCambiarEstado({ destino, rol }) {
  if (ETAPAS_DEL_PROPIETARIO.includes(destino) && rol !== 'PROPIETARIO') {
    return {
      permitido: false,
      motivo: `Solo el propietario pasa una orden a ${destino}: entregar el vehiculo es cerrar con el cliente.`,
    };
  }
  return { permitido: true, motivo: null };
}

/** Texto del asiento de bitacora que deja la eliminacion de una fotografia. */
function comentarioEliminacionFoto(fotografia) {
  return `Fotografia eliminada (etapa ${fotografia.etapa}).`;
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
  DESCRIPCION_FOTO_ANALIZADA,
  validarEdicion,
  resumirEdicion,
  validarMotivo,
  puedeAnular,
  comentarioAnulacion,
  fotografiaAnalizada,
  puedeEliminarFotografia,
  comentarioEliminacionFoto,
  puedeCambiarEstado,
  ETAPAS_DEL_PROPIETARIO,
};
