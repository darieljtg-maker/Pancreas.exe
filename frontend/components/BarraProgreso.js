import { progreso } from '@/lib/calculosNutricionales';

/**
 * Consumido contra meta. La barra se topa al 100% pero el número no:
 * pasarse también es información, y esconderla sería mentir.
 */
function Barra({ etiqueta, consumido, meta, unidad, color }) {
  const pct = progreso(consumido, meta);
  const excedido = consumido > meta;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{etiqueta}</span>
        <span className="font-mono tabular-nums text-tenue">
          <span className={excedido ? 'font-bold text-alto' : 'text-texto'}>
            {Math.round(consumido)}
          </span>
          {' / '}
          {Math.round(meta)} {unidad}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-superficie-alta"
        role="progressbar"
        aria-label={etiqueta}
        aria-valuenow={Math.round(consumido)}
        aria-valuemin={0}
        aria-valuemax={Math.round(meta)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: excedido ? '#F5A524' : color }}
        />
      </div>
    </div>
  );
}

export default function BarraProgreso({ consumido, meta }) {
  return (
    <section
      aria-label="Progreso del día"
      className="tarjeta flex flex-col gap-3 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-tenue">Hoy vs meta</p>
      <Barra etiqueta="Calorías" consumido={consumido.calorias} meta={meta.calorias} unidad="kcal" color="#38BDF8" />
      <Barra etiqueta="Proteína" consumido={consumido.proteina} meta={meta.proteina} unidad="g" color="#A78BFA" />
      <Barra etiqueta="Carbohidratos" consumido={consumido.carbos} meta={meta.carbos} unidad="g" color="#22C55E" />
      <Barra etiqueta="Grasa" consumido={consumido.grasa} meta={meta.grasa} unidad="g" color="#F5A524" />
    </section>
  );
}
