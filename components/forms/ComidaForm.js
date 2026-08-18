'use client';

import { useActionState, useState } from 'react';
import { Calculator } from 'lucide-react';

import { registrarComida } from '@/app/actions';
import CalculadoraPorciones from '@/components/CalculadoraPorciones';
import { TIPOS_COMIDA } from '@/lib/menus';
import { OpcionBoton, Campo, Entrada, AreaTexto, BotonGuardar, Mensaje, HoraOpcional } from './Campos';

/**
 * Alta de comida, con la calculadora de porciones incrustada arriba.
 *
 * Los campos son controlados a propósito: así el botón "Usar en el registro"
 * de la calculadora puede rellenar la descripción y los carbohidratos sin que
 * haya que copiarlos a mano.
 */
export default function ComidaForm({ glucosaActual, tendenciaActual }) {
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [carbos, setCarbos] = useState('');
  const [calculadoraAbierta, setCalculadoraAbierta] = useState(false);

  const [estado, accion] = useActionState(async (previo, formData) => {
    const resultado = await registrarComida(previo, formData);
    if (resultado?.ok) {
      setDescripcion('');
      setCarbos('');
      setTipo('');
      setCalculadoraAbierta(false);
    }
    return resultado;
  }, null);

  return (
    <div className="flex flex-col gap-4">
      {/* La calculadora vive aquí porque el orden real es: ver la glucosa,
          calcular los gramos, pesar, comer y entonces registrar. */}
      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <button
          type="button"
          onClick={() => setCalculadoraAbierta((v) => !v)}
          aria-expanded={calculadoraAbierta}
          className="flex min-h-14 w-full items-center gap-2 px-4 text-left text-sm font-semibold"
        >
          <Calculator size={18} className="text-acento" aria-hidden="true" />
          Calcular porción
          {tipo && <span className="font-normal text-tenue">· {tipo}</span>}
          <span className="ml-auto text-tenue">{calculadoraAbierta ? '−' : '+'}</span>
        </button>

        {calculadoraAbierta && (
          <div className="border-t border-borde p-4">
            {tipo ? (
              <CalculadoraPorciones
                glucosaInicial={glucosaActual}
                tendenciaInicial={tendenciaActual}
                tipoFijo={tipo}
                onUsar={({ carbos: c, descripcion: d }) => {
                  setCarbos(String(c));
                  setDescripcion(d);
                  setCalculadoraAbierta(false);
                }}
              />
            ) : (
              <p className="text-center text-sm text-tenue">
                Escoge primero el tipo de comida aquí abajo.
              </p>
            )}
          </div>
        )}
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Tipo de comida</legend>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_COMIDA.map((t) => (
              <OpcionBoton
                key={t}
                name="meal_type"
                value={t}
                required
                checked={tipo === t}
                onChange={() => setTipo(t)}
              >
                {t}
              </OpcionBoton>
            ))}
          </div>
        </fieldset>

        <Campo etiqueta="¿Qué comió?">
          <AreaTexto
            name="description"
            required
            maxLength={500}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Quesadillas de queso con frijoles y jugo de naranja"
          />
        </Campo>

        <Campo etiqueta="Carbohidratos" hint="gramos">
          <Entrada
            name="carbs_grams"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            max="500"
            required
            value={carbos}
            onChange={(e) => setCarbos(e.target.value)}
            placeholder="48"
          />
        </Campo>

        <HoraOpcional />
        <Mensaje estado={estado} />
        <BotonGuardar>Guardar comida</BotonGuardar>
      </form>
    </div>
  );
}
