import { NextResponse } from 'next/server';
import { COOKIE_SESION, tokenValido } from '@/lib/auth';

/**
 * Candado real de la aplicación.
 *
 * Se hace aquí y no dentro de layout.js a propósito: un guardia en el layout
 * solo esconde la interfaz, pero el servidor ya habría renderizado los datos
 * de Gaelito y viajarían al navegador en la respuesta, visibles en la pestaña
 * de red. Cortando en el proxy, quien no traiga cookie válida nunca recibe
 * esos datos, y las Server Actions tampoco se pueden invocar.
 */
export function proxy(request) {
  const { pathname } = request.nextUrl;

  // La pantalla del PIN tiene que ser accesible sin sesión.
  if (pathname === '/pin' || pathname.startsWith('/pin/')) {
    return NextResponse.next();
  }

  if (tokenValido(request.cookies.get(COOKIE_SESION)?.value)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/pin';
  url.search = '';
  if (pathname !== '/') url.searchParams.set('desde', pathname);

  return NextResponse.redirect(url);
}

export const config = {
  // El manifest, el service worker y los iconos quedan fuera para que la PWA
  // se pueda seguir instalando desde la pantalla del PIN.
  matcher: [
    '/((?!_next/static|_next/image|icons/|manifest\\.json|sw\\.js|favicon\\.ico|icon\\.png|apple-icon\\.png).*)',
  ],
};
