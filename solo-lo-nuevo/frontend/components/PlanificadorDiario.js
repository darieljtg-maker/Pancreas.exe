'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles, Loader2, Syringe, Target, AlertCircle, Check,
  Sunrise, TriangleAlert, Utensils, ChefHat,
} from 'lucide-react';

import { generarOpcionesComida, calcularAntojo } from '@/app/ai-actions';
import { registrarConsumo } from '@/app/nutricion-actions';
import BarraProgreso from './BarraProgreso';
import { enVentanaAlba, ALBA } from '@/lib/menus';
import {
  COMIDAS, ICR_POR_DEFECTO, rutaA, rutaB, discrepanciaAlba,
  calcularUGP, AVISO_UGP, UMBRAL_UGP,
} from '@/lib/calculosNutricionales';
import { TZ } from '@/lib/config';

const campo =
  'w-full rounded-xl border border-borde bg-superficie px-4 py-3.5 text-texto placeholder:text-tenue focus:border-acento focus:outline-none focus:ring-1 focus:ring-acento';

function Macro({ etiqueta, valor, unidad = 'g', destacado }) {
  return (
    <div className={`flex flex-col items-center rounded-xl px-2 py-3 ${destacado ? 'bg-acento/15' : 'bg-superficie-alta'}`}>
      <span className={`font-mono text-lg font-bold tabular-nums ${destacado ? 'text-acento' : ''}`}>
        {valor}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-tenue">
        {etiqueta} {unidad && `(${unidad})`}
      </span>
    </div>
  );
}

/**
 * Planificador de volumen limpio con ruta dual.
 *
 * Ruta A: mandan los macros del plan y la insulina es la consecuencia.
 * Ruta B: manda un límite de insulina y los macros se recalculan.
 */
export default function PlanificadorDiario({ requerimientos, metas, consumo, hayTabla }) {
  const [comidaId, setComidaId] = useState('desayuno');
  const [ruta, setRuta] = useState('A');
  const [icr, setIcr] = useState(ICR_POR_DEFECTO);
  const [unidades, setUnidades] = useState(4);

  const [menus, setMenus] = useState(null);
  const [cargandoMenus, setCargandoMenus] = useState(false);
  const [antojo, setAntojo] = useState('');
  const [resultadoAntojo, setResultadoAntojo] = useState(null);
  const [cargandoAntojo, setCargandoAntojo] = useState(false);
  const [guardado, setGuardado] = useState(null);

  // La ventana del alba se revisa cada minuto por si la pantalla queda abierta.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const meta = metas.find((m) => m.id === comidaId) ?? metas[0];
  const alba = enVentanaAlba(new Date(ahora), TZ);

  const plan = ruta === 'A'
    ? rutaA({ meta, icr })
    : rutaB({ meta, unidades, icr, alba });

  const discrepancia = ruta === 'A' ? discrepanciaAlba({ meta, icr, ahora: new Date(ahora), zona: TZ }) : null;
  const ugpPlan = calcularUGP({ proteina: plan?.proteina ?? 0, grasa: plan?.grasa ?? 0 });

  // Al cambiar cualquier parámetro, lo calculado antes deja de ser válido.
  const reiniciar = () => {
    setMenus(null);
    setResultadoAntojo(null);
    setGuardado(null);
  };

  async function generar() {
    if (!plan || cargandoMenus) return;
    setCargandoMenus(true);
    setMenus(null);
    try {
      setMenus(await generarOpcionesComida({
        nombreComida: meta.nombre,
        proteina: plan.proteina,
        carbos: plan.carbos,
        grasa: plan.grasa,
        calorias: plan.calorias,
      }));
    } catch (err) {
      setMenus({ ok: false, mensaje: err?.message || 'No se pudieron generar las opciones.' });
    } finally {
      setCargandoMenus(false);
    }
  }

  async function pedirAntojo() {
    if (!plan || cargandoAntojo || antojo.trim().length < 3) return;
    setCargandoAntojo(true);
    setResultadoAntojo(null);
    try {
      setResultadoAntojo(await calcularAntojo({
        antojo,
        nombreComida: meta.nombre,
        proteina: plan.proteina,
        carbos: plan.carbos,
        grasa: plan.grasa,
        calorias: plan.calorias,
      }));
    } catch (err) {
      setResultadoAntojo({ ok: false, mensaje: err?.message || 'No se pudo calcular el antojo.' });
    } finally {
      setCargandoAntojo(false);
    }
  }

  async function registrar(datos) {
    setGuardado({ cargando: true });
    setGuardado(await registrarConsumo({
      comida: comidaId,
      ruta: plan?.ruta ?? null,
      unidades: ruta === 'B' ? unidades : plan?.unidadesPractica,
      ...datos,
    }));
  }

  return (
    <div className="flex flex-col gap-5">
      {!hayTabla && (
        <p className="flex items-start gap-2 rounded-xl border border-alto/40 bg-alto/10 px-4 py-3 text-sm text-alto">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          Falta crear la tabla <code className="font-mono text-xs">daily_log</code>. Corre
          <code className="mx-1 font-mono text-xs">sql/002_daily_log.sql</code> en Neon para
          poder registrar el consumo.
        </p>
      )}

      {/* ------------------------------------------------ COMIDA */}
      <div>
        <p className="mb-2 text-sm font-medium">Comida</p>
        <div className="grid grid-cols-5 gap-1.5">
          {COMIDAS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setComidaId(c.id); reiniciar(); }}
              aria-pressed={comidaId === c.id}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-[11px] font-medium leading-tight transition-colors ${
                comidaId === c.id ? 'border-acento bg-acento/15 text-acento' : 'border-borde bg-superficie text-tenue'
              }`}
            >
              {c.nombre.replace('Colación ', 'Col. ')}
              <span className="text-[9px] opacity-70">{Math.round(c.porcentaje * 100)}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------ RUTA */}
      <div>
        <p className="mb-2 text-sm font-medium">Ruta</p>
        <div className="flex gap-2">
          {[
            { id: 'A', titulo: 'Prioridad volumen', sub: 'los macros mandan', Icono: Target },
            { id: 'B', titulo: 'Prioridad insulina', sub: 'tú fijas las unidades', Icono: Syringe },
          ].map(({ id, titulo, sub, Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setRuta(id); reiniciar(); }}
              aria-pressed={ruta === id}
              className={`flex flex-1 flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors ${
                ruta === id ? 'border-acento bg-acento/15' : 'border-borde bg-superficie'
              }`}
            >
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${ruta === id ? 'text-acento' : ''}`}>
                <Icono size={15} aria-hidden="true" />
                Ruta {id}
              </span>
              <span className="text-[11px] leading-tight text-tenue">{titulo}</span>
              <span className="text-[10px] leading-tight text-tenue opacity-70">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-borde bg-superficie px-4 py-3">
        <span className="text-sm">
          Ratio insulina/carbos
          <span className="block text-[11px] text-tenue">g por unidad · lo define el endocrinólogo</span>
        </span>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="1"
          max="50"
          value={icr}
          onChange={(e) => { setIcr(Number(e.target.value) || 0); reiniciar(); }}
          className="w-20 rounded-lg border border-borde bg-superficie-alta px-2 py-2 text-center font-mono text-lg font-bold"
        />
      </label>

      {ruta === 'B' && (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-acento/40 bg-acento/10 px-4 py-3">
          <span className="text-sm font-medium">
            Solo voy a inyectar
            <span className="block text-[11px] text-tenue">unidades de Lyumjev</span>
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            max="30"
            value={unidades}
            onChange={(e) => { setUnidades(Number(e.target.value) || 0); reiniciar(); }}
            className="w-20 rounded-lg border border-acento/50 bg-superficie px-2 py-2 text-center font-mono text-lg font-bold text-acento"
          />
        </label>
      )}

      {/* ------------------------------------------------ RESULTADO */}
      {plan && (
        <section aria-label="Objetivo de la comida" className="tarjeta flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{meta.nombre}</h2>
            <span className="font-mono text-sm text-tenue">{plan.calorias} kcal</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Macro etiqueta="Proteína" valor={plan.proteina} />
            <Macro etiqueta="Carbos" valor={plan.carbos} destacado />
            <Macro etiqueta="Grasa" valor={plan.grasa} />
          </div>

          {ruta === 'A' ? (
            <p className="flex items-center gap-2 rounded-xl bg-superficie-alta px-4 py-3 text-sm">
              <Syringe size={16} className="shrink-0 text-acento" aria-hidden="true" />
              <span>
                Para esta meta, necesitas inyectar{' '}
                <span className="font-mono text-lg font-bold text-acento">
                  {plan.unidadesPractica} U
                </span>
                <span className="ml-1 text-xs text-tenue">(cálculo exacto {plan.unidades} U)</span>
              </span>
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="rounded-xl bg-superficie-alta px-4 py-3 text-sm">
                Con <span className="font-mono font-bold text-acento">{plan.unidades} U</span> puedes
                comer <span className="font-mono font-bold text-acento">{plan.carbos} g</span> de
                carbohidratos.
                {plan.carbosRecortados > 0 && (
                  <span className="block text-xs text-tenue">
                    Son {plan.carbosRecortados} g menos que la meta del plan; la proteína y la grasa
                    suben para compensar las calorías.
                  </span>
                )}
              </p>
              {plan.alba && (
                <p className="flex items-start gap-2 rounded-xl border border-alto/40 bg-alto/10 px-4 py-3 text-sm">
                  <Sunrise size={18} className="mt-0.5 shrink-0 text-alto" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-alto">
                      Fenómeno del alba: −{Math.round(ALBA.reduccion * 100)}%
                    </span>
                    <span className="block text-xs text-tenue">
                      Sin corregir serían {plan.carbosSinAlba} g. Por la mañana hay resistencia,
                      así que cada unidad cubre {plan.recorteAlba} g menos.
                    </span>
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Las dos rutas no coinciden en la ventana del alba: se enseña. */}
          {discrepancia && (
            <p className="flex items-start gap-2 rounded-xl border border-borde px-4 py-3 text-xs text-tenue">
              <TriangleAlert size={15} className="mt-0.5 shrink-0 text-alto" aria-hidden="true" />
              <span>
                Es horario de resistencia matutina. Con esas {discrepancia.unidades} U, la Ruta B
                solo permitiría {discrepancia.carbosRutaB} g ({discrepancia.diferencia} g menos).
                La Ruta A no corrige por resistencia: consúltalo con el endocrinólogo antes de
                subir unidades.
              </span>
            </p>
          )}

          {ugpPlan.alto && (
            <p className="rounded-xl border-2 border-bajo bg-bajo/15 px-4 py-3 text-sm font-bold text-bajo">
              ⚠️ {AVISO_UGP}
              <span className="mt-1 block text-xs font-normal">
                {ugpPlan.ugp} UGP (umbral {UMBRAL_UGP}).
              </span>
            </p>
          )}
        </section>
      )}

      {/* ------------------------------------------------ MENÚS IA */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={generar}
          disabled={!plan || cargandoMenus}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-acento to-violet-500 text-base font-semibold text-fondo transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {cargandoMenus ? <Loader2 size={18} className="animate-spin" /> : <ChefHat size={18} />}
          {cargandoMenus ? 'Armando menús...' : 'Generar 3 opciones con IA'}
        </button>

        {menus && !menus.ok && (
          <p className="flex items-start gap-2 rounded-xl bg-bajo/10 px-4 py-3 text-sm text-bajo">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {menus.mensaje}
          </p>
        )}

        {menus?.ok && menus.opciones.map((o) => (
          <article key={o.opcion} className="tarjeta flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                <span className="mr-1.5 text-xs text-tenue">Opción {o.opcion}</span>
                {o.nombre}
              </h3>
              {!o.cuadra && (
                <span className="shrink-0 rounded-full bg-alto/15 px-2 py-0.5 text-[10px] font-bold text-alto">
                  APROX.
                </span>
              )}
            </div>

            <ul className="flex flex-col gap-1">
              {o.ingredientes.map((i, k) => (
                <li key={k} className="flex items-baseline justify-between gap-2 text-sm">
                  <span>{i.nombre}</span>
                  <span className="shrink-0 font-mono text-tenue">
                    {i.cantidad}
                    {i.estadoCrudoCocido !== 'no aplica' && (
                      <span className="ml-1 text-[10px] uppercase">{i.estadoCrudoCocido}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {o.preparacionCorta && (
              <p className="text-xs leading-relaxed text-tenue">{o.preparacionCorta}</p>
            )}

            <div className="grid grid-cols-4 gap-1.5">
              <Macro etiqueta="P" valor={o.macros.proteina} unidad="" />
              <Macro etiqueta="C" valor={o.macros.carbos} unidad="" />
              <Macro etiqueta="G" valor={o.macros.grasa} unidad="" />
              <Macro etiqueta="kcal" valor={Math.round(o.macros.calorias)} unidad="" />
            </div>

            <button
              type="button"
              onClick={() => registrar({
                origen: 'menu',
                descripcion: `${o.nombre} — ${o.ingredientes.map((i) => `${i.nombre} ${i.cantidad}`).join(', ')}`,
                ...o.macros,
              })}
              className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-acento/50 bg-acento/10 text-sm font-semibold text-acento active:opacity-80"
            >
              <Check size={16} aria-hidden="true" />
              Registrar consumo
            </button>
          </article>
        ))}
      </div>

      {/* ------------------------------------------------ ANTOJOS */}
      <section aria-label="Barra de antojos" className="tarjeta flex flex-col gap-3 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Utensils size={16} className="text-acento" aria-hidden="true" />
          ¿Se le antoja algo?
        </p>
        <input
          type="text"
          value={antojo}
          onChange={(e) => setAntojo(e.target.value)}
          maxLength={400}
          placeholder="Quiero comer pollo y arroz"
          className={campo}
        />
        <button
          type="button"
          onClick={pedirAntojo}
          disabled={!plan || cargandoAntojo || antojo.trim().length < 3}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-acento/50 bg-acento/10 text-sm font-semibold text-acento disabled:opacity-40"
        >
          {cargandoAntojo ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {cargandoAntojo ? 'Calculando cantidades...' : 'Cuadrar en mis macros'}
        </button>

        {resultadoAntojo && !resultadoAntojo.ok && (
          <p className="flex items-start gap-2 rounded-xl bg-bajo/10 px-4 py-3 text-sm text-bajo">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {resultadoAntojo.mensaje}
          </p>
        )}

        {resultadoAntojo?.ok && (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-1">
              {resultadoAntojo.ingredientes.map((i, k) => (
                <li key={k} className="flex items-baseline justify-between gap-2 text-sm">
                  <span>{i.nombre}</span>
                  <span className="shrink-0 font-mono text-tenue">
                    {i.cantidad}
                    {i.estadoCrudoCocido !== 'no aplica' && (
                      <span className="ml-1 text-[10px] uppercase">{i.estadoCrudoCocido}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-4 gap-1.5">
              <Macro etiqueta="P" valor={resultadoAntojo.totales.proteina} unidad="" />
              <Macro etiqueta="C" valor={resultadoAntojo.totales.carbos} unidad="" />
              <Macro etiqueta="G" valor={resultadoAntojo.totales.grasa} unidad="" />
              <Macro etiqueta="kcal" valor={Math.round(resultadoAntojo.totales.calorias)} unidad="" />
            </div>

            {resultadoAntojo.faltante && (
              <p className="rounded-xl border border-acento/40 bg-acento/10 px-4 py-3 text-sm text-acento">
                {resultadoAntojo.faltante}
              </p>
            )}

            {resultadoAntojo.advertencia && (
              <p className="text-xs text-tenue">{resultadoAntojo.advertencia}</p>
            )}

            {resultadoAntojo.highUGP && (
              <p
                role="alert"
                aria-label="Alerta de unidades grasa-proteína"
                className="rounded-xl border-2 border-bajo bg-bajo/15 px-4 py-4 text-sm font-bold leading-snug text-bajo"
              >
                ⚠️ {AVISO_UGP}
                <span className="mt-1 block text-xs font-normal">
                  {resultadoAntojo.ugp} UGP (umbral {UMBRAL_UGP}).
                </span>
              </p>
            )}

            <button
              type="button"
              onClick={() => registrar({
                origen: 'antojo',
                descripcion: resultadoAntojo.ingredientes
                  .map((i) => `${i.nombre} ${i.cantidad}`).join(', ')
                  .slice(0, 400),
                ...resultadoAntojo.totales,
              })}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-acento/50 bg-acento/10 text-sm font-semibold text-acento active:opacity-80"
            >
              <Check size={16} aria-hidden="true" />
              Registrar consumo
            </button>
          </div>
        )}
      </section>

      {guardado && !guardado.cargando && (
        <p
          role="status"
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
            guardado.ok ? 'bg-rango/10 text-rango' : 'bg-bajo/10 text-bajo'
          }`}
        >
          {guardado.ok ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          {guardado.mensaje}
        </p>
      )}

      <BarraProgreso consumido={consumo.totales} meta={requerimientos} />

      <p className="text-center text-xs leading-relaxed text-tenue">
        Cálculos orientativos generados por la aplicación y por IA. El plan nutricional y las
        dosis de insulina las define el equipo médico de Gaelito.
      </p>
    </div>
  );
}
