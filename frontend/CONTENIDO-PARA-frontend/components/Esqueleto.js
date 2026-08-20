/**
 * Piezas grises que se enseñan mientras la ruta trae sus datos.
 *
 * Existen porque las páginas son `force-dynamic`: cada visita va a Neon y
 * eso tarda. Sin esto, al tocar una pestaña no pasaba nada durante medio
 * segundo y parecía que la app se había trabado.
 */

export function Bloque({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-superficie-alta ${className}`} />;
}

export function Encabezado() {
  return (
    <header className="flex flex-col gap-2">
      <Bloque className="h-7 w-48" />
      <Bloque className="h-4 w-32" />
    </header>
  );
}

export function Tarjeta({ className = 'h-32' }) {
  return <Bloque className={`w-full ${className}`} />;
}

export function Fila({ columnas = 4 }) {
  return (
    <div className="tarjeta grid gap-1 p-1" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
      {Array.from({ length: columnas }, (_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 px-1 py-3">
          <Bloque className="h-5 w-12" />
          <Bloque className="h-2.5 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Envoltura común: mismo alto aproximado que la página real, para que no salte. */
export default function Esqueleto({ children }) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-5 pb-4">
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}
