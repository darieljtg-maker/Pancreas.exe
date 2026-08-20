import { CalendarOff } from 'lucide-react';

import GraficaGlucosa from '@/components/GraficaGlucosa';
import Timeline from '@/components/Timeline';
import AuditoriaSemanal from '@/components/AuditoriaSemanal';
import NavegadorDias from '@/components/NavegadorDias';
import AutoRefresh from '@/components/AutoRefresh';
import ErrorDeConexion from '@/components/ErrorDeConexion';
import {
  getHoyLocal,
  getRangoDeDatos,
  getLecturasDelDia,
  getTimelineDelDia,
  getEstadisticasDelDia,
  getTotalesDelDia,
} from '@/lib/queries';
import { hora } from '@/lib/glucosa';
import { TZ } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Historial · PancreasOS' };

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function Metrica({ etiqueta, valor, unidad, color }) {
  return (
    <div className="tarjeta flex flex-col items-center gap-0.5 px-2 py-3">
      <span className="font-mono text-xl font-bold tabular-nums" style={color ? { color } : undefined}>
        {valor ?? '--'}
        {valor != null && unidad && (
          <span className="ml-0.5 text-xs font-normal text-tenue">{unidad}</span>
        )}
      </span>
      <span className="text-center text-[11px] leading-tight text-tenue">{etiqueta}</span>
    </div>
  );
}

function Total({ etiqueta, valor }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1 py-3">
      <span className="font-mono text-base font-semibold tabular-nums">{valor}</span>
      <span className="text-center text-[10px] leading-tight text-tenue">{etiqueta}</span>
    </div>
  );
}

export default async function HistorialPage({ searchParams }) {
  let hoy;
  let datos;

  try {
    hoy = await getHoyLocal();
    const { fecha: pedida } = await searchParams;

    // Solo se aceptan fechas bien formadas y nunca del futuro.
    const fecha =
      typeof pedida === 'string' && ES_FECHA.test(pedida) && pedida <= hoy ? pedida : hoy;

    const [rango, lecturas, eventos, stats, totales] = await Promise.all([
      getRangoDeDatos(),
      getLecturasDelDia(fecha),
      getTimelineDelDia(fecha),
      getEstadisticasDelDia(fecha),
      getTotalesDelDia(fecha),
    ]);

    datos = { fecha, rango, lecturas, eventos, stats, totales };
  } catch (err) {
    console.error('[historial]', err);
    return <ErrorDeConexion mensaje={err.message} />;
  }

  const { fecha, rango, lecturas, eventos, stats, totales } = datos;
  const esHoy = fecha === hoy;

  // La gráfica necesita datos planos: la hora se convierte a decimal aquí,
  // en el servidor y con la zona explícita, para no romper la hidratación.
  const datosGrafica = lecturas.map((l) => {
    const partes = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TZ,
    }).formatToParts(new Date(l.timestamp));

    const h = Number(partes.find((p) => p.type === 'hour').value);
    const m = Number(partes.find((p) => p.type === 'minute').value);

    return { hora: h + m / 60, valor: Number(l.glucose_value), etiqueta: hora(l.timestamp) };
  });

  const titulo = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${fecha}T12:00:00Z`));

  const sinDatos = lecturas.length === 0 && eventos.length === 0;

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Solo se refresca solo cuando estás viendo hoy; un día pasado no cambia. */}
      {esHoy && <AutoRefresh segundos={120} />}

      <header>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-sm text-tenue">
          {titulo.charAt(0).toUpperCase() + titulo.slice(1)}
        </p>
      </header>

      <NavegadorDias fecha={fecha} hoy={hoy} primerDia={rango.primero} />

      <AuditoriaSemanal />

      {sinDatos ? (
        <div className="tarjeta flex flex-col items-center gap-3 px-6 py-12 text-center">
          <CalendarOff size={30} className="text-tenue" aria-hidden="true" />
          <p className="font-medium">Sin datos este día</p>
          <p className="text-sm text-tenue">
            No hay lecturas del sensor ni registros para esta fecha.
          </p>
        </div>
      ) : (
        <>
          <section aria-label="Resumen del día" className="grid grid-cols-4 gap-2">
            <Metrica etiqueta="en rango" valor={stats.porcentajeEnRango} unidad="%" color="#22C55E" />
            <Metrica etiqueta="promedio" valor={stats.promedio ? Math.round(stats.promedio) : null} />
            <Metrica etiqueta="mínima" valor={stats.minimo} color="#FF4D4F" />
            <Metrica etiqueta="máxima" valor={stats.maximo} color="#F5A524" />
          </section>

          <section aria-label="Curva de glucosa del día">
            <GraficaGlucosa datos={datosGrafica} />
            <p className="mt-2 text-center text-xs text-tenue">
              {stats.lecturas} lecturas · rango objetivo 70–180 mg/dL
            </p>
          </section>

          <section aria-label="Totales del día" className="tarjeta grid grid-cols-4 divide-x divide-borde p-1">
            <Total etiqueta="g carbos" valor={totales.carbos} />
            <Total etiqueta="U insulina" valor={totales.unidades} />
            <Total etiqueta="ml agua" valor={totales.aguaMl} />
            <Total etiqueta="min activo" valor={totales.minutosActividad} />
          </section>

          <section aria-label="Eventos del día">
            <h2 className="mb-3 text-lg font-semibold">
              {esHoy ? 'Eventos de hoy' : 'Eventos del día'}
            </h2>
            <Timeline eventos={eventos} />
          </section>
        </>
      )}

      <p className="pt-2 text-center text-xs leading-relaxed text-tenue">
        Herramienta de seguimiento. No sustituye el criterio del equipo médico de Gaelito
        ni sirve para decidir dosis.
      </p>
    </div>
  );
}
