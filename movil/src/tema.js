/**
 * Definicion visual compartida por las pantallas de la aplicacion.
 * La paleta conserva contraste alto porque el personal del taller consulta el
 * telefono bajo luz directa y con las manos ocupadas.
 */

import { StyleSheet } from 'react-native';

export const COLORES = {
  primario: '#123A5F',
  primarioClaro: '#1D5586',
  acento: '#E8722C',
  fondo: '#F4F6F8',
  tarjeta: '#FFFFFF',
  texto: '#1B2733',
  textoSuave: '#5A6B7B',
  borde: '#D9E0E7',
  exito: '#1E7A46',
  alerta: '#B3261E',
  aviso: '#B26A00',
};

export const ESPACIO = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  contenido: {
    padding: ESPACIO.md,
    paddingBottom: ESPACIO.xl,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORES.primario,
    marginBottom: ESPACIO.xs,
  },
  subtitulo: {
    fontSize: 14,
    color: COLORES.textoSuave,
    marginBottom: ESPACIO.md,
  },
  tarjeta: {
    backgroundColor: COLORES.tarjeta,
    borderRadius: 12,
    padding: ESPACIO.md,
    marginBottom: ESPACIO.sm,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  tarjetaTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORES.texto,
  },
  tarjetaDetalle: {
    fontSize: 13,
    color: COLORES.textoSuave,
    marginTop: 2,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORES.texto,
    marginBottom: ESPACIO.xs,
    marginTop: ESPACIO.sm,
  },
  campo: {
    backgroundColor: COLORES.tarjeta,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 10,
    paddingHorizontal: ESPACIO.md,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORES.texto,
  },
  campoAmplio: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  boton: {
    backgroundColor: COLORES.primario,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: ESPACIO.md,
  },
  botonSecundario: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORES.primario,
  },
  botonAcento: {
    backgroundColor: COLORES.acento,
  },
  botonInactivo: {
    opacity: 0.5,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  botonTextoSecundario: {
    color: COLORES.primario,
  },
  aviso: {
    borderRadius: 10,
    padding: ESPACIO.md,
    marginTop: ESPACIO.sm,
  },
  avisoError: {
    backgroundColor: '#FDECEA',
    borderWidth: 1,
    borderColor: '#F3C4C0',
  },
  avisoExito: {
    backgroundColor: '#E7F4EC',
    borderWidth: 1,
    borderColor: '#BDE0CB',
  },
  vacio: {
    textAlign: 'center',
    color: COLORES.textoSuave,
    marginTop: ESPACIO.xl,
    fontSize: 14,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distintivo: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: COLORES.primarioClaro,
  },
  distintivoTexto: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
