-- ==========================================================================
--  SISTEMA CON INTELIGENCIA ARTIFICIAL PARA GENERAR ORDENES DE TRABAJO
--  Y DIAGNOSTICO EN EL TALLER MECANICO RAPISERVICIOS
--  Universidad Mariano Galvez de Guatemala
--  Motor de base de datos: PostgreSQL 15 (Supabase)
--  Archivo: 01_esquema.sql   Version: 1.1
-- ==========================================================================
--  Control de cambios
--  1.0  2026-08-13  Version preliminar con catorce tablas y una vista.
--  1.1  2026-08-18  La tabla usuario deja de resguardar la contrasena. El
--                   servicio de autenticacion de Supabase asume la custodia
--                   de las credenciales y la columna auth_uid establece la
--                   correspondencia entre la cuenta de acceso y el perfil
--                   operativo del taller.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. CATALOGO DE ROLES Y USUARIOS
-- --------------------------------------------------------------------------
CREATE TABLE rol (
    id_rol          SERIAL       PRIMARY KEY,
    nombre_rol      VARCHAR(40)  NOT NULL UNIQUE,
    descripcion     VARCHAR(160)
);

-- La custodia de las credenciales corresponde al servicio de autenticacion de
-- Supabase, que resguarda correo y contrasena dentro del esquema reservado
-- auth.users. La tabla usuario conserva el perfil operativo del taller y se
-- enlaza con ese servicio mediante la columna auth_uid.
CREATE TABLE usuario (
    id_usuario      SERIAL       PRIMARY KEY,
    id_rol          INTEGER      NOT NULL REFERENCES rol(id_rol),
    auth_uid        UUID         UNIQUE,
    nombre_completo VARCHAR(120) NOT NULL,
    correo          VARCHAR(120) NOT NULL UNIQUE,
    telefono        VARCHAR(20),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_registro  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_usuario_auth ON usuario(auth_uid);

-- La restriccion contra auth.users se establece unicamente cuando el esquema
-- de autenticacion existe. De esa forma el script conserva compatibilidad con
-- una instalacion de PostgreSQL sin Supabase.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'auth' AND table_name = 'users') THEN
        ALTER TABLE usuario
            ADD CONSTRAINT fk_usuario_auth
            FOREIGN KEY (auth_uid) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- --------------------------------------------------------------------------
-- 2. CLIENTES Y VEHICULOS
-- --------------------------------------------------------------------------
CREATE TABLE cliente (
    id_cliente      SERIAL       PRIMARY KEY,
    nombre_completo VARCHAR(120) NOT NULL,
    telefono        VARCHAR(20)  NOT NULL,
    correo          VARCHAR(120),
    fecha_registro  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehiculo (
    id_vehiculo     SERIAL       PRIMARY KEY,
    id_cliente      INTEGER      NOT NULL REFERENCES cliente(id_cliente),
    placa           VARCHAR(15)  NOT NULL UNIQUE,
    marca           VARCHAR(50)  NOT NULL,
    linea           VARCHAR(50)  NOT NULL,
    modelo_anio     INTEGER      NOT NULL CHECK (modelo_anio BETWEEN 1950 AND 2100),
    color           VARCHAR(30),
    kilometraje     INTEGER      CHECK (kilometraje >= 0),
    fecha_registro  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_vehiculo_cliente ON vehiculo(id_cliente);

-- --------------------------------------------------------------------------
-- 3. BASE DE CONOCIMIENTO DEL TALLER
-- --------------------------------------------------------------------------
CREATE TABLE categoria_falla (
    id_categoria      SERIAL       PRIMARY KEY,
    nombre_categoria  VARCHAR(80)  NOT NULL UNIQUE,
    sistema_vehicular VARCHAR(60)  NOT NULL,
    descripcion       VARCHAR(240)
);

CREATE TABLE tarea_revision (
    id_tarea            SERIAL       PRIMARY KEY,
    nombre_tarea        VARCHAR(120) NOT NULL,
    descripcion         TEXT,
    tiempo_estimado_min INTEGER      NOT NULL CHECK (tiempo_estimado_min > 0)
);

CREATE TABLE regla_diagnostico (
    id_regla        SERIAL        PRIMARY KEY,
    id_categoria    INTEGER       NOT NULL REFERENCES categoria_falla(id_categoria),
    nombre_regla    VARCHAR(120)  NOT NULL,
    condicion       JSONB         NOT NULL,
    nivel_confianza NUMERIC(4,3)  NOT NULL DEFAULT 0.800
                    CHECK (nivel_confianza BETWEEN 0 AND 1),
    prioridad       INTEGER       NOT NULL DEFAULT 1,
    activa          BOOLEAN       NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_regla_categoria ON regla_diagnostico(id_categoria) WHERE activa;

CREATE TABLE regla_tarea (
    id_regla_tarea  SERIAL   PRIMARY KEY,
    id_regla        INTEGER  NOT NULL REFERENCES regla_diagnostico(id_regla) ON DELETE CASCADE,
    id_tarea        INTEGER  NOT NULL REFERENCES tarea_revision(id_tarea),
    orden_ejecucion INTEGER  NOT NULL DEFAULT 1,
    UNIQUE (id_regla, id_tarea)
);

-- --------------------------------------------------------------------------
-- 4. ORDENES DE TRABAJO
-- --------------------------------------------------------------------------
CREATE TABLE estado_orden (
    id_estado       SERIAL      PRIMARY KEY,
    nombre_estado   VARCHAR(40) NOT NULL UNIQUE,
    orden_secuencia INTEGER     NOT NULL
);

CREATE TABLE orden_trabajo (
    id_orden            SERIAL       PRIMARY KEY,
    id_vehiculo         INTEGER      NOT NULL REFERENCES vehiculo(id_vehiculo),
    id_usuario          INTEGER      NOT NULL REFERENCES usuario(id_usuario),
    id_estado           INTEGER      NOT NULL REFERENCES estado_orden(id_estado),
    codigo_consulta     VARCHAR(12)  NOT NULL UNIQUE,
    descripcion_falla   TEXT         NOT NULL,
    fecha_ingreso       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega       TIMESTAMP,
    tiempo_estimado_min INTEGER      CHECK (tiempo_estimado_min >= 0),
    observaciones       TEXT
);
CREATE INDEX idx_orden_vehiculo ON orden_trabajo(id_vehiculo);
CREATE INDEX idx_orden_estado   ON orden_trabajo(id_estado);

-- La categoria admite ausencia de valor. Un diagnostico sin categoria recoge
-- una interpretacion fuera del catalogo del taller, o bien la constancia de
-- que la descripcion carecia de una falla concreta. El motivo permanece
-- dentro de texto_interpretado en ambos casos.
CREATE TABLE diagnostico (
    id_diagnostico       SERIAL        PRIMARY KEY,
    id_orden             INTEGER       NOT NULL REFERENCES orden_trabajo(id_orden) ON DELETE CASCADE,
    id_categoria         INTEGER       REFERENCES categoria_falla(id_categoria),
    origen_interpretacion VARCHAR(20)  NOT NULL
                         CHECK (origen_interpretacion IN ('TEXTO','FOTOGRAFIA','MIXTO','MANUAL','GENERATIVO')),
    nivel_confianza      NUMERIC(4,3)  CHECK (nivel_confianza BETWEEN 0 AND 1),
    texto_interpretado   TEXT,
    sistema_sugerido     VARCHAR(80),
    hallazgo             TEXT,
    fecha_generacion     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_diagnostico_orden ON diagnostico(id_orden);

-- Una tarea de revision procede de dos vias. La via REGLA apunta al catalogo
-- del taller por medio de id_tarea. La via GENERATIVO recoge una sugerencia
-- del servicio de interpretacion para una averia ajena al catalogo, y conserva
-- el nombre y el tiempo dentro de la propia fila.
CREATE TABLE detalle_orden (
    id_detalle            SERIAL       PRIMARY KEY,
    id_orden              INTEGER      NOT NULL REFERENCES orden_trabajo(id_orden) ON DELETE CASCADE,
    id_tarea              INTEGER      REFERENCES tarea_revision(id_tarea),
    origen                VARCHAR(12)  NOT NULL DEFAULT 'REGLA'
                          CHECK (origen IN ('REGLA','GENERATIVO')),
    nombre_tarea_sugerida VARCHAR(160),
    tiempo_sugerido_min   INTEGER      CHECK (tiempo_sugerido_min > 0),
    completada            BOOLEAN      NOT NULL DEFAULT FALSE,
    tiempo_real_min       INTEGER      CHECK (tiempo_real_min >= 0),
    observacion           TEXT,
    UNIQUE (id_orden, id_tarea),
    CONSTRAINT detalle_orden_coherencia_check CHECK (
        (origen = 'REGLA'      AND id_tarea IS NOT NULL)
     OR (origen = 'GENERATIVO' AND nombre_tarea_sugerida IS NOT NULL
                               AND tiempo_sugerido_min   IS NOT NULL)
    )
);

-- --------------------------------------------------------------------------
-- 5. EVIDENCIA FOTOGRAFICA Y TRAZABILIDAD
-- --------------------------------------------------------------------------
CREATE TABLE fotografia (
    id_fotografia       SERIAL       PRIMARY KEY,
    id_orden            INTEGER      NOT NULL REFERENCES orden_trabajo(id_orden) ON DELETE CASCADE,
    id_usuario          INTEGER      NOT NULL REFERENCES usuario(id_usuario),
    ruta_almacenamiento VARCHAR(255) NOT NULL,
    etapa               VARCHAR(20)  NOT NULL
                        CHECK (etapa IN ('INGRESO','DIAGNOSTICO','REPARACION','ENTREGA')),
    descripcion         VARCHAR(200),
    fecha_captura       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fotografia_orden ON fotografia(id_orden);

CREATE TABLE bitacora_estado (
    id_bitacora  SERIAL       PRIMARY KEY,
    id_orden     INTEGER      NOT NULL REFERENCES orden_trabajo(id_orden) ON DELETE CASCADE,
    id_estado    INTEGER      NOT NULL REFERENCES estado_orden(id_estado),
    id_usuario   INTEGER      NOT NULL REFERENCES usuario(id_usuario),
    fecha_cambio TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comentario   VARCHAR(200)
);
CREATE INDEX idx_bitacora_orden ON bitacora_estado(id_orden);

-- --------------------------------------------------------------------------
-- 6. VISTA DE HISTORIAL POR VEHICULO
-- --------------------------------------------------------------------------
CREATE VIEW v_historial_vehiculo AS
SELECT  v.id_vehiculo,
        v.placa,
        v.marca,
        v.linea,
        o.id_orden,
        o.fecha_ingreso,
        o.fecha_entrega,
        e.nombre_estado,
        o.descripcion_falla,
        o.tiempo_estimado_min,
        (SELECT COUNT(*) FROM fotografia f WHERE f.id_orden = o.id_orden) AS total_fotografias,
        (SELECT string_agg(c.nombre_categoria, ', ')
           FROM diagnostico d
           JOIN categoria_falla c ON c.id_categoria = d.id_categoria
          WHERE d.id_orden = o.id_orden) AS categorias_diagnosticadas
FROM    vehiculo v
        JOIN orden_trabajo o ON o.id_vehiculo = v.id_vehiculo
        JOIN estado_orden  e ON e.id_estado   = o.id_estado;
