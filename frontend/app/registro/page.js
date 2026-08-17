import RegistroTabs from '@/components/RegistroTabs';
import { getUltimaLectura } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Registrar · PancreasOS' };

const VALIDAS = ['comida', 'insulina', 'agua', 'actividad'];

/** Acepta /registro?tipo=insulina para entrar directo a una pestaña. */
export default async function RegistroPage({ searchParams }) {
  const { tipo } = await searchParams;
  const inicial = VALIDAS.includes(tipo) ? tipo : 'comida';

  // La calculadora de porciones arranca con la lectura del sensor ya puesta,
  // que es el dato con el que se decide cuánto pesar.
  let glucosaActual = null;
  try {
    const lectura = await getUltimaLectura();
    if (lectura) glucosaActual = Number(lectura.glucose_value);
  } catch (err) {
    console.error('[registro] no se pudo leer la glucosa actual', err);
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <header>
        <h1 className="text-2xl font-bold">Registrar</h1>
        <p className="text-sm text-tenue">Se guarda directo en la base de datos.</p>
      </header>

      <RegistroTabs inicial={inicial} glucosaActual={glucosaActual} />
    </div>
  );
}
