"use client";
import { useState, useTransition } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Scale,
  Check,
  ExternalLink,
} from "lucide-react";
import { sugerirPlato } from "@/app/ai-actions";
import { calcularPlato } from "@/lib/nutricion.mjs";
import { estadoSensor, referenciaCarbos } from "@/lib/pauta.mjs";

const normalizar = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function PlatoBuilder({
  catalogo,
  pauta,
  lectura,
  comida,
  onUsar,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [ingredientes, setIngredientes] = useState([]);
  const [deseo, setDeseo] = useState("");
  const [restricciones, setRestricciones] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [modoRespuesta, setModoRespuesta] = useState(null);
  const [pendiente, iniciar] = useTransition();
  const [revisado, setRevisado] = useState(false);
  const referencia = referenciaCarbos(pauta, comida);
  const sensor = estadoSensor(lectura);
  const disponibles = catalogo
    .filter((f) => normalizar(f.name).includes(normalizar(busqueda)))
    .slice(0, 8);
  let plato = null;
  let error = "";
  if (ingredientes.length) {
    try {
      plato = calcularPlato(ingredientes, catalogo);
    } catch (e) {
      error = e.message;
    }
  }
  function cambiar(lista) {
    setIngredientes(lista);
    setRevisado(false);
  }
  function agregar(id) {
    if (ingredientes.some((f) => f.id === id) || ingredientes.length >= 12)
      return;
    cambiar([...ingredientes, { id, grams: 100 }]);
    setBusqueda("");
  }
  function sugerir() {
    setMensaje(null);
    setRevisado(false);
    iniciar(async () => {
      try {
        const r = await sugerirPlato({ comida, deseo, restricciones });
        if (r.ok) {
          setModoRespuesta(r.modo);
          cambiar(r.foods.map((f) => ({ id: f.id, grams: f.grams })));
          setMensaje({ ok: true, texto: r.mensaje });
        } else setMensaje({ ok: false, texto: r.mensaje });
      } catch {
        setMensaje({
          ok: false,
          texto:
            "No se pudo conectar con el asistente. El conteo manual sigue disponible.",
        });
      }
    });
  }
  return (
    <section
      className="flex flex-col gap-5"
      aria-label="Contar alimentos y preparar porciones"
    >
      <div className="rounded-2xl border border-acento/30 bg-acento/5 p-4">
        <div className="flex items-center gap-2 text-acento">
          <Sparkles size={18} aria-hidden="true" />
          <h3 className="font-semibold">¿Qué le gustaría comer?</h3>
        </div>
        <p className="mt-2 text-sm text-tenue">
          Consulta alimentos con cualquier lectura de glucosa. Gemini los
          identifica en las tablas de USDA; tú revisas la preparación y el peso.
        </p>
        <label className="mt-4 block text-sm font-medium" htmlFor="deseo">
          Alimentos que desea ingerir
        </label>
        <textarea
          id="deseo"
          value={deseo}
          onChange={(e) => setDeseo(e.target.value)}
          maxLength={500}
          rows={2}
          className="campo mt-2"
          placeholder="Por ejemplo: pollo, arroz integral, brócoli y aguacate"
        />
        <label
          className="mt-3 block text-sm font-medium"
          htmlFor="restricciones"
        >
          Alergias o alimentos que debemos evitar
        </label>
        <input
          id="restricciones"
          value={restricciones}
          onChange={(e) => setRestricciones(e.target.value)}
          maxLength={300}
          className="campo mt-2"
          placeholder="Indícalos aquí; no se presuponen alergias"
        />
        {sensor.estado !== "reciente" && (
          <p role="status" className="mt-3 text-sm text-alto">
            {sensor.mensaje} La consulta nutricional sigue disponible: usa
            valores por 100 g para comparar alimentos y cambia el peso real.
          </p>
        )}
        {!referencia && (
          <p className="mt-3 text-sm text-tenue">
            Para esta comida la IA mostrará composición por 100 g, sin ajustar
            cantidades a una dosis de insulina.
          </p>
        )}
        <button
          type="button"
          onClick={sugerir}
          disabled={pendiente || deseo.trim().length < 3}
          className="boton-secundario mt-4 w-full"
        >
          <Sparkles size={17} aria-hidden="true" />
          {pendiente ? "Consultando alimentos…" : "Consultar alimentos con IA"}
        </button>
      </div>
      {mensaje && (
        <p
          role="status"
          className={`aviso ${mensaje.ok ? "text-acento" : "text-alto"}`}
        >
          {mensaje.texto}
        </p>
      )}
      <div>
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-acento" aria-hidden="true" />
          <h3 className="font-semibold">Arma el plato con la báscula</h3>
        </div>
        <p className="mt-1 text-sm text-tenue">
          Gramos del alimento y gramos de carbohidratos son medidas diferentes.
          Revisa si se pesa crudo, cocido o escurrido.
        </p>
        <label
          className="mt-4 block text-sm font-medium"
          htmlFor="buscar-alimento"
        >
          Buscar en el catálogo verificado
        </label>
        <input
          id="buscar-alimento"
          className="campo mt-2"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Avena, tortilla, huevo, verduras…"
        />
        <div
          className="mt-2 grid gap-2 sm:grid-cols-2"
          aria-label="Alimentos disponibles"
        >
          {disponibles.map((f) => (
            <button
              key={f.id}
              type="button"
              disabled={
                ingredientes.some((i) => i.id === f.id) ||
                ingredientes.length >= 12
              }
              onClick={() => agregar(f.id)}
              className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-borde px-3 py-2 text-left text-sm disabled:opacity-40"
            >
              <span>{f.name}</span>
              <Plus
                size={16}
                className="shrink-0 text-acento"
                aria-hidden="true"
              />
            </button>
          ))}
          {!disponibles.length && (
            <p className="text-sm text-tenue">
              Sin coincidencias verificadas. Usa la etiqueta del producto en el
              registro manual; la IA no inventará su composición.
            </p>
          )}
        </div>
        <p className="mt-2 text-xs text-tenue">
          {catalogo.length} alimentos · USDA SR Legacy 04/2018 · sin azúcar
          añadida en las ideas del catálogo. Para marcas comerciales usa su
          etiqueta.
        </p>
      </div>
      {ingredientes.length > 0 && (
        <div className="flex flex-col gap-3" aria-label="Ingredientes y pesos">
          {ingredientes.map((item) => {
            const f = catalogo.find((a) => a.id === item.id);
            return (
              <div
                key={item.id}
                className="rounded-xl border border-borde bg-fondo/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{f.name}</p>
                    <p className="mt-1 text-xs text-tenue">{f.preparation}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      cambiar(ingredientes.filter((a) => a.id !== item.id))
                    }
                    aria-label={"Quitar " + f.name}
                    className="flex size-11 shrink-0 items-center justify-center text-tenue"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
                <label className="mt-2 flex items-center gap-3 text-sm">
                  <span className="min-w-20">Peso en g</span>
                  <input
                    aria-label={"Gramos de " + f.name}
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    max="2000"
                    step="0.1"
                    value={item.grams || ""}
                    onChange={(e) =>
                      cambiar(
                        ingredientes.map((a) =>
                          a.id === item.id
                            ? { ...a, grams: Number(e.target.value) }
                            : a,
                        ),
                      )
                    }
                    className="campo max-w-40 font-mono"
                  />
                </label>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex min-h-10 items-center gap-1 text-xs text-acento"
                >
                  Ver fuente y preparación{" "}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            );
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="aviso text-alto">
          {error}
        </p>
      )}
      {plato && (
        <div className="flex flex-col gap-4">
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            aria-label="Nutrientes del plato"
          >
            {[
              ["Carbohidratos", plato.totals.carbs, "g"],
              ["Proteína", plato.totals.protein, "g"],
              ["Grasa", plato.totals.fat, "g"],
              ["Energía", plato.totals.kcal, "kcal"],
            ].map(([k, v, u]) => (
              <div key={k} className="rounded-xl bg-superficie-alta p-3">
                <p className="text-xs text-tenue">{k}</p>
                <p className="mt-1 font-mono text-xl font-semibold">
                  {v}
                  <span className="ml-1 text-xs text-tenue">{u}</span>
                </p>
              </div>
            ))}
          </div>
          {referencia != null &&
            sensor.estado === "reciente" &&
            modoRespuesta !== "conteo" && (
              <p className="text-sm text-tenue">
                Referencia aritmética de la pauta: {referencia} g CH antes de
                cualquier ajuste por glucosa. No es una indicación de comer esa
                cantidad con glucosa alta.
              </p>
            )}
          {(!plato.hasVegetable || !plato.hasProtein) && (
            <p className="aviso text-tenue">
              Revisa si el plato puede incluir verduras y una fuente de
              proteína, según su tolerancia y plan nutricional.
            </p>
          )}
          <p className="text-xs leading-relaxed text-tenue">
            {plato.note} La proteína y la grasa pueden cambiar la elevación
            tardía de glucosa; aquí se cuentan, sin convertirlas en dosis extra.
          </p>
          <label className="flex min-h-12 items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={revisado}
              onChange={(e) => setRevisado(e.target.checked)}
              className="mt-1 size-5 shrink-0 accent-acento"
            />
            Revisé ingredientes, preparación, pesos y alergias. Registraré lo
            que realmente comió.
          </label>
          <button
            type="button"
            disabled={!revisado}
            onClick={() =>
              onUsar({
                ingredients: ingredientes,
                description: plato.foods
                  .map((f) => f.name + " " + f.grams + " g")
                  .join("; "),
                nutrition: plato.totals,
              })
            }
            className="boton-primario"
          >
            <Check size={18} aria-hidden="true" />
            Usar este conteo en el registro
          </button>
        </div>
      )}
    </section>
  );
}
