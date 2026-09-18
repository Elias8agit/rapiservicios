-- ==========================================================================
--  MIGRACION 05 - HISTORIAL VEHICULAR
--  Sistema con inteligencia artificial para generar ordenes de trabajo y
--  diagnostico en el taller mecanico Rapiservicios.
--
--  MOTIVO
--
--  La vista v_historial_vehiculo quedo escrita antes de la migracion 04 y
--  arrastra dos carencias.
--
--  PRIMERA, Y ES UN DEFECTO. La vista resuelve el diagnostico uniendo la tabla
--  diagnostico con categoria_falla mediante una union interna. Desde la
--  migracion 04 un diagnostico generativo carece de categoria: describe el
--  sistema afectado dentro de sistema_sugerido. La union interna descarta esas
--  filas, de modo que una orden interpretada fuera del catalogo aparecia en el
--  historial sin diagnostico alguno, como si nunca se hubiera interpretado.
--  Justamente las ordenes que mas informacion aportan al historial, porque
--  corresponden a las averias que el catalogo del taller no cubre.
--
--  SEGUNDA. La vista no expone el codigo de consulta ni el avance de las
--  tareas. El taller identifica cada trabajo por su codigo, que es lo que el
--  cliente lleva anotado, y el avance responde de un vistazo si aquella visita
--  quedo terminada o a medias.
--
--  La vista se reconstruye en lugar de reemplazarse porque las columnas nuevas
--  no van al final: CREATE OR REPLACE VIEW exige conservar el orden y los
--  tipos existentes.
--
--  La ejecucion resulta segura sobre una base con datos: una vista no almacena
--  filas, de modo que eliminarla y volver a crearla no toca ningun registro.
--
--  Ejecutar dentro del editor SQL de Supabase.
-- ==========================================================================

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

        -- Diagnostico de la visita, en una sola linea.
        --
        -- La union pasa a ser externa y el valor se toma de la categoria del
        -- catalogo o, a falta de ella, del sistema que senalo la
        -- interpretacion generativa. Asi ambos niveles de interpretacion
        -- quedan representados dentro de la misma columna y el historial no
        -- pierde las averias que el catalogo no cubre.
        (SELECT string_agg(DISTINCT COALESCE(c.nombre_categoria, d.sistema_sugerido), ', ')
           FROM diagnostico d
           LEFT JOIN categoria_falla c ON c.id_categoria = d.id_categoria
          WHERE d.id_orden = o.id_orden
            AND COALESCE(c.nombre_categoria, d.sistema_sugerido) IS NOT NULL)
                                                               AS categorias_diagnosticadas,

        -- Avance de la revision. Cuenta las dos clases de tarea, la que
        -- proviene del motor de reglas y la que sugirio la interpretacion,
        -- porque el mecanico marca ambas con el mismo gesto.
        (SELECT COUNT(*)
           FROM detalle_orden t
          WHERE t.id_orden = o.id_orden)                        AS total_tareas,

        (SELECT COUNT(*)
           FROM detalle_orden t
          WHERE t.id_orden = o.id_orden
            AND t.completada)                                   AS tareas_completadas

FROM    vehiculo v
        JOIN orden_trabajo o ON o.id_vehiculo = v.id_vehiculo
        JOIN estado_orden  e ON e.id_estado   = o.id_estado;

-- --------------------------------------------------------------------------
--  VERIFICACION
--
--  La primera consulta enumera las columnas de la vista: trece filas confirman
--  la reconstruccion, con codigo_consulta, total_tareas y tareas_completadas
--  entre ellas.
--
--  La segunda recorre el historial completo. Ninguna fila debe mostrar
--  categorias_diagnosticadas vacia cuando la orden si tiene diagnostico, que
--  era el defecto que esta migracion corrige.
-- --------------------------------------------------------------------------
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'v_historial_vehiculo'
 ORDER BY ordinal_position;

SELECT placa,
       codigo_consulta,
       nombre_estado,
       categorias_diagnosticadas,
       tareas_completadas || ' de ' || total_tareas AS avance
  FROM v_historial_vehiculo
 ORDER BY fecha_ingreso DESC;
