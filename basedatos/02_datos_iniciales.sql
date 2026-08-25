-- ==========================================================================
--  DATOS INICIALES DE LA BASE DE CONOCIMIENTO
--  Taller mecanico Rapiservicios - Villa Nueva, Guatemala
--  Archivo: 02_datos_iniciales.sql   Version: 1.0 preliminar
-- ==========================================================================

-- 1. ROLES ------------------------------------------------------------------
INSERT INTO rol (nombre_rol, descripcion) VALUES
 ('PROPIETARIO', 'Administra el taller, el catalogo de reglas y los usuarios'),
 ('MECANICO',    'Registra ingresos, describe fallas y ejecuta tareas de revision');

-- 2. ESTADOS DE LA ORDEN ----------------------------------------------------
INSERT INTO estado_orden (nombre_estado, orden_secuencia) VALUES
 ('RECIBIDO',       1),
 ('EN DIAGNOSTICO', 2),
 ('EN REPARACION',  3),
 ('LISTO',          4),
 ('ENTREGADO',      5);

-- 3. CATEGORIAS DE FALLA ----------------------------------------------------
INSERT INTO categoria_falla (nombre_categoria, sistema_vehicular, descripcion) VALUES
 ('Frenos',            'Sistema de frenos',      'Desgaste de pastillas, discos, fugas de liquido y perdida de presion'),
 ('Suspension',        'Suspension y direccion', 'Amortiguadores, rotulas, terminales y bujes'),
 ('Direccion',         'Suspension y direccion', 'Cremallera, bomba hidraulica y desalineacion'),
 ('Motor',             'Motor y encendido',      'Perdida de potencia, ruidos internos, humo y consumo de aceite'),
 ('Encendido',         'Motor y encendido',      'Bujias, bobinas, cables y arranque deficiente'),
 ('Sistema electrico', 'Electrico',              'Bateria, alternador, luces, fusibles y cableado'),
 ('Transmision',       'Transmision',            'Embrague, caja de cambios y transmision automatica'),
 ('Enfriamiento',      'Enfriamiento',           'Radiador, termostato, bomba de agua y sobrecalentamiento'),
 ('Combustible',       'Alimentacion',           'Bomba, inyectores, filtro y consumo excesivo'),
 ('Escape',            'Escape',                 'Silenciador, catalizador y emisiones'),
 ('Neumaticos',        'Rodamiento',             'Desgaste irregular, presion y balanceo'),
 ('Aire acondicionado','Confort',                'Compresor, refrigerante y ventilacion');

-- 4. TAREAS DE REVISION -----------------------------------------------------
INSERT INTO tarea_revision (nombre_tarea, descripcion, tiempo_estimado_min) VALUES
 ('Inspeccion visual de pastillas y discos', 'Verificacion de espesor y estado superficial',        20),
 ('Prueba de recorrido de pedal',            'Medicion de recorrido libre y firmeza del pedal',     15),
 ('Revision de fugas en el circuito',        'Inspeccion de mangueras, cilindros y deposito',       25),
 ('Purga del sistema hidraulico',            'Extraccion de aire del circuito de frenos',           40),
 ('Prueba de amortiguadores',                'Verificacion de rebote y fugas de aceite',            30),
 ('Revision de rotulas y terminales',        'Deteccion de juego en articulaciones',                25),
 ('Verificacion de alineacion',              'Medicion de convergencia y camber',                   35),
 ('Lectura de codigos de falla',             'Consulta del modulo de control mediante escaner',     15),
 ('Prueba de compresion del motor',          'Medicion de presion en cada cilindro',                60),
 ('Inspeccion de bujias y cables',           'Verificacion de electrodos, holgura y aislamiento',   30),
 ('Prueba de carga de bateria',              'Medicion de voltaje en reposo y bajo carga',          15),
 ('Prueba de salida del alternador',         'Medicion de voltaje y amperaje de carga',             20),
 ('Revision de nivel y estado de aceite',    'Verificacion de nivel, color y contaminacion',        10),
 ('Inspeccion del sistema de enfriamiento',  'Revision de radiador, mangueras y termostato',        30),
 ('Prueba de presion del sistema',           'Deteccion de fugas mediante presurizacion',           25),
 ('Revision de embrague',                    'Verificacion de punto de agarre y desgaste',          35),
 ('Prueba de cambios en carretera',          'Evaluacion del comportamiento en marcha',             30),
 ('Inspeccion de inyectores',                'Verificacion de pulverizacion y goteo',               45),
 ('Revision de filtro de combustible',       'Inspeccion de saturacion y reemplazo',                20),
 ('Inspeccion del sistema de escape',        'Revision de fugas, soportes y catalizador',           25),
 ('Verificacion de presion de neumaticos',   'Medicion y ajuste segun especificacion',              10),
 ('Balanceo de ruedas',                      'Correccion de desbalance mediante contrapesos',       40),
 ('Carga de refrigerante',                   'Recuperacion, vacio y carga del sistema',             45),
 ('Prueba de compresor de aire',             'Verificacion de acople y presiones de trabajo',       30);

-- 5. REGLAS DE DIAGNOSTICO --------------------------------------------------
-- La condicion se almacena en formato JSONB. El motor de reglas evalua las
-- palabras clave, el kilometraje y el nivel de confianza que reporta la capa
-- de interpretacion antes de sugerir las tareas asociadas.

INSERT INTO regla_diagnostico (id_categoria, nombre_regla, condicion, nivel_confianza, prioridad) VALUES
 (1, 'Ruido metalico al frenar',
     '{"palabras":["chilla","rechina","ruido al frenar","metalico"],"km_minimo":0}', 0.900, 1),
 (1, 'Pedal esponjoso o hundido',
     '{"palabras":["pedal","esponjoso","se hunde","sin presion"],"km_minimo":0}',    0.880, 1),
 (2, 'Golpeteo en superficie irregular',
     '{"palabras":["golpetea","brinca","tumbo","suspension"],"km_minimo":0}',        0.850, 2),
 (3, 'Vehiculo desviado de trayectoria',
     '{"palabras":["jala","se va","desvia","direccion dura"],"km_minimo":0}',        0.870, 2),
 (4, 'Perdida de potencia del motor',
     '{"palabras":["no jala","sin fuerza","pierde potencia","cascabeleo"],"km_minimo":0}', 0.840, 1),
 (5, 'Arranque deficiente',
     '{"palabras":["no enciende","cuesta arrancar","falla al arrancar"],"km_minimo":0}',   0.860, 1),
 (6, 'Falla de carga electrica',
     '{"palabras":["bateria","se descarga","luz de bateria","no da corriente"],"km_minimo":0}', 0.890, 1),
 (7, 'Deslizamiento del embrague',
     '{"palabras":["embrague","patina","no entra cambio","clutch"],"km_minimo":0}',  0.850, 2),
 (8, 'Sobrecalentamiento del motor',
     '{"palabras":["calienta","temperatura","hierve","vapor"],"km_minimo":0}',       0.910, 1),
 (9, 'Consumo excesivo de combustible',
     '{"palabras":["gasta mucho","consumo","gasolina","rinde poco"],"km_minimo":0}', 0.800, 3),
 (10,'Ruido o fuga en el escape',
     '{"palabras":["escape","ruidoso","truena","humo negro"],"km_minimo":0}',        0.820, 3),
 (11,'Desgaste irregular de neumaticos',
     '{"palabras":["llanta","desgaste","vibra","desbalance"],"km_minimo":0}',        0.830, 2),
 (12,'Aire acondicionado sin enfriamiento',
     '{"palabras":["aire","no enfria","clima","compresor"],"km_minimo":0}',          0.870, 3);

-- 6. TAREAS ASOCIADAS A CADA REGLA -----------------------------------------
INSERT INTO regla_tarea (id_regla, id_tarea, orden_ejecucion) VALUES
 (1,1,1),(1,2,2),(1,3,3),
 (2,2,1),(2,3,2),(2,4,3),
 (3,5,1),(3,6,2),(3,7,3),
 (4,6,1),(4,7,2),(4,22,3),
 (5,8,1),(5,9,2),(5,13,3),
 (6,8,1),(6,10,2),(6,11,3),
 (7,11,1),(7,12,2),(7,8,3),
 (8,16,1),(8,17,2),
 (9,14,1),(9,15,2),(9,13,3),
 (10,18,1),(10,19,2),(10,8,3),
 (11,20,1),(11,8,2),
 (12,21,1),(12,22,2),(12,7,3),
 (13,23,1),(13,24,2);
