/**
 * Componentes visuales compartidos por las pantallas.
 *
 * Todos toman la paleta del proveedor de tema, de modo que responden al modo
 * claro, oscuro o del telefono sin recibir parametros de color.
 */

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, TouchableOpacity, View } from 'react-native';
import { Texto, EntradaTexto } from './Texto';
import { Ionicons } from '@expo/vector-icons';

import { ESPACIO, RADIO, useTema } from '../tema';

/**
 * Boton principal con estado de espera.
 *
 * @param {string} icono Nombre de icono de Ionicons, opcional. Un icono junto
 *        al texto acelera el reconocimiento de la accion.
 */
export function Boton({
  titulo,
  alPresionar,
  ocupado = false,
  variante = 'principal',
  deshabilitado = false,
  icono = null,
}) {
  const { colores, estilos } = useTema();
  const inactivo = ocupado || deshabilitado;

  const estilosBoton = [
    estilos.boton,
    variante === 'secundario' && estilos.botonSecundario,
    variante === 'neutro' && estilos.botonNeutro,
    inactivo && estilos.botonInactivo,
  ];

  const colorContenido = variante === 'secundario' ? colores.texto : '#FFFFFF';

  return (
    <Pressable
      style={({ pressed }) => [...estilosBoton, pressed && !inactivo && { opacity: 0.85 }]}
      onPress={alPresionar}
      disabled={inactivo}
    >
      {ocupado ? (
        <ActivityIndicator color={colorContenido} />
      ) : (
        <>
          {icono ? (
            <Ionicons name={icono} size={19} color={colorContenido} style={{ marginRight: 8 }} />
          ) : null}
          <Texto style={[estilos.botonTexto, variante === 'secundario' && estilos.botonTextoSecundario]}>
            {titulo}
          </Texto>
        </>
      )}
    </Pressable>
  );
}

/**
 * Campo de captura con etiqueta, texto de orientacion y estado de foco.
 *
 * @param {string} ayuda Indicacion breve bajo el campo. Orienta antes de que
 *        la persona se equivoque, en lugar de corregirla despues.
 */
export function Campo({
  etiqueta,
  ayuda,
  invalido = false,
  amplio = false,
  icono = null,
  secreto = false,
  ...propiedades
}) {
  const { colores, estilos } = useTema();
  const [enfocado, setEnfocado] = useState(false);

  // Una contrasena escrita a ciegas se equivoca, y el mecanico teclea con las
  // manos sucias y el telefono al sol. El revelado corre por cuenta de quien
  // escribe, que sabe si alguien lo observa.
  const [revelado, setRevelado] = useState(false);

  return (
    <View>
      {etiqueta ? <Texto style={estilos.etiqueta}>{etiqueta}</Texto> : null}

      <View style={{ justifyContent: 'center' }}>
        <EntradaTexto
          style={[
            estilos.campo,
            amplio && estilos.campoAmplio,
            icono && { paddingLeft: 42 },
            secreto && { paddingRight: 46 },
            enfocado && estilos.campoActivo,
            invalido && estilos.campoInvalido,
          ]}
          placeholderTextColor={colores.textoSuave}
          multiline={amplio}
          secureTextEntry={secreto && !revelado}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          {...propiedades}
        />

        {secreto ? (
          <Pressable
            onPress={() => setRevelado((previo) => !previo)}
            hitSlop={10}
            style={{ position: 'absolute', right: 14 }}
          >
            <Ionicons
              name={revelado ? 'eye-off-outline' : 'eye-outline'}
              size={21}
              color={colores.textoSuave}
            />
          </Pressable>
        ) : null}
        {icono ? (
          <Ionicons
            name={icono}
            size={19}
            color={enfocado ? colores.acento : colores.textoSuave}
            style={{ position: 'absolute', left: 14, top: amplio ? 18 : undefined }}
          />
        ) : null}
      </View>

      {ayuda ? <Texto style={estilos.ayuda}>{ayuda}</Texto> : null}
    </View>
  );
}

const ICONO_AVISO = {
  error: 'alert-circle',
  exito: 'checkmark-circle',
  atencion: 'information-circle',
};

/**
 * Aviso de error, de confirmacion o de atencion.
 *
 * El tipo se reconoce por el icono y por el fondo, no unicamente por el color:
 * el rojo pertenece tambien a la identidad del taller y no basta por si solo
 * para transmitir una falla.
 */
export function Aviso({ mensaje, tipo = 'error' }) {
  const { colores, estilos } = useTema();
  if (!mensaje) return null;

  const color = tipo === 'error' ? colores.alerta : tipo === 'exito' ? colores.exito : colores.aviso;
  const fondo =
    tipo === 'error' ? estilos.avisoError : tipo === 'exito' ? estilos.avisoExito : estilos.avisoAtencion;

  return (
    <View style={[estilos.aviso, fondo]}>
      <Ionicons name={ICONO_AVISO[tipo] || ICONO_AVISO.error} size={19} color={color} />
      <Texto style={{ color, fontSize: 13, flex: 1, lineHeight: 18 }}>{mensaje}</Texto>
    </View>
  );
}

/**
 * Aviso de falla con accion de reintento.
 * Se emplea dentro de las pantallas que dependen de una consulta al servidor,
 * de manera que una interrupcion de la señal no obligue a salir de la pantalla.
 */
export function AvisoConReintento({ error, alReintentar, ocupado = false }) {
  const { colores, estilos } = useTema();
  if (!error) return null;

  const recuperable = error.recuperable !== false;

  return (
    <View style={[estilos.aviso, estilos.avisoError, { flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={{ flexDirection: 'row', gap: ESPACIO.sm }}>
        <Ionicons name="alert-circle" size={19} color={colores.alerta} />
        <Texto style={{ color: colores.alerta, fontSize: 13, flex: 1, lineHeight: 18 }}>{error.message}</Texto>
      </View>

      {error.direccion ? (
        <Texto style={{ color: colores.textoSuave, fontSize: 11, marginTop: 6 }}>
          Direccion consultada: {error.direccion}
        </Texto>
      ) : null}

      {recuperable && alReintentar ? (
        <TouchableOpacity
          style={{
            marginTop: ESPACIO.md,
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderWidth: 1.5,
            borderColor: colores.alerta,
            borderRadius: RADIO.sm,
            paddingHorizontal: 14,
            paddingVertical: 9,
          }}
          onPress={alReintentar}
          disabled={ocupado}
          activeOpacity={0.7}
        >
          {ocupado ? (
            <ActivityIndicator color={colores.alerta} size="small" />
          ) : (
            <>
              <Ionicons name="refresh" size={15} color={colores.alerta} />
              <Texto style={{ color: colores.alerta, fontSize: 13, fontWeight: '700' }}>Reintentar</Texto>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Indicador de carga centrado. */
export function Cargando({ texto = 'Consultando...' }) {
  const { colores } = useTema();
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <ActivityIndicator color={colores.acento} size="large" />
      <Texto style={{ marginTop: ESPACIO.sm, color: colores.textoSuave, fontSize: 13 }}>{texto}</Texto>
    </View>
  );
}

/**
 * Estado vacio con orientacion.
 *
 * Una lista vacia sin explicacion se interpreta como una falla. El componente
 * nombra la situacion y ofrece el paso siguiente.
 */
export function EstadoVacio({ icono = 'file-tray-outline', titulo, detalle, accion = null }) {
  const { colores } = useTema();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: ESPACIO.lg, paddingVertical: ESPACIO.xl }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: RADIO.completo,
          backgroundColor: colores.superficieAlterna,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: ESPACIO.md,
        }}
      >
        <Ionicons name={icono} size={32} color={colores.textoSuave} />
      </View>
      <Texto style={{ fontSize: 16, fontWeight: '700', color: colores.texto, textAlign: 'center' }}>
        {titulo}
      </Texto>
      {detalle ? (
        <Texto
          style={{
            fontSize: 13,
            color: colores.textoSuave,
            textAlign: 'center',
            marginTop: ESPACIO.xs,
            lineHeight: 19,
          }}
        >
          {detalle}
        </Texto>
      ) : null}
      {accion ? <View style={{ marginTop: ESPACIO.sm, alignSelf: 'stretch' }}>{accion}</View> : null}
    </View>
  );
}

/** Distintivo de estado. */
export function Distintivo({ texto, color = null }) {
  const { colores, estilos } = useTema();
  return (
    <View style={[estilos.distintivo, { backgroundColor: color || colores.primarioSuave }]}>
      <Texto style={estilos.distintivoTexto}>{texto}</Texto>
    </View>
  );
}

/**
 * Tipos de caja que el taller distingue, con el orden en que se presentan.
 *
 * Reside aqui, y no dentro de una pantalla, porque lo usan tanto el formulario
 * completo de vehiculos como el alta rapida desde la orden. Una lista repetida
 * en dos lugares termina divergiendo.
 *
 * El valor vacio corresponde a un vehiculo cuyo tipo el taller todavia no
 * constato. Se ofrece de forma expresa en lugar de dejar el campo sin elegir:
 * asi el mecanico distingue entre no haberlo llenado y no saberlo, y puede
 * volver atras despues de elegir por equivocacion.
 *
 * Los valores coinciden con los que admite la columna tipo_transmision de la
 * base de datos. Cambiar uno obliga a cambiar el otro.
 */
export const OPCIONES_TRANSMISION = [
  { valor: 'MECANICA', texto: 'Mecanica', icono: 'git-commit-outline' },
  { valor: 'AUTOMATICA', texto: 'Automatica', icono: 'sync-outline' },
  { valor: '', texto: 'Sin dato', icono: 'help-circle-outline' },
];

/**
 * Selector de opciones excluyentes, presentadas juntas.
 *
 * Evita el menu desplegable cuando las opciones son pocas: la persona ve todas
 * las alternativas a la vez y elige con un solo toque, sin abrir ni cerrar.
 *
 * @param {Array<{valor:string, texto:string, icono?:string}>} opciones
 */
export function SelectorSegmentado({ opciones, valor, alCambiar }) {
  const { colores } = useTema();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colores.superficieAlterna,
        borderRadius: RADIO.md,
        padding: 4,
        gap: 4,
      }}
    >
      {opciones.map((opcion) => {
        const activo = opcion.valor === valor;
        return (
          <Pressable
            key={opcion.valor}
            onPress={() => alCambiar(opcion.valor)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: RADIO.sm,
              backgroundColor: activo ? colores.superficie : 'transparent',
              borderWidth: activo ? 1 : 0,
              borderColor: colores.borde,
            }}
          >
            {opcion.icono ? (
              <Ionicons
                name={opcion.icono}
                size={16}
                color={activo ? colores.acento : colores.textoSuave}
              />
            ) : null}
            <Texto
              style={{
                fontSize: 13,
                fontWeight: activo ? '700' : '600',
                color: activo ? colores.texto : colores.textoSuave,
              }}
            >
              {opcion.texto}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}
