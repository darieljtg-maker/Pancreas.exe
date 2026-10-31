import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { validarCurvaPronostico } from "../lib/pronostico.mjs";
import { estadoSensor, referenciaCarbos, TIPOS_COMIDA } from "../lib/pauta.mjs";
import { calcularPlato, ajustarAlimento } from "../lib/nutricion.mjs";

const AHORA = Date.parse("2026-10-30T17:00:00Z");
const minuto = 60000;
const lectura = (edad) => ({
  timestamp: new Date(AHORA - edad * minuto).toISOString(),
  glucose_value: 120,
  trend_arrow: "Flat",
});

test("no presenta ausencia o escasez de datos como estabilidad", () => {
  for (const lecturas of [[], [lectura(1)], [lectura(5), lectura(1)]]) {
    assert.equal(validarCurvaPronostico(lecturas, AHORA).ok, false);
  }
});

test("rechaza la última medición antigua aunque haya muchas filas", () => {
  assert.equal(
    validarCurvaPronostico([lectura(1000), lectura(900), lectura(16)], AHORA)
      .ok,
    false,
  );
});

test("rechaza fechas inválidas y fechas futuras incompatibles con el reloj", () => {
  for (const timestamp of ["fecha-inválida", "2026-10-30T17:06:00Z"]) {
    assert.equal(
      validarCurvaPronostico([lectura(10), lectura(5), { timestamp }], AHORA)
        .ok,
      false,
    );
  }
});

test("una nueva lectura aislada no convierte el historial viejo en una curva reciente", () => {
  assert.equal(
    validarCurvaPronostico([lectura(1000), lectura(900), lectura(1)], AHORA).ok,
    false,
  );
});

test("solo incluye la última hora y admite el límite exacto de 15 minutos", () => {
  const result = validarCurvaPronostico(
    [lectura(1000), lectura(60), lectura(30), lectura(15)],
    AHORA,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.lecturas, [lectura(60), lectura(30), lectura(15)]);
});

async function cargarAccion(
  lecturas,
  {
    duranteRespuesta,
    pauta = null,
    respuestaPlato = null,
    catalogoPlato = [],
    autorizado = true,
  } = {},
) {
  let reloj = AHORA;
  let llamadas = 0;
  class Reloj extends Date {
    static now() {
      return reloj;
    }
  }
  const context = vm.createContext({
    Date: Reloj,
    console,
    process: { env: { GEMINI_API_KEY: "synthetic-test-key" } },
  });
  const [source, helperSource] = await Promise.all([
    fs.readFile(new URL("../app/ai-actions.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../lib/pronostico.mjs", import.meta.url), "utf8"),
  ]);
  const helper = new vm.SourceTextModule(helperSource, { context });
  const mocks = {
    "next/headers": {
      cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }),
    },
    "@google/genai": {
      Type: {
        OBJECT: "object",
        ARRAY: "array",
        STRING: "string",
        NUMBER: "number",
        BOOLEAN: "boolean",
      },
      GoogleGenAI: class {
        constructor() {
          this.models = {
            generateContent: async () => {
              llamadas++;
              if (duranteRespuesta) reloj = duranteRespuesta;
              return {
                text: respuestaPlato
                  ? JSON.stringify(respuestaPlato)
                  : "Estable",
              };
            },
          };
        }
      },
    },
    "@/lib/auth": { COOKIE_SESION: "test", tokenValido: () => autorizado },
    "@/lib/queries": {
      getContextoVigilante: async () => ({
        lecturas,
        ultimaComida: null,
        insulinaReciente: [],
      }),
      getContextoSemanal: async () => ({}),
      getUltimaLectura: async () => lecturas.at(-1),
    },
    "@/lib/pauta": { getPauta: async () => pauta },
    "@/lib/pauta.mjs": {
      estadoSensor: (l) => estadoSensor(l, reloj),
      referenciaCarbos,
      TIPOS_COMIDA,
    },
    "@/lib/nutricion.mjs": { calcularPlato, ajustarAlimento },
    "@/lib/alimentos.json": { default: catalogoPlato },
    "@/lib/glucosa": { hora: () => "test", fechaLarga: () => "test" },
    "@/lib/menus": {
      normalizarTendencia: () => ({ glifo: "→", texto: "Estable" }),
      CLASIFICACIONES_IG: [],
    },
    "@/lib/calculosNutricionales": { calcularUGP: () => 0 },
  };
  const accion = new vm.SourceTextModule(source, { context });
  await accion.link((specifier) => {
    if (specifier === "@/lib/pronostico.mjs") return helper;
    const mock = mocks[specifier];
    if (!mock) throw new Error(`Importación sin simulación: ${specifier}`);
    return new vm.SyntheticModule(
      Object.keys(mock),
      function () {
        for (const [name, value] of Object.entries(mock))
          this.setExport(name, value);
      },
      { context },
    );
  });
  await accion.evaluate();
  return {
    ejecutar: () => accion.namespace.pronosticoCorto(),
    sugerir: (datos) => accion.namespace.sugerirPlato(datos),
    llamadas: () => llamadas,
    avanzar: (valor) => {
      reloj = valor;
    },
  };
}

test("la acción no consulta al proveedor con la medición de 11 horas observada", async () => {
  const accion = await cargarAccion([lectura(690), lectura(685), lectura(680)]);
  const result = await accion.ejecutar();
  assert.equal(result.ok, false);
  assert.match(result.mensaje, /15 minutos/);
  assert.equal(accion.llamadas(), 0);
});

const pautaSintetica = {
  mode: "fixed",
  rapid: { Desayuno: 4, Comida: 5, Cena: 6 },
  basal: { units: 10 },
  icr: 10,
  isf: 50,
};
const catalogoSintetico = [
  {
    id: 1,
    group: "carbohidrato",
    per100g: { carbs: 25, protein: 4, fat: 1, kcal: 130, fiber: 0 },
  },
  {
    id: 2,
    group: "verdura",
    per100g: { carbs: 5, protein: 2, fat: 0, kcal: 30, fiber: 2 },
  },
  {
    id: 3,
    group: "proteína",
    per100g: { carbs: 0, protein: 20, fat: 2, kcal: 100, fiber: 0 },
  },
];
const respuestaSintetica = {
  foods: [
    { id: 1, grams: 100 },
    { id: 2, grams: 100 },
    { id: 3, grams: 100 },
  ],
  adjustableId: 1,
  unavailable: [],
  totals: { carbs: 999 },
};
const entradaSintetica = {
  comida: "Desayuno",
  deseo: "Alimentos sintéticos de prueba",
};
test("el asistente devuelve porciones con nutrientes del servidor y no acepta totales del modelo", async () => {
  const a = await cargarAccion([lectura(1)], {
    pauta: pautaSintetica,
    catalogoPlato: catalogoSintetico,
    respuestaPlato: respuestaSintetica,
  });
  const r = await a.sugerir(entradaSintetica);
  assert.equal(r.ok, true);
  assert.equal(r.modo, "pauta");
  assert.equal(r.totals.carbs, 40);
  assert.equal(r.foods[0].grams, 140);
  assert.equal(Object.hasOwn(r, "dosis"), false);
});
test("el asistente mantiene el conteo con glucosa alta, baja, antigua o futura sin adaptar el plato a la dosis", async () => {
  for (const [valor, edad] of [
    [65, 1],
    [181, 1],
    [250, 1],
    [300, 1],
    [600, 1],
    [120, 20],
    [120, -10],
  ]) {
    const a = await cargarAccion([{ ...lectura(edad), glucose_value: valor }], {
      pauta: pautaSintetica,
      catalogoPlato: catalogoSintetico,
      respuestaPlato: respuestaSintetica,
    });
    const r = await a.sugerir({ ...entradaSintetica, glucosa: 120 });
    assert.equal(r.ok, true);
    assert.equal(r.modo, "conteo");
    assert.equal(r.referencia, null);
    assert.deepEqual(
      Array.from(r.foods, (f) => f.grams),
      [100, 100, 100],
    );
    assert.equal(r.totals.carbs, 30);
    assert.equal(Object.hasOwn(r, "dosis"), false);
    assert.equal(a.llamadas(), 1);
  }
});

test("la consulta nutricional funciona sin sensor, sin pauta y para colaciones", async () => {
  for (const [lecturas, pauta, comida] of [
    [[], pautaSintetica, "Desayuno"],
    [[lectura(1)], null, "Desayuno"],
    [[lectura(1)], pautaSintetica, "Colación"],
  ]) {
    const a = await cargarAccion(lecturas, {
      pauta,
      catalogoPlato: catalogoSintetico,
      respuestaPlato: respuestaSintetica,
    });
    const r = await a.sugerir({ ...entradaSintetica, comida });
    assert.equal(r.ok, true);
    assert.equal(r.modo, "conteo");
    assert.equal(r.totals.carbs, 30);
    assert.equal(r.referencia, null);
  }
});

test("la consulta nutricional sigue rechazando sesiones inválidas y alimentos desconocidos", async () => {
  const sinSesion = await cargarAccion([lectura(1)], { autorizado: false });
  assert.equal((await sinSesion.sugerir(entradaSintetica)).ok, false);
  assert.equal(sinSesion.llamadas(), 0);
  for (const respuesta of [
    { foods: [{ id: 999, grams: 100 }], unavailable: [] },
    { ...respuestaSintetica, unavailable: ["alimento no verificado"] },
  ]) {
    const a = await cargarAccion([{ ...lectura(1), glucose_value: 300 }], {
      pauta: pautaSintetica,
      catalogoPlato: catalogoSintetico,
      respuestaPlato: respuesta,
    });
    assert.equal((await a.sugerir(entradaSintetica)).ok, false);
  }
});

test("el asistente vuelve a fichas por 100 g si el sensor caduca durante la llamada", async () => {
  const a = await cargarAccion([lectura(1)], {
    pauta: pautaSintetica,
    catalogoPlato: catalogoSintetico,
    respuestaPlato: respuestaSintetica,
    duranteRespuesta: AHORA + 20 * minuto,
  });
  const r = await a.sugerir(entradaSintetica);
  assert.equal(r.ok, true);
  assert.equal(r.modo, "conteo");
  assert.equal(r.sensorTimestamp, null);
  assert.equal(r.totals.carbs, 30);
  assert.equal(r.referencia, null);
  assert.equal(a.llamadas(), 1);
});

test("la acción mantiene el pronóstico y su caché cuando la curva es reciente", async () => {
  const accion = await cargarAccion([lectura(11), lectura(6), lectura(1)]);
  assert.equal((await accion.ejecutar()).ok, true);
  assert.equal((await accion.ejecutar()).deCache, true);
  assert.equal(accion.llamadas(), 1);
});

test("una entrada de caché caduca aunque el timestamp siga siendo el mismo", async () => {
  const accion = await cargarAccion([lectura(11), lectura(6), lectura(1)]);
  assert.equal((await accion.ejecutar()).ok, true);
  accion.avanzar(AHORA + 16 * minuto);
  assert.equal((await accion.ejecutar()).ok, false);
  assert.equal(accion.llamadas(), 1);
});

test("descarta una respuesta del proveedor que llegó después de caducar los datos", async () => {
  const accion = await cargarAccion([lectura(25), lectura(20), lectura(14)], {
    duranteRespuesta: AHORA + 2 * minuto,
  });
  assert.equal((await accion.ejecutar()).ok, false);
  assert.equal(accion.llamadas(), 1);
});
