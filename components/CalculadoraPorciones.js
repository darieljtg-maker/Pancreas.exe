'use client';

import { useState } from 'react';
import {
  Scale, Syringe, Lock, ArrowDown, ArrowUp, Minus, ClipboardCheck, TrendingDown,
} from 'lucide-react';

import AlertaHipoglucemia from './AlertaHipoglucemia';
import {
  calcularPorcion,
  MENUS,
  TIPOS_COMIDA,
  TENDENCIAS,
  OBJETIVO,
  SENSIBILIDAD,
  UMBRAL_HIPO,
} from '@/lib/menus';

/**
 * Ingeniería inversa de carbohidratos.
 *
 * Como la dosis de Lyumjev es fija, lo que se mueve es el plato: esto calcula
 * los gramos exactos de báscula del alimento ajustable según la glucosa que
 * Gaelito trae antes de sentarse a comer.
 *
 * @param {number}   glucosaInicial   - última lectura del sensor, para prellenar
 * @param {string}   tendenciaInicial - flecha del sensor (trend_arrow)
 * @param {string}   tipoFijo         - si viene, se oculta el selector de comida
 * @param {function} onUsar           - recibe { carbos, descripcion } para el registro
 */
export default function CalculadoraPorciones({
  glucosaInicial,
  tendenciaInicial,
  tipoFijo,
  onUsar,
}) {
  const [glucosa, setGlucosa] = useState(
    glucosaInicial != null ? String(glucosaInicial) : ''
  );
  const [tendencia, setTendencia] = useState(
    TENDENCIAS.some((t) => t.id === tendenciaInicial) ? tendenciaInicial : 'Flat'
  );
  const [tipo, setTipo] = useState(tipoFijo || 'Desayuno');
  const [menu, setMenu] = useState(1);
  const [hipoCerrada, setHipoCerrada] = useState(false);

  const tipoActivo = tipoFijo || tipo;
  const valor = Number(glucosa);
  const hayValor = Number.isFinite(valor) && valor > 0;
  const esHipo = hayValor && valor < UMBRAL_HIPO;

  const r = esHipo
    ? null
    : calcularPorcion({ tipo: tipoActivo, menu, glucosa: valor, tendencia });

  const claseCampo =
    'w-full rounded-xl border border-borde bg-superficie px-4 py-3.5 text-texto placeholder:text-tenue focus:border-acento focus:outline-none focus:ring-1 focus:ring-acento';

  const IconoAjuste = !r || r.ajuste === 0 ? Minus : r.ajuste > 0 ? ArrowUp : ArrowDown;

  return (
    <div className="flex flex-col gap-4">
      {esHipo && !hipoCerrada && (
        <AlertaHipoglucemia glucosa={valor} onCerrar={() => setHipoCerrada(true)} />
      )}

      {/* ------------------------------------------------ ENTRADAS */}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Glucosa antes de comer
          <span className="ml-2 font-normal text-tenue">mg/dL</span>
        </span>
        <input
          type="number"
          inputMode="numeric"
          min="20"
          max="600"
          value={glucosa}
          onChange={(e) => {
            setGlucosa(e.target.value);
            setHipoCerrada(false);
          }}
          placeholder="120"
          className={`${claseCampo} text-center font-mono text-3xl font-bold`}
        />
      </label>

      {/* Flecha del sensor. Va pegada a la glucosa porque las dos se leen
          del mismo vistazo en el Libre antes de servir el plato. */}
      <div>
        <p className="mb-2 text-sm font-medium">
          Tendencia
          <span className="ml-2 font-normal text-tenue">flecha del sensor</span>
        </p>
        <div className="flex gap-1.5">
          {TENDENCIAS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTendencia(t.id)}
              aria-pressed={tendencia === t.id}
              aria-label={t.texto}
              title={t.texto}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${
                tendencia === t.id
                  ? 'border-acento bg-acento/15'
                  : 'border-borde bg-superficie'
              }`}
            >
              <span className="text-xl leading-none" aria-hidden="true">
                {t.glifo}
              </span>
              {t.extra > 0 && (
                <span className="text-[10px] font-semibold leading-none text-acento">
                  +{t.extra}g
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!tipoFijo && (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Tipo de comida</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={claseCampo}>
            {TIPOS_COMIDA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Menú</p>
        <div className="flex gap-2">
          {[1, 2].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMenu(n)}
              aria-pressed={menu === n}
              className={`min-h-14 flex-1 rounded-xl border text-sm font-semibold transition-colors ${
                menu === n
                  ? 'border-acento bg-acento/15 text-acento'
                  : 'border-borde bg-superficie text-tenue'
              }`}
            >
              Menú {n}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------ RESULTADO */}
      {!hayValor && (
        <p className="rounded-xl border border-dashed border-borde px-4 py-6 text-center text-sm text-tenue">
          Escribe la glucosa para calcular los gramos.
        </p>
      )}

      {esHipo && (
        <div className="rounded-xl border border-bajo/40 bg-bajo/10 px-4 py-4 text-center">
          <p className="font-semibold text-bajo">Está en hipoglucemia ({valor} mg/dL)</p>
          <p className="mt-1 text-sm text-tenue">
            No se calcula el plato: primero hay que subirlo de {UMBRAL_HIPO}.
          </p>
          {hipoCerrada && (
            <button
              type="button"
              onClick={() => setHipoCerrada(false)}
              className="mt-3 min-h-12 w-full rounded-xl bg-bajo px-4 text-sm font-bold text-white"
            >
              Abrir protocolo de rescate
            </button>
          )}
        </div>
      )}

      {r && (
        <div className="flex flex-col gap-3">
          {r.ajusteTendencia > 0 && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border border-acento/40 bg-acento/10 px-4 py-3 text-sm"
            >
              <TrendingDown size={18} className="mt-0.5 shrink-0 text-acento" aria-hidden="true" />
              <span>
                <span className="font-semibold text-acento">
                  Ajuste preventivo por tendencia: +{r.ajusteTendencia}g
                </span>
                <span className="block text-xs text-tenue">
                  Va {r.tendencia.texto.toLowerCase()}: para cuando termine de comer estará más
                  abajo de lo que marca ahora.
                </span>
              </span>
            </p>
          )}

          {/* Dosis: no se toca, es el ancla de todo el cálculo. */}
          <div className="flex items-center justify-between rounded-xl border border-borde bg-superficie px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-tenue">
              <Syringe size={16} aria-hidden="true" />
              Lyumjev (dosis fija)
            </span>
            <span className="font-mono text-xl font-bold">{r.dosis} U</span>
          </div>

          {/* Lo que va completo, sin pesar. */}
          <div className="rounded-xl border border-borde bg-superficie p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-tenue">
              <Lock size={13} aria-hidden="true" />
              Va completo, no se pesa
            </p>
            <ul className="flex flex-col gap-1">
              {r.fijos.map((f) => (
                <li key={f.nombre} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{f.nombre}</span>
                  <span className="shrink-0 font-medium text-tenue">{f.porcion}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-borde pt-2 text-xs text-tenue">
              Aportan {r.carbosFijos} g de carbohidratos
            </p>
          </div>

          {/* El número que se lee parado frente a la báscula. */}
          <div className="rounded-2xl border-2 border-acento/50 bg-acento/10 p-5 text-center">
            <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-acento">
              <Scale size={14} aria-hidden="true" />
              Pesa en báscula
            </p>
            <p className="mt-1 text-base font-semibold">{r.ajustable.nombre}</p>

            <p className="mt-2 font-mono text-7xl font-black leading-none tabular-nums text-acento">
              {r.gramos}
              <span className="ml-1 text-3xl font-bold">g</span>
            </p>

            {r.piezas != null && (
              <p className="mt-2 text-sm text-tenue">≈ {r.piezas} piezas</p>
            )}
            {r.ajustable.nota && (
              <p className="mt-2 inline-block rounded-full bg-alto/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-alto">
                {r.ajustable.nota}
              </p>
            )}
            {r.topado && (
              <p className="mt-3 text-xs text-alto">
                Viene muy alto: la ración se topa en 0 g. Solo los alimentos fijos.
              </p>
            )}
          </div>

          {/* La cuenta a la vista, para poder verificarla a mano. */}
          <details className="rounded-xl border border-borde bg-superficie px-4 py-3">
            <summary className="cursor-pointer text-sm text-tenue">Ver la cuenta</summary>
            <dl className="mt-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-tenue">Objetivo − glucosa</dt>
                <dd className="font-mono">
                  {OBJETIVO} − {r.glucosa} = {OBJETIVO - r.glucosa}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tenue">÷ {SENSIBILIDAD} (sensibilidad)</dt>
                <dd className="flex items-center gap-1 font-mono font-semibold">
                  <IconoAjuste size={13} aria-hidden="true" />
                  {r.ajuste > 0 ? '+' : ''}
                  {r.ajuste} g
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tenue">
                  Tendencia {r.tendencia?.glifo ?? ''}
                </dt>
                <dd className="font-mono font-semibold">
                  {r.ajusteTendencia > 0 ? `+${r.ajusteTendencia}` : '0'} g
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-borde pt-1.5">
                <dt className="text-tenue">{r.ajustable.nombre} base</dt>
                <dd className="font-mono">
                  {r.ajustable.carbos} g carbos · {r.ajustable.gramos} g peso
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tenue">Ajustado</dt>
                <dd className="font-mono font-semibold">
                  {r.carbosAjustable} g carbos · {r.gramos} g peso
                </dd>
              </div>
            </dl>
          </details>

          <div className="flex items-center justify-between rounded-xl bg-superficie-alta px-4 py-3">
            <span className="text-sm text-tenue">
              Total del plato
              <span className="ml-2 text-xs">(base {r.carbosBase} g)</span>
            </span>
            <span className="font-mono text-2xl font-bold">{r.carbosTotales} g</span>
          </div>

          {onUsar && (
            <button
              type="button"
              onClick={() =>
                onUsar({
                  carbos: r.carbosTotales,
                  descripcion:
                    `Menú ${r.menu} — ` +
                    [
                      ...r.fijos.map((f) => `${f.nombre} (${f.porcion})`),
                      `${r.ajustable.nombre} ${r.gramos} g`,
                    ].join(' + '),
                })
              }
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-acento text-base font-semibold text-fondo active:opacity-80"
            >
              <ClipboardCheck size={18} aria-hidden="true" />
              Usar en el registro
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { MENUS };
