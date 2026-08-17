'use client';

import { useActionState } from 'react';
import { Sparkles, Loader2, X, AlertCircle } from 'lucide-react';

import { auditoriaSemanal } from '@/app/ai-actions';
import Markdown from './Markdown';

/**
 * Botón de auditoría semanal con modelo de razonamiento profundo.
 *
 * Tarda bastante más que el vigilante, por eso el estado de carga avisa que
 * la espera es normal en lugar de dejar al usuario dudando si se trabó.
 */
export default function AuditoriaSemanal() {
  const [estado, accion, cargando] = useActionState(async () => auditoriaSemanal(), null);

  const cerrar = () => {
    // Volver a enviar el formulario reinicia el estado; para cerrar basta
    // con recargar la vista del reporte.
    window.location.hash = '';
    window.location.reload();
  };

  return (
    <section aria-label="Auditoría semanal con IA">
      <form action={accion}>
        <button
          type="submit"
          disabled={cargando}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-acento to-violet-500 text-base font-semibold text-fondo transition-opacity active:opacity-80 disabled:opacity-60"
        >
          {cargando ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={18} aria-hidden="true" />
          )}
          {cargando ? 'Analizando la semana...' : 'Generar Auditoría Semanal con IA'}
        </button>
      </form>

      {cargando && (
        <p className="mt-2 text-center text-xs text-tenue">
          El modelo de razonamiento tarda entre 20 y 60 segundos. No cierres la pantalla.
        </p>
      )}

      {estado && !estado.ok && !cargando && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-bajo/10 px-4 py-3 text-sm text-bajo">
          <AlertCircle size={18} className="mt-px shrink-0" aria-hidden="true" />
          {estado.mensaje}
        </p>
      )}

      {estado?.ok && !cargando && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Auditoría semanal"
          className="fixed inset-0 z-100 flex flex-col overflow-y-auto bg-fondo"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto w-full max-w-lg px-5 py-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Sparkles size={18} className="text-acento" aria-hidden="true" />
                  Auditoría semanal
                </h2>
                <p className="text-xs text-tenue">
                  {estado.lecturas} lecturas · {estado.modelo}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar auditoría"
                className="rounded-full bg-superficie p-2.5 active:bg-superficie-alta"
              >
                <X size={20} />
              </button>
            </div>

            <article className="tarjeta px-5 py-4">
              <Markdown texto={estado.markdown} />
            </article>

            <p className="mt-4 text-center text-xs leading-relaxed text-tenue">
              Reporte generado por inteligencia artificial a partir de los datos registrados.
              Es material para llevar a consulta, no una indicación médica: cualquier cambio de
              dosis lo decide el endocrinólogo de Gaelito.
            </p>

            <button
              type="button"
              onClick={cerrar}
              className="mt-4 min-h-14 w-full rounded-2xl border border-borde bg-superficie text-base font-semibold active:bg-superficie-alta"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
