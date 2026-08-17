'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, PlusCircle, LineChart } from 'lucide-react';

const ENLACES = [
  { href: '/', etiqueta: 'Ahora', Icono: Activity },
  { href: '/registro', etiqueta: 'Registrar', Icono: PlusCircle },
  { href: '/historial', etiqueta: 'Historial', Icono: LineChart },
];

export default function BottomNav() {
  const ruta = usePathname();

  return (
    <nav
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
              className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                activo ? 'text-acento' : 'text-tenue active:text-texto'
              }`}
            >
              <Icono size={22} strokeWidth={activo ? 2.4 : 1.8} aria-hidden="true" />
              {etiqueta}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
