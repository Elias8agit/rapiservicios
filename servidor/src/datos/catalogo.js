/**
 * Catalogo en memoria de la base de conocimiento del taller.
 * Refleja el contenido de basedatos/02_datos_iniciales.sql y permite la
 * ejecucion del motor de reglas sin conexion a la base de datos durante
 * las pruebas de la fase inicial de desarrollo.
 */

const CATEGORIAS = [
  { idCategoria: 1,  nombre: 'Frenos',             sistema: 'Sistema de frenos' },
  { idCategoria: 2,  nombre: 'Suspension',         sistema: 'Suspension y direccion' },
  { idCategoria: 3,  nombre: 'Direccion',          sistema: 'Suspension y direccion' },
  { idCategoria: 4,  nombre: 'Motor',              sistema: 'Motor y encendido' },
  { idCategoria: 5,  nombre: 'Encendido',          sistema: 'Motor y encendido' },
  { idCategoria: 6,  nombre: 'Sistema electrico',  sistema: 'Electrico' },
  { idCategoria: 7,  nombre: 'Transmision',        sistema: 'Transmision' },
  { idCategoria: 8,  nombre: 'Enfriamiento',       sistema: 'Enfriamiento' },
  { idCategoria: 9,  nombre: 'Combustible',        sistema: 'Alimentacion' },
  { idCategoria: 10, nombre: 'Escape',             sistema: 'Escape' },
  { idCategoria: 11, nombre: 'Neumaticos',         sistema: 'Rodamiento' },
  { idCategoria: 12, nombre: 'Aire acondicionado', sistema: 'Confort' },
];

const TAREAS = [
  { idTarea: 1,  nombre: 'Inspeccion visual de pastillas y discos', minutos: 20 },
  { idTarea: 2,  nombre: 'Prueba de recorrido de pedal',            minutos: 15 },
  { idTarea: 3,  nombre: 'Revision de fugas en el circuito',        minutos: 25 },
  { idTarea: 4,  nombre: 'Purga del sistema hidraulico',            minutos: 40 },
  { idTarea: 5,  nombre: 'Prueba de amortiguadores',                minutos: 30 },
  { idTarea: 6,  nombre: 'Revision de rotulas y terminales',        minutos: 25 },
  { idTarea: 7,  nombre: 'Verificacion de alineacion',              minutos: 35 },
  { idTarea: 8,  nombre: 'Lectura de codigos de falla',             minutos: 15 },
  { idTarea: 9,  nombre: 'Prueba de compresion del motor',          minutos: 60 },
  { idTarea: 10, nombre: 'Inspeccion de bujias y cables',           minutos: 30 },
  { idTarea: 11, nombre: 'Prueba de carga de bateria',              minutos: 15 },
  { idTarea: 12, nombre: 'Prueba de salida del alternador',         minutos: 20 },
  { idTarea: 13, nombre: 'Revision de nivel y estado de aceite',    minutos: 10 },
  { idTarea: 14, nombre: 'Inspeccion del sistema de enfriamiento',  minutos: 30 },
  { idTarea: 15, nombre: 'Prueba de presion del sistema',           minutos: 25 },
  { idTarea: 16, nombre: 'Revision de embrague',                    minutos: 35 },
  { idTarea: 17, nombre: 'Prueba de cambios en carretera',          minutos: 30 },
  { idTarea: 18, nombre: 'Inspeccion de inyectores',                minutos: 45 },
  { idTarea: 19, nombre: 'Revision de filtro de combustible',       minutos: 20 },
  { idTarea: 20, nombre: 'Inspeccion del sistema de escape',        minutos: 25 },
  { idTarea: 21, nombre: 'Verificacion de presion de neumaticos',   minutos: 10 },
  { idTarea: 22, nombre: 'Balanceo de ruedas',                      minutos: 40 },
  { idTarea: 23, nombre: 'Carga de refrigerante',                   minutos: 45 },
  { idTarea: 24, nombre: 'Prueba de compresor de aire',             minutos: 30 },
];

/**
 * Base de conocimiento lexica del taller.
 *
 * La comparacion opera por contencion de texto sobre la descripcion
 * normalizada, de modo que conviene la raiz antes que la forma conjugada:
 * "sobrecalent" abarca sobrecalentamiento, sobrecalentado y sobrecalentar.
 *
 * Las expresiones no se repiten entre categorias. El clasificador de respaldo
 * suma coincidencias, y una palabra compartida reparte el puntaje.
 *
 * Ampliada el 2026-09-10 tras la orden RSKFQB65: "Reparacion de caja mecanica"
 * no coincidia con ninguna regla, porque transmision solo cubria "embrague".
 */
const REGLAS = [
  { idRegla: 1,  idCategoria: 1,  nombre: 'Ruido metalico al frenar',
    condicion: { palabras: ['chilla', 'rechina', 'ruido al frenar', 'metalico', 'pastilla', 'disco de freno', 'balata'], kmMinimo: 0 },
    nivelConfianza: 0.900, prioridad: 1, activa: true, tareas: [1, 2, 3] },
  { idRegla: 2,  idCategoria: 1,  nombre: 'Pedal esponjoso o hundido',
    condicion: { palabras: ['pedal', 'esponjoso', 'se hunde', 'sin presion', 'no frena', 'liquido de freno'], kmMinimo: 0 },
    nivelConfianza: 0.880, prioridad: 1, activa: true, tareas: [2, 3, 4] },
  { idRegla: 3,  idCategoria: 2,  nombre: 'Golpeteo en superficie irregular',
    condicion: { palabras: ['golpetea', 'brinca', 'tumbo', 'suspension', 'amortiguador', 'resorte', 'salta en los baches'], kmMinimo: 0 },
    nivelConfianza: 0.850, prioridad: 2, activa: true, tareas: [5, 6, 7] },
  { idRegla: 4,  idCategoria: 3,  nombre: 'Vehiculo desviado de trayectoria',
    condicion: { palabras: ['jala', 'se va', 'desvia', 'direccion dura', 'timon', 'volante', 'alineacion', 'rotula', 'terminal'], kmMinimo: 0 },
    nivelConfianza: 0.870, prioridad: 2, activa: true, tareas: [6, 7, 22] },
  { idRegla: 5,  idCategoria: 4,  nombre: 'Perdida de potencia del motor',
    condicion: { palabras: ['no jala', 'sin fuerza', 'pierde potencia', 'cascabeleo', 'tironea', 'jalonea', 'se apaga', 'falla el motor', 'aceite'], kmMinimo: 0 },
    nivelConfianza: 0.840, prioridad: 1, activa: true, tareas: [8, 9, 13] },
  { idRegla: 6,  idCategoria: 5,  nombre: 'Arranque deficiente',
    condicion: { palabras: ['no enciende', 'no arranca', 'cuesta arrancar', 'falla al arrancar', 'marcha', 'bujia', 'no da chispa'], kmMinimo: 0 },
    nivelConfianza: 0.860, prioridad: 1, activa: true, tareas: [8, 10, 11] },
  { idRegla: 7,  idCategoria: 6,  nombre: 'Falla de carga electrica',
    condicion: { palabras: ['bateria', 'se descarga', 'luz de bateria', 'no da corriente', 'alternador', 'fusible', 'sistema electrico', 'las luces'], kmMinimo: 0 },
    nivelConfianza: 0.890, prioridad: 1, activa: true, tareas: [11, 12, 8] },
  { idRegla: 8,  idCategoria: 7,  nombre: 'Falla de la transmision',
    condicion: { palabras: ['embrague', 'patina', 'no entra cambio', 'clutch', 'caja mecanica', 'caja de cambios', 'caja de velocidades', 'transmision', 'velocidades', 'sincronizado', 'palanca de cambios'], kmMinimo: 0 },
    nivelConfianza: 0.850, prioridad: 2, activa: true, tareas: [16, 17] },
  { idRegla: 9,  idCategoria: 8,  nombre: 'Sobrecalentamiento del motor',
    condicion: { palabras: ['calienta', 'calentamiento', 'sobrecalent', 'temperatura', 'hierve', 'vapor', 'radiador', 'refrigerante', 'ventilador'], kmMinimo: 0 },
    nivelConfianza: 0.910, prioridad: 1, activa: true, tareas: [14, 15, 13] },
  { idRegla: 10, idCategoria: 9,  nombre: 'Consumo excesivo de combustible',
    condicion: { palabras: ['gasta mucho', 'consumo', 'gasolina', 'rinde poco', 'inyector', 'combustible', 'bomba de gasolina'], kmMinimo: 0 },
    nivelConfianza: 0.800, prioridad: 3, activa: true, tareas: [18, 19, 8] },
  { idRegla: 11, idCategoria: 10, nombre: 'Ruido o fuga en el escape',
    condicion: { palabras: ['escape', 'ruidoso', 'truena', 'humo negro', 'mofle', 'silenciador', 'catalizador'], kmMinimo: 0 },
    nivelConfianza: 0.820, prioridad: 3, activa: true, tareas: [20, 8] },
  { idRegla: 12, idCategoria: 11, nombre: 'Desgaste irregular de neumaticos',
    condicion: { palabras: ['llanta', 'neumatico', 'desgaste', 'vibra', 'desbalance', 'balanceo', 'rin', 'presion de aire'], kmMinimo: 0 },
    nivelConfianza: 0.830, prioridad: 2, activa: true, tareas: [21, 22, 7] },
  { idRegla: 13, idCategoria: 12, nombre: 'Aire acondicionado sin enfriamiento',
    condicion: { palabras: ['aire acondicionado', 'no enfria', 'clima', 'compresor', 'gas del aire'], kmMinimo: 0 },
    nivelConfianza: 0.870, prioridad: 3, activa: true, tareas: [23, 24] },
];

module.exports = { CATEGORIAS, TAREAS, REGLAS };
