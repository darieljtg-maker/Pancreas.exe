import { TZ } from "./config";
export function prepararGrafica(lecturas) {
  const datos = lecturas.map((l) => {
    const fecha = new Date(l.timestamp);
    const partes = new Intl.DateTimeFormat("es-MX", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(fecha);
    const h = Number(partes.find((p) => p.type === "hour").value) % 24;
    const m = Number(partes.find((p) => p.type === "minute").value);
    return {
      hora: h + m / 60,
      valor: Number(l.glucose_value),
      etiqueta: new Intl.DateTimeFormat("es-MX", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
      }).format(fecha),
      timestamp: fecha.toISOString(),
    };
  });
  return datos.flatMap((d, i) => {
    const previa = datos[i - 1];
    if (
      previa &&
      new Date(d.timestamp) - new Date(previa.timestamp) > 20 * 60000
    ) {
      return [
        {
          hora: (previa.hora + d.hora) / 2,
          valor: null,
          etiqueta: "Sin lecturas",
        },
        d,
      ];
    }
    return [d];
  });
}
