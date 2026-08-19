'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * El sensor produce una lectura nueva cada 5 min. Esto vuelve a pedir los
 * Server Components sin recargar la página, y además al volver a la pestaña,
 * que es el caso real: desbloqueas el celular y quieres el dato de ahora.
 */
export default function AutoRefresh({ segundos = 60 }) {
  const router = useRouter();

  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };

    const id = setInterval(refrescar, segundos * 1000);
    document.addEventListener('visibilitychange', refrescar);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refrescar);
    };
  }, [router, segundos]);

  return null;
}
