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
export function calcularPorcion({ tipo, menu, glucosa }) {
  const comida = MENUS[tipo];
  const receta = comida?.menus?.[menu];
  if (!receta) return null;

  const g = Number(glucosa);
  if (!Number.isFinite(g) || g <= 0) return null;

  const ajuste = calcularAjuste(g);
  const carbosFijos = receta.carbosBase - receta.ajustable.carbos;

  const carbosIdeales = receta.ajustable.carbos + ajuste;
  const topado = carbosIdeales < 0;
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
