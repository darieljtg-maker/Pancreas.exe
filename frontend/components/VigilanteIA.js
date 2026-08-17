import { Sparkles, TriangleAlert, ShieldCheck } from 'lucide-react';
import { pronosticoCorto } from '@/app/ai-actions';

/**
 * Pronóstico a 40 minutos en el dashboard.
 *
 * Es un Server Component: llama al modelo durante el render y se transmite
 * dentro de un <Suspense>, así el número de glucosa aparece de inmediato y
 * esta tarjeta llega después sin bloquear nada.
 *
 * Es orientativo. La alerta de hipoglucemia por debajo de 70 mg/dL es
 * determinista y vive aparte: no depende de que el modelo acierte.
 */
export default async function VigilanteIA() {
  const r = await pronosticoCorto();

  if (!r.ok) {
    // Un fallo de IA no debe ensuciar el dashboard: se avisa discreto.
    return (
      <p
        aria-label="Pronóstico de IA"
        className="flex items-start gap-2 rounded-xl border border-borde bg-superficie px-4 py-3 text-xs text-tenue"
      >
        <Sparkles size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Vigilante IA no disponible. {r.mensaje}</span>
      </p>
    );
  }

  if (r.estable) {
    return (
      <p
        aria-label="Pronóstico de IA"
        className="flex items-center gap-2 rounded-xl border border-borde bg-superficie px-4 py-3 text-sm text-tenue"
      >
        <ShieldCheck size={16} className="shrink-0 text-rango" aria-hidden="true" />
        <span>
          <span className="font-medium text-texto">Estable</span> · sin cambios previstos en los
          próximos 40 min
        </span>
      </p>
    );
  }

  return (
    <div aria-label="Pronóstico de IA" className="rounded-xl border border-alto/40 bg-alto/10 px-4 py-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-alto">
        <TriangleAlert size={14} aria-hidden="true" />
        Pronóstico · próximos 40 min
      </p>
      <p className="text-sm leading-relaxed text-texto">{r.mensaje}</p>
      <p className="mt-2 text-[11px] text-tenue">
        Generado por IA a partir de la curva reciente. Orientativo, no es una indicación médica.
      </p>
    </div>
  );
}

/** Se muestra mientras el modelo responde. */
export function VigilanteIACargando() {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-borde bg-superficie px-4 py-3 text-sm text-tenue">
      <Sparkles size={16} className="shrink-0 animate-pulse text-acento" aria-hidden="true" />
      Analizando la curva reciente...
    </p>
  );
}
