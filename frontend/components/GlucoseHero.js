import { AlertTriangle, WifiOff } from 'lucide-react';
import { clasificar, tendencia, haceCuanto, estaDesactualizada } from '@/lib/glucosa';

/**
 * El número grande. Es lo único que mi mamá va a mirar a las 3am, así que
 * manda sobre todo lo demás: tamaño, color y flecha antes que cualquier
 * adorno. Server Component: recibe filas de Neon ya consultadas.
 */
export default function GlucoseHero({ lectura, previa }) {
  if (!lectura) {
    return (
      <section className="tarjeta flex flex-col items-center gap-2 px-6 py-12 text-center">
        <WifiOff className="text-tenue" size={32} aria-hidden="true" />
        <p className="text-lg font-medium">Sin lecturas todavía</p>
        <p className="text-sm text-tenue">
          Revisa que el worker de sincronización esté corriendo.
        </p>
      </section>
    );
  }

  const valor = Number(lectura.glucose_value);
  const estado = clasificar(valor);
  const flecha = tendencia(lectura.trend_arrow);
  const vieja = estaDesactualizada(lectura.timestamp);

  const delta = previa != null ? valor - Number(previa.glucose_value) : null;
  const signo = delta > 0 ? '+' : '';

  return (
    <section
      className="tarjeta relative overflow-hidden px-6 py-8"
      style={{ borderColor: `${estado.color}55` }}
      aria-label={`Glucosa actual ${valor} miligramos por decilitro, ${estado.etiqueta}, ${flecha.texto}`}
    >
      {/* Halo del color del rango: da el estado de un vistazo, sin leer. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${estado.color}, transparent 70%)` }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center">
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{ backgroundColor: `${estado.color}22`, color: estado.color }}
        >
          {estado.etiqueta}
        </span>

        <div className="mt-3 flex items-start gap-3">
          <span
            className="font-mono text-8xl font-bold leading-none tabular-nums"
            style={{ color: estado.color }}
          >
            {valor}
          </span>
          <span
            className="mt-2 text-5xl leading-none"
            style={{ color: estado.color }}
            aria-hidden="true"
            title={flecha.texto}
          >
            {flecha.glifo}
          </span>
        </div>

        <p className="mt-2 text-sm text-tenue">
          mg/dL · {flecha.texto}
          {delta != null && (
            <>
              {' · '}
              <span className="tabular-nums">
                {signo}
                {delta} en 15 min
              </span>
            </>
          )}
        </p>

        <p className={`mt-4 text-sm ${vieja ? 'text-alto' : 'text-tenue'}`}>
          {haceCuanto(lectura.timestamp)}
        </p>

        {vieja && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-alto/10 px-3 py-2 text-xs text-alto">
            <AlertTriangle size={16} className="mt-px shrink-0" aria-hidden="true" />
            El sensor no ha reportado en más de 15 minutos. Revisa que el celular de Gaelito
            tenga internet y esté cerca de él.
          </p>
        )}
      </div>
    </section>
  );
}
