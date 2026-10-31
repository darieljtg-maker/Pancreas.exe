"use client";

import { useEffect, useState } from "react";
import AlertaHipoglucemia from "./AlertaHipoglucemia";
import { UMBRAL_HIPO } from "@/lib/menus";

/**
 * Decide cuándo salta el protocolo de hipoglucemia en el dashboard.
 *
 * Se puede cerrar para no estorbar mientras se atiende a Gaelito, pero si
 * el sensor manda una lectura NUEVA que sigue por debajo de 70, vuelve a
 * abrirse: el descarte aplica a esa lectura, no a la hipoglucemia entera.
 */
export default function VigilanteHipo({ glucosa, timestamp }) {
  const [descartada, setDescartada] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(reloj);
  }, []);

  const valor = glucosa != null ? Number(glucosa) : null;
  const clave = timestamp ? String(timestamp) : null;

  const debeAbrirse =
    Number.isFinite(valor) &&
    valor > 0 &&
    valor < UMBRAL_HIPO &&
    descartada !== clave &&
    Number.isFinite(new Date(timestamp).getTime()) &&
    ahora - new Date(timestamp).getTime() <= 15 * 60000 &&
    new Date(timestamp).getTime() <= ahora + 5 * 60000;

  if (!debeAbrirse) return null;

  return (
    <AlertaHipoglucemia glucosa={valor} onCerrar={() => setDescartada(clave)} />
  );
}
