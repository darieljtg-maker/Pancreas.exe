'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker, que existe solo para que la app se pueda
 * instalar en la pantalla de inicio. No cachea datos de glucosa a propósito:
 * un valor viejo mostrado como si fuera actual sería peligroso.
 */
export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('No se pudo registrar el service worker:', err);
    });
  }, []);

  return null;
}
