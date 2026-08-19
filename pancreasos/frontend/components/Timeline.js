import { UtensilsCrossed, Syringe, Droplets, Footprints } from 'lucide-react';
import { hora, clasificar, tendencia } from '@/lib/glucosa';

const ESTILOS = {
  comida: { Icono: UtensilsCrossed, color: '#38BDF8' },
  insulina: { Icono: Syringe, color: '#A78BFA' },
  agua: { Icono: Droplets, color: '#22D3EE' },
  actividad: { Icono: Footprints, color: '#34D399' },
};

/**
 * Eventos del día en orden inverso. Cada uno lleva la glucosa que había en
 * ese momento: es lo que permite ver "comió 62 g y estaba en 180".
 */
export default function Timeline({ eventos }) {
  if (!eventos.length) {
    return (
      <div className="tarjeta px-6 py-10 text-center text-sm text-tenue">
        No hay registros de hoy todavía.
      </div>
    );
  }

  return (
    <ol className="flex flex-col">
      {eventos.map((e, i) => {
        const { Icono, color } = ESTILOS[e.tipo] ?? ESTILOS.comida;
        const estado = clasificar(e.glucose_value != null ? Number(e.glucose_value) : null);
        const flecha = tendencia(e.trend_arrow);
        const ultimo = i === eventos.length - 1;

        return (
          <li key={`${e.tipo}-${e.ts}-${i}`} className="flex gap-3">
            {/* Riel vertical que une los eventos. */}
            <div className="flex flex-col items-center">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: `${color}55`, backgroundColor: `${color}18`, color }}
              >
                <Icono size={18} aria-hidden="true" />
              </span>
              {!ultimo && <span className="w-px flex-1 bg-borde" aria-hidden="true" />}
            </div>

            <div className={`flex-1 ${ultimo ? 'pb-1' : 'pb-5'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{e.titulo}</p>
                <time className="shrink-0 font-mono text-xs text-tenue">{hora(e.ts)}</time>
              </div>

              <p className="text-sm text-tenue">
                {e.cantidad != null && (
                  <span className="font-medium text-texto">
                    {e.cantidad} {e.unidad}
                  </span>
                )}
                {e.detalle && (
                  <>
                    {e.cantidad != null && ' · '}
                    {e.detalle}
                  </>
                )}
              </p>

              {e.glucose_value != null && (
                <p className="mt-1 text-xs" style={{ color: estado.color }}>
                  Glucosa {Number(e.glucose_value)} mg/dL {flecha.glifo}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
