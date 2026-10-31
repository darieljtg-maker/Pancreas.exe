import "server-only";
import { query, TZ } from "./db";
import { validarPauta, edadEnFecha } from "./pauta.mjs";

export async function getPauta() {
  const { rows } = await query(
    `SELECT data, effective_from::text,
            to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD') AS hoy
       FROM care_plans WHERE effective_from <= (now() AT TIME ZONE $1)::date
       ORDER BY effective_from DESC LIMIT 1`,
    [TZ],
  );
  const row = rows[0];
  const data = validarPauta(row?.data);
  if (!data) return null;
  return {
    ...data,
    effectiveFrom: row.effective_from,
    today: row.hoy,
    age: edadEnFecha(data.birthDate, row.hoy),
    reviewDue: Boolean(data.nextReview && row.hoy >= data.nextReview),
  };
}
