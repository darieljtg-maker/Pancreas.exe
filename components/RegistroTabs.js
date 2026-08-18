'use client';

import { useState } from 'react';
import { UtensilsCrossed, Syringe, Droplets, Footprints } from 'lucide-react';

import ComidaForm from './forms/ComidaForm';
import InsulinaForm from './forms/InsulinaForm';
import AguaForm from './forms/AguaForm';
import ActividadForm from './forms/ActividadForm';

const PESTANAS = [
  { id: 'comida', etiqueta: 'Comida', Icono: UtensilsCrossed, Form: ComidaForm },
  { id: 'insulina', etiqueta: 'Insulina', Icono: Syringe, Form: InsulinaForm },
  { id: 'agua', etiqueta: 'Agua', Icono: Droplets, Form: AguaForm },
  { id: 'actividad', etiqueta: 'Actividad', Icono: Footprints, Form: ActividadForm },
];

export default function RegistroTabs({ inicial = 'comida', glucosaActual, tendenciaActual }) {
  const [activa, setActiva] = useState(inicial);
  const actual = PESTANAS.find((p) => p.id === activa) ?? PESTANAS[0];
  const { Form } = actual;

  // Solo el formulario de comida usa la glucosa (para calcular la porción).
  const props = actual.id === 'comida' ? { glucosaActual, tendenciaActual } : {};

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Tipo de registro" className="grid grid-cols-4 gap-2">
        {PESTANAS.map(({ id, etiqueta, Icono }) => {
          const activo = id === activa;
          return (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={activo}
              aria-controls={`panel-${id}`}
              onClick={() => setActiva(id)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-colors ${
                activo
                  ? 'border-acento bg-acento/15 text-acento'
                  : 'border-borde bg-superficie text-tenue'
              }`}
            >
              <Icono size={20} aria-hidden="true" />
              {etiqueta}
            </button>
          );
        })}
      </div>

      {/* Se monta solo el formulario activo: cambiar de pestaña limpia lo
          escrito, que es lo que quieres para no mezclar dos registros. */}
      <div role="tabpanel" id={`panel-${actual.id}`} key={actual.id}>
        <Form {...props} />
      </div>
    </div>
  );
}
