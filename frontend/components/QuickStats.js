import { Syringe, UtensilsCrossed } from "lucide-react";
import { hora, haceCuanto } from "@/lib/glucosa";
export default function QuickStats({ insulina, comida, totales }) {
  return (
    <section
      aria-label="Últimos registros"
      className="grid gap-3 sm:grid-cols-2"
    >
      {[
        {
          Icon: Syringe,
          label: "Última insulina registrada",
          value: insulina
            ? Number(insulina.units) + " U · " + insulina.type
            : "Sin dosis registrada",
          detail: insulina
            ? hora(insulina.timestamp) + " · " + haceCuanto(insulina.timestamp)
            : "Los registros no confirman ausencia de insulina activa.",
        },
        {
          Icon: UtensilsCrossed,
          label: "Última comida registrada",
          value: comida
            ? Number(comida.carbs_grams) + " g CH · " + comida.meal_type
            : "Sin comida registrada",
          detail: comida
            ? hora(comida.timestamp) + " · " + haceCuanto(comida.timestamp)
            : "Añade los alimentos y sus porciones reales.",
        },
      ].map(({ Icon, label, value, detail }) => (
        <div key={label} className="tarjeta p-4">
          <p className="flex items-center gap-2 text-xs text-tenue">
            <Icon size={16} aria-hidden="true" />
            {label}
          </p>
          <p className="mt-3 font-semibold">{value}</p>
          <p className="mt-2 text-xs leading-relaxed text-tenue">{detail}</p>
        </div>
      ))}
      <p className="text-sm text-tenue sm:col-span-2">
        Hoy:{" "}
        <span className="text-texto">{totales.carbos} g CH registrados</span> ·{" "}
        <span className="text-texto">{totales.unidades} U registradas</span>
      </p>
    </section>
  );
}
