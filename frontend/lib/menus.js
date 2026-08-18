/**
 * Plan alimenticio de Gaelito e ingeniería inversa de porciones.
 *
 * Las dosis de Lyumjev son FIJAS, así que la variable de ajuste no es la
 * insulina sino la comida: se calcula cuántos gramos del "alimento ajustable"
 * debe pesar la báscula para compensar la glucosa que trae antes de comer.
 *
 * Los gramos de carbohidratos vienen del plan del nutriólogo. Este archivo
 * solo hace la aritmética; no decide nada clínico.
 */

/** Glucosa a la que apuntamos antes de sentarse a la mesa. */
export const OBJETIVO = 120;

/** Factor de sensibilidad: 1 g de carbohidrato neto mueve 4 mg/dL. */
export const SENSIBILIDAD = 4;

/** Por debajo de esto es hipoglucemia y manda el protocolo de rescate. */
export const UMBRAL_HIPO = 70;

export const TIPOS_COMIDA = ['Desayuno', 'Comida', 'Cena', 'Colación'];

/**
 * Flechas de tendencia del Libre 2.
 *
 * `extra` son gramos de carbohidratos que se SUMAN de forma preventiva: si la
 * glucosa va cayendo, para cuando termine de comer estará más abajo de lo que
 * marca el sensor ahora, y el plato calculado solo con el valor actual se
 * quedaría corto. Los identificadores coinciden con lo que el worker guarda
 * en `cgm_readings.trend_arrow`.
 */
export const TENDENCIAS = [
  { id: 'SingleUp', glifo: '⬆️', texto: 'Subiendo rápido', extra: 0 },
  { id: 'FortyFiveUp', glifo: '↗️', texto: 'Subiendo', extra: 0 },
  { id: 'Flat', glifo: '➡️', texto: 'Estable', extra: 0 },
  { id: 'FortyFiveDown', glifo: '↘️', texto: 'Bajando', extra: 5 },
  { id: 'SingleDown', glifo: '⬇️', texto: 'Bajando rápido', extra: 15 },
];

const POR_CODIGO = ['NotComputable', 'SingleDown', 'FortyFiveDown', 'Flat', 'FortyFiveUp', 'SingleUp'];

/** Acepta el nombre de Abbott o su código numérico 0-5. */
export function normalizarTendencia(valor) {
  if (valor == null || valor === '') return null;
  const bruto = String(valor).trim();
  const clave = /^\d+$/.test(bruto) ? POR_CODIGO[Number(bruto)] : bruto;
  return TENDENCIAS.find((t) => t.id === clave) ?? null;
}

/** Gramos preventivos que aporta la tendencia. */
export function ajustePorTendencia(valor) {
  return normalizarTendencia(valor)?.extra ?? 0;
}

/**
 * Fenómeno del alba: entre las 05:00 y las 11:30 hay resistencia a la
 * insulina, así que la misma dosis rinde menos y el plato debe achicarse.
 */
export const ALBA = { desdeMin: 5 * 60, hastaMin: 11 * 60 + 30, reduccion: 0.2 };

/** Reducción extra cuando la comida es de absorción rápida (IG alto). */
export const REDUCCION_IG_ALTO = 0.15;

/** Minutos desde medianoche en la zona horaria indicada. */
export function minutosLocales(fecha, zona) {
  const partes = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: zona,
  }).formatToParts(fecha);

  const h = Number(partes.find((p) => p.type === 'hour').value);
  const m = Number(partes.find((p) => p.type === 'minute').value);
  return h * 60 + m;
}

export function enVentanaAlba(fecha, zona) {
  const min = minutosLocales(fecha, zona);
  return min >= ALBA.desdeMin && min <= ALBA.hastaMin;
}

/** Clasificaciones que puede devolver el análisis de índice glucémico. */
export const CLASIFICACIONES_IG = ['Bajo', 'Medio', 'Alto'];

/**
 * Qué hacer cuando la comida es de absorción rápida.
 *
 * Con insulina ultra-rápida (actúa en ~2 minutos) NO se espera antes de
 * comer: un pre-bolus prolongado provocaría hipoglucemia. Lo que se cambia
 * es el ORDEN de los alimentos dentro del mismo plato.
 */
export const AVISO_IG_ALTO =
  'Alimentos de Rápida Absorción. Como usas insulina ultra-rápida, CÓMETE PRIMERO ' +
  'la proteína o grasa (ej. carne, queso) y deja los carbohidratos al final para ' +
  'frenar el pico de glucosa.';

/**
 * Cada tipo de comida tiene su dosis fija y dos menús intercambiables.
 * `carbosBase` es el total del plato tal como lo diseñó el nutriólogo;
 * los fijos aportan `carbosBase - ajustable.carbos`.
 */
export const MENUS = {
  Desayuno: {
    dosis: 4,
    menus: {
      1: {
        carbosBase: 45,
        fijos: [{ nombre: 'Pan tostado integral', porcion: '2 piezas', carbos: 30 }],
        ajustable: { nombre: 'Papaya picada', gramos: 140, carbos: 15 },
      },
      2: {
        carbosBase: 61,
        fijos: [
          { nombre: 'Leche light', porcion: '1 taza', carbos: 12 },
          { nombre: 'Plátano', porcion: '1 pieza', carbos: 27 },
        ],
        ajustable: { nombre: 'Cereal de caja sin azúcar', gramos: 30, carbos: 22 },
      },
    },
  },

  Comida: {
    dosis: 5,
    menus: {
      // Los dos menús de la comida son el mismo plato.
      1: {
        carbosBase: 85,
        fijos: [{ nombre: 'Tortillas de maíz', porcion: '3 piezas', carbos: 45 }],
        ajustable: {
          nombre: 'Sopa de pasta',
          gramos: 200,
          carbos: 40,
          nota: 'Se pesa YA COCIDA',
        },
      },
      2: {
        carbosBase: 85,
        fijos: [{ nombre: 'Tortillas de maíz', porcion: '3 piezas', carbos: 45 }],
        ajustable: {
          nombre: 'Sopa de pasta',
          gramos: 200,
          carbos: 40,
          nota: 'Se pesa YA COCIDA',
        },
      },
    },
  },

  Cena: {
    dosis: 6,
    menus: {
      1: {
        carbosBase: 62,
        fijos: [{ nombre: 'Leche light', porcion: '1 taza', carbos: 12 }],
        ajustable: { nombre: 'Tostadas horneadas', gramos: 70, carbos: 50, piezas: 5 },
      },
      2: {
        carbosBase: 65,
        fijos: [
          { nombre: 'Yogurt griego natural', porcion: '250 g', carbos: 12 },
          { nombre: 'Jícama', porcion: '1 taza', carbos: 8 },
        ],
        ajustable: { nombre: 'Pan tostado integral', gramos: 90, carbos: 45, piezas: 3 },
      },
    },
  },

  Colación: {
    dosis: 0,
    menus: {
      1: {
        carbosBase: 15,
        fijos: [{ nombre: 'Almendras', porcion: '10 piezas', carbos: 0 }],
        ajustable: { nombre: 'Manzana', gramos: 150, carbos: 15 },
      },
      2: {
        carbosBase: 15,
        fijos: [{ nombre: 'Nueces', porcion: '10 piezas', carbos: 0 }],
        ajustable: { nombre: 'Pera', gramos: 150, carbos: 15 },
      },
    },
  },
};

const redondear = (n, decimales = 0) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

/**
 * Cuántos carbohidratos netos hay que sumar o restar al plato base.
 * Positivo = trae la glucosa baja y necesita comer de más.
 */
export function calcularAjuste(glucosa) {
  return (OBJETIVO - glucosa) / SENSIBILIDAD;
}

/**
 * Devuelve los gramos exactos de báscula del alimento ajustable.
 *
 * Si el ajuste pide menos de 0 g, la ración se topa en 0: no existen los
 * gramos negativos, y el resto del plato ya está fijo.
 */
export function calcularPorcion({
  tipo,
  menu,
  glucosa,
  tendencia,
  alba = false,
  igAlto = false,
}) {
  const comida = MENUS[tipo];
  const receta = comida?.menus?.[menu];
  if (!receta) return null;

  const g = Number(glucosa);
  if (!Number.isFinite(g) || g <= 0) return null;

  const ajuste = calcularAjuste(g);
  const flecha = normalizarTendencia(tendencia);
  const extra = flecha?.extra ?? 0;
  const carbosFijos = receta.carbosBase - receta.ajustable.carbos;

  // El extra por tendencia se suma al alimento ajustable, que es lo único
  // que se puede mover: los fijos van completos por indicación del plan.
  const ajustableIdeal = receta.ajustable.carbos + ajuste + extra;
  const ajustableSinFactores = Math.max(0, ajustableIdeal);
  const totalSinFactores = carbosFijos + ajustableSinFactores;

  // Alba e índice glucémico recortan el TOTAL del plato. Como los fijos no
  // se tocan, el recorte completo lo absorbe el alimento ajustable, que por
  // eso puede quedarse en 0 antes que el total llegue al objetivo.
  const factorAlba = alba ? 1 - ALBA.reduccion : 1;
  const factorIG = igAlto ? 1 - REDUCCION_IG_ALTO : 1;
  const totalPermitido = totalSinFactores * factorAlba * factorIG;

  const carbosIdeales = totalPermitido - carbosFijos;

  // Se marca como topado si la ración quedó en cero en cualquiera de las dos
  // etapas: por la glucosa alta, o porque los factores recortaron el total
  // por debajo de lo que ya aportan los alimentos fijos.
  const topado = ajustableIdeal < 0 || carbosIdeales < 0;
  const carbosAjustable = Math.max(0, carbosIdeales);

  // Regla de tres contra la ración base del plan.
  const gramosPorCarbo = receta.ajustable.gramos / receta.ajustable.carbos;
  const gramos = Math.round(carbosAjustable * gramosPorCarbo);

  const piezas = receta.ajustable.piezas
    ? redondear(carbosAjustable * (receta.ajustable.piezas / receta.ajustable.carbos), 1)
    : null;

  return {
    tipo,
    menu,
    glucosa: g,
    dosis: comida.dosis,
    ajuste: redondear(ajuste, 1),
    tendencia: flecha,
    ajusteTendencia: extra,
    alba,
    igAlto,
    // Cuántos gramos se recortaron por cada factor, para poder mostrarlo.
    recorteAlba: redondear(totalSinFactores - totalSinFactores * factorAlba, 1),
    recorteIG: redondear(totalSinFactores * factorAlba * (1 - factorIG), 1),
    totalSinFactores: redondear(totalSinFactores, 1),
    topado,
    fijos: receta.fijos,
    carbosFijos,
    ajustable: receta.ajustable,
    gramos,
    piezas,
    carbosAjustable: redondear(carbosAjustable, 1),
    carbosTotales: redondear(carbosFijos + carbosAjustable, 1),
    carbosBase: receta.carbosBase,
    esHipo: g < UMBRAL_HIPO,
  };
}

/** Equivalencias exactas de rescate, medidas en báscula o cuchara. */
export const RESCATES = [
  { emoji: '🧃', nombre: 'Jugo comercial', detalle: 'Boing o Jumex', porCarbo: 10, unidad: 'ml' },
  { emoji: '🍯', nombre: 'Miel o azúcar', detalle: '1 cucharada sopera = 15 g', porCarbo: 1 / 15, unidad: 'cucharadas' },
  { emoji: '🍬', nombre: 'Gomitas', detalle: 'Panditas, en báscula', porCarbo: 20 / 15, unidad: 'g' },
];

/** Mínimo absoluto de rescate, aunque la fórmula pida menos. */
export const RESCATE_MINIMO = 15;

/**
 * Carbohidratos simples para sacar a Gaelito de una hipoglucemia,
 * con sus equivalencias listas para pesar.
 */
export function calcularRescate(glucosa) {
  const g = Number(glucosa);
  const bruto = calcularAjuste(g);
  const carbos = Math.max(RESCATE_MINIMO, Math.round(bruto));

  return {
    glucosa: g,
    carbosCalculados: redondear(bruto, 1),
    carbos,
    aplicoMinimo: bruto < RESCATE_MINIMO,
    opciones: RESCATES.map((r) => ({
      ...r,
      cantidad: r.unidad === 'cucharadas'
        ? redondear(carbos * r.porCarbo, 1)
        : Math.round(carbos * r.porCarbo),
    })),
  };
}

/** Minutos de espera antes de volver a medir tras un rescate. */
export const ESPERA_MINUTOS = 15;

/**
 * Colaciones de mantenimiento para asentar el azúcar una vez recuperado,
 * y que la insulina residual no lo vuelva a tirar.
 */
export const ANCLAS = [
  { id: 1, titulo: 'Opción 1', items: ['1 pan tostado integral', '10 almendras'] },
  { id: 2, titulo: 'Opción 2', items: ['1/2 taza de leche light', '10 nueces'] },
];
