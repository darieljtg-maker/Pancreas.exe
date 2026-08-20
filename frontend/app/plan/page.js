import PlanificadorDiario from '@/components/PlanificadorDiario';
import ErrorDeConexion from '@/components/ErrorDeConexion';
import { getHoyLocal, getConsumoDelDia, existeDailyLog, getUltimaLectura } from '@/lib/queries';
import {
  PERFIL, calcularRequerimientos, distribuirPorComidas,
} from '@/lib/calculosNutricionales';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plan · PancreasOS' };

export default async function PlanPage() {
  let datos;

  try {
    const hoy = await getHoyLocal();
    const hayTabla = await existeDailyLog();
    // Lo que dice el sensor ahora mismo: de aquí sale la corrección de macros.
    const lectura = await getUltimaLectura();

    // Sin la tabla creada todavía, la página sigue siendo útil para calcular:
    // solo se desactiva el registro y se avisa.
    const consumo = hayTabla
      ? await getConsumoDelDia(hoy)
      : { registros: [], totales: { calorias: 0, carbos: 0, proteina: 0, grasa: 0, unidades: 0 } };

    datos = { hoy, hayTabla, consumo, lectura };
  } catch (err) {
    console.error('[plan]', err);
    return <ErrorDeConexion mensaje={err.message} />;
  }

  const requerimientos = calcularRequerimientos(
    PERFIL.peso,
    PERFIL.altura,
    PERFIL.edad,
    PERFIL.factorActividad
  );
  const metas = distribuirPorComidas(requerimientos);

  return (
    <div className="flex flex-col gap-5 pb-4">
      <header>
        <h1 className="text-2xl font-bold">Plan del día</h1>
        <p className="text-sm text-tenue">
          Volumen limpio · {requerimientos.calorias} kcal · {PERFIL.peso} kg
        </p>
      </header>

      <section aria-label="Requerimientos diarios" className="tarjeta grid grid-cols-4 divide-x divide-borde p-1">
        {[
          { v: requerimientos.calorias, u: 'kcal' },
          { v: requerimientos.proteina, u: `g proteína · ${requerimientos.reparto.proteina}%` },
          { v: requerimientos.carbos, u: `g carbos · ${requerimientos.reparto.carbos}%` },
          { v: requerimientos.grasa, u: `g grasa · ${requerimientos.reparto.grasa}%` },
        ].map(({ v, u }) => (
          <div key={u} className="flex flex-col items-center gap-0.5 px-1 py-3">
            <span className="font-mono text-base font-bold tabular-nums">{v}</span>
            <span className="text-center text-[10px] leading-tight text-tenue">{u}</span>
          </div>
        ))}
      </section>

      <p className="text-center text-[11px] text-tenue">
        TMB {requerimientos.tmb} kcal (Mifflin-St Jeor) × {PERFIL.factorActividad} de actividad
        + {PERFIL.superavit} kcal de superávit
      </p>

      <PlanificadorDiario
        requerimientos={requerimientos}
        metas={metas}
        consumo={datos.consumo}
        hayTabla={datos.hayTabla}
        lectura={datos.lectura}
      />
    </div>
  );
}
