/**
 * MODULO M1 - ADMINISTRACION DE USUARIOS DEL TALLER.
 *
 * El alta de personal corresponde de forma exclusiva al propietario. El
 * servicio crea primero la cuenta de acceso dentro del servicio de
 * autenticacion de Supabase y despues registra el perfil operativo dentro de
 * la tabla usuario, con la columna auth_uid como enlace entre ambos.
 *
 * Rutas
 *   GET  /api/usuarios        Listado del personal del taller
 *   POST /api/usuarios        Alta de personal
 *   PATCH /api/usuarios/:id   Activa o desactiva un perfil
 */

const express = require('express');
const { clienteServicio, verificarConfiguracion } = require('../config/supabase');
const { requiereSesion, requiereRol } = require('../middleware/autenticacion');

const enrutador = express.Router();

enrutador.use(requiereSesion);

/** Listado del personal registrado. */
enrutador.get('/', requiereRol('PROPIETARIO'), async (peticion, respuesta) => {
  const { data, error } = await clienteServicio
    .from('usuario')
    .select('id_usuario, nombre_completo, correo, telefono, activo, fecha_registro, rol:rol(id_rol, nombre_rol)')
    .order('id_usuario');

  if (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al consultar el personal.', detalle: error.message });
  }
  return respuesta.json({ total: data.length, usuarios: data });
});

/** Alta de personal del taller. */
enrutador.post('/', requiereRol('PROPIETARIO'), async (peticion, respuesta) => {
  const { nombreCompleto, correo, telefono, contrasena, rol = 'MECANICO' } = peticion.body || {};

  if (!nombreCompleto || !correo || !contrasena) {
    return respuesta.status(400).json({
      error: 'El nombre completo, el correo y la contrasena resultan obligatorios.',
    });
  }
  if (String(contrasena).length < 8) {
    return respuesta.status(400).json({ error: 'La contrasena requiere al menos ocho caracteres.' });
  }

  const correoNormalizado = String(correo).trim().toLowerCase();

  try {
    verificarConfiguracion();

    const { data: filaRol, error: errorRol } = await clienteServicio
      .from('rol')
      .select('id_rol')
      .eq('nombre_rol', rol)
      .maybeSingle();

    if (errorRol || !filaRol) {
      return respuesta.status(400).json({ error: `El rol ${rol} no existe dentro del catalogo.` });
    }

    // Paso uno: cuenta de acceso dentro del servicio de autenticacion.
    const { data: cuenta, error: errorCuenta } = await clienteServicio.auth.admin.createUser({
      email: correoNormalizado,
      password: String(contrasena),
      email_confirm: true,
    });

    if (errorCuenta) {
      return respuesta.status(400).json({ error: 'No se logro crear la cuenta de acceso.', detalle: errorCuenta.message });
    }

    // Paso dos: perfil operativo dentro de la base de datos del taller.
    const { data: perfil, error: errorPerfil } = await clienteServicio
      .from('usuario')
      .insert({
        id_rol: filaRol.id_rol,
        auth_uid: cuenta.user.id,
        nombre_completo: String(nombreCompleto).trim(),
        correo: correoNormalizado,
        telefono: telefono ? String(telefono).trim() : null,
      })
      .select('id_usuario, nombre_completo, correo, telefono, activo')
      .single();

    if (errorPerfil) {
      // La cuenta de acceso se elimina para evitar registros huerfanos.
      await clienteServicio.auth.admin.deleteUser(cuenta.user.id);
      return respuesta.status(400).json({ error: 'No se logro registrar el perfil.', detalle: errorPerfil.message });
    }

    return respuesta.status(201).json({ usuario: { ...perfil, rol } });
  } catch (error) {
    return respuesta.status(error.codigoHttp || 500).json({ error: error.message });
  }
});

/** Activa o desactiva un perfil operativo. */
enrutador.patch('/:id', requiereRol('PROPIETARIO'), async (peticion, respuesta) => {
  const { activo } = peticion.body || {};
  if (typeof activo !== 'boolean') {
    return respuesta.status(400).json({ error: 'El campo activo requiere un valor logico.' });
  }

  const { data, error } = await clienteServicio
    .from('usuario')
    .update({ activo })
    .eq('id_usuario', Number(peticion.params.id))
    .select('id_usuario, nombre_completo, activo')
    .maybeSingle();

  if (error) {
    return respuesta.status(500).json({ error: 'Ocurrio una falla al actualizar el perfil.', detalle: error.message });
  }
  if (!data) {
    return respuesta.status(404).json({ error: 'El perfil solicitado no existe.' });
  }
  return respuesta.json({ usuario: data });
});

module.exports = enrutador;
