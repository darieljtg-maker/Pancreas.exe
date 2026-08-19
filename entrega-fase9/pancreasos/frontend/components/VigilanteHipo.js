'use client';

import { useState } from 'react';
import AlertaHipoglucemia from './AlertaHipoglucemia';
import { UMBRAL_HIPO } from '@/lib/menus';

/**
 * Decide cuándo salta el protocolo de hipoglucemia en el dashboard.
 *
 * Se puede cerrar para no estorbar mientras se atiende a Gaelito, pero si
 * el sensor manda una lectura NUEVA que sigue por debajo de 70, vuelve a
 * abrirse: el descarte aplica a esa lectura, no a la hipoglucemia entera.
 */
export default function VigilanteHipo({ glucosa, timestamp }) {
  const [descartada, setDescartada] = useState(null);

  const valor = glucosa != null ? Number(glucosa) : null;
  const clave = timestamp ? String(timestamp) : null;

  const debeAbrirse =
    Number.isFinite(valor) && valor < UMBRAL_HIPO && descartada !== clave;

  if (!debeAbrirse) return null;

  return <AlertaHipoglucemia glucosa={valor} onCerrar={() => setDescartada(clave)} />;
}
