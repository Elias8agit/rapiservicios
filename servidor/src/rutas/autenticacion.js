/**
 * MODULO M1 - SERVICIOS REST DE AUTENTICACION.
 *
 * La aplicacion movil entrega correo y contrasena hacia este servicio, que a
 * su vez consulta al servicio de autenticacion de Supabase. De esa forma la
 * aplicacion movil conversa unicamente con el servidor del taller, conforme a
 * la arquitectura definida en el Capitulo V del documento.
 *
 * Rutas
 *   POST /api/autenticacion/ingreso     Inicia sesion y devuelve el testigo
 *   POST /api/autenticacion/renovar     Renueva el testigo vencido
 *   GET  /api/autenticacion/perfil      Devuelve el perfil de la sesion activa
 *   POST /api/autenticacion/salida      Cierra la sesion
 *   POST /api/autenticacion/contrasena  Cambia la contrasena propia
 */

const express = require('express');
const { clientePublico, clienteServicio, verificarConfiguracion } = require('../config/supabase');
const { requiereSesion } = require('../middleware/autenticacion');
const { limitarIngreso } = require('../middleware/limitador');

const enrutador = express.Router();

/**
 * Inicia sesion con correo y contrasena.
 * El limite de intentos va delante: diez contrasenas rechazadas en quince
 * minutos, por direccion o por cuenta, imponen quince minutos de espera.
 */
enrutador.post('/ingreso', limitarIngreso, async (peticion, respuesta) => {
  const { correo, contrasena } = peticion.body || {};

  if (!correo || !contrasena) {
    return respuesta.status(400).json({ error: 'El correo y la contrasena resultan obligatorios.' });
  }

  try {
    verificarConfiguracion();

    const { data, error } = await clientePublico.auth.signInWithPassword({
      email: String(correo).trim().toLowerCase(),
      password: String(contrasena),
    });

    // Una credencial equivocada y un servicio caido son fallas distintas y
    // requieren respuestas distintas. Hasta el 10 de septiembre de 2026 ambas
    // devolvian el mismo mensaje, y una pausa del proveedor de datos llevo al
    // usuario a buscar durante un rato un problema de contrasena inexistente.
    //
    // El proveedor reporta la credencial invalida con estado 400 o 401. Toda
    // otra condicion corresponde a una indisponibilidad del servicio.
    if (error) {
      const credencialInvalida =
        error.status === 400 ||
        error.status === 401 ||
        /invalid login credentials|email not confirmed/i.test(error.message || '');

      if (credencialInvalida) {
        return respuesta.status(401).json({ error: 'El correo o la contrasena no corresponden.' });
      }

      return respuesta.status(503).json({
        error:
          'El servicio de datos del taller no responde, de modo que la cuenta no se logro verificar. ' +
          'La contrasena no esta en duda.',
        detalle: error.message,
      });
    }

    if (!data?.session) {
      return respuesta.status(401).json({ error: 'El correo o la contrasena no corresponden.' });
    }

    const { data: perfil } = await clienteServicio
      .from('usuario')
      .select('id_usuario, nombre_completo, correo, telefono, activo, rol:rol(nombre_rol)')
      .eq('auth_uid', data.user.id)
      .maybeSingle();

    if (!perfil) {
      return respuesta.status(403).json({
        error: 'La cuenta de acceso carece de perfil registrado dentro del taller.',
      });
    }
    if (!perfil.activo) {
      return respuesta.status(403).json({ error: 'El perfil se encuentra inactivo.' });
    }

    return respuesta.json({
      testigo: data.session.access_token,
      testigoRenovacion: data.session.refresh_token,
      vencimiento: data.session.expires_at,
      usuario: {
        idUsuario: perfil.id_usuario,
        nombre: perfil.nombre_completo,
        correo: perfil.correo,
        telefono: perfil.telefono,
        rol: perfil.rol?.nombre_rol || null,
      },
    });
  } catch (error) {
    return respuesta.status(error.codigoHttp || 500).json({ error: error.message });
  }
});

/** Renueva el testigo de acceso a partir del testigo de renovacion. */
enrutador.post('/renovar', async (peticion, respuesta) => {
  const { testigoRenovacion } = peticion.body || {};
  if (!testigoRenovacion) {
    return respuesta.status(400).json({ error: 'El testigo de renovacion resulta obligatorio.' });
  }

  try {
    verificarConfiguracion();
    const { data, error } = await clientePublico.auth.refreshSession({ refresh_token: testigoRenovacion });
    if (error || !data?.session) {
      return respuesta.status(401).json({ error: 'El testigo de renovacion perdio validez.' });
    }
    return respuesta.json({
      testigo: data.session.access_token,
      testigoRenovacion: data.session.refresh_token,
      vencimiento: data.session.expires_at,
    });
  } catch (error) {
    return respuesta.status(error.codigoHttp || 500).json({ error: error.message });
  }
});

/** Devuelve el perfil de la sesion activa. */
enrutador.get('/perfil', requiereSesion, (peticion, respuesta) => {
  respuesta.json({ usuario: peticion.usuario });
});

/**
 * Cambio de la contrasena propia (18 de octubre de 2026).
 *
 * Hasta esta fecha la contrasena de cada mecanico la definia y la restablecia
 * el propietario, de modo que el propietario las conocia todas. Con este
 * servicio cada persona la cambia por una que solo ella sabe.
 *
 * Exige la contrasena actual: sin ese paso, cualquiera que encontrara el
 * telefono desbloqueado con la sesion abierta podria cambiarla y quedarse con
 * la cuenta. La comprobacion pasa por el mismo limite de intentos que el
 * inicio de sesion, porque probar contrasenas aqui equivale a probarlas alla.
 *
 * Al terminar se cierran las demas sesiones de la cuenta: si alguien mas la
 * tenia abierta en otro telefono, pierde la renovacion y tendra que entrar
 * con la contrasena nueva.
 */
enrutador.post('/contrasena', requiereSesion, limitarIngreso, async (peticion, respuesta) => {
  const { actual, nueva } = peticion.body || {};

  if (!actual || !nueva) {
    return respuesta.status(400).json({ error: 'La contrasena actual y la nueva resultan obligatorias.' });
  }
  if (String(nueva).length < 8) {
    return respuesta.status(400).json({ error: 'La contrasena nueva requiere al menos ocho caracteres.' });
  }
  if (String(nueva) === String(actual)) {
    return respuesta.status(400).json({ error: 'La contrasena nueva debe ser distinta de la actual.' });
  }

  try {
    verificarConfiguracion();

    const { error: errorActual } = await clientePublico.auth.signInWithPassword({
      email: peticion.usuario.correo,
      password: String(actual),
    });
    if (errorActual) {
      const credencialInvalida =
        errorActual.status === 400 ||
        errorActual.status === 401 ||
        /invalid login credentials/i.test(errorActual.message || '');
      if (credencialInvalida) {
        return respuesta.status(401).json({ error: 'La contrasena actual no corresponde.' });
      }
      return respuesta.status(503).json({
        error: 'El servicio de datos del taller no responde. La contrasena no se cambio.',
        detalle: errorActual.message,
      });
    }

    const { data: perfil } = await clienteServicio
      .from('usuario')
      .select('auth_uid')
      .eq('id_usuario', peticion.usuario.idUsuario)
      .maybeSingle();
    if (!perfil?.auth_uid) {
      return respuesta.status(409).json({ error: 'El perfil carece de cuenta de acceso asociada.' });
    }

    const { error } = await clienteServicio.auth.admin.updateUserById(perfil.auth_uid, {
      password: String(nueva),
    });
    if (error) {
      return respuesta.status(400).json({ error: 'No se logro cambiar la contrasena.', detalle: error.message });
    }

    try {
      await clienteServicio.auth.admin.signOut(peticion.testigo, 'others');
    } catch (errorCierre) {
      // El cambio ya quedo hecho; cerrar las otras sesiones es una medida
      // adicional y su falla no lo deshace.
    }

    return respuesta.json({ mensaje: 'La contrasena quedo cambiada.' });
  } catch (error) {
    return respuesta.status(error.codigoHttp || 500).json({ error: error.message });
  }
});

/** Cierra la sesion activa. */
enrutador.post('/salida', requiereSesion, async (peticion, respuesta) => {
  try {
    await clienteServicio.auth.admin.signOut(peticion.testigo);
  } catch (error) {
    // El cierre de sesion del lado del servicio no interrumpe la operacion:
    // la aplicacion movil descarta el testigo de igual manera.
  }
  respuesta.json({ mensaje: 'La sesion quedo cerrada.' });
});

module.exports = enrutador;
