'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { RANGO } from '@/lib/config';

const COLORES = { bajo: '#FF4D4F', rango: '#22C55E', alto: '#F5A524', linea: '#38BDF8' };

function TooltipPersonalizado({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const color =
    p.valor < RANGO.bajo ? COLORES.bajo : p.valor > RANGO.alto ? COLORES.alto : COLORES.rango;

  return (
    <div className="rounded-lg border border-borde bg-superficie-alta px-3 py-2 text-sm shadow-lg">
      <p className="font-mono text-base font-semibold" style={{ color }}>
        {p.valor} <span className="text-xs text-tenue">mg/dL</span>
      </p>
      <p className="text-xs text-tenue">{p.etiqueta}</p>
    </div>
  );
}

/**
 * Curva del día. Las bandas de color importan más que la línea: de un vistazo
 * quieres ver cuánto tiempo estuvo fuera de rango, no el valor exacto.
 */
export default function GlucoseChart({ datos }) {
  if (!datos?.length) {
    return (
      <div className="tarjeta flex h-64 items-center justify-center px-6 text-center text-sm text-tenue">
        Todavía no hay lecturas de hoy.
      </div>
    );
  }

  const maximo = Math.max(220, ...datos.map((d) => d.valor)) + 20;

  return (
    <div className="tarjeta p-3 pt-5">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={datos} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGlucosa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORES.linea} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLORES.linea} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Banda del rango objetivo: el "carril" donde debería ir la curva. */}
          <ReferenceArea
            y1={RANGO.bajo}
            y2={RANGO.alto}
            fill={COLORES.rango}
            fillOpacity={0.09}
          />
          <ReferenceLine y={RANGO.bajo} stroke={COLORES.bajo} strokeDasharray="4 4" strokeOpacity={0.6} />
          <ReferenceLine y={RANGO.alto} stroke={COLORES.alto} strokeDasharray="4 4" strokeOpacity={0.6} />

          <CartesianGrid stroke="#253140" strokeOpacity={0.4} vertical={false} />

          <XAxis
            dataKey="hora"
            type="number"
            domain={[0, 24]}
            ticks={[0, 6, 12, 18, 24]}
            tickFormatter={(h) => `${String(h).padStart(2, '0')}h`}
            stroke="#8A98A6"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[40, maximo]}
            ticks={[70, 180, 250]}
            stroke="#8A98A6"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={38}
          />

          <Tooltip content={<TooltipPersonalizado />} cursor={{ stroke: '#8A98A6', strokeWidth: 1 }} />

          <Area
            type="monotone"
            dataKey="valor"
            stroke={COLORES.linea}
            strokeWidth={2}
            fill="url(#areaGlucosa)"
            dot={false}
            activeDot={{ r: 4, fill: COLORES.linea }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
