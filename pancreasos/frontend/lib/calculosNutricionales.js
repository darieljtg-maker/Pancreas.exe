import { ALBA, enVentanaAlba } from './menus.js';

/**
 * Motor antropométrico para volumen limpio.
 *
 * Todo lo clínico configurable vive arriba, en PERFIL y RATIOS: si el
 * endocrinólogo o la nutrióloga cambian un número, se edita aquí y solo aquí.
 *
 * Nota sobre la fórmula: Mifflin-St Jeor está validada en adultos. Para un
 * paciente de 12.8 años subestima alrededor de un 6% frente a las ecuaciones
 * pediátricas (Schofield). Se usa porque así se especificó; el superávit de
 * 300 kcal absorbe buena parte de esa diferencia.
 */

export const PERFIL = {
  peso: 41,          // kg
  altura: 152,       // cm
  edad: 12.8,        // años
  sexo: 'masculino',
  factorActividad: 1.55, // 4 sesiones de hipertrofia por semana
  superavit: 300,        // kcal sobre mantenimiento
};

export const RATIOS = {
  proteinaPorKg: 2.2,   // g/kg — objetivo de hipertrofia
  porcentajeGrasa: 0.35, // del total calórico
};

export const KCAL = { proteina: 4, carbohidrato: 4, grasa: 9 };

/**
 * Ratio insulina/carbohidrato: cuántos gramos cubre una unidad.
 *
 * NO es un valor que se pueda deducir del plan actual: ahí las dosis son
 * fijas y el ICR implícito varía entre 10.3 y 17 g/U según la comida. Este
 * número LO DEFINE EL ENDOCRINÓLOGO; el valor por defecto es solo un punto
 * de partida y la interfaz permite cambiarlo.
 */
export const ICR_POR_DEFECTO = Number(process.env.NEXT_PUBLIC_ICR ?? 12);

/** Reparto del día. Debe sumar 1. */
export const COMIDAS = [
  { id: 'desayuno', nombre: 'Desayuno', porcentaje: 0.25 },
  { id: 'colacion1', nombre: 'Colación 1', porcentaje: 0.1 },
  { id: 'comida', nombre: 'Comida', porcentaje: 0.3 },
  { id: 'colacion2', nombre: 'Colación 2', porcentaje: 0.1 },
  { id: 'cena', nombre: 'Cena', porcentaje: 0.25 },
];

const redondear = (n, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/**
 * Tasa metabólica basal por Mifflin-St Jeor.
 * Hombres: 10P + 6.25A − 5E + 5   |   Mujeres: 10P + 6.25A − 5E − 161
 */
export function calcularTMB({ peso, altura, edad, sexo = 'masculino' }) {
  const base = 10 * peso + 6.25 * altura - 5 * edad;
  return base + (sexo === 'femenino' ? -161 : 5);
}

/**
 * Requerimientos diarios completos.
 * El orden importa: proteína por peso, grasa por porcentaje del total, y
 * los carbohidratos son lo que sobra.
 */
export function calcularRequerimientos(
  peso = PERFIL.peso,
  altura = PERFIL.altura,
  edad = PERFIL.edad,
  factorActividad = PERFIL.factorActividad,
  opciones = {}
) {
  const { sexo = PERFIL.sexo, superavit = PERFIL.superavit, ratios = RATIOS } = opciones;

  const tmb = calcularTMB({ peso, altura, edad, sexo });
  const mantenimiento = tmb * factorActividad;
  const calorias = mantenimiento + superavit;

  const proteina = ratios.proteinaPorKg * peso;
  const kcalProteina = proteina * KCAL.proteina;

  const kcalGrasa = calorias * ratios.porcentajeGrasa;
  const grasa = kcalGrasa / KCAL.grasa;

  // Los carbohidratos absorben el resto. Si la proteína y la grasa se
  // configuraran tan altas que no quedara nada, se topa en 0 en vez de
  // devolver un número negativo.
  const kcalCarbos = Math.max(0, calorias - kcalProteina - kcalGrasa);
  const carbos = kcalCarbos / KCAL.carbohidrato;

  return {
    tmb: redondear(tmb, 0),
    mantenimiento: redondear(mantenimiento, 0),
    calorias: redondear(calorias, 0),
    proteina: redondear(proteina),
    grasa: redondear(grasa),
    carbos: redondear(carbos),
    reparto: {
      proteina: redondear((kcalProteina / calorias) * 100, 0),
      grasa: redondear((kcalGrasa / calorias) * 100, 0),
      carbos: redondear((kcalCarbos / calorias) * 100, 0),
    },
  };
}

/** Divide los requerimientos del día entre las cinco comidas. */
export function distribuirPorComidas(requerimientos, comidas = COMIDAS) {
  return comidas.map((c) => ({
    ...c,
    calorias: redondear(requerimientos.calorias * c.porcentaje, 0),
    proteina: redondear(requerimientos.proteina * c.porcentaje),
    carbos: redondear(requerimientos.carbos * c.porcentaje),
    grasa: redondear(requerimientos.grasa * c.porcentaje),
  }));
}

export function metasDeComida(idComida, requerimientos) {
  return distribuirPorComidas(requerimientos).find((c) => c.id === idComida) ?? null;
}

// ---------------------------------------------------------------- RUTA DUAL

/**
 * RUTA A — Prioridad volumen.
 * Los macros mandan; la insulina es la consecuencia.
 */
export function rutaA({ meta, icr = ICR_POR_DEFECTO }) {
  if (!meta || !(icr > 0)) return null;

  const unidades = meta.carbos / icr;

  return {
    ruta: 'A',
    carbos: meta.carbos,
    proteina: meta.proteina,
    grasa: meta.grasa,
    calorias: meta.calorias,
    unidades: redondear(unidades),
    // Las plumas dosifican de media en media unidad.
    unidadesPractica: Math.round(unidades * 2) / 2,
    icr,
  };
}

/**
 * RUTA B — Prioridad insulina.
 *
 * El usuario fija las unidades y de ahí salen los carbohidratos. El alba
 * entra AQUÍ y no en la ruta A por una razón concreta: por la mañana hay
 * resistencia, así que la misma unidad cubre menos gramos. Reducir los
 * carbohidratos permitidos es exactamente eso — no es un recorte de dieta,
 * es corregir cuánto rinde de verdad cada unidad a esa hora.
 *
 * Con los carbohidratos ya limitados, las calorías que faltan para la meta
 * de la comida se rellenan con proteína y grasa, que no disparan la glucosa.
 */
export function rutaB({
  meta,
  unidades,
  icr = ICR_POR_DEFECTO,
  alba = false,
  topeProteina = 1.5,
}) {
  if (!meta || !(icr > 0)) return null;

  const u = Number(unidades);
  if (!Number.isFinite(u) || u < 0) return null;

  const carbosSinAlba = u * icr;
  const factorAlba = alba ? 1 - ALBA.reduccion : 1;
  const carbos = carbosSinAlba * factorAlba;

  const kcalCarbos = carbos * KCAL.carbohidrato;
  const faltante = Math.max(0, meta.calorias - kcalCarbos);

  // Las calorías que faltan se reparten entre proteína y grasa guardando la
  // proporción que ya tenían en la meta.
  const kcalProteinaMeta = meta.proteina * KCAL.proteina;
  const kcalGrasaMeta = meta.grasa * KCAL.grasa;
  const sumaMeta = kcalProteinaMeta + kcalGrasaMeta;

  const pesoProteina = sumaMeta > 0 ? kcalProteinaMeta / sumaMeta : 0.5;

  let proteina = (faltante * pesoProteina) / KCAL.proteina;
  let grasa = (faltante * (1 - pesoProteina)) / KCAL.grasa;

  // La proteína no crece sin límite: pasado el tope, el excedente se
  // convierte en grasa, que es la que rellena calorías sin carga renal.
  const maxProteina = meta.proteina * topeProteina;
  if (proteina > maxProteina) {
    const kcalSobrante = (proteina - maxProteina) * KCAL.proteina;
    proteina = maxProteina;
    grasa += kcalSobrante / KCAL.grasa;
  }

  // Nunca por debajo de la meta original: la ruta B rellena, no recorta.
  proteina = Math.max(proteina, meta.proteina);
  grasa = Math.max(grasa, meta.grasa);

  const calorias =
    carbos * KCAL.carbohidrato + proteina * KCAL.proteina + grasa * KCAL.grasa;

  return {
    ruta: 'B',
    unidades: u,
    icr,
    alba,
    carbosSinAlba: redondear(carbosSinAlba),
    recorteAlba: redondear(carbosSinAlba - carbos),
    carbos: redondear(carbos),
    proteina: redondear(proteina),
    grasa: redondear(grasa),
    calorias: redondear(calorias, 0),
    // Cuánto se aleja del objetivo calórico de la comida.
    diferenciaCalorica: redondear(calorias - meta.calorias, 0),
    carbosRecortados: redondear(meta.carbos - carbos),
  };
}

/**
 * Aviso cuando las dos rutas discrepan en la ventana del alba.
 *
 * En la ruta A la insulina sale de dividir los carbohidratos del plan entre
 * el ICR, sin corregir por resistencia matutina; en la ruta B esa corrección
 * sí se aplica. Por eso a la misma hora las dos rutas no coinciden. No se
 * resuelve por cuenta propia: subir insulina a un niño de 12 años es una
 * decisión del endocrinólogo, no de la aplicación.
 */
export function discrepanciaAlba({ meta, icr = ICR_POR_DEFECTO, ahora = new Date(), zona }) {
  const alba = enVentanaAlba(ahora, zona);
  if (!alba || !meta || !(icr > 0)) return null;

  const a = rutaA({ meta, icr });
  const b = rutaB({ meta, unidades: a.unidadesPractica, icr, alba: true });

  return {
    alba: true,
    unidades: a.unidadesPractica,
    carbosRutaA: a.carbos,
    carbosRutaB: b.carbos,
    diferencia: redondear(a.carbos - b.carbos),
  };
}

// ---------------------------------------------------------------- UGP

/**
 * Unidades Grasa-Proteína (efecto pizza).
 *
 * 100 kcal provenientes de grasa y proteína equivalen a 1 UGP. A partir de
 * 2 UGP la digestión se alarga y la glucosa sube tarde, horas después de
 * comer, cuando la insulina rápida ya se agotó.
 */
export const UMBRAL_UGP = 2;

export function calcularUGP({ proteina = 0, grasa = 0 }) {
  const kcal = proteina * KCAL.proteina + grasa * KCAL.grasa;
  const ugp = kcal / 100;
  return {
    ugp: redondear(ugp),
    kcalGrasaProteina: redondear(kcal, 0),
    alto: ugp >= UMBRAL_UGP,
  };
}

export const AVISO_UGP =
  'Comida alta en Unidades Grasa-Proteína. La digestión será muy lenta ' +
  '(3-5 horas). Sugerencia: Considera dividir el bolo de insulina ' +
  '(Ej. 50% inicio, 50% en 2 horas) y vigilar glucosa tardía.';

/** Porcentaje consumido frente a la meta, topado en 100 para la barra. */
export function progreso(consumido, meta) {
  if (!(meta > 0)) return 0;
  return Math.min(100, Math.round((consumido / meta) * 100));
}
