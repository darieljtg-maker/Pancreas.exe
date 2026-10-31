import { Sparkles } from "lucide-react";
import { pronosticoCorto } from "@/app/ai-actions";
export default async function VigilanteIA() {
  const r = await pronosticoCorto();
  return (
    <section
      aria-label="Resumen de la curva con IA"
      className="tarjeta flex items-start gap-3 p-4"
    >
      <Sparkles
        size={18}
        className="mt-1 shrink-0 text-acento"
        aria-hidden="true"
      />
      <div>
        <h2 className="text-sm font-semibold">Lectura de la curva</h2>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          {!r.ok
            ? r.mensaje
            : r.estable
              ? "Sin una tendencia destacable en los datos observados."
              : r.mensaje}
        </p>
        <p className="mt-2 text-xs text-tenue">
          Resumen orientativo. No predice una glucosa final ni indica dosis.
        </p>
      </div>
    </section>
  );
}
export function VigilanteIACargando() {
  return (
    <p className="tarjeta p-4 text-sm text-tenue">
      Resumiendo la curva reciente…
    </p>
  );
}
