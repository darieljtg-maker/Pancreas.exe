import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

import GlucoseHero from '@/components/GlucoseHero';
import QuickStats from '@/components/QuickStats';
import AutoRefresh from '@/components/AutoRefresh';
import ErrorDeConexion from '@/components/ErrorDeConexion';
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

      <header>
        <h1 className="text-2xl font-bold">Gaelito</h1>
        <p className="text-sm text-tenue">{fechaLarga(new Date())}</p>
      </header>

      <GlucoseHero lectura={datos.lectura} previa={datos.previa} />

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
