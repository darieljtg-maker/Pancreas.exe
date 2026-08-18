import { Suspense } from 'react';
import Link from 'next/link';
import { PlusCircle, Lock } from 'lucide-react';

import GlucoseHero from '@/components/GlucoseHero';
import QuickStats from '@/components/QuickStats';
import AutoRefresh from '@/components/AutoRefresh';
import ErrorDeConexion from '@/components/ErrorDeConexion';
import VigilanteHipo from '@/components/VigilanteHipo';
import VigilanteIA, { VigilanteIACargando } from '@/components/VigilanteIA';
import { cerrarSesion } from '@/app/pin-actions';
import {
  getUltimaLectura,
  getLecturaPrevia,
  getUltimaInsulina,
  getUltimaComida,
  getTotalesDeHoy,
} from '@/lib/queries';
import { fechaLarga } from '@/lib/glucosa';

// Datos de glucosa en vivo: nunca se sirven desde caché estática.
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  let datos;
  try {
    const [lectura, previa, insulina, comida, totales] = await Promise.all([
      getUltimaLectura(),
      getLecturaPrevia(),
      getUltimaInsulina(),
      getUltimaComida(),
      getTotalesDeHoy(),
    ]);
    datos = { lectura, previa, insulina, comida, totales };
  } catch (err) {
    console.error('[dashboard]', err);
    return <ErrorDeConexion mensaje={err.message} />;
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <AutoRefresh segundos={60} />

      {/* Si el sensor reporta por debajo de 70, esto toma la pantalla completa. */}
      <VigilanteHipo
        glucosa={datos.lectura?.glucose_value}
        timestamp={datos.lectura?.timestamp}
      />

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gaelito</h1>
          <p className="text-sm text-tenue">{fechaLarga(new Date())}</p>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            aria-label="Bloquear la aplicación"
            className="flex size-11 items-center justify-center rounded-full border border-borde bg-superficie text-tenue active:bg-superficie-alta"
          >
            <Lock size={18} aria-hidden="true" />
          </button>
        </form>
      </header>

      <GlucoseHero lectura={datos.lectura} previa={datos.previa} />

      {/* El pronóstico llega en streaming: no retrasa el número de glucosa. */}
      <Suspense fallback={<VigilanteIACargando />}>
        <VigilanteIA />
      </Suspense>

      <QuickStats
        insulina={datos.insulina}
        comida={datos.comida}
        totales={datos.totales}
      />

      <Link
        href="/registro"
        className="flex items-center justify-center gap-2 rounded-2xl bg-acento px-6 py-4 text-base font-semibold text-fondo transition-opacity active:opacity-80"
      >
        <PlusCircle size={20} aria-hidden="true" />
        Registrar algo
      </Link>
    </div>
  );
}
