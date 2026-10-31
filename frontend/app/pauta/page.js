import Link from "next/link";
import { ArrowLeft, CalendarDays, ShieldCheck } from "lucide-react";
import { getPauta } from "@/lib/pauta";
import ErrorDeConexion from "@/components/ErrorDeConexion";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pauta médica · Pancreas OS" };
const fecha = (d) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(d + "T12:00:00Z"));
export default async function PautaPage() {
  let p;
  try {
    p = await getPauta();
  } catch {
    return <ErrorDeConexion mensaje="No pudimos cargar la pauta médica." />;
  }
  if (!p)
    return <p className="tarjeta p-6">No hay una pauta vigente configurada.</p>;
  return (
    <div className="pagina">
      <Link
        href="/"
        className="flex min-h-11 items-center gap-2 text-sm text-acento"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a mi día
      </Link>
      <header>
        <p className="eyebrow">Seguimiento clínico</p>
        <h1 className="titulo-pagina">La pauta vigente</h1>
        <p className="mt-2 text-tenue">
          Indicaciones de consulta comunicadas por la familia. Vigentes desde el{" "}
          {fecha(p.effectiveFrom)}.
        </p>
      </header>
      <section className="tarjeta p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck size={20} className="text-acento" aria-hidden="true" />
          Insulina indicada
        </h2>
        <dl className="mt-4 divide-y divide-borde">
          {["Desayuno", "Comida", "Cena"]
            .map((k) => [k, p.rapid[k]])
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-3">
                <dt>Lyumjev · {k}</dt>
                <dd className="font-mono font-semibold">{v} U</dd>
              </div>
            ))}
          <div className="flex justify-between gap-3 py-3">
            <dt>Tresiba · basal</dt>
            <dd className="font-mono font-semibold">{p.basal.units} U</dd>
          </div>
        </dl>
        <p className="mt-2 text-sm text-tenue">
          {p.basal.timing}. Registrar una comida no registra una inyección.
        </p>
      </section>
      <section className="tarjeta p-5">
        <h2 className="text-lg font-semibold">Ratio, factor y metas</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["Ratio insulina / carbohidratos", "1 U por " + p.icr + " g CH"],
            ["Factor de corrección", p.isf + " mg/dL por 1 U"],
            ["Al despertar", p.wakeTarget.join("–") + " mg/dL"],
            ["Antes de dormir", p.bedTarget.join("–") + " mg/dL"],
            ["Referencia general", p.generalTarget.join("–") + " mg/dL"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-tenue">{k}</dt>
              <dd className="mt-1 font-mono text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="aviso mt-5 text-alto">
          <p className="font-semibold">
            Ajuste de carbohidratos por glucosa: pendiente de parámetros
          </p>
          <p className="mt-2 text-sm">
            Está confirmada la indicación de reservar parte de la dosis fija
            para corrección. Falta el objetivo de cada comida y la regla sobre
            insulina aún activa. El rango general no se convierte en un objetivo
            elegido por la IA. No se añaden unidades automáticamente.
          </p>
        </div>
      </section>
      <section className="tarjeta p-5">
        <h2 className="text-lg font-semibold">Datos de seguimiento</h2>
        <p className="mt-3 text-tenue">
          {p.age} años · {p.weightKg} kg · {p.heightCm / 100} m
        </p>
        <p className="mt-2 text-sm text-tenue">
          Cumpleaños: {fecha(p.birthDate).replace(/ de \d{4}$/, "")}. Datos
          usados para el seguimiento, sin fórmulas automáticas de aumento de
          peso.
        </p>
      </section>
      <section className="tarjeta p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays size={20} className="text-acento" aria-hidden="true" />
          Próxima revisión
        </h2>
        <p className="mt-3 text-xl">{fecha(p.nextReview)}</p>
        <p className="mt-2 text-sm text-tenue">
          Las dosis solo cambian cuando se registra una nueva indicación médica.
        </p>
      </section>
    </div>
  );
}
