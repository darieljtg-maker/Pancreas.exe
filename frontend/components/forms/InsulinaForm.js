"use client";
import { useActionState, useRef, useState } from "react";
import { registrarInsulina } from "@/app/actions";
import { Campo, Entrada, BotonGuardar, Mensaje, HoraOpcional } from "./Campos";
export default function InsulinaForm({ pauta }) {
  const [tipo, setTipo] = useState("Lyumjev");
  const [units, setUnits] = useState("");
  const formRef = useRef(null);
  const requestRef = useRef(null);
  const [estado, accion] = useActionState(async (prev, fd) => {
    requestRef.current ||= crypto.randomUUID();
    fd.set("request_id", requestRef.current);
    const r = await registrarInsulina(prev, fd);
    if (r.ok) {
      requestRef.current = null;
      setUnits("");
      formRef.current?.reset();
    }
    return r;
  }, null);
  return (
    <form ref={formRef} action={accion} className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">Registro de insulina</p>
        <h2 className="mt-1 text-xl font-semibold">
          ¿Qué dosis ya se administró?
        </h2>
        <p className="mt-2 text-sm text-tenue">
          Guardar deja constancia de una inyección real. Elegir una pauta solo
          rellena el formulario.
        </p>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Insulina</legend>
        <div className="grid grid-cols-2 gap-2">
          {["Lyumjev", "Tresiba"].map((t) => (
            <label key={t} className="cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t}
                checked={tipo === t}
                onChange={() => {
                  setTipo(t);
                  setUnits("");
                }}
                className="peer sr-only"
              />
              <span className="flex min-h-16 flex-col justify-center rounded-xl border border-borde px-4 peer-checked:border-acento peer-checked:bg-acento/10 peer-focus-visible:ring-2 peer-focus-visible:ring-acento">
                <span className="font-semibold">{t}</span>
                <span className="text-xs text-tenue">
                  {t === "Lyumjev" ? "Ultrarrápida" : "Basal"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {pauta && (
        <div>
          <p className="mb-2 text-xs text-tenue">
            Pauta vigente · toca para copiar al campo
          </p>
          <div className="flex flex-wrap gap-2">
            {(tipo === "Lyumjev"
              ? ["Desayuno", "Comida", "Cena"].map((k) => [k, pauta.rapid[k]])
              : [["Antes de dormir", pauta.basal.units]]
            ).map(([k, v]) => (
              <button
                type="button"
                key={k}
                onClick={() => setUnits(String(v))}
                className="min-h-12 rounded-xl border border-borde px-3 text-sm"
              >
                {k} <strong>{v} U</strong>
              </button>
            ))}
          </div>
          {tipo === "Tresiba" && (
            <p className="mt-2 text-sm text-tenue">{pauta.basal.timing}</p>
          )}
        </div>
      )}
      <Campo etiqueta="Unidades realmente administradas" hint="U">
        <Entrada
          name="units"
          type="number"
          inputMode="decimal"
          min="0.5"
          max="100"
          step="any"
          required
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          placeholder="Escribe las unidades"
          className="font-mono text-3xl"
        />
      </Campo>
      <HoraOpcional />
      <label className="flex min-h-12 items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="administered"
          value="yes"
          required
          className="mt-1 size-5 shrink-0 accent-acento"
        />
        Confirmo que esta dosis ya fue administrada. No estoy registrando una
        intención.
      </label>
      <Mensaje estado={estado} />
      <BotonGuardar>Guardar dosis administrada</BotonGuardar>
    </form>
  );
}
