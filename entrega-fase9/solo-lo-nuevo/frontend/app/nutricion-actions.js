'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { query, TZ } from '@/lib/db';
import { COOKIE_SESION, tokenValido } from '@/lib/auth';
import { getPacienteId } from '@/lib/queries';
import { calcularUGP } from '@/lib/calculosNutricionales';

async function haySesion() {
  const almacen = await cookies();
  return tokenValido(almacen.get(COOKIE_SESION)?.value);
}

/** Límites de cordura: frenan errores de dedo, no son límites clínicos. */
const LIMITES = {
  calorias: [0, 3000],
  carbos: [0, 500],
  proteina: [0, 300],
  grasa: [0, 300],
  unidades: [0, 100],
};

function numero(valor, campo) {
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new Error(`${campo}: valor no numérico.`);
  const [min, max] = LIMITES[campo] ?? [0, Number.MAX_SAFE_INTEGER];
  if (n < min || n > max) throw new Error(`${campo}: debe estar entre ${min} y ${max}.`);
  return n;
}

const COMIDAS_VALIDAS = ['desayuno', 'colacion1', 'comida', 'colacion2', 'cena'];
const ORIGENES = ['menu', 'antojo', 'manual'];

/**
 * Guarda lo que Gaelito realmente comió.
 *
 * La fecha se resuelve en SQL con la zona horaria de la app: si se usara el
 * reloj del servidor, en Vercel (UTC) todo lo cenado después de las 18:00
 * hora de México se registraría en el día siguiente.
 */
export async function registrarConsumo(datos) {
  if (!(await haySesion())) return { ok: false, mensaje: 'Sesión no válida.' };

  try {
    const comida = COMIDAS_VALIDAS.includes(datos?.comida) ? datos.comida : null;
    const origen = ORIGENES.includes(datos?.origen) ? datos.origen : 'manual';
    const ruta = ['A', 'B'].includes(datos?.ruta) ? datos.ruta : null;

    const calorias = numero(datos?.calorias ?? 0, 'calorias');
    const carbos = numero(datos?.carbos ?? 0, 'carbos');
    const proteina = numero(datos?.proteina ?? 0, 'proteina');
    const grasa = numero(datos?.grasa ?? 0, 'grasa');
    const unidades =
      datos?.unidades == null || datos.unidades === ''
        ? null
        : numero(datos.unidades, 'unidades');

    if (calorias === 0 && carbos === 0 && proteina === 0 && grasa === 0) {
      return { ok: false, mensaje: 'No hay nada que registrar.' };
    }

    const descripcion = String(datos?.descripcion || '').trim().slice(0, 500) || null;
    const { ugp } = calcularUGP({ proteina, grasa });
    const pacienteId = await getPacienteId();

    await query(
      `INSERT INTO daily_log
         (user_id, fecha, comida, origen, descripcion,
          calorias, carbos, proteina, grasa, unidades, ruta, ugp)
       VALUES ($1, (now() AT TIME ZONE '${TZ}')::date, $2, $3, $4,
               $5, $6, $7, $8, $9, $10, $11)`,
      [pacienteId, comida, origen, descripcion,
       calorias, carbos, proteina, grasa, unidades, ruta, ugp]
    );

    revalidatePath('/plan');
    revalidatePath('/');

    return {
      ok: true,
      mensaje: `Registrado: ${Math.round(calorias)} kcal · ${carbos} g de carbohidratos.`,
    };
  } catch (err) {
    console.error('[registrarConsumo]', err);

    if (err?.code === '42P01') {
      return {
        ok: false,
        mensaje: 'Falta crear la tabla daily_log. Corre sql/002_daily_log.sql en Neon.',
      };
    }
    return { ok: false, mensaje: err.message || 'No se pudo registrar el consumo.' };
  }
}

/** Deshace el último registro del día, por si se guardó de más. */
export async function borrarConsumo(id) {
  if (!(await haySesion())) return { ok: false, mensaje: 'Sesión no válida.' };

  try {
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, mensaje: 'Registro inválido.' };

    const { rowCount } = await query(
      `DELETE FROM daily_log
        WHERE id = $1 AND fecha = (now() AT TIME ZONE '${TZ}')::date`,
      [n]
    );

    revalidatePath('/plan');
    return rowCount > 0
      ? { ok: true, mensaje: 'Registro eliminado.' }
      : { ok: false, mensaje: 'Ese registro no es de hoy.' };
  } catch (err) {
    console.error('[borrarConsumo]', err);
    return { ok: false, mensaje: err.message || 'No se pudo eliminar.' };
  }
}
