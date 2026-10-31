// No patient-specific defaults: a missing or invalid prescription stays missing.
export const TIPOS_COMIDA = ["Desayuno", "Comida", "Cena", "Colación"];

export function validarPauta(data) {
  if (!data || data.mode !== "fixed" || !data.rapid || !data.basal) return null;
  const doses = [
    data.rapid.Desayuno,
    data.rapid.Comida,
    data.rapid.Cena,
    data.basal.units,
  ];
  if (
    doses.some(
      (n) => typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > 100,
    )
  )
    return null;
  if (
    !Number.isFinite(data.icr) ||
    data.icr <= 0 ||
    !Number.isFinite(data.isf) ||
    data.isf <= 0
  )
    return null;
  return data;
}

export function referenciaCarbos(pauta, comida) {
  const p = validarPauta(pauta);
  if (!p || !Object.hasOwn(p.rapid, comida)) return null;
  // Arithmetic reference only. Never subtract a correction or active insulin,
  // reduce for dawn/trend, or convert protein/fat into additional insulin.
  return Math.round(p.rapid[comida] * p.icr * 10) / 10;
}

// Reserved for a COMPLETE clinician-specified protocol. No inferred target,
// default insulin-action duration, dawn factor or extra correction injection.
// The current care plan deliberately leaves this disabled.
export function repartoDeDosisFija(
  pauta,
  comida,
  contexto,
  ahora = Date.now(),
) {
  const p = validarPauta(pauta);
  const regla = p?.carbAdjustment;
  const objetivo = regla?.mealTargets?.[comida];
  if (
    !regla?.enabled ||
    !regla.reserveInFixedDoseConfirmed ||
    !Number.isFinite(objetivo) ||
    !Number.isFinite(regla.minHoursSinceRapid) ||
    regla.minHoursSinceRapid <= 0 ||
    !Number.isFinite(regla.maxGlucoseForAdjustment)
  ) {
    return {
      ok: false,
      mensaje:
        "Falta completar el objetivo de comida y el protocolo de corrección con el equipo médico.",
    };
  }
  if (
    objetivo < 70 ||
    objetivo > 180 ||
    regla.maxGlucoseForAdjustment <= objetivo
  )
    return {
      ok: false,
      mensaje: "Los parámetros del protocolo no son válidos.",
    };
  const sensor = estadoSensor(contexto?.lectura, ahora);
  if (["sin-datos", "antigua", "baja"].includes(sensor.estado))
    return { ok: false, mensaje: sensor.mensaje };
  if (!contexto?.registrosCompletosConfirmados)
    return {
      ok: false,
      mensaje:
        "No se puede descartar insulina activa con registros incompletos.",
    };
  if (contexto.ultimaRapida) {
    const t = new Date(contexto.ultimaRapida).getTime();
    if (!Number.isFinite(t) || ahora - t < regla.minHoursSinceRapid * 3600000)
      return {
        ok: false,
        mensaje:
          "Hay una dosis reciente o de hora incierta. Sigue el protocolo del equipo médico.",
      };
  }
  const glucosa = Number(contexto.lectura.glucose_value);
  if (glucosa > regla.maxGlucoseForAdjustment)
    return {
      ok: false,
      mensaje: "La glucosa excede el límite autorizado para este cálculo.",
    };
  const fija = p.rapid[comida];
  if (!Number.isFinite(fija))
    return {
      ok: false,
      mensaje: "No hay dosis fija indicada para esta comida.",
    };
  const reservadas = Math.max(0, (glucosa - objetivo) / p.isf);
  if (reservadas >= fija)
    return {
      ok: false,
      mensaje:
        "El cálculo no deja una porción de comida válida. No se elimina la comida automáticamente.",
    };
  return {
    ok: true,
    unidadesTotales: fija,
    unidadesReservadas: reservadas,
    unidadesParaComida: fija - reservadas,
    carbohidratosReferencia: (fija - reservadas) * p.icr,
    objetivo,
    nota: "Aritmética de la pauta. No predice ni garantiza la glucosa posterior.",
  };
}

export function estadoSensor(lectura, ahora = Date.now()) {
  const valor = Number(lectura?.glucose_value);
  const fecha = new Date(lectura?.timestamp).getTime();
  if (
    !Number.isFinite(valor) ||
    valor <= 0 ||
    !Number.isFinite(fecha) ||
    fecha > ahora + 5 * 60000
  ) {
    return {
      estado: "sin-datos",
      mensaje: "No hay una lectura válida del sensor.",
    };
  }
  if (ahora - fecha > 15 * 60000)
    return {
      estado: "antigua",
      mensaje:
        "Lectura de más de 15 minutos. Actualiza el sensor antes de usar el asistente.",
    };
  if (valor < 70)
    return {
      estado: "baja",
      mensaje:
        "Glucosa baja: sigue el plan de hipoglucemia de su equipo médico. Las preferencias de evitar azúcar no aplican al rescate.",
    };
  if (valor >= 250)
    return {
      estado: "alta",
      mensaje:
        "Glucosa de 250 mg/dL o más. Sigue su plan médico para hiperglucemia y cetonas. Esta app no repartirá la dosis fija ni ajustará porciones mientras falten los parámetros del protocolo.",
    };
  if (valor > 180)
    return {
      estado: "fuera-rango",
      mensaje: "Glucosa por encima de 180 mg/dL. Para proponer porciones ajustadas falta el objetivo de comida indicado por su equipo médico. Puedes contar y registrar los alimentos reales.",
    };
  return {
    estado: "reciente",
    mensaje: "Lectura reciente del sensor.",
  };
}

export function edadEnFecha(nacimiento, fecha) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(nacimiento || "") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")
  )
    return null;
  const [y, m, d] = nacimiento.split("-").map(Number);
  const [ay, am, ad] = fecha.split("-").map(Number);
  return ay - y - (am < m || (am === m && ad < d) ? 1 : 0);
}
