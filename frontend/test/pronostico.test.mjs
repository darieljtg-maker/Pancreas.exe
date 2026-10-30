import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { validarCurvaPronostico } from '../lib/pronostico.mjs';

const AHORA = Date.parse('2026-10-30T17:00:00Z');
const minuto = 60000;
const lectura = (edad) => ({ timestamp: new Date(AHORA - edad * minuto).toISOString(), glucose_value: 120, trend_arrow: 'Flat' });

test('no presenta ausencia o escasez de datos como estabilidad', () => {
  for (const lecturas of [[], [lectura(1)], [lectura(5), lectura(1)]]) {
    assert.equal(validarCurvaPronostico(lecturas, AHORA).ok, false);
  }
});

test('rechaza la última medición antigua aunque haya muchas filas', () => {
  assert.equal(validarCurvaPronostico([lectura(1000), lectura(900), lectura(16)], AHORA).ok, false);
});

test('rechaza fechas inválidas y fechas futuras incompatibles con el reloj', () => {
  for (const timestamp of ['fecha-inválida', '2026-10-30T17:06:00Z']) {
    assert.equal(validarCurvaPronostico([lectura(10), lectura(5), { timestamp }], AHORA).ok, false);
  }
});

test('una nueva lectura aislada no convierte el historial viejo en una curva reciente', () => {
  assert.equal(validarCurvaPronostico([lectura(1000), lectura(900), lectura(1)], AHORA).ok, false);
});

test('solo incluye la última hora y admite el límite exacto de 15 minutos', () => {
  const result = validarCurvaPronostico([lectura(1000), lectura(60), lectura(30), lectura(15)], AHORA);
  assert.equal(result.ok, true);
  assert.deepEqual(result.lecturas, [lectura(60), lectura(30), lectura(15)]);
});

async function cargarAccion(lecturas, { duranteRespuesta } = {}) {
  let reloj = AHORA;
  let llamadas = 0;
  class Reloj extends Date { static now() { return reloj; } }
  const context = vm.createContext({ Date: Reloj, console, process: { env: { GEMINI_API_KEY: 'synthetic-test-key' } } });
  const [source, helperSource] = await Promise.all([
    fs.readFile(new URL('../app/ai-actions.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../lib/pronostico.mjs', import.meta.url), 'utf8'),
  ]);
  const helper = new vm.SourceTextModule(helperSource, { context });
  const mocks = {
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'synthetic-session' }) }) },
    '@google/genai': {
      Type: { OBJECT: 'object', ARRAY: 'array', STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean' },
      GoogleGenAI: class { constructor() { this.models = { generateContent: async () => {
        llamadas++;
        if (duranteRespuesta) reloj = duranteRespuesta;
        return { text: 'Estable' };
      } }; } },
    },
    '@/lib/auth': { COOKIE_SESION: 'test', tokenValido: () => true },
    '@/lib/queries': { getContextoVigilante: async () => ({ lecturas, ultimaComida: null, insulinaReciente: [] }), getContextoSemanal: async () => ({}) },
    '@/lib/glucosa': { hora: () => 'test', fechaLarga: () => 'test' },
    '@/lib/menus': { normalizarTendencia: () => ({ glifo: '→', texto: 'Estable' }), CLASIFICACIONES_IG: [] },
    '@/lib/calculosNutricionales': { calcularUGP: () => 0 },
  };
  const accion = new vm.SourceTextModule(source, { context });
  await accion.link((specifier) => {
    if (specifier === '@/lib/pronostico.mjs') return helper;
    const mock = mocks[specifier];
    if (!mock) throw new Error(`Importación sin simulación: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(mock), function () {
      for (const [name, value] of Object.entries(mock)) this.setExport(name, value);
    }, { context });
  });
  await accion.evaluate();
  return { ejecutar: () => accion.namespace.pronosticoCorto(), llamadas: () => llamadas, avanzar: (valor) => { reloj = valor; } };
}

test('la acción no consulta al proveedor con la medición de 11 horas observada', async () => {
  const accion = await cargarAccion([lectura(690), lectura(685), lectura(680)]);
  const result = await accion.ejecutar();
  assert.equal(result.ok, false);
  assert.match(result.mensaje, /15 minutos/);
  assert.equal(accion.llamadas(), 0);
});

test('la acción mantiene el pronóstico y su caché cuando la curva es reciente', async () => {
  const accion = await cargarAccion([lectura(11), lectura(6), lectura(1)]);
  assert.equal((await accion.ejecutar()).ok, true);
  assert.equal((await accion.ejecutar()).deCache, true);
  assert.equal(accion.llamadas(), 1);
});

test('una entrada de caché caduca aunque el timestamp siga siendo el mismo', async () => {
  const accion = await cargarAccion([lectura(11), lectura(6), lectura(1)]);
  assert.equal((await accion.ejecutar()).ok, true);
  accion.avanzar(AHORA + 16 * minuto);
  assert.equal((await accion.ejecutar()).ok, false);
  assert.equal(accion.llamadas(), 1);
});

test('descarta una respuesta del proveedor que llegó después de caducar los datos', async () => {
  const accion = await cargarAccion([lectura(25), lectura(20), lectura(14)], { duranteRespuesta: AHORA + 2 * minuto });
  assert.equal((await accion.ejecutar()).ok, false);
  assert.equal(accion.llamadas(), 1);
});
