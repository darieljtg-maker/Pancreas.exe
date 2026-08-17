'use client';

import { useActionState, useEffect, useRef } from 'react';
import { registrarActividad } from '@/app/actions';
import { OpcionBoton, Campo, Entrada, BotonGuardar, Mensaje, HoraOpcional } from './Campos';

const SUGERENCIAS = ['Fútbol', 'Bicicleta', 'Natación', 'Caminata', 'Educación física', 'Juego libre'];

export default function ActividadForm() {
  const [estado, accion] = useActionState(registrarActividad, null);
  const formRef = useRef(null);

  useEffect(() => {
    if (estado?.ok) formRef.current?.reset();
  }, [estado]);

  return (
    <form ref={formRef} action={accion} className="flex flex-col gap-4">
      <Campo etiqueta="¿Qué hizo?">
        <Entrada
          name="activity_type"
          list="sugerencias-actividad"
          required
          maxLength={100}
          placeholder="Fútbol"
        />
      </Campo>
      <datalist id="sugerencias-actividad">
        {SUGERENCIAS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <Campo etiqueta="Duración" hint="minutos">
        <Entrada
          name="duration_minutes"
          type="number"
          inputMode="numeric"
          step="5"
          min="1"
          max="600"
          required
          placeholder="60"
          className="text-2xl"
        />
      </Campo>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Intensidad</legend>
        <div className="flex gap-2">
          {['Baja', 'Media', 'Alta'].map((nivel) => (
            <OpcionBoton key={nivel} name="intensity" value={nivel} required>
              {nivel}
            </OpcionBoton>
          ))}
        </div>
      </fieldset>

      <HoraOpcional />
      <Mensaje estado={estado} />
      <BotonGuardar>Guardar actividad</BotonGuardar>
    </form>
  );
}
