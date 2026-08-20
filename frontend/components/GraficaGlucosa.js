'use client';

import dynamic from 'next/dynamic';

/**
 * La gráfica, cargada aparte.
 *
 * `recharts` pesa 362 KB comprimidos: medido, era el 44% de todo el
 * JavaScript de /historial (820 KB contra los ~480 KB del resto de la app) y
 * hacía que esa pestaña tardara el doble que las demás en responder.
 *
 * Cargándola aparte, la página se puede usar mientras la gráfica llega. No
 * se renderiza en el servidor porque el HTML de un SVG de recharts es
 * enorme y de todas formas se vuelve a dibujar en el cliente.
 */
const GlucoseChart = dynamic(() => import('./GlucoseChart'), {
  ssr: false,
  loading: () => (
    <div
      className="h-64 w-full animate-pulse rounded-2xl bg-superficie-alta"
      aria-busy="true"
      aria-label="Cargando la gráfica"
    />
  ),
});

export default function GraficaGlucosa(props) {
  return <GlucoseChart {...props} />;
}
