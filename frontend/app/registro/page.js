import RegistroTabs from "@/components/RegistroTabs";
import ErrorDeConexion from "@/components/ErrorDeConexion";
import { getUltimaLectura } from "@/lib/queries";
import { getPauta } from "@/lib/pauta";
import catalogo from "@/lib/alimentos.json";
export const dynamic = "force-dynamic";
export const metadata = { title: "Registrar · Pancreas OS" };
export default async function RegistroPage({ searchParams }) {
  const { tipo } = await searchParams;
  let lectura, pauta;
  try {
    [lectura, pauta] = await Promise.all([getUltimaLectura(), getPauta()]);
  } catch {
    return (
      <ErrorDeConexion mensaje="No pudimos cargar los datos para el registro. Intenta de nuevo." />
    );
  }
  return (
    <div className="pagina">
      <header>
        <p className="eyebrow">Pancreas OS · Registro</p>
        <h1 className="titulo-pagina">Cada dato, en su lugar</h1>
        <p className="mt-2 text-tenue">
          Comida consumida e insulina administrada, con su hora real.
        </p>
      </header>
      <RegistroTabs
        key={tipo === "insulina" ? "insulina" : "comida"}
        inicial={tipo === "insulina" ? "insulina" : "comida"}
        lectura={
          lectura ? { ...lectura, timestamp: String(lectura.timestamp) } : null
        }
        pauta={
          pauta
            ? {
                mode: pauta.mode,
                rapid: pauta.rapid,
                basal: pauta.basal,
                icr: pauta.icr,
                isf: pauta.isf,
              }
            : null
        }
        catalogo={catalogo}
      />
    </div>
  );
}
