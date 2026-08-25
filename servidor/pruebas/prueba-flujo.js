/**
 * PRUEBA FUNCIONAL DE EXTREMO A EXTREMO.
 *
 * Recorre el camino completo del sistema contra el servidor en ejecucion:
 * inicio de sesion, alta de cliente, alta de vehiculo, generacion de la orden
 * de trabajo con diagnostico sugerido, avance de estado y consulta publica del
 * cliente. Verifica ademas que los servicios protegidos rechazan las peticiones
 * sin testigo de acceso.
 *
 * Requisitos: el servidor debe permanecer en ejecucion (npm run iniciar).
 *
 * Ejecucion:
 *   npm run prueba:flujo -- propietario@rapiservicios.gt LaContrasena
 */

require('dotenv').config();

const BASE = `http://localhost:${process.env.PUERTO || 3000}/api`;
const LINEA = '='.repeat(78);

const correo = process.argv[2];
const contrasena = process.argv[3];

let correctas = 0;
let fallidas = 0;
let testigo = null;

function informar(descripcion, condicion, detalle = '') {
  console.log(`${condicion ? '  CORRECTO' : '  FALLA   '}  ${descripcion}`);
  if (detalle) console.log(`              ${detalle}`);
  if (condicion) correctas += 1;
  else fallidas += 1;
  return condicion;
}

/** Ejecuta una peticion contra el servidor y devuelve estado y cuerpo. */
async function llamar(ruta, opciones = {}, conTestigo = true) {
  const encabezados = { 'Content-Type': 'application/json' };
  if (conTestigo && testigo) encabezados.Authorization = `Bearer ${testigo}`;

  const respuesta = await fetch(`${BASE}${ruta}`, { ...opciones, headers: encabezados });
  const texto = await respuesta.text();
  let cuerpo = {};
  try {
    cuerpo = texto ? JSON.parse(texto) : {};
  } catch (error) {
    cuerpo = { textoCrudo: texto };
  }
  return { estado: respuesta.status, cuerpo };
}

/** Genera una placa que no colisione con los registros existentes. */
function placaDePrueba() {
  const digitos = String(Math.floor(Math.random() * 900) + 100);
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const sufijo = Array.from({ length: 3 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
  return `P${digitos}${sufijo}`;
}

async function principal() {
  console.log(LINEA);
  console.log('  PRUEBA FUNCIONAL DE EXTREMO A EXTREMO');
  console.log('  Sistema de ordenes de trabajo y diagnostico - Taller Rapiservicios');
  console.log(LINEA);
  console.log();

  if (!correo || !contrasena) {
    console.log('  Falta indicar el correo y la contrasena del propietario.');
    console.log('  Ejemplo: npm run prueba:flujo -- propietario@rapiservicios.gt MiContrasena');
    process.exit(1);
  }

  // 1. Estado del servicio -------------------------------------------------
  console.log('1. ESTADO DEL SERVICIO');
  let salud;
  try {
    salud = await llamar('/salud', {}, false);
  } catch (error) {
    console.log('  FALLA     El servidor no responde.');
    console.log(`              Encender el servidor con npm run iniciar antes de la prueba.`);
    console.log(`              Detalle: ${error.message}`);
    process.exit(1);
  }
  informar('El servidor responde en /api/salud', salud.estado === 200);
  informar(
    `Supabase: ${salud.cuerpo.supabase}`,
    salud.cuerpo.supabase === 'configurado'
  );
  console.log(`              Capa de interpretacion: ${salud.cuerpo.interpretacion}`);
  console.log();

  // 2. Control de acceso ---------------------------------------------------
  console.log('2. CONTROL DE ACCESO');
  const sinTestigo = await llamar('/clientes', {}, false);
  informar(
    'El listado de clientes rechaza la peticion sin testigo de acceso',
    sinTestigo.estado === 401,
    sinTestigo.estado === 401 ? '' : `Devolvio estado ${sinTestigo.estado} en lugar de 401.`
  );

  const claveIncorrecta = await llamar(
    '/autenticacion/ingreso',
    { method: 'POST', body: JSON.stringify({ correo, contrasena: 'contrasenaEquivocada' }) },
    false
  );
  informar(
    'El inicio de sesion rechaza una contrasena equivocada',
    claveIncorrecta.estado === 401
  );
  console.log();

  // 3. Inicio de sesion ----------------------------------------------------
  console.log('3. INICIO DE SESION');
  const ingreso = await llamar(
    '/autenticacion/ingreso',
    { method: 'POST', body: JSON.stringify({ correo, contrasena }) },
    false
  );

  if (!informar(
    'El inicio de sesion entrega el testigo de acceso',
    ingreso.estado === 200 && Boolean(ingreso.cuerpo.testigo),
    ingreso.estado === 200 ? '' : `Estado ${ingreso.estado}: ${ingreso.cuerpo.error || ''}`
  )) {
    console.log();
    console.log('  La prueba se detiene: sin sesion no procede el resto del recorrido.');
    process.exit(1);
  }

  testigo = ingreso.cuerpo.testigo;
  const usuario = ingreso.cuerpo.usuario;
  informar(`Usuario: ${usuario.nombre}`, true);
  informar(`Rol: ${usuario.rol}`, usuario.rol === 'PROPIETARIO');

  const perfil = await llamar('/autenticacion/perfil');
  informar('El perfil de la sesion responde con el testigo', perfil.estado === 200);
  console.log();

  // 4. Alta de cliente -----------------------------------------------------
  console.log('4. REGISTRO DE CLIENTE');
  const marcaTiempo = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const cliente = await llamar('/clientes', {
    method: 'POST',
    body: JSON.stringify({
      nombreCompleto: `Cliente de prueba ${marcaTiempo}`,
      telefono: '55550000',
      correo: '',
    }),
  });

  if (!informar(
    'El cliente queda registrado',
    cliente.estado === 201,
    cliente.estado === 201 ? '' : `Estado ${cliente.estado}: ${cliente.cuerpo.error || ''} ${cliente.cuerpo.detalle || ''}`
  )) {
    process.exit(1);
  }
  const idCliente = cliente.cuerpo.cliente.id_cliente;
  console.log(`              Identificador asignado: ${idCliente}`);

  const clienteInvalido = await llamar('/clientes', {
    method: 'POST',
    body: JSON.stringify({ nombreCompleto: 'AB', telefono: '1' }),
  });
  informar('El servicio rechaza un cliente con datos incompletos', clienteInvalido.estado === 400);
  console.log();

  // 5. Alta de vehiculo ----------------------------------------------------
  console.log('5. REGISTRO DE VEHICULO');
  const placa = placaDePrueba();
  const vehiculo = await llamar('/vehiculos', {
    method: 'POST',
    body: JSON.stringify({
      idCliente,
      placa,
      marca: 'Toyota',
      linea: 'Corolla',
      modeloAnio: 2015,
      color: 'Blanco',
      kilometraje: 85000,
    }),
  });

  if (!informar(
    `El vehiculo ${placa} queda registrado`,
    vehiculo.estado === 201,
    vehiculo.estado === 201 ? '' : `Estado ${vehiculo.estado}: ${vehiculo.cuerpo.error || ''} ${vehiculo.cuerpo.detalle || ''}`
  )) {
    process.exit(1);
  }
  const idVehiculo = vehiculo.cuerpo.vehiculo.id_vehiculo;

  const placaDuplicada = await llamar('/vehiculos', {
    method: 'POST',
    body: JSON.stringify({ idCliente, placa, marca: 'Nissan', linea: 'Sentra', modeloAnio: 2018 }),
  });
  informar(
    'El servicio rechaza una placa duplicada',
    placaDuplicada.estado === 400,
    placaDuplicada.estado === 400 ? '' : `Devolvio estado ${placaDuplicada.estado}.`
  );
  console.log();

  // 6. Generacion de la orden con diagnostico ------------------------------
  console.log('6. ORDEN DE TRABAJO CON DIAGNOSTICO SUGERIDO');
  const orden = await llamar('/ordenes', {
    method: 'POST',
    body: JSON.stringify({
      idVehiculo,
      descripcionFalla:
        'Al frenar se escucha un ruido metalico y el pedal se siente esponjoso cuando lo piso a fondo.',
      kilometraje: 85000,
    }),
  });

  if (!informar(
    'La orden de trabajo queda generada',
    orden.estado === 201,
    orden.estado === 201 ? '' : `Estado ${orden.estado}: ${orden.cuerpo.error || ''} ${orden.cuerpo.detalle || ''}`
  )) {
    process.exit(1);
  }

  const idOrden = orden.cuerpo.orden.id_orden;
  const codigoConsulta = orden.cuerpo.orden.codigo_consulta;
  const diagnostico = orden.cuerpo.diagnostico;

  console.log(`              Codigo de consulta: ${codigoConsulta}`);
  informar(
    `La capa de interpretacion clasifico la falla: ${diagnostico.categoria || 'sin categoria'}`,
    diagnostico.categoria === 'Frenos',
    diagnostico.categoria === 'Frenos' ? '' : 'Se esperaba la categoria Frenos.'
  );
  informar(
    `El motor de reglas sugirio ${diagnostico.tareas ? diagnostico.tareas.length : 0} tareas de revision`,
    Boolean(diagnostico.aplicada) && diagnostico.tareas.length > 0
  );
  informar(
    `Tiempo estimado: ${diagnostico.tiempoEstimadoTexto || 'sin calcular'}`,
    Number(diagnostico.tiempoEstimadoMin) > 0
  );
  if (diagnostico.tareas) {
    diagnostico.tareas.forEach((t, i) => {
      console.log(`                ${String(i + 1).padStart(2, '0')}. ${t.nombre.padEnd(46)} ${t.minutos} min`);
    });
  }
  console.log();

  // 7. Detalle de la orden -------------------------------------------------
  console.log('7. DETALLE DE LA ORDEN');
  const detalle = await llamar(`/ordenes/${idOrden}`);
  informar('El detalle de la orden responde', detalle.estado === 200);
  informar(
    `El diagnostico quedo asentado en la base de datos: ${detalle.cuerpo.diagnosticos?.length || 0} registro`,
    (detalle.cuerpo.diagnosticos?.length || 0) === 1
  );
  informar(
    `El detalle de tareas quedo asentado: ${detalle.cuerpo.tareas?.length || 0} tareas`,
    (detalle.cuerpo.tareas?.length || 0) === (diagnostico.tareas?.length || 0)
  );
  informar(
    `La bitacora registro el ingreso: ${detalle.cuerpo.bitacora?.length || 0} asiento`,
    (detalle.cuerpo.bitacora?.length || 0) >= 1
  );
  console.log();

  // 8. Avance del estado ---------------------------------------------------
  console.log('8. AVANCE DEL ESTADO Y TAREAS');
  const primeraTarea = detalle.cuerpo.tareas?.[0];
  if (primeraTarea) {
    const marca = await llamar(`/ordenes/${idOrden}/tareas/${primeraTarea.id_detalle}`, {
      method: 'PATCH',
      body: JSON.stringify({ completada: true }),
    });
    informar('Una tarea de revision queda marcada como concluida', marca.estado === 200);
  }

  const avance = await llamar(`/ordenes/${idOrden}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ nombreEstado: 'EN DIAGNOSTICO', comentario: 'Prueba funcional automatizada.' }),
  });
  informar('La orden avanza hacia EN DIAGNOSTICO', avance.estado === 200);

  const estadoInvalido = await llamar(`/ordenes/${idOrden}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ nombreEstado: 'ESTADO INVENTADO' }),
  });
  informar('El servicio rechaza un estado fuera del catalogo', estadoInvalido.estado === 400);
  console.log();

  // 9. Historial vehicular -------------------------------------------------
  console.log('9. HISTORIAL VEHICULAR');
  const historial = await llamar(`/vehiculos/${idVehiculo}/historial`);
  informar(
    `La vista de historial devuelve ${historial.cuerpo.total || 0} orden`,
    historial.estado === 200 && (historial.cuerpo.total || 0) >= 1
  );
  console.log();

  // 10. Consulta publica del cliente ---------------------------------------
  console.log('10. CONSULTA DEL CLIENTE');
  const consulta = await llamar(`/consulta/${codigoConsulta}`, {}, false);
  informar(
    'El cliente consulta el estado sin cuenta de acceso',
    consulta.estado === 200,
    consulta.estado === 200 ? '' : `Estado ${consulta.estado}: ${consulta.cuerpo.error || ''}`
  );
  if (consulta.estado === 200) {
    console.log(`              Vehiculo: ${consulta.cuerpo.vehiculo}`);
    console.log(`              Estado:   ${consulta.cuerpo.estado} (etapa ${consulta.cuerpo.etapa})`);
    console.log(`              Avance:   ${consulta.cuerpo.avance.porcentaje} % de las revisiones`);
    informar(
      'La respuesta omite los datos del personal del taller',
      consulta.cuerpo.usuario === undefined && consulta.cuerpo.mecanico === undefined
    );
  }

  const codigoInexistente = await llamar('/consulta/RSZZZZZZ', {}, false);
  informar('Un codigo inexistente devuelve no encontrado', codigoInexistente.estado === 404);

  // Resumen ----------------------------------------------------------------
  console.log();
  console.log(LINEA);
  const total = correctas + fallidas;
  const porcentaje = ((correctas / total) * 100).toFixed(1);
  console.log(`  RESUMEN: ${correctas} de ${total} verificaciones correctas (${porcentaje} %)`);
  console.log(`  Datos generados: cliente ${idCliente}, vehiculo ${placa}, orden ${codigoConsulta}`);
  console.log(LINEA);

  process.exit(fallidas === 0 ? 0 : 1);
}

principal().catch((error) => {
  console.error();
  console.error('  La prueba se interrumpio por una falla inesperada:');
  console.error(`  ${error.message}`);
  process.exit(1);
});
