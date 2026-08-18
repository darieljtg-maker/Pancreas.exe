'use client';

import { useEffect, useState } from 'react';
import {
  Scale, Syringe, Lock, ArrowDown, ArrowUp, Minus, ClipboardCheck, TrendingDown,
  Sparkles, Loader2, Sunrise, Flame, AlertCircle,
} from 'lucide-react';

import AlertaHipoglucemia from './AlertaHipoglucemia';
import { analizarComidaIG } from '@/app/ai-actions';
import {
  calcularPorcion,
  enVentanaAlba,
  ALBA,
  REDUCCION_IG_ALTO,
  AVISO_IG_ALTO,
  MENUS,
  TIPOS_COMIDA,
  TENDENCIAS,
  OBJETIVO,
  SENSIBILIDAD,
  UMBRAL_HIPO,
} from '@/lib/menus';
import { TZ } from '@/lib/config';

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

  const [textoComida, setTextoComida] = useState('');
  const [analisis, setAnalisis] = useState(null);
  const [analizando, setAnalizando] = useState(false);

  // La ventana del alba se evalúa con la hora real, refrescada cada minuto
  // por si la calculadora queda abierta cruzando las 11:30.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const tipoActivo = tipoFijo || tipo;
  const valor = Number(glucosa);
  const hayValor = Number.isFinite(valor) && valor > 0;
  const esHipo = hayValor && valor < UMBRAL_HIPO;

  const alba = enVentanaAlba(new Date(ahora), TZ);
  const igAlto = analisis?.ok && analisis.clasificacionIG === 'Alto';

  const r = esHipo
    ? null
    : calcularPorcion({ tipo: tipoActivo, menu, glucosa: valor, tendencia, alba, igAlto });

  async function analizar() {
    if (analizando || textoComida.trim().length < 3) return;
    setAnalizando(true);
    try {
      setAnalisis(await analizarComidaIG(textoComida));
    } catch (err) {
      setAnalisis({ ok: false, mensaje: err?.message || 'No se pudo analizar la comida.' });
    } finally {
      setAnalizando(false);
    }
  }

  const COLOR_IG = { Alto: 'text-bajo', Medio: 'text-alto', Bajo: 'text-rango' };

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

      {/* Análisis de absorción de la comida. */}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            ¿Qué va a comer?
            <span className="ml-2 font-normal text-tenue">para estimar la absorción</span>
          </span>
          <textarea
            value={textoComida}
            onChange={(e) => {
              setTextoComida(e.target.value);
              setAnalisis(null);
            }}
            maxLength={500}
            rows={2}
            placeholder="1 plátano, taza de leche, huevos revueltos"
            className={`${claseCampo} min-h-20 resize-y`}
          />
        </label>

        <button
          type="button"
          onClick={analizar}
          disabled={analizando || textoComida.trim().length < 3}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-acento/50 bg-acento/10 text-sm font-semibold text-acento transition-opacity active:opacity-80 disabled:opacity-40"
        >
          {analizando ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={18} aria-hidden="true" />
          )}
          {analizando ? 'Analizando comida...' : 'Analizar Comida (IA)'}
        </button>

        {analisis && !analisis.ok && (
          <p className="flex items-start gap-2 rounded-xl bg-bajo/10 px-4 py-3 text-sm text-bajo">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {analisis.mensaje}
          </p>
        )}

        {analisis?.ok && (
          <div
            aria-label="Resultado del análisis de absorción"
            className="flex items-start gap-2 rounded-xl border border-borde bg-superficie px-4 py-3"
          >
            <Flame size={16} className={`mt-0.5 shrink-0 ${COLOR_IG[analisis.clasificacionIG]}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm">
                Absorción{' '}
                <span className={`font-bold ${COLOR_IG[analisis.clasificacionIG]}`}>
                  {analisis.clasificacionIG.toUpperCase()}
                </span>
              </p>
              {analisis.warning && (
                <p className="text-xs text-tenue">{analisis.warning}</p>
              )}
            </div>
          </div>
        )}
      </div>

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

          {r.igAlto && (
            <div
              role="alert"
              aria-label="Advertencia de absorción rápida"
              className="rounded-xl border-2 border-bajo bg-bajo/15 px-4 py-4"
            >
              <p className="text-base font-bold leading-snug text-bajo">
                ⚠️ {AVISO_IG_ALTO}
              </p>
            </div>
          )}

          {r.alba && (
            <p className="flex items-start gap-2 rounded-xl border border-alto/40 bg-alto/10 px-4 py-3 text-sm">
              <Sunrise size={18} className="mt-0.5 shrink-0 text-alto" aria-hidden="true" />
              <span>
                <span className="font-semibold text-alto">
                  Fenómeno del alba: −{Math.round(ALBA.reduccion * 100)}% de carbohidratos
                </span>
                <span className="block text-xs text-tenue">
                  Por la mañana hay más resistencia a la insulina, así que la misma dosis
                  rinde menos.
                </span>
              </span>
            </p>
          )}

          {r.igAlto && (
            <p className="flex items-start gap-2 rounded-xl border border-bajo/40 bg-bajo/10 px-4 py-3 text-sm">
              <Flame size={18} className="mt-0.5 shrink-0 text-bajo" aria-hidden="true" />
              <span className="font-semibold text-bajo">
                Absorción alta: −{Math.round(REDUCCION_IG_ALTO * 100)}% adicional de carbohidratos
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
                <dt className="text-tenue">Total antes de factores</dt>
                <dd className="font-mono">{r.totalSinFactores} g</dd>
              </div>
              {r.alba && (
                <div className="flex justify-between gap-3">
                  <dt className="text-tenue">Alba (−{Math.round(ALBA.reduccion * 100)}%)</dt>
                  <dd className="font-mono font-semibold text-alto">−{r.recorteAlba} g</dd>
                </div>
              )}
              {r.igAlto && (
                <div className="flex justify-between gap-3">
                  <dt className="text-tenue">
                    Absorción alta (−{Math.round(REDUCCION_IG_ALTO * 100)}%)
                  </dt>
                  <dd className="font-mono font-semibold text-bajo">−{r.recorteIG} g</dd>
                </div>
              )}
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
                    (textoComida.trim() ? `${textoComida.trim()} · ` : '') +
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
