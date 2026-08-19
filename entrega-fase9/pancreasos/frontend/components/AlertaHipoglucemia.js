'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Timer, CheckCircle2, X, Anchor } from 'lucide-react';
import { calcularRescate, ESPERA_MINUTOS, ANCLAS, UMBRAL_HIPO } from '@/lib/menus';

const CLAVE_GUARDADO = 'pancreasos:hipo';
const EVENTO = 'pancreasos:hipo-cambio';

/**
 * El cronómetro vive en localStorage para sobrevivir a que se bloquee el
 * celular a media espera. Es un sistema externo a React, así que se lee con
 * useSyncExternalStore: funciona en el servidor (devuelve null) y en el
 * cliente sin romper la hidratación ni encadenar renders.
 */
function suscribir(alCambiar) {
  window.addEventListener('storage', alCambiar);
  window.addEventListener(EVENTO, alCambiar);
  return () => {
    window.removeEventListener('storage', alCambiar);
    window.removeEventListener(EVENTO, alCambiar);
  };
}

function leerCrudo() {
  try {
    return window.localStorage.getItem(CLAVE_GUARDADO);
  } catch {
    return null;
  }
}

function guardar(dato) {
  try {
    if (dato) window.localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(dato));
    else window.localStorage.removeItem(CLAVE_GUARDADO);
  } catch {
    /* modo privado de Safari: el cronómetro sigue vivo en memoria */
  }
  window.dispatchEvent(new Event(EVENTO));
}

const mmss = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Protocolo de hipoglucemia en 3 fases: rescate rápido, espera de 15 minutos
 * y colación de mantenimiento. Toma la pantalla completa a propósito: cuando
 * Gaelito trae 55 mg/dL no hay nada más que mirar.
 *
 * Las cantidades salen del plan de su nutriólogo; aquí solo se convierten a
 * gramos y mililitros de báscula.
 */
export default function AlertaHipoglucemia({ glucosa, onCerrar }) {
  const [faseLocal, setFase] = useState('rescate');
  const [glucosaLocal, setGlucosaActual] = useState(glucosa);
  const [finTimerLocal, setFinTimer] = useState(null);
  const [restante, setRestante] = useState(0);
  const [rondaLocal, setRonda] = useState(1);
  const [nuevaLectura, setNuevaLectura] = useState('');
  const [tocado, setTocado] = useState(false);
  // Se captura una sola vez al montar para pintar la cuenta regresiva
  // restaurada sin esperar al primer tick del intervalo.
  const [montadoEn] = useState(() => Date.now());
  const botonRef = useRef(null);

  const crudo = useSyncExternalStore(suscribir, leerCrudo, () => null);

  // Cronómetro pendiente de una sesión anterior, si seguía vigente al abrir.
  // Si ya venía vencido no se restaura; y si vence estando abierto, el
  // intervalo lo detecta y salta a la re-medición.
  const pendiente = useMemo(() => {
    if (!crudo) return null;
    try {
      const dato = JSON.parse(crudo);
      return dato?.finTimer > montadoEn ? dato : null;
    } catch {
      return null;
    }
  }, [crudo, montadoEn]);

  // Mientras nadie toque nada, manda lo guardado: así reabrir la app a media
  // espera retoma la cuenta regresiva en lugar de empezar de cero.
  const restaurando = !tocado && pendiente !== null;
  const fase = restaurando ? 'espera' : faseLocal;
  const finTimer = restaurando ? pendiente.finTimer : finTimerLocal;
  const glucosaActual = restaurando ? (pendiente.glucosa ?? glucosa) : glucosaLocal;
  const ronda = restaurando ? (pendiente.ronda ?? 1) : rondaLocal;

  const rescate = calcularRescate(glucosaActual);

  // La pantalla de atrás no debe poder desplazarse mientras esto está abierto.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  useEffect(() => {
    if (fase !== 'espera' || !finTimer) return undefined;

    const id = setInterval(() => {
      const ms = finTimer - Date.now();
      if (ms <= 0) {
        setRestante(0);
        setTocado(true);
        setFase('remedir');
        setGlucosaActual(glucosaActual);
        setRonda(ronda);
        guardar(null);
        // En Android vibra; iOS lo ignora en silencio.
        navigator.vibrate?.([400, 200, 400, 200, 400]);
      } else {
        setRestante(ms);
      }
    }, 250);

    return () => clearInterval(id);
  }, [fase, finTimer, glucosaActual, ronda]);

  useEffect(() => {
    botonRef.current?.focus();
  }, [fase]);

  function iniciarEspera() {
    const fin = Date.now() + ESPERA_MINUTOS * 60 * 1000;
    setTocado(true);
    setFinTimer(fin);
    setRestante(fin - Date.now());
    setGlucosaActual(glucosaActual);
    setRonda(ronda);
    setFase('espera');
    guardar({ finTimer: fin, glucosa: glucosaActual, ronda });
  }

  function medirAhora() {
    setTocado(true);
    setGlucosaActual(glucosaActual);
    setRonda(ronda);
    setFase('remedir');
    guardar(null);
  }

  function confirmarRemedicion(evento) {
    evento.preventDefault();
    const valor = Number(nuevaLectura);
    if (!Number.isFinite(valor) || valor <= 0) return;

    setTocado(true);
    setGlucosaActual(valor);
    setNuevaLectura('');

    if (valor < UMBRAL_HIPO) {
      setRonda((r) => r + 1);
      setFase('rescate');
    } else {
      setFase('ancla');
    }
  }

  function cerrar() {
    guardar(null);
    onCerrar?.();
  }

  const exito = fase === 'ancla';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={exito ? 'Glucosa recuperada' : `Hipoglucemia: ${glucosaActual} mg/dL`}
      className={`fixed inset-0 z-100 flex flex-col overflow-y-auto ${
        exito ? 'bg-green-700' : 'bg-red-700'
      } text-white`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {exito ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
            <div>
              <p className="text-xl font-black uppercase tracking-wide">
                {exito ? 'Recuperado' : 'Hipoglucemia'}
              </p>
              {ronda > 1 && !exito && (
                <p className="text-sm text-white/80">Ronda {ronda} de rescate</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar alerta"
            className="rounded-full bg-white/15 p-2.5 active:bg-white/25"
          >
            <X size={20} />
          </button>
        </div>

        {/* ---------------------------------------------- FASE 1: RESCATE */}
        {fase === 'rescate' && (
          <>
            <div className="text-center">
              <p className="font-mono text-7xl font-black leading-none tabular-nums">
                {glucosaActual}
              </p>
              <p className="mt-1 text-sm text-white/80">mg/dL</p>
            </div>

            <div className="rounded-2xl bg-white/15 px-5 py-4 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
                Dale ahora
              </p>
              <p className="font-mono text-6xl font-black leading-tight tabular-nums">
                {rescate.carbos} g
              </p>
              <p className="text-sm text-white/80">de carbohidratos rápidos</p>
              {rescate.aplicoMinimo && (
                <p className="mt-2 text-xs text-white/70">
                  La fórmula daba {rescate.carbosCalculados} g; se aplica el mínimo de 15 g.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-white/80">Escoge UNA opción:</p>
              {rescate.opciones.map((o) => (
                <div
                  key={o.nombre}
                  className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3"
                >
                  <span className="text-3xl" aria-hidden="true">
                    {o.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{o.nombre}</p>
                    <p className="text-xs text-white/70">{o.detalle}</p>
                  </div>
                  <p className="shrink-0 font-mono text-2xl font-black tabular-nums">
                    {o.cantidad}
                    <span className="ml-1 text-sm font-normal">{o.unidad}</span>
                  </p>
                </div>
              ))}
            </div>

            <button
              ref={botonRef}
              type="button"
              onClick={iniciarEspera}
              className="mt-auto min-h-16 w-full rounded-2xl bg-white text-lg font-bold text-red-700 active:bg-white/90"
            >
              Ya le di el rescate
            </button>
          </>
        )}

        {/* ---------------------------------------------- FASE 2: ESPERA */}
        {fase === 'espera' && (
          <>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <Timer size={32} className="text-white/80" />
              <p className="font-mono text-8xl font-black leading-none tabular-nums">
                {mmss(restante || (finTimer ? Math.max(0, finTimer - montadoEn) : 0))}
              </p>
              <p className="max-w-xs text-base text-white/90">
                Espera los {ESPERA_MINUTOS} minutos completos antes de volver a medir.
              </p>
              <p className="max-w-xs text-sm text-white/70">
                Puedes cerrar la app: el cronómetro sigue corriendo.
              </p>
            </div>

            <button
              ref={botonRef}
              type="button"
              onClick={medirAhora}
              className="min-h-14 w-full rounded-2xl border-2 border-white/40 text-base font-semibold active:bg-white/10"
            >
              Medir ahora
            </button>
          </>
        )}

        {/* ---------------------------------------------- FASE 2b: RE-MEDIR */}
        {fase === 'remedir' && (
          <form onSubmit={confirmarRemedicion} className="flex flex-1 flex-col gap-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle size={32} className="animate-pulse" />
              <p className="text-2xl font-black">Vuelve a medir a Gaelito</p>
              <p className="max-w-xs text-sm text-white/80">
                Pasaron los {ESPERA_MINUTOS} minutos. Anota cuánto trae ahora.
              </p>

              <label className="mt-2 w-full max-w-xs">
                <span className="sr-only">Nueva glucosa en mg/dL</span>
                <input
                  ref={botonRef}
                  type="number"
                  inputMode="numeric"
                  min="20"
                  max="600"
                  required
                  value={nuevaLectura}
                  onChange={(e) => setNuevaLectura(e.target.value)}
                  placeholder="85"
                  className="w-full rounded-2xl bg-white px-5 py-4 text-center font-mono text-4xl font-black text-red-700 placeholder:text-red-300 focus:outline-none focus:ring-4 focus:ring-white/50"
                />
              </label>
              <p className="text-sm text-white/70">mg/dL</p>
            </div>

            <button
              type="submit"
              className="min-h-16 w-full rounded-2xl bg-white text-lg font-bold text-red-700 active:bg-white/90"
            >
              Continuar
            </button>
          </form>
        )}

        {/* ---------------------------------------------- FASE 3: EL ANCLA */}
        {fase === 'ancla' && (
          <>
            <div className="rounded-2xl bg-white/15 px-5 py-5 text-center">
              <p className="font-mono text-6xl font-black leading-none tabular-nums">
                {glucosaActual}
              </p>
              <p className="mt-1 text-sm text-white/80">mg/dL · fuera de peligro</p>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-white/10 px-4 py-3">
              <Anchor size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm">
                Dale una colación para asentar el azúcar. Todavía le queda insulina
                trabajando y sin esto puede volver a bajar.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {ANCLAS.map((a) => (
                <div key={a.id} className="rounded-2xl bg-white/15 px-5 py-4">
                  <p className="text-sm font-bold uppercase tracking-wide text-white/80">
                    {a.titulo}
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {a.items.map((i) => (
                      <li key={i} className="text-lg font-semibold">
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <button
              ref={botonRef}
              type="button"
              onClick={cerrar}
              className="mt-auto min-h-16 w-full rounded-2xl bg-white text-lg font-bold text-green-700 active:bg-white/90"
            >
              Listo
            </button>
          </>
        )}

        <p className="pt-1 text-center text-[11px] leading-relaxed text-white/60">
          Protocolo indicado por el equipo médico de Gaelito. Si no reacciona, vomita o
          pierde la conciencia, no uses esta pantalla: aplica glucagón y llama a emergencias.
        </p>
      </div>
    </div>
  );
}
