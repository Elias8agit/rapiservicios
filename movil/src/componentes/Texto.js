/**
 * TIPOGRAFIA DE LA APLICACION.
 *
 * React Native no hereda la familia tipografica entre componentes: todo
 * elemento de texto que no declara fontFamily toma la fuente que el dueño del
 * telefono tenga configurada en el sistema. En el equipo de prueba esa fuente
 * es de trazo manuscrito, mas alta y mas ancha que una de interfaz, y el efecto
 * no se limita a la apariencia: los renglones ocupan mas alto del previsto y
 * cualquier control con alto acotado recorta su contenido. Una aplicacion de
 * taller no puede quedar sujeta a esa eleccion.
 *
 * Tampoco existe un punto unico donde fijar la familia. En React Native 0.81 el
 * componente Text es una funcion simple: no expone un render que interceptar y
 * defaultProps quedo fuera de React 19. De ahi que la familia se aplique
 * mediante estos dos componentes, que las pantallas utilizan en lugar de Text y
 * de TextInput.
 *
 * PESO TIPOGRAFICO EN ANDROID. El sistema no deriva la negrita de una familia
 * que carga la propia aplicacion: cada peso reside en un archivo distinto y hay
 * que nombrarlo. Declarar fontWeight sobre una familia cargada produce, segun
 * el equipo, o ningun efecto o una negrita sintetica de trazo sucio. Por eso el
 * componente traduce el fontWeight que recibe al archivo correspondiente y
 * retira la propiedad del estilo. Las pantallas siguen declarando pesos como
 * siempre y la correspondencia con el archivo se resuelve en un solo lugar.
 *
 * La familia es Inter, de la coleccion de Google Fonts. Se eligio por ser una
 * tipografia de interfaz de asta alta y contraformas amplias, legible en
 * tamaños pequeños y bajo la luz del patio, que es donde el mecanico consulta
 * el telefono.
 */

import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * Correspondencia entre el peso declarado y el archivo de la familia.
 *
 * Los pesos intermedios que la aplicacion no carga se resuelven hacia el
 * inmediato disponible, de manera que un fontWeight no previsto degrada hacia
 * una variante real en lugar de caer en la fuente del sistema.
 */
const ARCHIVO_POR_PESO = {
  100: 'Inter_400Regular',
  200: 'Inter_400Regular',
  300: 'Inter_400Regular',
  400: 'Inter_400Regular',
  normal: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  bold: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
  900: 'Inter_800ExtraBold',
};

/** Familia predeterminada, para los componentes nativos que no pasan por aqui. */
export const FUENTE_REGULAR = 'Inter_400Regular';
export const FUENTE_MEDIA = 'Inter_500Medium';
export const FUENTE_SEMI = 'Inter_600SemiBold';
export const FUENTE_FUERTE = 'Inter_700Bold';

/**
 * Resuelve el estilo final: sustituye el peso por la familia que le
 * corresponde. Un fontFamily declarado de forma explicita por la pantalla se
 * respeta y tiene precedencia.
 */
export function resolverTipografia(estilo) {
  const plano = StyleSheet.flatten(estilo) || {};
  const { fontWeight, ...resto } = plano;
  if (plano.fontFamily) return plano;
  const clave = fontWeight == null ? 400 : fontWeight;
  return { ...resto, fontFamily: ARCHIVO_POR_PESO[clave] || FUENTE_REGULAR };
}

/** Texto de la aplicacion. Sustituye a Text de react-native. */
export function Texto({ style, ...resto }) {
  return <Text {...resto} style={resolverTipografia(style)} />;
}

/**
 * Campo de captura. Sustituye a TextInput de react-native.
 *
 * EL TEXTO GUIA SE DIBUJA APARTE. Comprobado en el equipo de prueba: lo que el
 * usuario escribe toma la familia de la aplicacion, y el texto guia conserva la
 * del sistema. La causa reside en como React Native entrega cada uno al campo
 * nativo de Android. El texto escrito viaja con sus atributos de formato, entre
 * ellos la familia; el texto guia se entrega como una cadena simple mediante
 * setHint y queda dibujado con la tipografia base de la vista, que la
 * aplicacion nunca cambia. React Native no expone propiedad alguna para
 * alterarla.
 *
 * De ahi que el campo reciba el texto guia vacio y este componente lo dibuje
 * por encima con Texto, que si aplica la familia. Se muestra unicamente
 * mientras el campo carece de contenido y no intercepta el toque, de modo que
 * pulsar sobre el sigue abriendo el teclado.
 *
 * La posicion se deriva del relleno que declara el propio estilo del campo, en
 * lugar de fijarse, porque el relleno cambia entre un campo con icono, uno con
 * ojo de revelado y uno de varias lineas.
 */
export const EntradaTexto = React.forwardRef(function EntradaTexto(
  { style, placeholder, placeholderTextColor, value, multiline = false, ...resto },
  referencia
) {
  const estilo = resolverTipografia(style);

  const izquierda = estilo.paddingLeft ?? estilo.paddingHorizontal ?? estilo.padding ?? 0;
  const derecha = estilo.paddingRight ?? estilo.paddingHorizontal ?? estilo.padding ?? 0;
  const arriba = estilo.paddingTop ?? estilo.paddingVertical ?? estilo.padding ?? 0;

  const guiaVisible = !value && placeholder != null && placeholder !== '';

  return (
    <View style={{ justifyContent: 'center' }}>
      <TextInput ref={referencia} value={value} multiline={multiline} {...resto} style={estilo} />

      {guiaVisible ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: izquierda,
            right: derecha,
            // En un campo de una linea la guia se centra sola: una vista
            // absoluta sin top ni bottom se acomoda segun el justifyContent
            // del contenedor. En uno de varias lineas el texto arranca arriba,
            // igual que el contenido.
            top: multiline ? arriba : undefined,
          }}
        >
          <Texto
            numberOfLines={1}
            style={{ color: placeholderTextColor || '#8A949E', fontSize: estilo.fontSize }}
          >
            {placeholder}
          </Texto>
        </View>
      ) : null}
    </View>
  );
});
