"use client";
import { useState, useRef } from "react";
import { UtensilsCrossed, Syringe } from "lucide-react";
import ComidaForm from "./forms/ComidaForm";
import InsulinaForm from "./forms/InsulinaForm";
const tabs = [
  { id: "comida", label: "Comida", Icon: UtensilsCrossed },
  { id: "insulina", label: "Insulina", Icon: Syringe },
];
export default function RegistroTabs({
  inicial = "comida",
  lectura,
  pauta,
  catalogo,
}) {
  const [activa, setActiva] = useState(inicial);
  const refs = useRef([]);
  function teclado(e, i) {
    let n = null;
    if (e.key === "ArrowRight") n = (i + 1) % 2;
    if (e.key === "ArrowLeft") n = (i + 1) % 2;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = 1;
    if (n !== null) {
      e.preventDefault();
      setActiva(tabs[n].id);
      refs.current[n]?.focus();
    }
  }
  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Tipo de registro"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-borde bg-superficie p-2"
      >
        {tabs.map(({ id, label, Icon }, i) => (
          <button
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={"tab-" + id}
            key={id}
            type="button"
            role="tab"
            aria-controls={"panel-" + id}
            aria-selected={activa === id}
            tabIndex={activa === id ? 0 : -1}
            onKeyDown={(e) => teclado(e, i)}
            onClick={() => setActiva(id)}
            className={
              "flex min-h-14 items-center justify-center gap-2 rounded-xl font-semibold " +
              (activa === id ? "bg-acento text-fondo" : "text-tenue")
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <section
        id="panel-comida"
        role="tabpanel"
        aria-labelledby="tab-comida"
        hidden={activa !== "comida"}
        className="tarjeta p-5 sm:p-6"
      >
        <ComidaForm lectura={lectura} pauta={pauta} catalogo={catalogo} />
      </section>
      <section
        id="panel-insulina"
        role="tabpanel"
        aria-labelledby="tab-insulina"
        hidden={activa !== "insulina"}
        className="tarjeta p-5 sm:p-6"
      >
        <InsulinaForm pauta={pauta} />
      </section>
    </div>
  );
}
