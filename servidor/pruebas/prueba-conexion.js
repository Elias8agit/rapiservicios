/**
 * PRUEBA DE CONEXION CON SUPABASE.
 *
 * Verifica que el servidor alcanza la base de datos, que los catalogos de la
 * base de conocimiento quedaron cargados, que el perfil del propietario existe
 * y que el deposito de fotografias se encuentra disponible.
 *
 * Ejecucion:  npm run prueba:conexion
 */

require('dotenv').config();

const { clienteServicio, configurado, BUCKET_FOTOGRAFIAS } = require('../src/config/supabase');
const { CATEGORIAS, TAREAS, REGLAS } = require('../src/datos/catalogo');

/**
 * Cantidad de filas que cada catalogo debe tener dentro de la base.
 *
 * Los cuatro catalogos de la base de conocimiento derivan del catalogo en
 * memoria y no de una cifra escrita a mano. El 29 de septiembre de 2026 esta
 * prueba informo tres fallas que no correspondian a ningun defecto: los
 * numeros seguian siendo los anteriores a la migracion 06, que agrego cuatro
 * tareas de caja automatica y partio la regla de transmision en tres. La
 * prueba quedaba vieja cada vez que el catalogo crecia.
 *
 * Con los valores derivados, la comprobacion pasa a significar lo que de
 * verdad importa: que la base contenga exactamente lo que el servidor tiene
 * cargado. Una migracion aplicada a medias sigue delatandose.
 *
 * El rol y el estado de la orden conservan su cifra fija porque no residen
 * dentro del catalogo en memoria.
 */
const FILAS_ESPERADAS = {
  rol: 2,
  estado_orden: 5,
  categoria_falla: CATEGORIAS.length,
  tarea_revision: TAREAS.length,
  regla_diagnostico: REGLAS.length,
  regla_tarea: REGLAS.reduce((total, regla) => total + regla.tareas.length, 0),
};

const LINEA = '='.repeat(78);
let correctas = 0;
let fallidas = 0;

function informar(descripcion, condicion, detalle = '') {
  const marca = condicion ? '  CORRECTO' : '  FALLA   ';
  console.log(`${marca}  ${descripcion}${detalle ? `\n              ${detalle}` : ''}`);
  if (condicion) correctas += 1;
  else fallidas += 1;
}

/** Cuenta las filas de una tabla y compara contra la cantidad esperada. */
async function verificarTabla(tabla, esperadas) {
  const { count, error } = await clienteServicio
    .from(tabla)
    .select('*', { count: 'exact', head: true });

  if (error) {
    informar(`Tabla ${tabla}`, false, `Error: ${error.message}`);
    return;
  }
  informar(
    `Tabla ${tabla}: ${count} registros`,
    count === esperadas,
    count === esperadas ? '' : `Se esperaban ${esperadas} registros.`
  );
}

async function principal() {
  console.log(LINEA);
  console.log('  PRUEBA DE CONEXION CON SUPABASE');
  console.log('  Sistema de ordenes de trabajo y diagnostico - Taller Rapiservicios');
  console.log(LINEA);
  console.log();

  // 1. Configuracion del entorno ------------------------------------------
  console.log('1. CONFIGURACION DEL ENTORNO');
  informar('El archivo .env aporta las tres credenciales de Supabase', configurado);

  if (!configurado) {
    console.log();
    console.log('  Completar SUPABASE_URL, SUPABASE_CLAVE_ANONIMA y SUPABASE_CLAVE_SERVICIO');
    console.log('  dentro del archivo servidor/.env antes de repetir la prueba.');
    process.exit(1);
  }

  informar(`Direccion del proyecto: ${process.env.SUPABASE_URL}`, true);
  console.log();

  // 2. Catalogos de la base de conocimiento -------------------------------
  console.log('2. CATALOGOS DE LA BASE DE CONOCIMIENTO');
  for (const [tabla, esperadas] of Object.entries(FILAS_ESPERADAS)) {
    await verificarTabla(tabla, esperadas);
  }
  console.log();

  // 3. Correspondencia entre el catalogo en memoria y la base de datos ----
  console.log('3. CORRESPONDENCIA DE IDENTIFICADORES');

  const { data: categoriasBd } = await clienteServicio
    .from('categoria_falla')
    .select('id_categoria, nombre_categoria')
    .order('id_categoria');

  const categoriasIguales =
    Array.isArray(categoriasBd) &&
    categoriasBd.length === CATEGORIAS.length &&
    categoriasBd.every((c, i) => c.id_categoria === CATEGORIAS[i].idCategoria && c.nombre_categoria === CATEGORIAS[i].nombre);

  informar(
    'Las categorias de la base coinciden con el catalogo del motor de reglas',
    categoriasIguales,
    categoriasIguales ? '' : 'El motor de reglas asignaria categorias equivocadas.'
  );

  const { data: tareasBd } = await clienteServicio
    .from('tarea_revision')
    .select('id_tarea, nombre_tarea, tiempo_estimado_min')
    .order('id_tarea');

  const tareasIguales =
    Array.isArray(tareasBd) &&
    tareasBd.length === TAREAS.length &&
    tareasBd.every((t, i) => t.id_tarea === TAREAS[i].idTarea && t.tiempo_estimado_min === TAREAS[i].minutos);

  informar(
    'Las tareas de revision coinciden con el catalogo del motor de reglas',
    tareasIguales,
    tareasIguales ? '' : 'El detalle de la orden guardaria tareas equivocadas.'
  );
  console.log();

  // 4. Perfil del propietario ---------------------------------------------
  console.log('4. PERFIL DEL PROPIETARIO');
  const { data: perfiles, error: errorPerfil } = await clienteServicio
    .from('usuario')
    .select('id_usuario, nombre_completo, correo, auth_uid, activo, rol:rol(nombre_rol)');

  if (errorPerfil) {
    informar('Consulta de la tabla usuario', false, `Error: ${errorPerfil.message}`);
  } else {
    informar(`Perfiles registrados: ${perfiles.length}`, perfiles.length >= 1);

    const propietario = perfiles.find((p) => p.rol?.nombre_rol === 'PROPIETARIO');
    informar('Existe un perfil con rol PROPIETARIO', Boolean(propietario));

    if (propietario) {
      informar(
        `Correo del propietario: ${propietario.correo}`,
        true
      );
      informar(
        'El perfil quedo enlazado con la cuenta de acceso (auth_uid)',
        Boolean(propietario.auth_uid),
        propietario.auth_uid ? '' : 'Ejecutar de nuevo basedatos/03_usuario_inicial.sql'
      );
      informar('El perfil permanece activo', propietario.activo === true);
    }
  }
  console.log();

  // 5. Vista de historial --------------------------------------------------
  console.log('5. VISTA DE HISTORIAL VEHICULAR');
  const { error: errorVista } = await clienteServicio
    .from('v_historial_vehiculo')
    .select('id_vehiculo', { count: 'exact', head: true });

  informar(
    'La vista v_historial_vehiculo responde',
    !errorVista,
    errorVista ? `Error: ${errorVista.message}` : ''
  );
  console.log();

  // 6. Deposito de fotografias ---------------------------------------------
  console.log('6. ALMACENAMIENTO DE FOTOGRAFIAS');
  const { data: depositos, error: errorDeposito } = await clienteServicio.storage.listBuckets();

  if (errorDeposito) {
    informar('Consulta de depositos', false, `Error: ${errorDeposito.message}`);
  } else {
    const deposito = depositos.find((d) => d.name === BUCKET_FOTOGRAFIAS);
    informar(
      `Existe el deposito ${BUCKET_FOTOGRAFIAS}`,
      Boolean(deposito),
      deposito ? '' : `Depositos encontrados: ${depositos.map((d) => d.name).join(', ') || 'ninguno'}`
    );
    if (deposito) {
      informar(
        'El deposito permanece privado',
        deposito.public === false,
        deposito.public ? 'El deposito quedo publico. Cambiarlo dentro del panel de Storage.' : ''
      );
    }
  }

  // Resumen ----------------------------------------------------------------
  console.log();
  console.log(LINEA);
  const total = correctas + fallidas;
  console.log(`  RESUMEN: ${correctas} de ${total} verificaciones correctas`);
  console.log(LINEA);

  process.exit(fallidas === 0 ? 0 : 1);
}

principal().catch((error) => {
  console.error();
  console.error('  La prueba se interrumpio por una falla inesperada:');
  console.error(`  ${error.message}`);
  process.exit(1);
});
