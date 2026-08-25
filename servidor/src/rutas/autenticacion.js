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
 */

const express = require('express');
const { clientePublico, clienteServicio, verificarConfiguracion } = require('../config/supabase');
const { requiereSesion } = require('../middleware/autenticacion');

const enrutador = express.Router();

/** Inicia sesion con correo y contrasena. */
enrutador.post('/ingreso', async (peticion, respuesta) => {
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

    if (error || !data?.session) {
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
