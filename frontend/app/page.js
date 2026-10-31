import { Suspense } from "react";
import Link from "next/link";
import {
  Lock,
  UtensilsCrossed,
  Syringe,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import GlucoseHero from "@/components/GlucoseHero";
import QuickStats from "@/components/QuickStats";
import AutoRefresh from "@/components/AutoRefresh";
import ErrorDeConexion from "@/components/ErrorDeConexion";
import VigilanteHipo from "@/components/VigilanteHipo";
import VigilanteIA, { VigilanteIACargando } from "@/components/VigilanteIA";
import GraficaGlucosa from "@/components/GraficaGlucosa";
import { cerrarSesion } from "@/app/pin-actions";
import {
  getUltimaLectura,
  getLecturaPrevia,
  getUltimaInsulina,
  getUltimaComida,
  getTotalesDeHoy,
  getLecturasDeHoy,
} from "@/lib/queries";
import { getPauta } from "@/lib/pauta";
import { prepararGrafica } from "@/lib/grafica";
import { fechaLarga } from "@/lib/glucosa";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  let lectura, previa, insulina, comida, totales, curva, pauta;
  try {
    [lectura, previa, insulina, comida, totales, curva, pauta] =
      await Promise.all([
        getUltimaLectura(),
        getLecturaPrevia(),
        getUltimaInsulina(),
        getUltimaComida(),
        getTotalesDeHoy(),
        getLecturasDeHoy(),
        getPauta(),
      ]);
  } catch (err) {
    console.error("[dashboard]", err?.code);
    return (
      <ErrorDeConexion mensaje="No pudimos cargar los datos. Revisa tu conexión e intenta de nuevo." />
    );
  }
  return (
    <div className="pagina">
      <AutoRefresh segundos={60} />
      <VigilanteHipo
        glucosa={lectura?.glucose_value}
        timestamp={lectura?.timestamp}
      />
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Activity size={16} aria-hidden="true" /> Pancreas OS
          </p>
          <h1 className="titulo-pagina">El día de Gaelito</h1>
          <p className="mt-2 text-sm text-tenue">{fechaLarga(new Date())}</p>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            aria-label="Bloquear la aplicación"
            className="flex size-12 items-center justify-center rounded-full border border-borde bg-superficie text-tenue"
          >
            <Lock size={18} aria-hidden="true" />
          </button>
        </form>
      </header>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
        <div className="flex flex-col gap-4">
          <GlucoseHero lectura={lectura} previa={previa} />
          <Suspense fallback={<VigilanteIACargando />}>
            <VigilanteIA />
          </Suspense>
        </div>
        <section
          className="flex flex-col gap-3"
          aria-label="Gráfica de glucosa de hoy"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">La curva de hoy</h2>
            <Link
              href="/historial"
              className="flex min-h-11 items-center gap-1 text-sm text-acento"
            >
              Ver historial
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <GraficaGlucosa datos={prepararGrafica(curva)} />
          <p className="text-xs text-tenue">
            Banda de referencia general: 70–180 mg/dL. Los espacios sin lecturas
            no se rellenan.
          </p>
        </section>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/registro?tipo=comida" className="boton-primario">
          <UtensilsCrossed size={20} aria-hidden="true" />
          Registrar comida
        </Link>
        <Link href="/registro?tipo=insulina" className="boton-secundario">
          <Syringe size={20} aria-hidden="true" />
          Registrar insulina
        </Link>
      </div>
      {pauta && (
        <section className="tarjeta p-5" aria-label="Pauta médica vigente">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Pauta de seguimiento</p>
              <h2 className="mt-1 text-lg font-semibold">
                Las dosis indicadas en consulta
              </h2>
            </div>
            <Link
              href="/pauta"
              className="flex min-h-11 items-center gap-1 text-sm text-acento"
            >
              Ver pauta
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ...["Desayuno", "Comida", "Cena"].map((k) => [k, pauta.rapid[k]]),
              ["Tresiba", pauta.basal.units],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-superficie-alta p-3">
                <p className="text-xs text-tenue">{k}</p>
                <p className="mt-1 font-mono text-xl font-semibold">
                  {v}
                  <span className="ml-1 text-xs text-tenue">U</span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-tenue">{pauta.basal.timing}</p>
          {pauta.reviewDue && (
            <p className="aviso mt-3 text-alto">
              La fecha de revisión ya llegó. Confirma la pauta con su equipo
              médico; las dosis no aumentan automáticamente.
            </p>
          )}
        </section>
      )}
      <QuickStats insulina={insulina} comida={comida} totales={totales} />
    </div>
  );
}
