import RegistroTabs from '@/components/RegistroTabs';

export const metadata = { title: 'Registrar · PancreasOS' };

const VALIDAS = ['comida', 'insulina', 'agua', 'actividad'];

/** Acepta /registro?tipo=insulina para entrar directo a una pestaña. */
export default async function RegistroPage({ searchParams }) {
  const { tipo } = await searchParams;
  const inicial = VALIDAS.includes(tipo) ? tipo : 'comida';

  return (
    <div className="flex flex-col gap-5 pb-4">
      <header>
        <h1 className="text-2xl font-bold">Registrar</h1>
        <p className="text-sm text-tenue">Se guarda directo en la base de datos.</p>
      </header>

      <RegistroTabs inicial={inicial} />
    </div>
  );
}
