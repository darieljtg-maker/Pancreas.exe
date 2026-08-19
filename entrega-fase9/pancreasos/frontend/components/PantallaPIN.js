'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Delete, Lock, ShieldAlert } from 'lucide-react';

import { verificarPin } from '@/app/pin-actions';

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'borrar'];

/**
 * Teclado numérico de entrada. El PIN nunca se compara aquí: se manda a una
 * Server Action que lo valida contra APP_PIN y devuelve una cookie httpOnly.
 * Así el PIN no viaja en el bundle del navegador.
 */
export default function PantallaPIN({ largoPin, hayPin, destino = '/' }) {
  const router = useRouter();
  const [digitos, setDigitos] = useState('');
  const formRef = useRef(null);

  const [estado, accion, enviando] = useActionState(async (previo, formData) => {
    const resultado = await verificarPin(previo, formData);
    if (resultado?.ok) {
      // El proxy ya ve la cookie; refrescar entra a la app.
      router.replace(destino);
      router.refresh();
    } else {
      setDigitos('');
    }
    return resultado;
  }, null);

  // Cuando se completan los dígitos esperados, se envía solo.
  useEffect(() => {
    if (largoPin > 0 && digitos.length === largoPin && !enviando) {
      formRef.current?.requestSubmit();
    }
  }, [digitos, largoPin, enviando]);

  const escribir = (t) => {
    if (enviando) return;
    if (t === 'borrar') setDigitos((d) => d.slice(0, -1));
    else if (largoPin === 0 || digitos.length < largoPin) setDigitos((d) => d + t);
  };

  if (!hayPin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <ShieldAlert size={40} className="text-alto" aria-hidden="true" />
        <h1 className="text-xl font-bold">Falta configurar el PIN</h1>
        <p className="max-w-xs text-sm text-tenue">
          Define la variable <code className="font-mono text-xs">APP_PIN</code> en Vercel
          (Settings → Environment Variables) y vuelve a desplegar.
        </p>
        <p className="max-w-xs text-xs text-tenue">
          Hasta entonces la aplicación queda cerrada a propósito, para no dejar los datos
          de Gaelito al descubierto.
        </p>
      </div>
    );
  }

  const puntos = largoPin || Math.max(digitos.length, 4);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-superficie">
            <Lock size={24} className="text-acento" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold">PancreasOS</h1>
          <p className="text-sm text-tenue">Escribe el PIN para entrar</p>
        </div>

        <div className="flex gap-3" role="status" aria-label={`${digitos.length} dígitos escritos`}>
          {Array.from({ length: puntos }).map((_, i) => (
            <span
              key={i}
              className={`size-4 rounded-full border transition-colors ${
                i < digitos.length ? 'border-acento bg-acento' : 'border-borde bg-transparent'
              }`}
            />
          ))}
        </div>

        <p
          role="alert"
          aria-live="polite"
          className={`min-h-5 text-sm ${estado && !estado.ok ? 'text-bajo' : 'text-transparent'}`}
        >
          {estado && !estado.ok ? estado.mensaje : '.'}
        </p>
      </div>

      <form ref={formRef} action={accion} className="w-full max-w-xs">
        <input type="hidden" name="pin" value={digitos} readOnly />

        <div className="grid grid-cols-3 gap-3">
          {TECLAS.map((t, i) =>
            t === null ? (
              <span key={`hueco-${i}`} />
            ) : (
              <button
                key={t}
                type="button"
                onClick={() => escribir(t)}
                disabled={enviando}
                aria-label={t === 'borrar' ? 'Borrar' : t}
                className="flex min-h-16 items-center justify-center rounded-2xl border border-borde bg-superficie font-mono text-2xl font-semibold transition-colors active:bg-superficie-alta disabled:opacity-40"
              >
                {t === 'borrar' ? <Delete size={22} aria-hidden="true" /> : t}
              </button>
            )
          )}
        </div>
      </form>
    </div>
  );
}
