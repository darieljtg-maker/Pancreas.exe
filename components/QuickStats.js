import { Syringe, UtensilsCrossed, Droplets, Footprints } from 'lucide-react';
import { hora, haceCuanto } from '@/lib/glucosa';

function Tarjeta({ Icono, titulo, valor, detalle, pie }) {
  return (
    <div className="tarjeta flex flex-col gap-1 p-4">
      <div className="flex items-center gap-2 text-tenue">
        <Icono size={16} aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{titulo}</span>
      </div>
      <p className="text-lg font-semibold leading-tight">{valor}</p>
      {detalle && <p className="line-clamp-2 text-sm text-tenue">{detalle}</p>}
      {pie && <p className="mt-auto pt-1 text-xs text-tenue">{pie}</p>}
    </div>
  );
}

export default function QuickStats({ insulina, comida, totales }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Resumen del día">
      <div className="grid grid-cols-2 gap-3">
        <Tarjeta
          Icono={Syringe}
          titulo="Última insulina"
          valor={insulina ? `${Number(insulina.units)} U` : 'Sin registro'}
          detalle={insulina ? insulina.type : 'Registra la primera dosis'}
          pie={insulina ? `${hora(insulina.timestamp)} · ${haceCuanto(insulina.timestamp)}` : null}
        />
        <Tarjeta
          Icono={UtensilsCrossed}
          titulo="Última comida"
          valor={comida ? `${Number(comida.carbs_grams)} g` : 'Sin registro'}
          detalle={comida ? comida.description : 'Registra la primera comida'}
          pie={comida ? `${comida.meal_type} · ${hora(comida.timestamp)}` : null}
        />
      </div>

      <div className="tarjeta grid grid-cols-4 divide-x divide-borde p-1">
        {[
          { Icono: UtensilsCrossed, valor: `${totales.carbos}`, unidad: 'g carbos' },
          { Icono: Syringe, valor: `${totales.unidades}`, unidad: 'U hoy' },
          { Icono: Droplets, valor: `${totales.aguaMl}`, unidad: 'ml agua' },
          { Icono: Footprints, valor: `${totales.minutosActividad}`, unidad: 'min activo' },
        ].map(({ Icono, valor, unidad }) => (
          <div key={unidad} className="flex flex-col items-center gap-0.5 px-1 py-3">
            <Icono size={14} className="text-tenue" aria-hidden="true" />
            <span className="font-mono text-base font-semibold tabular-nums">{valor}</span>
            <span className="text-center text-[10px] leading-tight text-tenue">{unidad}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
