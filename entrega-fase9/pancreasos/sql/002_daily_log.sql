-- ============================================================
--  PancreasOS · tabla daily_log
--  Pégalo en el editor SQL de Neon, igual que las 6 tablas originales.
-- ============================================================
--
--  Se entrega como SQL y no como esquema de Prisma o Drizzle a propósito:
--  el resto de la aplicación habla con Neon a través de `pg` y las otras
--  seis tablas se crearon así. Meter un ORM ahora obligaría a añadir
--  migraciones, un cliente generado, un paso más en el build de Vercel y
--  una segunda forma de consultar la misma base. El día que quieras
--  migrar, esta tabla mapea 1:1 a un modelo de Prisma sin cambios.

CREATE TABLE IF NOT EXISTS daily_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id),

  -- Fecha local (America/Mexico_City), no UTC: el día nutricional termina
  -- cuando se acuesta, no a las 6 de la tarde que es cuando cambia el día
  -- en el reloj del servidor.
  fecha         DATE        NOT NULL,

  -- A qué comida del reparto corresponde: desayuno, colacion1, comida...
  comida        TEXT,

  -- Qué produjo el registro: 'menu' (opción sugerida por la IA),
  -- 'antojo' (calculadora inversa) o 'manual'.
  origen        TEXT        NOT NULL DEFAULT 'manual',
  descripcion   TEXT,

  calorias      NUMERIC(7,1) NOT NULL DEFAULT 0,
  carbos        NUMERIC(6,1) NOT NULL DEFAULT 0,
  proteina      NUMERIC(6,1) NOT NULL DEFAULT 0,
  grasa         NUMERIC(6,1) NOT NULL DEFAULT 0,

  -- Unidades de insulina asociadas y qué ruta se usó para decidirlas.
  unidades      NUMERIC(5,2),
  ruta          TEXT,

  -- Unidades Grasa-Proteína, para poder revisar después si las subidas
  -- tardías coinciden con las comidas de digestión lenta.
  ugp           NUMERIC(5,2),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT daily_log_origen_valido CHECK (origen IN ('menu', 'antojo', 'manual')),
  CONSTRAINT daily_log_ruta_valida   CHECK (ruta IS NULL OR ruta IN ('A', 'B')),
  CONSTRAINT daily_log_no_negativos  CHECK (
    calorias >= 0 AND carbos >= 0 AND proteina >= 0 AND grasa >= 0
  )
);

-- La consulta que corre en cada carga del planificador es "todo lo de hoy".
CREATE INDEX IF NOT EXISTS daily_log_fecha_idx ON daily_log (fecha DESC);
CREATE INDEX IF NOT EXISTS daily_log_user_fecha_idx ON daily_log (user_id, fecha DESC);
