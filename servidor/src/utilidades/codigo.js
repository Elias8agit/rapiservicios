/**
 * Generacion del codigo de consulta de la orden de trabajo.
 *
 * El cliente del taller consulta el estado de la reparacion mediante este
 * codigo, sin necesidad de cuenta de acceso. El alfabeto excluye los
 * caracteres que se confunden entre si al dictarlos por telefono, con lo cual
 * se reduce el error de captura: cero, letra o, uno, letra i y letra l.
 */

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LONGITUD = 8;

/** Devuelve un codigo con la forma RS-XXXXXX. */
function generarCodigoConsulta() {
  let cuerpo = '';
  for (let i = 0; i < LONGITUD - 2; i += 1) {
    cuerpo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return `RS${cuerpo}`;
}

module.exports = { generarCodigoConsulta, ALFABETO, LONGITUD };
