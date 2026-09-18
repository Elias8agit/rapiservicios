/**
 * MODULO M1 - CUENTA Y ADMINISTRACION DEL PERSONAL.
 *
 * Presenta el perfil de la sesion activa. Cuando el rol corresponde al
 * propietario del taller, la pantalla habilita el alta del personal operativo.
 */

import React, { useCallback, useState } from 'react';
import { Dimensions, PixelRatio, Platform, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { Texto } from '../componentes/Texto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../api/cliente';
import { Aviso, AvisoConReintento, Boton, Campo, Distintivo, SelectorSegmentado } from '../componentes/Comunes';
import { useSesion } from '../contexto/Sesion';
import { ESPACIO, RADIO, useTema } from '../tema';

/**
 * Panel de informacion del dispositivo.
 *
 * La aplicacion no dispone el alto de la barra de estado ni el de los botones
 * de navegacion con un valor fijo: los consulta al sistema, porque cambian
 * entre un telefono con muesca, uno sin ella y una tableta. Ese panel muestra
 * los valores que el sistema reporta, de manera que una discrepancia entre la
 * franja que se ve y la que se reserva se comprueba con numeros en el equipo
 * donde ocurre, en lugar de deducirse de una captura.
 *
 * Tambien resulta util al soporte: el propietario lee estos datos por telefono
 * sin necesidad de conectar el equipo a una computadora.
 */
function InformacionDispositivo() {
  const { colores, estilos } = useTema();
  const margenes = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  const ventana = Dimensions.get('window');
  const pantalla = Dimensions.get('screen');

  // El contexto de margen seguro y la barra de estado del sistema deberian
  // informar el mismo alto superior en Android. Una diferencia notable entre
  // ambos delata que el margen se esta consumiendo o duplicando en el camino.
  const altoBarraSistema = Platform.OS === 'android' ? StatusBar.currentHeight : null;

  const renglones = [
    ['Sistema', `${Platform.OS} ${Platform.Version}`],
    ['Version de la app', Constants.expoConfig?.version || 'sin dato'],
    ['Ventana', `${Math.round(ventana.width)} x ${Math.round(ventana.height)} pt`],
    ['Pantalla', `${Math.round(pantalla.width)} x ${Math.round(pantalla.height)} pt`],
    ['Densidad', `${PixelRatio.get()}x`],
    ['Margen superior', `${Math.round(margenes.top)} pt`],
    ['Barra de estado', altoBarraSistema != null ? `${Math.round(altoBarraSistema)} pt` : 'no aplica'],
    ['Margen inferior', `${Math.round(margenes.bottom)} pt`],
    ['Margenes laterales', `${Math.round(margenes.left)} / ${Math.round(margenes.right)} pt`],
  ];

  return (
    <View style={estilos.tarjeta}>
      <Pressable
        onPress={() => setVisible((previo) => !previo)}
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm }}
      >
        <Ionicons name="phone-portrait-outline" size={20} color={colores.textoSuave} />
        <Texto style={[estilos.tarjetaTitulo, { flex: 1, marginBottom: 0 }]}>
          Informacion del dispositivo
        </Texto>
        <Ionicons
          name={visible ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colores.textoSuave}
        />
      </Pressable>

      {visible ? (
        <View style={{ marginTop: ESPACIO.md }}>
          {renglones.map(([etiqueta, valor]) => (
            <View
              key={etiqueta}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 5,
                borderTopWidth: 1,
                borderTopColor: colores.borde,
              }}
            >
              <Texto style={{ color: colores.textoSuave, fontSize: 12, flex: 1 }}>{etiqueta}</Texto>
              <Texto style={{ color: colores.texto, fontSize: 12, fontWeight: '700' }}>{valor}</Texto>
            </View>
          ))}
          <Texto
            style={{
              color: colores.textoSuave,
              fontSize: 11,
              marginTop: ESPACIO.sm,
              lineHeight: 16,
            }}
          >
            El margen superior corresponde a la franja que la aplicacion reserva para la barra de
            estado. Debe coincidir con el alto que informa el sistema.
          </Texto>
        </View>
      ) : null}
    </View>
  );
}

export default function Cuenta() {
  const { colores, estilos, modo, cambiarModo } = useTema();
  const { usuario, esPropietario, salir } = useSesion();

  const [personal, setPersonal] = useState([]);
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState('');
  const [reintentando, setReintentando] = useState(false);
  const [restableciendo, setRestableciendo] = useState(null);
  const [contrasenaNueva, setContrasenaNueva] = useState('');

  const consultarPersonal = useCallback(async () => {
    if (!esPropietario) return;
    setError(null);
    try {
      const datos = await api.listarUsuarios();
      setPersonal(datos.usuarios);
    } catch (falla) {
      setError(falla);
    } finally {
      setReintentando(false);
    }
  }, [esPropietario]);

  async function reintentar() {
    setReintentando(true);
    await consultarPersonal();
  }

  useFocusEffect(
    useCallback(() => {
      consultarPersonal();
    }, [consultarPersonal])
  );

  async function registrarMecanico() {
    setError(null);
    setExito('');
    setOcupado(true);
    try {
      await api.crearUsuario({ nombreCompleto, correo, telefono, contrasena, rol: 'MECANICO' });
      setExito(`El mecanico ${nombreCompleto} quedo registrado.`);
      setNombreCompleto('');
      setCorreo('');
      setTelefono('');
      setContrasena('');
      setFormularioVisible(false);
      consultarPersonal();
    } catch (falla) {
      setError(falla);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Restablecimiento de la contrasena de un mecanico.
   *
   * El taller opera con cuentas propias del negocio, no con correos
   * personales, de modo que la recuperacion la resuelve el propietario y no un
   * mensaje de correo. Se la comunica de viva voz y el mecanico la cambia
   * despues si lo desea.
   */
  async function restablecer(persona) {
    setError(null);
    setExito('');
    setOcupado(true);
    try {
      const respuesta = await api.restablecerContrasena(persona.id_usuario, contrasenaNueva);
      setExito(respuesta.mensaje);
      setRestableciendo(null);
      setContrasenaNueva('');
    } catch (falla) {
      setError(falla);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <View style={estilos.tarjeta}>
        <View style={{ alignItems: 'center', paddingVertical: ESPACIO.md }}>
          <Ionicons name="person-circle-outline" size={64} color={colores.primario} />
          <Texto style={[estilos.tarjetaTitulo, { marginTop: ESPACIO.sm }]}>{usuario?.nombre}</Texto>
          <Texto style={estilos.tarjetaDetalle}>{usuario?.correo}</Texto>
          <View style={{ marginTop: ESPACIO.sm }}>
            <Distintivo texto={usuario?.rol} color={colores.acento} />
          </View>
        </View>
      </View>

      {esPropietario ? (
        <View style={estilos.tarjeta}>
          <Texto style={estilos.tarjetaTitulo}>Personal del taller</Texto>
          {personal.map((p) => (
            <View
              key={p.id_usuario}
              style={{
                marginTop: ESPACIO.sm,
                paddingTop: ESPACIO.sm,
                borderTopWidth: 1,
                borderTopColor: colores.borde,
              }}
            >
              <View style={estilos.fila}>
                <Texto style={{ color: colores.texto, fontSize: 14, fontWeight: '600', flex: 1 }}>
                  {p.nombre_completo}
                </Texto>
                <Distintivo
                  texto={p.rol?.nombre_rol}
                  color={p.rol?.nombre_rol === 'PROPIETARIO' ? colores.primarioSuave : colores.plata}
                />
              </View>
              <Texto style={estilos.tarjetaDetalle}>
                {p.correo}
                {p.activo ? '' : ' · inactivo'}
              </Texto>

              {restableciendo === p.id_usuario ? (
                <View style={{ marginTop: ESPACIO.sm }}>
                  <Campo
                    etiqueta={`Contrasena nueva para ${p.nombre_completo.split(' ')[0]}`}
                    value={contrasenaNueva}
                    onChangeText={setContrasenaNueva}
                    placeholder="Minimo ocho caracteres"
                    secreto
                    icono="key-outline"
                    ayuda="Al guardar, comunicarsela al mecanico. El podra cambiarla despues."
                  />
                  <Boton
                    titulo="Guardar contrasena"
                    icono="checkmark"
                    alPresionar={() => restablecer(p)}
                    ocupado={ocupado}
                    deshabilitado={contrasenaNueva.length < 8}
                  />
                  <Boton
                    titulo="Cancelar"
                    variante="secundario"
                    alPresionar={() => {
                      setRestableciendo(null);
                      setContrasenaNueva('');
                    }}
                  />
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setRestableciendo(p.id_usuario);
                    setContrasenaNueva('');
                  }}
                  hitSlop={6}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}
                >
                  <Ionicons name="key-outline" size={15} color={colores.enlace} />
                  <Texto style={{ color: colores.enlace, fontSize: 13, fontWeight: '600' }}>
                    Restablecer contrasena
                  </Texto>
                </Pressable>
              )}
            </View>
          ))}

          {formularioVisible ? (
            <View style={{ marginTop: ESPACIO.md }}>
              <Campo etiqueta="Nombre completo" value={nombreCompleto} onChangeText={setNombreCompleto} />
              <Campo
                etiqueta="Correo"
                value={correo}
                onChangeText={setCorreo}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Campo etiqueta="Telefono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
              <Campo
                etiqueta="Contrasena"
                value={contrasena}
                onChangeText={setContrasena}
                placeholder="Minimo ocho caracteres"
                secreto
                icono="key-outline"
              />
              <Boton titulo="Registrar mecanico" alPresionar={registrarMecanico} ocupado={ocupado} />
              <Boton titulo="Cancelar" variante="secundario" alPresionar={() => setFormularioVisible(false)} />
            </View>
          ) : (
            <Boton titulo="Agregar mecanico" variante="secundario" alPresionar={() => setFormularioVisible(true)} />
          )}
        </View>
      ) : null}

      {/* Apariencia. El taller trabaja al patio y a la oficina, con luz muy
          distinta en cada sitio, de modo que la eleccion corresponde a quien
          usa el telefono y no a una preferencia fijada de antemano. */}
      <View style={estilos.tarjeta}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.sm }}>
          <Ionicons name="color-palette-outline" size={20} color={colores.acento} />
          <Texto style={estilos.tarjetaTitulo}>Apariencia</Texto>
        </View>
        <Texto style={[estilos.tarjetaDetalle, { marginBottom: ESPACIO.md }]}>
          El modo claro se lee mejor bajo el sol del patio. El oscuro cansa menos la vista de
          noche y dentro de la oficina.
        </Texto>
        <SelectorSegmentado
          valor={modo}
          alCambiar={cambiarModo}
          opciones={[
            { valor: 'claro', texto: 'Claro', icono: 'sunny-outline' },
            { valor: 'oscuro', texto: 'Oscuro', icono: 'moon-outline' },
            { valor: 'sistema', texto: 'Telefono', icono: 'phone-portrait-outline' },
          ]}
        />
      </View>

      <InformacionDispositivo />

      <AvisoConReintento error={error} alReintentar={reintentar} ocupado={reintentando} />
      <Aviso mensaje={exito} tipo="exito" />

      <Boton titulo="Cerrar sesion" alPresionar={salir} variante="secundario" icono="log-out-outline" />
    </ScrollView>
  );
}
