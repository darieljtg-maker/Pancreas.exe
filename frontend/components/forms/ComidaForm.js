'use client';

import { useActionState, useEffect, useRef } from 'react';
import { registrarComida } from '@/app/actions';
import { OpcionBoton, Campo, Entrada, AreaTexto, BotonGuardar, Mensaje, HoraOpcional } from './Campos';

const TIPOS = ['Desayuno', 'Comida', 'Cena', 'Colación'];

export default function ComidaForm() {
  const [estado, accion] = useActionState(registrarComida, null);
  const formRef = useRef(null);

  useEffect(() => {
    if (estado?.ok) formRef.current?.reset();
  }, [estado]);

  return (
    <form ref={formRef} action={accion} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Tipo de comida</legend>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((tipo) => (
            <OpcionBoton key={tipo} name="meal_type" value={tipo} required>
              {tipo}
            </OpcionBoton>
          ))}
        </div>
      </fieldset>

      <Campo etiqueta="¿Qué comió?">
        <AreaTexto
          name="description"
          required
          maxLength={500}
          placeholder="Quesadillas de queso con frijoles y jugo de naranja"
        />
      </Campo>

      <Campo etiqueta="Carbohidratos" hint="gramos">
        <Entrada
          name="carbs_grams"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          max="500"
          required
          placeholder="48"
        />
      </Campo>

      <HoraOpcional />
      <Mensaje estado={estado} />
      <BotonGuardar>Guardar comida</BotonGuardar>
    </form>
  );
}
