'use server';

import { revalidatePath } from 'next/cache';
import { query, TZ } from '@/lib/db';
import { getPacienteId } from '@/lib/queries';

/**
 * Server Actions de registro. Todas siguen la misma forma
 * (estadoPrevio, formData) -> { ok, mensaje } para poder usarlas con
 * useActionState en los formularios.
 */

/**
 * Si el formulario trae una hora, se interpreta como hora local de HOY.
 * Construirlo en SQL evita que el reloj del servidor (UTC en Vercel) mueva
 * el registro de día.
 */
const EXPRESION_FECHA = `
  CASE WHEN $HORA::text IS NULL OR $HORA::text = '' THEN now()
       ELSE (date_trunc('day', now() AT TIME ZONE '${TZ}') + $HORA::time) AT TIME ZONE '${TZ}'
  END`;

function fechaSql(indiceParam) {
  return EXPRESION_FECHA.replaceAll('$HORA', `$${indiceParam}`);
}

function numero(valor, { min, max, campo, entero = false }) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error(`${campo}: escribe un número válido.`);
  if (entero && !Number.isInteger(n)) throw new Error(`${campo}: debe ser un número entero.`);
  if (n < min || n > max) throw new Error(`${campo}: debe estar entre ${min} y ${max}.`);
  return n;
}

function texto(valor, { max = 500, campo, requerido = false }) {
  const t = String(valor ?? '').trim();
  if (requerido && !t) throw new Error(`${campo}: no puede quedar vacío.`);
  if (t.length > max) throw new Error(`${campo}: máximo ${max} caracteres.`);
  return t || null;
}

function refrescar() {
  revalidatePath('/');
  revalidatePath('/historial');
}

const TIPOS_COMIDA = ['Desayuno', 'Comida', 'Cena', 'Colación'];
const TIPOS_INSULINA = ['Lyumjev', 'Tresiba'];
const INTENSIDADES = ['Baja', 'Media', 'Alta'];

export async function registrarComida(_estadoPrevio, formData) {
  try {
    const tipo = String(formData.get('meal_type') || '');
    if (!TIPOS_COMIDA.includes(tipo)) throw new Error('Elige el tipo de comida.');

    const descripcion = texto(formData.get('description'), {
      campo: 'Descripción',
      requerido: true,
    });
    const carbos = numero(formData.get('carbs_grams'), {
      min: 0,
      max: 500,
      campo: 'Carbohidratos',
    });
    const hora = formData.get('hora');
    const pacienteId = await getPacienteId();

    await query(
      `INSERT INTO meals (user_id, meal_type, description, carbs_grams, "timestamp")
       VALUES ($1, $2, $3, $4, ${fechaSql(5)})`,
      [pacienteId, tipo, descripcion, carbos, hora]
    );

    refrescar();
    return { ok: true, mensaje: `${tipo} registrado: ${carbos} g de carbohidratos.` };
  } catch (err) {
    console.error('[registrarComida]', err);
    return { ok: false, mensaje: err.message || 'No se pudo guardar la comida.' };
  }
}

export async function registrarInsulina(_estadoPrevio, formData) {
  try {
    const tipo = String(formData.get('type') || '');
    if (!TIPOS_INSULINA.includes(tipo)) throw new Error('Elige el tipo de insulina.');

    // Tope de 100 U: no es un límite clínico, es un freno a los dedos gordos.
    const unidades = numero(formData.get('units'), { min: 0.5, max: 100, campo: 'Unidades' });
    const hora = formData.get('hora');

    await query(
      `INSERT INTO insulin_logs (type, units, "timestamp") VALUES ($1, $2, ${fechaSql(3)})`,
      [tipo, unidades, hora]
    );

    refrescar();
    return { ok: true, mensaje: `${tipo}: ${unidades} unidades registradas.` };
  } catch (err) {
    console.error('[registrarInsulina]', err);
    return { ok: false, mensaje: err.message || 'No se pudo guardar la insulina.' };
  }
}

export async function registrarAgua(_estadoPrevio, formData) {
  try {
    const ml = numero(formData.get('amount_ml'), {
      min: 10,
      max: 3000,
      campo: 'Cantidad',
      entero: true,
    });

    await query(
      `INSERT INTO water_logs (amount_ml, "timestamp") VALUES ($1, ${fechaSql(2)})`,
      [ml, formData.get('hora')]
    );

    refrescar();
    return { ok: true, mensaje: `${ml} ml de agua registrados.` };
  } catch (err) {
    console.error('[registrarAgua]', err);
    return { ok: false, mensaje: err.message || 'No se pudo guardar el agua.' };
  }
}

export async function registrarActividad(_estadoPrevio, formData) {
  try {
    const tipo = texto(formData.get('activity_type'), {
      campo: 'Tipo de actividad',
      requerido: true,
      max: 100,
    });
    const minutos = numero(formData.get('duration_minutes'), {
      min: 0,
      max: 600,
      campo: 'Duración',
      entero: true,
    });

    const intensidad = String(formData.get('intensity') || '');
    if (!INTENSIDADES.includes(intensidad)) throw new Error('Elige la intensidad.');

    await query(
      `INSERT INTO activities (activity_type, duration_minutes, intensity, "timestamp")
       VALUES ($1, $2, $3, ${fechaSql(4)})`,
      [tipo, minutos, intensidad, formData.get('hora')]
    );

    refrescar();
    return { ok: true, mensaje: `${tipo}: ${minutos} min registrados.` };
  } catch (err) {
    console.error('[registrarActividad]', err);
    return { ok: false, mensaje: err.message || 'No se pudo guardar la actividad.' };
  }
}
