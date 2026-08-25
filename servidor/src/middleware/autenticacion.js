/**
 * MODULO M1 - AUTENTICACION Y CONTROL DE ACCESO.
 *
 * La aplicacion movil entrega en cada peticion el testigo de acceso que
 * emitio el servicio de autenticacion de Supabase. Este componente valida ese
 * testigo, recupera el perfil operativo del usuario dentro de la tabla usuario
 * y lo adjunta a la peticion para el resto de la cadena.
 *
 * El control por rol se resuelve en una segunda funcion, de manera que cada
 * servicio REST declara de forma explicita quien tiene permiso de consumirlo.
 */

const { clienteServicio, verificarConfiguracion } = require('../config/supabase');

/** Extrae el testigo del encabezado Authorization con formato Bearer. */
function extraerTestigo(peticion) {
  const encabezado = peticion.headers.authorization || '';
  if (!encabezado.startsWith('Bearer ')) return null;
  return encabezado.slice(7).trim() || null;
}

/**
 * Valida el testigo de acceso y adjunta el perfil del usuario en
 * peticion.usuario con la forma { idUsuario, nombre, correo, rol }.
 */
async function requiereSesion(peticion, respuesta, siguiente) {
  try {
    verificarConfiguracion();
  } catch (error) {
    return respuesta.status(error.codigoHttp || 500).json({ error: error.message });
  }

  const testigo = extraerTestigo(peticion);
  if (!testigo) {
    return respuesta.status(401).json({ error: 'La peticion carece del testigo de acceso.' });
  }

  const { data, error } = await clienteServicio.auth.getUser(testigo);
  if (error || !data?.user) {
    return respuesta.status(401).json({ error: 'El testigo de acceso perdio validez. Iniciar sesion de nuevo.' });
  }

  const { data: perfil, error: errorPerfil } = await clienteServicio
    .from('usuario')
    .select('id_usuario, nombre_completo, correo, telefono, activo, rol:rol(nombre_rol)')
    .eq('auth_uid', data.user.id)
    .maybeSingle();

  if (errorPerfil) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al recuperar el perfil.', detalle: errorPerfil.message });
  }
  if (!perfil) {
    return respuesta.status(403).json({ error: 'La cuenta de acceso carece de perfil registrado dentro del taller.' });
  }
  if (!perfil.activo) {
    return respuesta.status(403).json({ error: 'El perfil se encuentra inactivo.' });
  }

  peticion.usuario = {
    idUsuario: perfil.id_usuario,
    nombre: perfil.nombre_completo,
    correo: perfil.correo,
    telefono: perfil.telefono,
    rol: perfil.rol?.nombre_rol || null,
  };
  peticion.testigo = testigo;

  return siguiente();
}

/**
 * Restringe el consumo del servicio a los roles indicados.
 * Ejemplo de uso: enrutador.post('/', requiereSesion, requiereRol('PROPIETARIO'), manejador)
 */
function requiereRol(...roles) {
  return (peticion, respuesta, siguiente) => {
    if (!peticion.usuario) {
      return respuesta.status(401).json({ error: 'La peticion carece de sesion.' });
    }
    if (!roles.includes(peticion.usuario.rol)) {
      return respuesta.status(403).json({
        error: `La operacion corresponde al rol ${roles.join(' o ')}.`,
      });
    }
    return siguiente();
  };
}

module.exports = { requiereSesion, requiereRol };
