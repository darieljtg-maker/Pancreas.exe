import { AlertTriangle, Radio } from "lucide-react";
import {
  clasificar,
  tendencia,
  haceCuanto,
  estaDesactualizada,
} from "@/lib/glucosa";
export default function GlucoseHero({ lectura, previa }) {
  if (!lectura)
    return (
      <section className="tarjeta p-6">
        <p className="eyebrow">Sensor Libre 2</p>
        <h2 className="mt-3 text-xl font-semibold">Esperando lecturas</h2>
        <p className="mt-2 text-tenue">
          Revisa la conexión del teléfono y la app del sensor.
        </p>
      </section>
    );
  const valor = Number(lectura.glucose_value),
    estado = clasificar(valor),
    flecha = tendencia(lectura.trend_arrow),
    vieja = estaDesactualizada(lectura.timestamp);
  const distancia = previa
    ? (new Date(lectura.timestamp) - new Date(previa.timestamp)) / 60000
    : 0;
  const delta =
    !vieja && distancia >= 10 && distancia <= 20
      ? valor - Number(previa.glucose_value)
      : null;
  return (
    <section
      className="tarjeta relative overflow-hidden p-6 sm:p-8"
      style={{ borderColor: estado.color + "55" }}
      aria-label={
        (vieja ? "Última lectura" : "Glucosa actual") +
        " " +
        valor +
        " miligramos por decilitro, " +
        estado.etiqueta +
        ", " +
        flecha.texto
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-2">
          <Radio size={14} aria-hidden="true" />{" "}
          {vieja ? "Última lectura recibida" : "Sensor Libre 2"}
        </p>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: estado.color + "18", color: estado.color }}
        >
          {vieja ? "Dato antiguo" : estado.etiqueta}
        </span>
      </div>
      <div className="my-5 flex items-end gap-3">
        <span
          className="font-mono text-7xl font-semibold tracking-tighter sm:text-8xl"
          style={{ color: estado.color }}
        >
          {valor}
        </span>
        <span
          className="mb-3 text-4xl"
          style={{ color: estado.color }}
          aria-label={flecha.texto}
        >
          {flecha.glifo}
        </span>
        <span className="mb-3 text-sm text-tenue">mg/dL</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-tenue">
        <span>{flecha.texto}</span>
        <span>{haceCuanto(lectura.timestamp)}</span>
        {delta !== null && (
          <span>
            {delta > 0 ? "+" : ""}
            {delta} en unos 15 min
          </span>
        )}
      </div>
      {vieja && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-alto/10 p-3 text-sm text-alto">
          <AlertTriangle
            size={17}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          Sin datos recientes. Revisa que el teléfono tenga batería, internet y
          conexión con el sensor.
        </p>
      )}
    </section>
  );
}
