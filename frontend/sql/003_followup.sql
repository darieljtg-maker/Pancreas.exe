-- Structure only. Patient data is entered privately in Neon, never in Git.
CREATE TABLE IF NOT EXISTS care_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_from date NOT NULL UNIQUE,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE meals ADD COLUMN IF NOT EXISTS nutrition jsonb;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS request_id text;
ALTER TABLE insulin_logs ADD COLUMN IF NOT EXISTS request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS meals_request_id_unique ON meals (request_id);
CREATE UNIQUE INDEX IF NOT EXISTS insulin_request_id_unique ON insulin_logs (request_id);
