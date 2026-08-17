'use client';

import { useActionState, useState } from 'react';
import { registrarAgua } from '@/app/actions';
import { Campo, Entrada, BotonGuardar, Mensaje, HoraOpcional } from './Campos';

const PRESETS = [200, 250, 500, 750];
const POR_DEFECTO = 250;

export default function AguaForm() {
  const [ml, setMl] = useState(POR_DEFECTO);

  // El reset va aquí y no en un useEffect: esto corre como manejador del
  // envío, no durante el render, así que no encadena renders de más.
  const [estado, accion] = useActionState(async (previo, formData) => {
    const resultado = await registrarAgua(previo, formData);
    if (resultado?.ok) setMl(POR_DEFECTO);
    return resultado;
  }, null);

  return (
    <form action={accion} className="flex flex-col gap-4">
      {/* Los presets cubren el 90% de los casos: un vaso o una botella. */}
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => setMl(valor)}
            aria-pressed={ml === valor}
            className={`min-h-14 rounded-xl border text-sm font-medium transition-colors ${
              ml === valor
                ? 'border-acento bg-acento/15 text-acento'
                : 'border-borde bg-superficie text-texto'
            }`}
          >
            {valor}
            <span className="block text-[10px] text-tenue">ml</span>
          </button>
        ))}
      </div>

      <Campo etiqueta="Cantidad" hint="mililitros">
        <Entrada
          name="amount_ml"
          type="number"
          inputMode="numeric"
          step="10"
          min="10"
          max="3000"
          required
          value={ml}
          onChange={(e) => setMl(e.target.value)}
          className="text-2xl"
        />
      </Campo>

      <HoraOpcional />
      <Mensaje estado={estado} />
      <BotonGuardar>Guardar agua</BotonGuardar>
    </form>
  );
}
