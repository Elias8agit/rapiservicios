-- ==========================================================================
--  MIGRACION 06 - TIPO DE TRANSMISION DEL VEHICULO
--  Sistema con inteligencia artificial para generar ordenes de trabajo y
--  diagnostico en el taller mecanico Rapiservicios.
--
--  MOTIVO
--
--  La orden RS7MNWKJ, del 18 de septiembre de 2026, describia la reparacion de
--  una caja automatica y el sistema le asigno la tarea "Revision de embrague",
--  treinta y cinco minutos. Una caja automatica carece de embrague de pedal, de
--  modo que la orden cargaba tiempo de un trabajo que nadie iba a ejecutar.
--
--  El origen del defecto reside en la base de conocimiento del taller, no en la
--  capa de interpretacion: la categoria Transmision cubria los dos tipos de
--  caja con un unico paquete de tareas. De hecho la capa generativa se comporto
--  mejor y propuso solenoides y cuerpo de valvulas, que si corresponden a una
--  caja automatica.
--
--  QUE HACE ESTA MIGRACION
--
--  1. El vehiculo gana el tipo de caja como dato propio. Queda como fuente de
--     verdad: lo constata el taller al registrar el vehiculo y deja de depender
--     de como redacte la orden quien la ingresa.
--  2. El catalogo gana cuatro tareas propias de la caja automatica.
--  3. La regla de Transmision se parte en tres: lo comun a ambas cajas, lo
--     propio de la mecanica y lo propio de la automatica.
--
--  El campo admite nulo de forma deliberada. Los vehiculos registrados antes de
--  esta fecha carecen del dato, y un valor inventado resulta peor que su
--  ausencia: ante un tipo desconocido el motor de reglas asigna solo lo comun a
--  ambas cajas en lugar de suponer cual es.
--
--  ADVERTENCIA SOBRE LAS TAREAS NUEVAS. Las cuatro corresponden a la practica
--  corriente del oficio y NO al procedimiento declarado por Rapiservicios. Los
--  tiempos son provisionales hasta confirmarlos con el propietario del taller.
--
--  La ejecucion resulta segura sobre una base con datos: agrega una columna que
--  admite nulo, inserta filas nuevas y reemplaza una regla por tres. Ninguna
--  orden existente se modifica.
--
--  Ejecutar dentro del editor SQL de Supabase.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. TIPO DE CAJA DENTRO DE LA FICHA DEL VEHICULO
-- --------------------------------------------------------------------------
ALTER TABLE vehiculo ADD COLUMN IF NOT EXISTS tipo_transmision VARCHAR(12);

ALTER TABLE vehiculo DROP CONSTRAINT IF EXISTS vehiculo_tipo_transmision_check;
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_tipo_transmision_check
    CHECK (tipo_transmision IS NULL OR tipo_transmision IN ('MECANICA','AUTOMATICA'));

COMMENT ON COLUMN vehiculo.tipo_transmision IS
    'Tipo de caja del vehiculo. Nulo significa que el taller todavia no lo constato, '
    'y en ese caso el motor de reglas se abstiene de las tareas propias de un tipo.';

-- --------------------------------------------------------------------------
-- 2. TAREAS PROPIAS DE LA CAJA AUTOMATICA
-- --------------------------------------------------------------------------
INSERT INTO tarea_revision (id_tarea, nombre_tarea, descripcion, tiempo_estimado_min) VALUES
    (25, 'Revision de nivel y estado del aceite de transmision',
         'Verificacion de nivel, color y olor del aceite de la caja automatica', 20),
    (26, 'Prueba de solenoides y cuerpo de valvulas',
         'Comprobacion electrica y de accionamiento del control hidraulico',     40),
    (27, 'Revision del convertidor de par',
         'Deteccion de patinaje y ruido en el acoplamiento hidraulico',          35),
    (28, 'Lectura de codigos del modulo de transmision',
         'Escaneo del modulo de control de la caja y de sus codigos historicos', 15)
ON CONFLICT (id_tarea) DO UPDATE
    SET nombre_tarea        = EXCLUDED.nombre_tarea,
        descripcion         = EXCLUDED.descripcion,
        tiempo_estimado_min = EXCLUDED.tiempo_estimado_min;

-- La secuencia del identificador se adelanta para que un alta posterior no
-- choque contra las filas que esta migracion inserta con identificador fijo.
SELECT setval(
    pg_get_serial_sequence('tarea_revision', 'id_tarea'),
    (SELECT MAX(id_tarea) FROM tarea_revision)
);

-- --------------------------------------------------------------------------
-- 3. LA REGLA DE TRANSMISION SE PARTE EN TRES
--
-- La regla 8 conserva el identificador y pasa a cubrir unicamente lo comun a
-- ambas cajas. Las reglas 14 y 15 aportan lo propio de cada tipo.
--
-- La columna condicion es JSONB y refleja el catalogo en memoria del servidor.
-- El campo transmision dentro de ese objeto es lo que distingue una regla
-- sujeta a un tipo de caja. El motor aplica esas reglas solo cuando el tipo
-- consta, sea por la ficha del vehiculo o por la propia descripcion.
-- --------------------------------------------------------------------------
UPDATE regla_diagnostico
   SET nombre_regla = 'Falla de la transmision',
       condicion = '{"palabras":["no entra cambio","caja de cambios","caja de velocidades","transmision","velocidades","patina"],"km_minimo":0}'::jsonb
 WHERE id_regla = 8;

DELETE FROM regla_tarea WHERE id_regla = 8;
INSERT INTO regla_tarea (id_regla, id_tarea, orden_ejecucion) VALUES (8, 17, 1);

INSERT INTO regla_diagnostico
    (id_regla, id_categoria, nombre_regla, condicion, nivel_confianza, prioridad, activa) VALUES
    (14, 7, 'Falla de caja mecanica',
        '{"palabras":["embrague","clutch","caja mecanica","sincronizado","palanca de cambios","manual","estandar"],"km_minimo":0,"transmision":["MECANICA"]}'::jsonb,
        0.870, 2, TRUE),
    (15, 7, 'Falla de caja automatica',
        '{"palabras":["caja automatica","automatica","solenoide","convertidor","cuerpo de valvulas","aceite de transmision","atf"],"km_minimo":0,"transmision":["AUTOMATICA"]}'::jsonb,
        0.870, 2, TRUE)
ON CONFLICT (id_regla) DO UPDATE
    SET nombre_regla    = EXCLUDED.nombre_regla,
        condicion       = EXCLUDED.condicion,
        nivel_confianza = EXCLUDED.nivel_confianza,
        prioridad       = EXCLUDED.prioridad,
        activa          = EXCLUDED.activa;

DELETE FROM regla_tarea WHERE id_regla IN (14, 15);
INSERT INTO regla_tarea (id_regla, id_tarea, orden_ejecucion) VALUES
    (14, 16, 1), (14, 17, 2),
    (15, 25, 1), (15, 28, 2), (15, 26, 3), (15, 27, 4);

SELECT setval(
    pg_get_serial_sequence('regla_diagnostico', 'id_regla'),
    (SELECT MAX(id_regla) FROM regla_diagnostico)
);

-- --------------------------------------------------------------------------
--  VERIFICACION
--
--  La primera consulta confirma la columna nueva con su restriccion.
--  La segunda enumera las tareas de cada regla de Transmision: la regla 8 con
--  una tarea comun, la 14 con dos de caja mecanica y la 15 con cuatro de caja
--  automatica. Ninguna tarea de embrague debe figurar en la regla 15.
-- --------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'vehiculo'
   AND column_name = 'tipo_transmision';

SELECT r.id_regla,
       r.nombre_regla,
       t.id_tarea,
       t.nombre_tarea,
       t.tiempo_estimado_min
  FROM regla_diagnostico r
       JOIN regla_tarea    rt ON rt.id_regla = r.id_regla
       JOIN tarea_revision t  ON t.id_tarea  = rt.id_tarea
 WHERE r.id_categoria = 7
 ORDER BY r.id_regla, t.id_tarea;
