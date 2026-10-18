/**
 * PRUEBA DE LAS REGLAS DE EDICION Y ANULACION DE ORDENES.
 *
 * Verifica las decisiones de servicios/reglasOrden.js sin red ni base de
 * datos: que campos se admiten al editar, como se valida cada uno, que deja
 * escrito la bitacora, en que etapas se puede anular, y desde el 18 de
 * octubre de 2026 quien puede eliminar cada fotografia.
 *
 * Lo que esta suite NO cubre, porque necesita servidor y base: el bloqueo con
 * 409 de las rutas sobre una orden anulada, el filtro ANULADAS del listado y
 * la respuesta de la consulta publica. Eso lo recorre la seccion 11 de
 * prueba-flujo. El rechazo con 403 a un mecanico tampoco se cubre aqui: lo
 * aplica requiereRol, el mismo control que ya protege el alta de personal.
 *
 * Ejecucion:  npm run prueba:anulacion
 */

const {
  validarEdicion,
  resumirEdicion,
  validarMotivo,
  puedeAnular,
  comentarioAnulacion,
  ETAPAS_ANULABLES,
  fotografiaAnalizada,
  puedeEliminarFotografia,
  DESCRIPCION_FOTO_ANALIZADA,
} = require('../src/servicios/reglasOrden');

const LINEA = '='.repeat(78);
let correctas = 0;
let fallidas = 0;

function informar(descripcion, condicion, detalle = '') {
  console.log(`${condicion ? '  CORRECTO' : '  FALLA   '}  ${descripcion}`);
  if (!condicion && detalle) console.log(`              ${detalle}`);
  if (condicion) correctas += 1;
  else fallidas += 1;
}

console.log(LINEA);
console.log('  PRUEBA DE EDICION Y ANULACION DE ORDENES');
console.log('  Sistema de ordenes de trabajo y diagnostico - Taller Rapiservicios');
console.log(LINEA);
console.log();

// 1. Campos admitidos ------------------------------------------------------
console.log('1. CAMPOS QUE SE ADMITEN AL EDITAR');
{
  const r = validarEdicion({ kilometraje: 86500 });
  informar('Se admite corregir solo el kilometraje', r.errores.length === 0 && r.cambios.kilometraje_ingreso === 86500);
}
{
  const r = validarEdicion({ observaciones: '  Cliente pide aviso por telefono  ' });
  informar(
    'Se admite editar solo la nota, sin espacios sobrantes',
    r.errores.length === 0 && r.cambios.observaciones === 'Cliente pide aviso por telefono'
  );
}
{
  const r = validarEdicion({ kilometraje: 90000, observaciones: 'Revisar tambien luces' });
  informar('Se admiten los dos campos juntos', r.errores.length === 0 && Object.keys(r.cambios).length === 2);
}
{
  const r = validarEdicion({ descripcionFalla: 'Otra falla' });
  informar(
    'Se rechaza editar la descripcion de la falla',
    r.errores.length === 1 && r.errores[0].includes('descripcionFalla'),
    JSON.stringify(r)
  );
}
{
  const r = validarEdicion({ idVehiculo: 3, kilometraje: 1000 });
  informar(
    'Se rechaza cambiar el vehiculo aunque venga junto con un campo valido',
    r.errores.length === 1 && r.errores[0].includes('idVehiculo'),
    JSON.stringify(r)
  );
}
{
  const r = validarEdicion({});
  informar('Se rechaza una edicion sin cambios', r.errores.length === 1);
}
{
  const r = validarEdicion(null);
  informar('Un cuerpo vacio no rompe la validacion', r.errores.length === 1);
}
console.log();

// 2. Validacion de cada campo ---------------------------------------------
console.log('2. VALIDACION DEL KILOMETRAJE Y DE LA NOTA');
informar('Kilometraje negativo rechazado', validarEdicion({ kilometraje: -5 }).errores.length === 1);
informar('Kilometraje con decimales rechazado', validarEdicion({ kilometraje: 1000.5 }).errores.length === 1);
informar('Kilometraje en texto no numerico rechazado', validarEdicion({ kilometraje: 'mucho' }).errores.length === 1);
informar('Kilometraje como valor logico rechazado', validarEdicion({ kilometraje: true }).errores.length === 1);
informar('Kilometraje de solo espacios rechazado', validarEdicion({ kilometraje: '   ' }).errores.length === 1);
informar('Kilometraje fuera de rango rechazado', validarEdicion({ kilometraje: 2000001 }).errores.length === 1);
informar(
  'Kilometraje escrito como texto numerico admitido',
  validarEdicion({ kilometraje: '120000' }).cambios.kilometraje_ingreso === 120000
);
informar(
  'Kilometraje vacio borra el dato en lugar de guardar cero',
  validarEdicion({ kilometraje: '' }).cambios.kilometraje_ingreso === null
);
informar('Nota de 501 caracteres rechazada', validarEdicion({ observaciones: 'x'.repeat(501) }).errores.length === 1);
informar(
  'Nota de 500 caracteres admitida',
  validarEdicion({ observaciones: 'x'.repeat(500) }).errores.length === 0
);
informar(
  'Nota solo con espacios se guarda como vacia',
  validarEdicion({ observaciones: '   ' }).cambios.observaciones === null
);
informar('Nota que no es texto rechazada', validarEdicion({ observaciones: 42 }).errores.length === 1);
console.log();

// 3. Asiento de la bitacora ------------------------------------------------
console.log('3. ASIENTO DE LA BITACORA');
{
  const anterior = { kilometraje_ingreso: 85000, observaciones: null };
  const texto = resumirEdicion(anterior, { kilometraje_ingreso: 86500 });
  informar(
    'La correccion de kilometraje deja el valor anterior y el nuevo',
    texto === 'Edicion: kilometraje de 85000 a 86500.',
    String(texto)
  );
}
{
  const anterior = { kilometraje_ingreso: null, observaciones: null };
  const texto = resumirEdicion(anterior, { kilometraje_ingreso: 40000, observaciones: 'Aviso por telefono' });
  informar(
    'Una orden sin kilometraje previo dice "sin dato", y la nota tambien queda',
    texto === 'Edicion: kilometraje de sin dato a 40000; nota del mecanico actualizada.',
    String(texto)
  );
}
{
  const anterior = { kilometraje_ingreso: 85000, observaciones: 'Algo' };
  informar(
    'Guardar los mismos valores no deja asiento',
    resumirEdicion(anterior, { kilometraje_ingreso: 85000, observaciones: 'Algo' }) === null
  );
}
{
  const anterior = { kilometraje_ingreso: 85000, observaciones: 'Algo' };
  informar(
    'Retirar la nota queda dicho como tal',
    resumirEdicion(anterior, { observaciones: null }) === 'Edicion: nota del mecanico retirada.'
  );
}
console.log();

// 4. Motivo de la anulacion ------------------------------------------------
console.log('4. MOTIVO DE LA ANULACION');
informar('Sin motivo se rechaza', validarMotivo(undefined).error !== null);
informar('Motivo de cuatro caracteres se rechaza', validarMotivo('abcd').error !== null);
informar('Motivo solo con espacios se rechaza', validarMotivo('        ').error !== null);
informar('Motivo de 161 caracteres se rechaza', validarMotivo('x'.repeat(161)).error !== null);
{
  const r = validarMotivo('  Cliente desistio de la reparacion  ');
  informar('Motivo valido se acepta sin espacios sobrantes', r.error === null && r.motivo === 'Cliente desistio de la reparacion');
}
{
  const texto = comentarioAnulacion('x'.repeat(160));
  informar('El asiento de anulacion cabe en los 200 caracteres de la bitacora', texto.length <= 200, `${texto.length}`);
}
console.log();

// 5. Etapas en las que se puede anular -----------------------------------
console.log('5. ETAPAS EN LAS QUE SE PUEDE ANULAR');
for (const etapa of ETAPAS_ANULABLES) {
  informar(`Se anula desde ${etapa}`, puedeAnular({ nombreEstado: etapa, anulada: false }).permitido);
}
informar('No se anula una orden ENTREGADO', !puedeAnular({ nombreEstado: 'ENTREGADO', anulada: false }).permitido);
informar('No se anula dos veces la misma orden', !puedeAnular({ nombreEstado: 'RECIBIDO', anulada: true }).permitido);
informar('Una etapa desconocida no se anula', !puedeAnular({ nombreEstado: 'INVENTADA', anulada: false }).permitido);
console.log();

// 6. Eliminacion de fotografias ------------------------------------------
console.log('6. ELIMINACION DE FOTOGRAFIAS');
{
  const ingreso = '2026-10-18T21:42:39.381882';
  const fotos = [
    { id_fotografia: 10, id_usuario: 2, etapa: 'INGRESO', descripcion: DESCRIPCION_FOTO_ANALIZADA, fecha_captura: '2026-10-18T21:42:45' },
    { id_fotografia: 11, id_usuario: 2, etapa: 'INGRESO', descripcion: 'Evidencia adicional del ingreso.', fecha_captura: '2026-10-18T21:42:46' },
    { id_fotografia: 12, id_usuario: 3, etapa: 'DIAGNOSTICO', descripcion: null, fecha_captura: '2026-10-18T23:00:00' },
  ];
  const protegida = fotografiaAnalizada(fotos, ingreso);
  informar('Se reconoce por su descripcion la fotografia que leyo el asistente', protegida === 10, String(protegida));

  const viejas = [
    { id_fotografia: 20, id_usuario: 2, etapa: 'INGRESO', descripcion: 'Texto de otra version', fecha_captura: '2026-08-28T10:00:20' },
    { id_fotografia: 21, id_usuario: 2, etapa: 'INGRESO', descripcion: null, fecha_captura: '2026-08-28T15:00:00' },
  ];
  informar(
    'En una orden vieja se protege la primera foto subida durante el registro',
    fotografiaAnalizada(viejas, '2026-08-28T10:00:05') === 20
  );

  const sinFotoEnRegistro = [
    { id_fotografia: 30, id_usuario: 2, etapa: 'INGRESO', descripcion: null, fecha_captura: '2026-09-01T12:00:00' },
  ];
  informar(
    'Una foto de INGRESO agregada horas despues no queda protegida',
    fotografiaAnalizada(sinFotoEnRegistro, '2026-09-01T08:00:00') === null
  );
  informar('Sin fotografias no hay ninguna protegida', fotografiaAnalizada([], ingreso) === null);

  const mecanico = { idUsuario: 2, rol: 'MECANICO' };
  const otroMecanico = { idUsuario: 3, rol: 'MECANICO' };
  const propietario = { idUsuario: 1, rol: 'PROPIETARIO' };
  const base = { idProtegida: 10, nombreEstado: 'EN DIAGNOSTICO', anulada: false };

  informar(
    'Quien tomo la fotografia puede eliminarla',
    puedeEliminarFotografia({ ...base, fotografia: fotos[1], usuario: mecanico }).permitido
  );
  {
    const r = puedeEliminarFotografia({ ...base, fotografia: fotos[1], usuario: otroMecanico });
    informar('Otro mecanico no puede eliminarla, y el rechazo es de permiso', !r.permitido && r.deUsuario === true);
  }
  informar(
    'El propietario puede eliminar la fotografia de otro',
    puedeEliminarFotografia({ ...base, fotografia: fotos[2], usuario: propietario }).permitido
  );
  {
    const r = puedeEliminarFotografia({ ...base, fotografia: fotos[0], usuario: propietario });
    informar('Ni el propietario elimina la fotografia que leyo el asistente', !r.permitido && r.deUsuario === false);
  }
  informar(
    'No se elimina en una orden ENTREGADA',
    !puedeEliminarFotografia({ ...base, nombreEstado: 'ENTREGADO', fotografia: fotos[1], usuario: mecanico }).permitido
  );
  informar(
    'Si se elimina en una orden LISTO',
    puedeEliminarFotografia({ ...base, nombreEstado: 'LISTO', fotografia: fotos[1], usuario: mecanico }).permitido
  );
  informar(
    'No se elimina en una orden anulada',
    !puedeEliminarFotografia({ ...base, anulada: true, fotografia: fotos[1], usuario: propietario }).permitido
  );
}

// Resumen ------------------------------------------------------------------
console.log();
console.log(LINEA);
console.log(`  RESUMEN: ${correctas} de ${correctas + fallidas} verificaciones correctas`);
console.log(LINEA);

process.exit(fallidas === 0 ? 0 : 1);
