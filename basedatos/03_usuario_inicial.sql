-- ==========================================================================
--  SISTEMA CON INTELIGENCIA ARTIFICIAL PARA GENERAR ORDENES DE TRABAJO
--  Y DIAGNOSTICO EN EL TALLER MECANICO RAPISERVICIOS
--  Archivo: 03_usuario_inicial.sql   Version: 1.0
--
--  PROPOSITO
--  Registra el perfil operativo del primer usuario del sistema, con rol de
--  propietario del taller. La cuenta de acceso correspondiente se crea antes
--  desde el panel de Supabase, en la seccion Authentication, opcion Add user.
--
--  ORDEN DE EJECUCION
--  1. Ejecutar 01_esquema.sql
--  2. Ejecutar 02_datos_iniciales.sql
--  3. Crear la cuenta de acceso en Authentication > Users > Add user
--  4. Ejecutar este archivo
--
--  A partir del segundo usuario, el alta corresponde al servicio REST
--  POST /api/usuarios, que el propietario consume desde la aplicacion movil.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Perfil del propietario del taller.
-- La subconsulta recupera el identificador de la cuenta de acceso a partir
-- del correo, con lo cual no se requiere copiar el UUID de forma manual.
-- Sustituir el correo por el que se registro en el panel de Supabase.
-- --------------------------------------------------------------------------
INSERT INTO usuario (id_rol, auth_uid, nombre_completo, correo, telefono, activo)
SELECT  (SELECT id_rol FROM rol WHERE nombre_rol = 'PROPIETARIO'),
        u.id,
        'Propietario del taller Rapiservicios',
        u.email,
        '00000000',
        TRUE
FROM    auth.users u
WHERE   u.email = 'propietario@rapiservicios.gt'
ON CONFLICT (correo) DO UPDATE
    SET auth_uid = EXCLUDED.auth_uid;

-- --------------------------------------------------------------------------
-- Verificacion del resultado.
-- La consulta devuelve una fila cuando el enlace entre la cuenta de acceso y
-- el perfil operativo quedo establecido de forma correcta.
-- --------------------------------------------------------------------------
SELECT  u.id_usuario,
        u.nombre_completo,
        u.correo,
        r.nombre_rol,
        u.auth_uid
FROM    usuario u
        JOIN rol r ON r.id_rol = u.id_rol;
