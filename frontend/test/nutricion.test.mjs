import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  calcularPlato,
  ajustarAlimento,
  nutrientesPorPeso,
} from "../lib/nutricion.mjs";
import {
  estadoSensor,
  referenciaCarbos,
  validarPauta,
  edadEnFecha,
  repartoDeDosisFija,
} from "../lib/pauta.mjs";
const catalogo = JSON.parse(
  await fs.readFile(new URL("../lib/alimentos.json", import.meta.url), "utf8"),
);
const simple = [
  {
    id: 1,
    name: "Synthetic carbohydrate",
    group: "carbohidrato",
    per100g: { carbs: 25, protein: 4, fat: 1, kcal: 130, fiber: 2 },
  },
  {
    id: 2,
    name: "Synthetic vegetable",
    group: "verdura",
    per100g: { carbs: 5, protein: 2, fat: 0, kcal: 30, fiber: 3 },
  },
  {
    id: 3,
    name: "Synthetic protein",
    group: "proteína",
    per100g: { carbs: 0, protein: 20, fat: 2, kcal: 100, fiber: 0 },
  },
];
const syntheticPlan = {
  mode: "fixed",
  rapid: { Desayuno: 4, Comida: 5, Cena: 6 },
  basal: { units: 10 },
  icr: 10,
  isf: 50,
};

test("el reparto de dosis no se activa con un rango general o un objetivo faltante", () => {
  const contexto = {
    lectura: { glucose_value: 200, timestamp: "2026-01-01T12:00:00Z" },
    registrosCompletosConfirmados: true,
  };
  assert.equal(
    repartoDeDosisFija(
      syntheticPlan,
      "Desayuno",
      contexto,
      Date.parse("2026-01-01T12:01:00Z"),
    ).ok,
    false,
  );
});
test("un protocolo completo conserva la dosis fija y rechaza insulina reciente o historia incompleta", () => {
  const ahora = Date.parse("2026-01-01T12:01:00Z");
  const pauta = {
    ...syntheticPlan,
    carbAdjustment: {
      enabled: true,
      reserveInFixedDoseConfirmed: true,
      mealTargets: { Desayuno: 150 },
      minHoursSinceRapid: 4,
      maxGlucoseForAdjustment: 350,
    },
  };
  const contexto = {
    lectura: { glucose_value: 250, timestamp: "2026-01-01T12:00:00Z" },
    registrosCompletosConfirmados: true,
  };
  const r = repartoDeDosisFija(pauta, "Desayuno", contexto, ahora);
  assert.equal(r.ok, true);
  assert.equal(r.unidadesTotales, 4);
  assert.equal(r.unidadesReservadas, 2);
  assert.equal(r.carbohidratosReferencia, 20);
  assert.equal(
    repartoDeDosisFija(
      pauta,
      "Desayuno",
      { ...contexto, registrosCompletosConfirmados: false },
      ahora,
    ).ok,
    false,
  );
  assert.equal(
    repartoDeDosisFija(
      pauta,
      "Desayuno",
      { ...contexto, ultimaRapida: "2026-01-01T11:00:00Z" },
      ahora,
    ).ok,
    false,
  );
});
test("el peso del alimento no se confunde con carbohidratos y se cuentan proteína y grasa", () => {
  const r = calcularPlato(
    [
      { id: 1, grams: 200 },
      { id: 2, grams: 50 },
      { id: 3, grams: 100 },
    ],
    simple,
  );
  assert.equal(r.totals.carbs, 52.5);
  assert.equal(r.totals.protein, 29);
  assert.equal(r.totals.fat, 4);
  assert.equal(r.totals.kcal, 375);
  assert.equal(r.hasProtein, true);
  assert.equal(r.hasVegetable, true);
});
test("no acepta macros inventados por el modelo ni ids desconocidos, duplicados o pesos imposibles", () => {
  assert.equal(
    calcularPlato([{ id: 1, grams: 100, carbs: 999 }], simple).totals.carbs,
    25,
  );
  for (const foods of [
    [{ id: 999, grams: 100 }],
    [
      { id: 1, grams: 100 },
      { id: 1, grams: 50 },
    ],
    [{ id: 1, grams: NaN }],
    [{ id: 1, grams: -1 }],
    [{ id: 1, grams: 2001 }],
  ])
    assert.throws(() => calcularPlato(foods, simple));
});
test("ajusta solo el ingrediente elegido, descontando CH de todos los demás alimentos", () => {
  const r = ajustarAlimento(
    [
      { id: 1, grams: 50 },
      { id: 2, grams: 100 },
      { id: 3, grams: 100 },
    ],
    1,
    40,
    simple,
  );
  assert.equal(r[0].grams, 140);
  assert.equal(r[1].grams, 100);
  assert.equal(calcularPlato(r, simple).totals.carbs, 40);
});
test("un resultado negativo no se convierte en cero comida y una ración absurda no se entrega", () => {
  assert.throws(() =>
    ajustarAlimento(
      [
        { id: 1, grams: 100 },
        { id: 2, grams: 200 },
      ],
      1,
      5,
      simple,
    ),
  );
  assert.throws(() => ajustarAlimento([{ id: 1, grams: 100 }], 1, 290, simple));
});
test("la referencia no elige glucosa objetivo ni cambia dosis por tendencias, UGP o alba", () => {
  assert.equal(referenciaCarbos(syntheticPlan, "Desayuno"), 40);
  assert.equal(referenciaCarbos(syntheticPlan, "Colación"), null);
  assert.equal(validarPauta({ ...syntheticPlan, icr: 0 }), null);
  assert.equal(referenciaCarbos(null, "Comida"), null);
});
test("protege lecturas antiguas, futuras, bajas y altas, con el límite exacto de 15 minutos", () => {
  const ahora = Date.parse("2026-01-01T12:00:00Z");
  const l = (g, m) => ({
    glucose_value: g,
    timestamp: new Date(ahora - m * 60000).toISOString(),
  });
  assert.equal(estadoSensor(l(120, 15), ahora).estado, "reciente");
  assert.equal(estadoSensor(l(120, 15.1), ahora).estado, "antigua");
  assert.equal(estadoSensor(l(120, -6), ahora).estado, "sin-datos");
  assert.equal(estadoSensor(l(69, 1), ahora).estado, "baja");
  assert.equal(estadoSensor(l(250, 1), ahora).estado, "alta");
  assert.equal(estadoSensor(l(249, 1), ahora).estado, "fuera-rango");
  assert.equal(estadoSensor(l(180, 1), ahora).estado, "reciente");
});
test("la edad cambia en el cumpleaños, no al cambiar de año", () => {
  assert.equal(edadEnFecha("2010-06-20", "2025-06-19"), 14);
  assert.equal(edadEnFecha("2010-06-20", "2025-06-20"), 15);
});
test("todos los alimentos tienen valores trazables y no faltan nutrientes básicos", () => {
  assert.ok(catalogo.length >= 50);
  const ids = new Set();
  for (const f of catalogo) {
    assert.equal(ids.has(f.id), false);
    ids.add(f.id);
    assert.ok(f.url.includes("/" + f.id + "/"));
    assert.match(f.source, /USDA/);
    assert.ok(f.preparation);
    const n = nutrientesPorPeso(f, 100);
    for (const key of ["carbs", "protein", "fat", "kcal"])
      assert.equal(n[key], f.per100g[key]);
  }
});
