'use client';

import { useFormStatus } from 'react-dom';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Radio disfrazado de botón: accesible con teclado y con área táctil grande.
 * Funciona tanto sin estado (defaultChecked) como controlado desde React
 * (checked + onChange), según lo necesite cada formulario.
 */
export function OpcionBoton({ name, value, children, ...props }) {
  return (
    <label className="flex-1">
      <input type="radio" name={name} value={value} {...props} className="peer sr-only" />
      <span className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl border border-borde bg-superficie px-2 text-center text-sm font-medium transition-colors peer-checked:border-acento peer-checked:bg-acento/15 peer-checked:text-acento peer-focus-visible:ring-2 peer-focus-visible:ring-acento">
        {children}
      </span>
    </label>
  );
}

export function Campo({ etiqueta, hint, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {etiqueta}
        {hint && <span className="ml-2 font-normal text-tenue">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const claseInput =
  'w-full rounded-xl border border-borde bg-superficie px-4 py-3.5 text-texto placeholder:text-tenue focus:border-acento focus:outline-none focus:ring-1 focus:ring-acento';

export function Entrada({ className = '', ...props }) {
  return <input {...props} className={`${claseInput} ${className}`} />;
}

export function AreaTexto({ className = '', ...props }) {
  return <textarea {...props} className={`${claseInput} min-h-24 resize-y ${className}`} />;
}

/**
 * El botón se deshabilita solo mientras la Server Action está en vuelo,
 * para que un doble toque no registre dos dosis de insulina.
 */
export function BotonGuardar({ children = 'Guardar' }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-acento text-base font-semibold text-fondo transition-opacity active:opacity-80 disabled:opacity-50"
    >
      {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
      {pending ? 'Guardando...' : children}
    </button>
  );
}

export function Mensaje({ estado }) {
  if (!estado?.mensaje) return null;

  const Icono = estado.ok ? Check : AlertCircle;
  const clases = estado.ok
    ? 'bg-rango/10 text-rango'
    : 'bg-bajo/10 text-bajo';

  return (
    <p
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${clases}`}
    >
      <Icono size={18} className="mt-px shrink-0" aria-hidden="true" />
      {estado.mensaje}
    </p>
  );
}

/**
 * Hora opcional. Por defecto se guarda "ahora", pero casi siempre registras
 * la comida 20 minutos después de comerla, y en diabetes la hora exacta es
 * justo lo que hace útil el dato.
 */
export function HoraOpcional() {
  return (
    <details className="rounded-xl border border-borde bg-superficie px-4 py-3">
      <summary className="cursor-pointer text-sm text-tenue">
        Se guarda con la hora actual · cambiar
      </summary>
      <input
        type="time"
        name="hora"
        className="mt-3 w-full rounded-lg border border-borde bg-superficie-alta px-3 py-2.5 text-texto"
      />
    </details>
  );
}
