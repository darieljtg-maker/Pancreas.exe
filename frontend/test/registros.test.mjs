import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { calcularPlato } from "../lib/nutricion.mjs";
import { TIPOS_COMIDA } from "../lib/pauta.mjs";
const catalogo = [
  {
    id: 1,
    name: "Synthetic food",
    group: "carbohidrato",
    per100g: { carbs: 25, protein: 5, fat: 2, kcal: 138, fiber: 0 },
    url: "https://example.test/food/1",
  },
];
async function acciones(sesion = true) {
  const calls = [],
    guardados = new Map();
  class Reloj extends Date {
    constructor(...args) {
      super(...(args.length ? args : ["2026-01-01T18:00:00Z"]));
    }
  }
  const context = vm.createContext({ console, Date: Reloj, Intl });
  const mocks = {
    "next/cache": { revalidatePath: () => {} },
    "next/headers": {
      cookies: async () => ({ get: () => ({ value: "synthetic" }) }),
    },
    "@/lib/auth": { COOKIE_SESION: "test", tokenValido: () => sesion },
    "@/lib/queries": { getPacienteId: async () => "synthetic-patient" },
    "@/lib/pauta.mjs": { TIPOS_COMIDA },
    "@/lib/nutricion.mjs": { calcularPlato },
    "@/lib/alimentos.json": { default: catalogo },
    "@/lib/db": {
      TZ: "America/Mexico_City",
      query: async (sql, params) => {
        calls.push({ sql, params });
        const id = sql.includes("INSERT INTO meals")
          ? "meal:" + params[6]
          : "insulin:" + params[3];
        if (guardados.has(id)) return { rowCount: 0, rows: [] };
        guardados.set(id, params);
        return { rowCount: 1, rows: [{ id: 1 }] };
      },
    },
  };
  const mod = new vm.SourceTextModule(
    await fs.readFile(new URL("../app/actions.js", import.meta.url), "utf8"),
    { context },
  );
  await mod.link((name) => {
    const mock = mocks[name];
    if (!mock) throw new Error(name);
    return new vm.SyntheticModule(
      Object.keys(mock),
      function () {
        for (const [k, v] of Object.entries(mock)) this.setExport(k, v);
      },
      { context },
    );
  });
  await mod.evaluate();
  return { mod: mod.namespace, calls, guardados };
}
function datos(extra = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    request_id: "10000000-0000-0000-0000-000000000000",
    ...extra,
  }))
    f.set(k, String(v));
  return f;
}
test("ningún registro escribe sin sesión, aunque se invoque la Server Action directamente", async () => {
  const a = await acciones(false);
  assert.equal(
    (
      await a.mod.registrarInsulina(
        null,
        datos({ type: "Lyumjev", units: 4, administered: "yes" }),
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await a.mod.registrarComida(
        null,
        datos({ meal_type: "Comida", description: "test", carbs_grams: 20 }),
      )
    ).ok,
    false,
  );
  assert.equal(a.calls.length, 0);
});
test("no guarda una intención de inyección, dosis vacías, imposibles o futuras", async () => {
  const a = await acciones();
  for (const fields of [
    { type: "Lyumjev", units: 4 },
    { type: "Lyumjev", units: "", administered: "yes" },
    { type: "Tresiba", units: -1, administered: "yes" },
    { type: "Lyumjev", units: 4, hora: "23:59", administered: "yes" },
  ])
    assert.equal(
      (await a.mod.registrarInsulina(null, datos(fields))).ok,
      false,
    );
  assert.equal(a.calls.length, 0);
});
test("un reintento con la misma clave no crea una segunda dosis", async () => {
  const a = await acciones(),
    f = datos({ type: "Lyumjev", units: 4, administered: "yes" });
  assert.equal((await a.mod.registrarInsulina(null, f)).ok, true);
  const second = await a.mod.registrarInsulina(null, f);
  assert.match(second.mensaje, /No se duplicó/);
  assert.equal(a.guardados.size, 1);
});
test("recalcula los nutrientes desde el catálogo y no registra insulina al guardar comida", async () => {
  const a = await acciones();
  const f = datos({
    meal_type: "Comida",
    description: "Synthetic food 200 g",
    carbs_grams: 999,
    ingredients: JSON.stringify([{ id: 1, grams: 200, carbs: 999 }]),
  });
  assert.equal((await a.mod.registrarComida(null, f)).ok, true);
  assert.equal(a.calls[0].params[3], 50);
  assert.equal(JSON.parse(a.calls[0].params[5]).totals.protein, 10);
  assert.equal(a.calls.filter((c) => c.sql.includes("insulin_logs")).length, 0);
});
