/**
 * CONFIGURACION DEL ACCESO A SUPABASE.
 *
 * El servidor establece dos clientes con proposito distinto:
 *
 *  - clientePublico  Opera con la clave anonima y atiende el inicio de sesion
 *                    de los usuarios del taller. Respeta las politicas de
 *                    seguridad definidas en la base de datos.
 *
 *  - clienteServicio Opera con la clave de servicio, de uso exclusivo del
 *                    servidor. Atiende la lectura y escritura de las tablas
 *                    del sistema y el alta de cuentas de acceso. Esta clave
 *                    nunca viaja hacia la aplicacion movil.
 */

const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL || '';
const CLAVE_ANONIMA = process.env.SUPABASE_CLAVE_ANONIMA || '';
const CLAVE_SERVICIO = process.env.SUPABASE_CLAVE_SERVICIO || '';

const configurado = Boolean(URL && CLAVE_ANONIMA && CLAVE_SERVICIO);

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

const clientePublico = configurado ? createClient(URL, CLAVE_ANONIMA, opciones) : null;
const clienteServicio = configurado ? createClient(URL, CLAVE_SERVICIO, opciones) : null;

/**
 * Interrumpe la peticion cuando las credenciales de Supabase no existen.
 * El mensaje orienta hacia el archivo de configuracion del entorno.
 */
function verificarConfiguracion() {
  if (!configurado) {
    const error = new Error(
      'El acceso a Supabase carece de configuracion. Completar SUPABASE_URL, ' +
      'SUPABASE_CLAVE_ANONIMA y SUPABASE_CLAVE_SERVICIO dentro del archivo .env'
    );
    error.codigoHttp = 503;
    throw error;
  }
}

module.exports = {
  clientePublico,
  clienteServicio,
  configurado,
  verificarConfiguracion,
  BUCKET_FOTOGRAFIAS: process.env.SUPABASE_BUCKET_FOTOGRAFIAS || 'fotografias-ordenes',
};
