'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

/**
 * Controles de fecha del historial.
 *
 * Las fechas se manejan como cadenas 'YYYY-MM-DD' de principio a fin, nunca
 * como objetos Date: el servidor corre en UTC y convertir de ida y vuelta
 * movería el día para quien está en México.
 */
function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  // Date.UTC evita que el huso del navegador desplace el resultado.
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}

export default function NavegadorDias({ fecha, hoy, primerDia }) {
  const router = useRouter();

  const ir = (destino) => {
    if (!destino || destino > hoy) return;
    if (primerDia && destino < primerDia) return;
    router.push(destino === hoy ? '/historial' : `/historial?fecha=${destino}`);
  };

  const anterior = sumarDias(fecha, -1);
  const siguiente = sumarDias(fecha, 1);

  const hayAnterior = !primerDia || anterior >= primerDia;
  const haySiguiente = siguiente <= hoy;
  const esHoy = fecha === hoy;

  const claseFlecha =
    'flex size-12 shrink-0 items-center justify-center rounded-xl border border-borde bg-superficie transition-colors active:bg-superficie-alta disabled:opacity-30';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => ir(anterior)}
          disabled={!hayAnterior}
          aria-label="Día anterior"
          className={claseFlecha}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>

        {/* El input date abre el calendario nativo del celular. */}
        <label className="relative flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-borde bg-superficie px-3">
          <CalendarDays size={16} className="shrink-0 text-tenue" aria-hidden="true" />
          <span className="text-sm font-medium">
            {esHoy ? 'Hoy' : new Intl.DateTimeFormat('es-MX', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              timeZone: 'UTC',
            }).format(new Date(`${fecha}T12:00:00Z`))}
          </span>
          <input
            type="date"
            value={fecha}
            max={hoy}
            min={primerDia || undefined}
            onChange={(e) => ir(e.target.value)}
            aria-label="Elegir fecha"
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        <button
          type="button"
          onClick={() => ir(siguiente)}
          disabled={!haySiguiente}
          aria-label="Día siguiente"
          className={claseFlecha}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>

      {!esHoy && (
        <button
          type="button"
          onClick={() => ir(hoy)}
          className="min-h-11 w-full rounded-xl border border-acento/40 bg-acento/10 text-sm font-semibold text-acento active:bg-acento/20"
        >
          Volver a hoy
        </button>
      )}
    </div>
  );
}
