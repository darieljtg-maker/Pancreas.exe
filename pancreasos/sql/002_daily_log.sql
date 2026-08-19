-- ============================================================
--  PancreasOS · tabla daily_log
--  Pégalo en el editor SQL de Neon, igual que las 6 tablas originales.
--  Se puede correr dos veces sin romper nada: si la tabla ya existe,
--  no la toca.
-- ============================================================
--
--  Se entrega como SQL y no como esquema de Prisma o Drizzle a propósito:
--  el resto de la aplicación habla con Neon a través de `pg` y las otras
--  seis tablas se crearon así. Meter un ORM ahora obligaría a añadir
--  migraciones, un cliente generado, un paso más en el build de Vercel y
--  una segunda forma de consultar la misma base. El día que quieras
--  migrar, esta tabla mapea 1:1 a un modelo de Prisma sin cambios.
--
--  El tipo de `user_id` no está escrito a mano: se copia del que tenga
--  `users.id` en TU base. Así da igual que allá sea INTEGER, BIGINT o
--  UUID, y si la tabla `users` no existiera, la columna se crea suelta
--  sin llave foránea en vez de fallar.

DO $bloque$
DECLARE
  tipo_id text;
  fk      text := '';
BEGIN
  IF to_regclass('daily_log') IS NOT NULL THEN
    RAISE NOTICE 'daily_log ya existe: no se modifica.';
    RETURN;
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO tipo_id
    FROM pg_attribute a
   WHERE a.attrelid = to_regclass('users')
     AND a.attname  = 'id'
     AND a.attnum   > 0
     AND NOT a.attisdropped;

  IF tipo_id IS NULL THEN
    RAISE NOTICE 'No encontré users.id: creo user_id como integer y sin llave foránea.';
    tipo_id := 'integer';
  ELSE
    fk := 'REFERENCES users(id)';
  END IF;

  EXECUTE format($tabla$
    CREATE TABLE daily_log (
      id            BIGSERIAL PRIMARY KEY,
      user_id       %s %s,

      -- Fecha local (America/Mexico_City), no UTC: el día nutricional
      -- termina cuando se acuesta, no a las 6 de la tarde que es cuando
      -- cambia el día en el reloj del servidor.
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
    )$tabla$, tipo_id, fk);

  RAISE NOTICE 'daily_log creada con user_id de tipo %.', tipo_id;
END
$bloque$;

-- La consulta que corre en cada carga del planificador es "todo lo de hoy".
CREATE INDEX IF NOT EXISTS daily_log_fecha_idx ON daily_log (fecha DESC);
CREATE INDEX IF NOT EXISTS daily_log_user_fecha_idx ON daily_log (user_id, fecha DESC);
