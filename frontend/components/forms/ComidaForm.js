"use client";
import { useActionState, useRef, useState } from "react";
import { Scale, ChevronDown } from "lucide-react";
import { registrarComida } from "@/app/actions";
import { TIPOS_COMIDA } from "@/lib/pauta.mjs";
import PlatoBuilder from "@/components/PlatoBuilder";
import {
  OpcionBoton,
  Campo,
  Entrada,
  AreaTexto,
  BotonGuardar,
  Mensaje,
  HoraOpcional,
} from "./Campos";
export default function ComidaForm({ lectura, pauta, catalogo }) {
  const [tipo, setTipo] = useState("Desayuno");
  const [description, setDescription] = useState("");
  const [carbs, setCarbs] = useState("");
  const [conteo, setConteo] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const formRef = useRef(null);
  const requestRef = useRef(null);
  const [estado, accion] = useActionState(async (prev, fd) => {
    requestRef.current ||= crypto.randomUUID();
    fd.set("request_id", requestRef.current);
    const r = await registrarComida(prev, fd);
    if (r.ok) {
      requestRef.current = null;
      setDescription("");
      setCarbs("");
      setConteo(null);
      setAbierto(false);
      formRef.current?.reset();
    }
    return r;
  }, null);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">Comida y porciones</p>
        <h2 className="mt-1 text-xl font-semibold">Prepara, pesa y registra</h2>
        <p className="mt-2 text-sm text-tenue">
          Cuenta los alimentos que comerá; guarda después lo que realmente
          consumió. La inyección se registra por separado.
        </p>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Momento de la comida
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIPOS_COMIDA.map((t) => (
            <OpcionBoton
              key={t}
              name="tipo-visible"
              value={t}
              checked={tipo === t}
              onChange={() => {
                setTipo(t);
                setConteo(null);
                setDescription("");
                setCarbs("");
              }}
            >
              {t}
            </OpcionBoton>
          ))}
        </div>
      </fieldset>
      <div className="rounded-2xl border border-borde p-4">
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls="asistente-comida"
          onClick={() => setAbierto((v) => !v)}
          className="flex min-h-12 w-full items-center gap-3 text-left font-semibold"
        >
          <Scale size={20} className="text-acento" aria-hidden="true" />
          Contar alimentos y consultar IA
          <ChevronDown size={18} className="ml-auto" aria-hidden="true" />
        </button>
        {abierto && (
          <div
            id="asistente-comida"
            className="mt-4 border-t border-borde pt-5"
          >
            <PlatoBuilder
              key={tipo}
              comida={tipo}
              lectura={lectura}
              pauta={pauta}
              catalogo={catalogo}
              onUsar={(r) => {
                setConteo(r);
                setDescription(r.description);
                setCarbs(String(r.nutrition.carbs));
                setAbierto(false);
              }}
            />
          </div>
        )}
      </div>
      <form ref={formRef} action={accion} className="flex flex-col gap-4">
        <input type="hidden" name="meal_type" value={tipo} />
        <input
          type="hidden"
          name="ingredients"
          value={conteo ? JSON.stringify(conteo.ingredients) : ""}
        />
        {conteo && (
          <div role="status" className="aviso text-acento">
            <p>
              Conteo con alimentos y pesos de USDA. El servidor volverá a
              calcularlo al guardar.
            </p>
            <button
              type="button"
              onClick={() => setConteo(null)}
              className="mt-2 min-h-11 underline underline-offset-4"
            >
              Cambiar a registro manual
            </button>
          </div>
        )}
        <Campo etiqueta="¿Qué comió?">
          <AreaTexto
            name="description"
            required
            maxLength={1000}
            value={description}
            readOnly={Boolean(conteo)}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe los alimentos y las cantidades reales"
          />
        </Campo>
        <Campo etiqueta="Carbohidratos totales" hint="g CH">
          <Entrada
            name="carbs_grams"
            type="number"
            inputMode="decimal"
            min="0"
            max="500"
            step="any"
            required
            value={carbs}
            readOnly={Boolean(conteo)}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="Según el conteo o la etiqueta"
          />
        </Campo>
        {!conteo && (
          <details className="rounded-xl border border-borde p-4">
            <summary className="cursor-pointer text-sm">
              Añadir proteína, grasa y energía de la etiqueta
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["protein_grams", "Proteína", "g", 300],
                ["fat_grams", "Grasa", "g", 300],
                ["kcal", "Energía", "kcal", 3000],
              ].map(([name, label, u, max]) => (
                <Campo key={name} etiqueta={label} hint={u}>
                  <Entrada
                    name={name}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={max}
                    step="any"
                    placeholder="Opcional"
                  />
                </Campo>
              ))}
            </div>
          </details>
        )}
        <HoraOpcional />
        <Mensaje estado={estado} />
        <BotonGuardar>Guardar comida consumida</BotonGuardar>
      </form>
    </div>
  );
}
