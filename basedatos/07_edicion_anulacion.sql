-- ==========================================================================
--  MIGRACION 07 - EDICION Y ANULACION DE ORDENES
--  Sistema con inteligencia artificial para generar ordenes de trabajo y
--  diagnostico en el taller mecanico Rapiservicios.
--
--  MOTIVO
--
--  Hasta esta migracion una orden mal creada permanecia para siempre: no
--  habia forma de corregir un dato ni de retirarla del trabajo activo. En un
--  taller real eso ocurre (un kilometraje mal leido, un vehiculo equivocado,
--  un cliente que se arrepiente antes de la revision).
--
--  ALCANCE DECIDIDO EL 18 DE OCTUBRE DE 2026
--
--    Se edita solo lo que no afecta al diagnostico: el kilometraje de ingreso
--    y la nota del mecanico (columna observaciones, que ya existia). La
--    descripcion de la falla y el vehiculo quedan fijos, porque el diagnostico
--    se genero a partir de ellos. Si estaban mal, la orden se anula y se crea
--    otra.
--
--    Anular corresponde solo al propietario, exige un motivo y se admite hasta
--    la etapa LISTO. Una orden ENTREGADA ya salio del taller con el cliente.
--
--  POR QUE ANULADA NO ES UN ESTADO MAS
--
--  El ciclo de la orden es lineal (RECIBIDO, EN DIAGNOSTICO, EN REPARACION,
--  LISTO, ENTREGADO) y la aplicacion calcula la etapa siguiente por su numero
--  de secuencia. Anular, en cambio, puede ocurrir desde cualquiera de las
--  cuatro primeras etapas y la cierra. Como sexto estado romperia esa
--  secuencia: el sistema creeria que despues de ENTREGADO viene ANULADA. Por
--  eso la anulacion se registra en columnas propias y la orden conserva la
--  etapa en que estaba cuando se anulo, que tambien es un dato util.
--
--  QUIEN ANULO
--
--  No se agrega una segunda referencia a la tabla usuario dentro de
--  orden_trabajo. La anulacion deja un asiento en bitacora_estado, que ya
--  registra el usuario de cada movimiento. Una segunda referencia volveria
--  ambiguas las consultas que hoy unen la orden con su usuario.
--
--  NADA SE BORRA
--
--  La orden anulada conserva diagnostico, tareas, fotografias y bitacora.
--
--  La ejecucion resulta segura sobre una base con datos: las columnas nuevas
--  admiten nulo y las ordenes existentes quedan como no anuladas.
--
--  Ejecutar dentro del editor SQL de Supabase.
-- ==========================================================================

-- --------------------------------------------------------------------------
--  1. COLUMNAS NUEVAS
-- --------------------------------------------------------------------------

-- Kilometraje con el que el vehiculo ingreso en esta visita. Hasta ahora solo
-- se guardaba en la ficha del vehiculo, que se sobrescribe en cada ingreso,
-- de modo que el historial perdia el dato de las visitas anteriores. Las
-- ordenes existentes quedan sin el dato: no hay de donde recuperarlo.
ALTER TABLE orden_trabajo
    ADD COLUMN IF NOT EXISTS kilometraje_ingreso INTEGER
        CHECK (kilometraje_ingreso >= 0);

ALTER TABLE orden_trabajo
    ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMP;

ALTER TABLE orden_trabajo
    ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(160);

-- La fecha y el motivo van juntos: una orden anulada sin motivo, o un motivo
-- en una orden vigente, indicarian un registro a medias.
ALTER TABLE orden_trabajo
    DROP CONSTRAINT IF EXISTS chk_orden_anulacion_completa;

ALTER TABLE orden_trabajo
    ADD CONSTRAINT chk_orden_anulacion_completa CHECK (
        (fecha_anulacion IS NULL AND motivo_anulacion IS NULL)
        OR (fecha_anulacion IS NOT NULL AND motivo_anulacion IS NOT NULL)
    );

-- El listado de trabajo activo filtra por esta columna en cada consulta.
CREATE INDEX IF NOT EXISTS idx_orden_anulacion ON orden_trabajo(fecha_anulacion);

-- --------------------------------------------------------------------------
--  2. VISTA DE HISTORIAL
--
--  Se reconstruye para exponer la anulacion y el kilometraje de ingreso. Una
--  visita anulada sigue apareciendo en el historial, marcada como tal: si un
--  vehiculo acumula ordenes anuladas, eso tambien le dice algo al taller.
--
--  Las columnas nuevas van al final y el resto queda identico a la migracion
--  05, de modo que la aplicacion actual sigue leyendo lo mismo.
-- --------------------------------------------------------------------------
DROP VIEW IF EXISTS v_historial_vehiculo;

CREATE VIEW v_historial_vehiculo AS
SELECT  v.id_vehiculo,
        v.placa,
        v.marca,
        v.linea,
        o.id_orden,
        o.codigo_consulta,
        o.fecha_ingreso,
        o.fecha_entrega,
        e.nombre_estado,
        o.descripcion_falla,
        o.tiempo_estimado_min,

        (SELECT COUNT(*)
           FROM fotografia f
          WHERE f.id_orden = o.id_orden)                       AS total_fotografias,

        (SELECT string_agg(DISTINCT COALESCE(c.nombre_categoria, d.sistema_sugerido), ', ')
           FROM diagnostico d
           LEFT JOIN categoria_falla c ON c.id_categoria = d.id_categoria
          WHERE d.id_orden = o.id_orden
            AND COALESCE(c.nombre_categoria, d.sistema_sugerido) IS NOT NULL)
                                                               AS categorias_diagnosticadas,

        (SELECT COUNT(*)
           FROM detalle_orden t
          WHERE t.id_orden = o.id_orden)                        AS total_tareas,

        (SELECT COUNT(*)
           FROM detalle_orden t
          WHERE t.id_orden = o.id_orden
            AND t.completada)                                   AS tareas_completadas,

        o.kilometraje_ingreso,
        (o.fecha_anulacion IS NOT NULL)                         AS anulada,
        o.fecha_anulacion,
        o.motivo_anulacion

FROM    vehiculo v
        JOIN orden_trabajo o ON o.id_vehiculo = v.id_vehiculo
        JOIN estado_orden  e ON e.id_estado   = o.id_estado;

-- --------------------------------------------------------------------------
--  VERIFICACION
--
--  La primera consulta debe devolver las tres columnas nuevas de la tabla.
--  La segunda debe devolver diecinueve columnas en la vista: las quince de la
--  migracion 05 mas kilometraje_ingreso, anulada, fecha_anulacion y
--  motivo_anulacion.
--  La tercera debe dar cero: ninguna orden existente quedo anulada.
-- --------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'orden_trabajo'
   AND column_name IN ('kilometraje_ingreso', 'fecha_anulacion', 'motivo_anulacion')
 ORDER BY column_name;

SELECT COUNT(*) AS columnas_de_la_vista
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'v_historial_vehiculo';

SELECT COUNT(*) AS ordenes_anuladas
  FROM orden_trabajo
 WHERE fecha_anulacion IS NOT NULL;
