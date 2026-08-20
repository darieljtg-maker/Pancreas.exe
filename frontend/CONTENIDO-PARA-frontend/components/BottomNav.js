'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, PlusCircle, LineChart, Dumbbell } from 'lucide-react';

const ENLACES = [
  { href: '/', etiqueta: 'Ahora', Icono: Activity },
  { href: '/registro', etiqueta: 'Registrar', Icono: PlusCircle },
  { href: '/plan', etiqueta: 'Plan', Icono: Dumbbell },
  { href: '/historial', etiqueta: 'Historial', Icono: LineChart },
];

/**
 * Punto que aparece bajo la pestaña tocada mientras la ruta llega.
 *
 * Todas las páginas son `force-dynamic` y consultan Neon, así que entre el
 * toque y el cambio de pantalla pasa medio segundo largo. Con los
 * `loading.js` la transición ya es inmediata, pero si la red va lenta esto
 * confirma que el toque se registró en vez de dejar la pantalla muda.
 */
function Pendiente() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-2 h-1 w-1 animate-ping rounded-full bg-acento"
    />
  );
}

export default function BottomNav() {
  const ruta = usePathname();

  // En la pantalla del PIN no hay a dónde navegar todavía.
  if (ruta === '/pin') return null;

  return (
    <nav
      data-nav-principal
      className="fixed inset-x-0 bottom-0 z-50 border-t border-borde bg-fondo/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex max-w-lg">
        {ENLACES.map(({ href, etiqueta, Icono }) => {
          const activo = ruta === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={activo ? 'page' : undefined}
              // min-h-16 mantiene el área táctil cómoda con el pulgar.
              className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                activo ? 'text-acento' : 'text-tenue active:text-texto'
              }`}
            >
              <Icono size={22} strokeWidth={activo ? 2.4 : 1.8} aria-hidden="true" />
              {etiqueta}
              <Pendiente />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
