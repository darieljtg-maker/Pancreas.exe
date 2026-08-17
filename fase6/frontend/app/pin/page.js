import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import PantallaPIN from '@/components/PantallaPIN';
import { COOKIE_SESION, hayPin, pinConfigurado, tokenValido } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'PancreasOS' };

export default async function PaginaPin({ searchParams }) {
  const almacen = await cookies();
  if (tokenValido(almacen.get(COOKIE_SESION)?.value)) redirect('/');

  const { desde } = await searchParams;
  // Solo rutas internas: evita que un enlace externo use esto como redirección.
  const destino = typeof desde === 'string' && /^\/[^/]/.test(desde) ? desde : '/';

  return (
    <PantallaPIN
      hayPin={hayPin()}
      largoPin={pinConfigurado().length}
      destino={destino}
    />
  );
}
