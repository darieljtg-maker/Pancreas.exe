'use client';

import { useActionState, useEffect, useRef } from 'react';
import { registrarInsulina } from '@/app/actions';
import { OpcionBoton, Campo, Entrada, BotonGuardar, Mensaje, HoraOpcional } from './Campos';

export default function InsulinaForm() {
  const [estado, accion] = useActionState(registrarInsulina, null);
  const formRef = useRef(null);

  useEffect(() => {
    if (estado?.ok) formRef.current?.reset();
  }, [estado]);

  return (
    <form ref={formRef} action={accion} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tipo de insulina</legend>
        <div className="flex gap-2">
          <OpcionBoton name="type" value="Lyumjev" required>
            Lyumjev
            <span className="ml-1 text-xs text-tenue">rápida</span>
          </OpcionBoton>
          <OpcionBoton name="type" value="Tresiba">
            Tresiba
            <span className="ml-1 text-xs text-tenue">basal</span>
          </OpcionBoton>
        </div>
      </fieldset>

      <Campo etiqueta="Unidades" hint="U">
        <Entrada
          name="units"
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0.5"
          max="100"
          required
          placeholder="5.5"
          // Teclado numérico grande: se captura con una mano y con prisa.
          className="text-2xl"
        />
      </Campo>

      <HoraOpcional />
      <Mensaje estado={estado} />
      <BotonGuardar>Guardar dosis</BotonGuardar>
    </form>
  );
}
