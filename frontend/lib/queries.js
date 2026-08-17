import 'server-only';
import { query, INICIO_DEL_DIA } from './db';

/**
 * Todos los SELECT viven aquí. Las páginas son Server Components y llaman a
 * estas funciones directamente: no hace falta una API Route intermedia.
 */

/** Última lectura del sensor. Es la que manda en el Hero del dashboard. */
export async function getUltimaLectura() {
  const { rows } = await query(
    `SELECT glucose_value, trend_arrow, "timestamp"
       FROM cgm_readings
      ORDER BY "timestamp" DESC
      LIMIT 1`
  );
  return rows[0] ?? null;
}

/** Lectura de hace ~15 min, para calcular el delta contra la actual. */
export async function getLecturaPrevia() {
  const { rows } = await query(
    `SELECT glucose_value, "timestamp"
       FROM cgm_readings
      WHERE "timestamp" <= now() - interval '15 minutes'
      ORDER BY "timestamp" DESC
      LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function getUltimaInsulina() {
  const { rows } = await query(
    `SELECT type, units, "timestamp"
       FROM insulin_logs
      ORDER BY "timestamp" DESC
      LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function getUltimaComida() {
  const { rows } = await query(
    `SELECT meal_type, description, carbs_grams, "timestamp"
       FROM meals
      ORDER BY "timestamp" DESC
      LIMIT 1`
  );
  return rows[0] ?? null;
}

/** Curva completa del día para la gráfica. */
export async function getLecturasDeHoy() {
  const { rows } = await query(
    `SELECT glucose_value, trend_arrow, "timestamp"
       FROM cgm_readings
      WHERE "timestamp" >= ${INICIO_DEL_DIA}
      ORDER BY "timestamp" ASC`
  );
  return rows;
}

/**
 * Tiempo en rango del día. Es la métrica que de verdad le importa al
 * endocrinólogo, más que cualquier lectura suelta.
 */
export async function getEstadisticasDeHoy() {
  const { rows } = await query(
    `SELECT
        count(*)::int                                                   AS lecturas,
        avg(glucose_value)::numeric(6,1)                                AS promedio,
        min(glucose_value)::int                                         AS minimo,
        max(glucose_value)::int                                         AS maximo,
        count(*) FILTER (WHERE glucose_value BETWEEN 70 AND 180)::int   AS en_rango,
        count(*) FILTER (WHERE glucose_value < 70)::int                 AS bajas,
        count(*) FILTER (WHERE glucose_value > 180)::int                AS altas
       FROM cgm_readings
      WHERE "timestamp" >= ${INICIO_DEL_DIA}`
  );

  const s = rows[0] ?? {};
  const total = s.lecturas || 0;
  return {
    lecturas: total,
    promedio: s.promedio != null ? Number(s.promedio) : null,
    minimo: s.minimo,
    maximo: s.maximo,
    porcentajeEnRango: total ? Math.round((s.en_rango / total) * 100) : null,
    porcentajeBajo: total ? Math.round((s.bajas / total) * 100) : null,
    porcentajeAlto: total ? Math.round((s.altas / total) * 100) : null,
  };
}

/** Totales del día para las tarjetas de resumen. */
export async function getTotalesDeHoy() {
  const { rows } = await query(
    `SELECT
       (SELECT coalesce(sum(carbs_grams), 0)     FROM meals        WHERE "timestamp" >= ${INICIO_DEL_DIA}) AS carbos,
       (SELECT coalesce(sum(units), 0)           FROM insulin_logs WHERE "timestamp" >= ${INICIO_DEL_DIA}) AS unidades,
       (SELECT coalesce(sum(amount_ml), 0)       FROM water_logs   WHERE "timestamp" >= ${INICIO_DEL_DIA}) AS agua_ml,
       (SELECT coalesce(sum(duration_minutes),0) FROM activities   WHERE "timestamp" >= ${INICIO_DEL_DIA}) AS minutos_actividad`
  );
  const t = rows[0] ?? {};
  return {
    carbos: Number(t.carbos || 0),
    unidades: Number(t.unidades || 0),
    aguaMl: Number(t.agua_ml || 0),
    minutosActividad: Number(t.minutos_actividad || 0),
  };
}

/**
 * Línea de tiempo del día: comidas, insulina, actividad y agua en un solo
 * flujo, cada evento con la glucosa que había en ese momento (LATERAL a la
 * lectura más cercana). Se omiten las lecturas sueltas del sensor porque son
 * ~288 al día y taparían todo lo demás; para eso está la gráfica.
 */
export async function getTimelineDeHoy() {
  const { rows } = await query(
    `WITH eventos AS (
        SELECT 'comida'::text  AS tipo, m."timestamp" AS ts,
               coalesce(m.meal_type, 'Comida') AS titulo,
               m.description AS detalle,
               m.carbs_grams::numeric AS cantidad, 'g'::text AS unidad
          FROM meals m WHERE m."timestamp" >= ${INICIO_DEL_DIA}
        UNION ALL
        SELECT 'insulina', i."timestamp",
               coalesce(i.type, 'Insulina'), NULL,
               i.units::numeric, 'U'
          FROM insulin_logs i WHERE i."timestamp" >= ${INICIO_DEL_DIA}
        UNION ALL
        SELECT 'actividad', a."timestamp",
               coalesce(a.activity_type, 'Actividad'), a.intensity,
               a.duration_minutes::numeric, 'min'
          FROM activities a WHERE a."timestamp" >= ${INICIO_DEL_DIA}
        UNION ALL
        SELECT 'agua', w."timestamp",
               'Agua', NULL,
               w.amount_ml::numeric, 'ml'
          FROM water_logs w WHERE w."timestamp" >= ${INICIO_DEL_DIA}
     )
     SELECT e.tipo, e.ts, e.titulo, e.detalle, e.cantidad, e.unidad,
            g.glucose_value, g.trend_arrow
       FROM eventos e
       LEFT JOIN LATERAL (
            SELECT c.glucose_value, c.trend_arrow
              FROM cgm_readings c
             WHERE c."timestamp" BETWEEN e.ts - interval '10 minutes'
                                     AND e.ts + interval '10 minutes'
             ORDER BY abs(extract(epoch FROM (c."timestamp" - e.ts)))
             LIMIT 1
       ) g ON true
      ORDER BY e.ts DESC`
  );

  return rows.map((r) => ({
    ...r,
    cantidad: r.cantidad != null ? Number(r.cantidad) : null,
  }));
}

/**
 * Id de Gaelito para las comidas. Se resuelve una vez y se cachea: primero
 * PATIENT_USER_ID, si no el usuario con rol de paciente, si no el primero.
 */
let pacienteCacheado;

export async function getPacienteId() {
  if (process.env.PATIENT_USER_ID) return process.env.PATIENT_USER_ID;
  if (pacienteCacheado !== undefined) return pacienteCacheado;

  const { rows } = await query(
    `SELECT id FROM users
      WHERE role ILIKE 'pat%' OR role ILIKE 'pac%'
      ORDER BY id LIMIT 1`
  );
  if (rows[0]) return (pacienteCacheado = rows[0].id);

  const fallback = await query('SELECT id FROM users ORDER BY id LIMIT 1');
  return (pacienteCacheado = fallback.rows[0]?.id ?? null);
}
