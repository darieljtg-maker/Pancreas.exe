import { DatabaseZap } from 'lucide-react';

/** Si Neon no responde, decimos qué pasó en vez de mostrar una pantalla rota. */
export default function ErrorDeConexion({ mensaje }) {
  return (
    <div className="tarjeta flex flex-col items-center gap-3 px-6 py-12 text-center">
      <DatabaseZap className="text-bajo" size={32} aria-hidden="true" />
      <p className="text-lg font-semibold">No se pudo leer la base de datos</p>
      <p className="text-sm text-tenue">
        Revisa que <code className="font-mono text-xs">DATABASE_URL</code> esté configurada y que
        Neon esté despierto.
      </p>
      {mensaje && (
        <p className="max-w-full break-words rounded-lg bg-superficie-alta px-3 py-2 font-mono text-xs text-tenue">
          {mensaje}
        </p>
      )}
    </div>
  );
}
