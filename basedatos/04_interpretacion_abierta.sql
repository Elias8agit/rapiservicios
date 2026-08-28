-- ==========================================================================
--  MIGRACION 04 - INTERPRETACION ABIERTA
--  Sistema con inteligencia artificial para generar ordenes de trabajo y
--  diagnostico en el taller mecanico Rapiservicios.
--
--  MOTIVO
--
--  El catalogo del taller reune doce categorias de falla. Un vehiculo
--  presenta averias que exceden ese catalogo, y hasta hoy esas averias
--  producian una orden vacia: sin diagnostico, sin tareas y sin registro del
--  motivo. La orden RS4A44QJ, con el texto "Check engine encendido y falla de
--  airbag", quedo derivada a revision manual sin dejar rastro de la causa.
--
--  Esta migracion habilita dos niveles de interpretacion dentro de la misma
--  estructura de datos:
--
--    Nivel 1  La interpretacion corresponde a una categoria del catalogo. El
--             motor de reglas del taller decide las tareas y el tiempo. La
--             tarea proviene de tarea_revision y lleva origen REGLA.
--
--    Nivel 2  Ninguna categoria corresponde. El servicio de interpretacion
--             describe el sistema afectado y propone tareas de revision. Esas
--             tareas residen dentro de la misma tabla, con nombre y tiempo
--             propios, y llevan origen GENERATIVO para que nadie las confunda
--             con una decision de la base de conocimiento del taller.
--
--  La ejecucion de este archivo resulta segura sobre una base con datos: solo
--  agrega columnas, relaja restricciones y conserva las filas existentes, que
--  quedan marcadas con origen REGLA por el valor predeterminado.
--
--  Ejecutar dentro del editor SQL de Supabase.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. DIAGNOSTICO
--
-- La categoria deja de resultar obligatoria. Un diagnostico sin categoria
-- representa una interpretacion fuera del catalogo, o bien la constancia de
-- que la descripcion carecia de una falla concreta. En ambos casos el motivo
-- queda registrado dentro de texto_interpretado, evidencia que hasta hoy se
-- perdia por completo.
-- --------------------------------------------------------------------------
ALTER TABLE diagnostico ALTER COLUMN id_categoria DROP NOT NULL;

-- El origen admite el valor GENERATIVO, que distingue la sugerencia del
-- servicio de interpretacion de la decision del motor de reglas.
ALTER TABLE diagnostico DROP CONSTRAINT IF EXISTS diagnostico_origen_interpretacion_check;
ALTER TABLE diagnostico ADD CONSTRAINT diagnostico_origen_interpretacion_check
    CHECK (origen_interpretacion IN ('TEXTO','FOTOGRAFIA','MIXTO','MANUAL','GENERATIVO'));

-- Sistema del vehiculo que el servicio senala cuando ninguna categoria del
-- catalogo corresponde. Ejemplo: seguridad pasiva, ante un testigo de airbag.
ALTER TABLE diagnostico ADD COLUMN IF NOT EXISTS sistema_sugerido VARCHAR(80);

-- Descripcion del hallazgo en lenguaje del taller, redactada por el servicio
-- de interpretacion a partir del texto del mecanico y de la fotografia.
ALTER TABLE diagnostico ADD COLUMN IF NOT EXISTS hallazgo TEXT;

-- --------------------------------------------------------------------------
-- 2. DETALLE DE LA ORDEN
--
-- Una tarea sugerida carece de fila dentro de tarea_revision, de modo que la
-- llave foranea deja de resultar obligatoria y la tarea conserva su nombre y
-- su tiempo dentro de la propia fila. El mecanico marca ambas clases de tarea
-- desde la misma pantalla y con el mismo gesto.
-- --------------------------------------------------------------------------
ALTER TABLE detalle_orden ALTER COLUMN id_tarea DROP NOT NULL;

ALTER TABLE detalle_orden ADD COLUMN IF NOT EXISTS nombre_tarea_sugerida VARCHAR(160);
ALTER TABLE detalle_orden ADD COLUMN IF NOT EXISTS tiempo_sugerido_min   INTEGER;
ALTER TABLE detalle_orden ADD COLUMN IF NOT EXISTS origen                VARCHAR(12) NOT NULL DEFAULT 'REGLA';

ALTER TABLE detalle_orden DROP CONSTRAINT IF EXISTS detalle_orden_origen_check;
ALTER TABLE detalle_orden ADD CONSTRAINT detalle_orden_origen_check
    CHECK (origen IN ('REGLA','GENERATIVO'));

ALTER TABLE detalle_orden DROP CONSTRAINT IF EXISTS detalle_orden_tiempo_sugerido_check;
ALTER TABLE detalle_orden ADD CONSTRAINT detalle_orden_tiempo_sugerido_check
    CHECK (tiempo_sugerido_min IS NULL OR tiempo_sugerido_min > 0);

-- Coherencia entre el origen de la tarea y los campos que la sustentan: una
-- tarea de regla apunta al catalogo, una tarea sugerida carga su nombre y su
-- tiempo. La restriccion impide filas a medias.
ALTER TABLE detalle_orden DROP CONSTRAINT IF EXISTS detalle_orden_coherencia_check;
ALTER TABLE detalle_orden ADD CONSTRAINT detalle_orden_coherencia_check
    CHECK (
        (origen = 'REGLA'      AND id_tarea IS NOT NULL)
     OR (origen = 'GENERATIVO' AND nombre_tarea_sugerida IS NOT NULL
                               AND tiempo_sugerido_min   IS NOT NULL)
    );

-- --------------------------------------------------------------------------
-- 3. VERIFICACION
--
-- La consulta devuelve las columnas nuevas junto con su condicion de nulidad.
-- Doce filas confirman la migracion completa.
-- --------------------------------------------------------------------------
SELECT table_name, column_name, is_nullable, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (
        (table_name = 'diagnostico'   AND column_name IN ('id_categoria','sistema_sugerido','hallazgo'))
     OR (table_name = 'detalle_orden' AND column_name IN ('id_tarea','nombre_tarea_sugerida','tiempo_sugerido_min','origen'))
       )
 ORDER BY table_name, column_name;
