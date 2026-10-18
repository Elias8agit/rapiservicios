# Compilaciones y pruebas de campo

Documento operativo del sistema Rapiservicios. Leer antes de salir a probar la
aplicacion fuera de la red de la casa.

## La regla que costo un viaje al taller (21 de septiembre de 2026)

**Para cualquier prueba fuera de la red donde corre Metro hay que usar el APK
del perfil `taller`, nunca la compilacion de desarrollo.**

La aplicacion no abrio en el taller y devolvio:

    java.net.SocketTimeoutException: failed to connect to /192.168.0.11

Esa direccion corresponde a la computadora de desarrollo dentro de la red de la
casa. **La compilacion de desarrollo no lleva el codigo dentro del paquete: lo
descarga de Metro cada vez que abre.** Fuera de esa red no tiene de donde
bajarlo. El servidor de Render, Supabase y el servicio de interpretacion no
intervienen en la falla: la aplicacion nunca alcanza ese punto.

## Los tres perfiles de `movil/eas.json`

| Perfil | Para que sirve | Lleva el codigo dentro |
|---|---|---|
| `desarrollo` | Programar con recarga en caliente. Solo opera dentro de la red donde corre Metro | No |
| `taller` | Pruebas de campo y demostraciones. APK instalable | Si |
| `produccion` | Paquete para la tienda. Sin usar todavia | Si |

Comando de la compilacion de campo:

    eas build --profile taller --platform android

**Tarda entre diez y quince minutos**, de modo que no se resuelve estando en el
taller. Conviene salir de la casa con el APK ya instalado y abierto una vez.

## Las dos compilaciones no conviven

Ambas declaran `android.package` igual a `gt.edu.umg.rapiservicios`, de manera
que una reemplaza a la otra. Con el APK del taller instalado se pierde la
recarga en caliente hasta reinstalar la de desarrollo.

**Mejora pendiente:** declarar un identificador propio para la compilacion de
desarrollo, `gt.edu.umg.rapiservicios.dev`, con lo cual las dos conviven dentro
del mismo telefono. Requiere pasar de `app.json` a `app.config.js` con una
variante por perfil.

## Versiones

`movil/app.json` lleva `version` y `android.versionCode`. Ambos suben antes de
cada APK nuevo, de lo contrario la instalacion choca con la anterior. Al 21 de
septiembre de 2026: version 0.5.0 y versionCode 6.

**Regla permanente: leer `app.json` antes de escribirlo.** El 11 de septiembre
de 2026 se sobrescribio y se perdio `extra.eas.projectId`, con lo cual `eas
build` dejo de reconocer el proyecto. El valor correcto es
`75fb7f81-2c2b-44b2-aba3-704ca1e1ebe3`.

## Comprobaciones antes de ir al taller

1. **El proveedor de datos despierto.** La capa gratuita de Supabase suspende el
   proyecto tras una semana sin actividad y no se reanuda sola. Entrar al panel
   la noche anterior.

2. **El codigo desplegado.** Abrir `https://rapiservicios-api.onrender.com/api/salud`
   y confirmar `baseDatos` en `operativa` junto con las cifras de `catalogo`.
   Ese campo informa cuantas categorias, tareas y reglas tiene cargadas el
   proceso y cambia por si solo cuando el catalogo cambia, de modo que acredita
   el despliegue sin depender de que alguien suba el numero de version.

3. **APK del perfil `taller` instalado**, y abierto una vez desde datos moviles
   con la red inalambrica apagada.

4. **El servicio de interpretacion responde.** Desde el 12 de septiembre de
   2026, ante una falla de esa capa la orden no se registra. Corresponde a una
   decision tomada y no a un defecto.
