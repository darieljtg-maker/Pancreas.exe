import GlucoseChart from '@/components/GlucoseChart';
import Timeline from '@/components/Timeline';
import AuditoriaSemanal from '@/components/AuditoriaSemanal';
import AutoRefresh from '@/components/AutoRefresh';
import ErrorDeConexion from '@/components/ErrorDeConexion';
import { getLecturasDeHoy, getTimelineDeHoy, getEstadisticasDeHoy } from '@/lib/queries';
import { fechaLarga, hora } from '@/lib/glucosa';
import { TZ } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Historial · PancreasOS' };

function Metrica({ etiqueta, valor, unidad, color }) {
  return (
    <div className="tarjeta flex flex-col items-center gap-0.5 px-2 py-3">
      <span className="font-mono text-xl font-bold tabular-nums" style={color ? { color } : undefined}>
        {valor ?? '--'}
        {unidad && <span className="ml-0.5 text-xs font-normal text-tenue">{unidad}</span>}
      </span>
      <span className="text-center text-[11px] leading-tight text-tenue">{etiqueta}</span>
    </div>
  );
}

export default async function HistorialPage() {
  let lecturas;
  let eventos;
  let stats;

  try {
    [lecturas, eventos, stats] = await Promise.all([
      getLecturasDeHoy(),
      getTimelineDeHoy(),
      getEstadisticasDeHoy(),
    ]);
  } catch (err) {
    console.error('[historial]', err);
    return <ErrorDeConexion mensaje={err.message} />;
  }

  // La gráfica necesita datos planos y serializables: la hora se convierte a
  // decimal en el servidor con la zona horaria correcta, no en el navegador.
  const datosGrafica = lecturas.map((l) => {
    const partes = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TZ,
    }).formatToParts(new Date(l.timestamp));

    const h = Number(partes.find((p) => p.type === 'hour').value);
    const m = Number(partes.find((p) => p.type === 'minute').value);

    return {
      hora: h + m / 60,
      valor: Number(l.glucose_value),
      etiqueta: hora(l.timestamp),
    };
  });

  return (
    <div className="flex flex-col gap-5 pb-4">
      <AutoRefresh segundos={120} />

      <header>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-sm text-tenue">{fechaLarga(new Date())}</p>
      </header>

      <section aria-label="Resumen del día" className="grid grid-cols-4 gap-2">
        <Metrica
          etiqueta="en rango"
          valor={stats.porcentajeEnRango}
          unidad="%"
          color="#22C55E"
        />
        <Metrica etiqueta="promedio" valor={stats.promedio ? Math.round(stats.promedio) : null} />
        <Metrica etiqueta="mínima" valor={stats.minimo} color="#FF4D4F" />
        <Metrica etiqueta="máxima" valor={stats.maximo} color="#F5A524" />
      </section>

      <section aria-label="Curva de glucosa del día">
        <GlucoseChart datos={datosGrafica} />
        <p className="mt-2 text-center text-xs text-tenue">
          {stats.lecturas} lecturas hoy · rango objetivo 70–180 mg/dL
        </p>
      </section>

      <AuditoriaSemanal />

      <section aria-label="Eventos del día">
        <h2 className="mb-3 text-lg font-semibold">Eventos de hoy</h2>
        <Timeline eventos={eventos} />
      </section>

      <p className="pt-2 text-center text-xs leading-relaxed text-tenue">
        Herramienta de seguimiento. No sustituye el criterio del equipo médico de Gaelito
        ni sirve para decidir dosis.
      </p>
    </div>
  );
}
