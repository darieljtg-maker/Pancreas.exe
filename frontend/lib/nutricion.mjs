export const redondear = (n, decimales = 1) =>
  Math.round((n + Number.EPSILON) * 10 ** decimales) / 10 ** decimales;

export function nutrientesPorPeso(alimento, gramos) {
  if (
    !alimento?.per100g ||
    typeof gramos !== "number" ||
    !Number.isFinite(gramos) ||
    gramos <= 0 ||
    gramos > 2000
  ) {
    throw new Error("Elige un alimento y un peso entre 0.1 y 2000 gramos.");
  }
  const result = {};
  for (const k of ["carbs", "protein", "fat", "kcal", "fiber"]) {
    const n = alimento.per100g[k];
    if (n == null && k === "fiber") {
      result[k] = null;
      continue;
    }
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0)
      throw new Error("Información nutricional incompleta.");
    result[k] = (n * gramos) / 100;
  }
  return result;
}

export function calcularPlato(ingredientes, catalogo) {
  if (
    !Array.isArray(ingredientes) ||
    ingredientes.length < 1 ||
    ingredientes.length > 12
  )
    throw new Error("El plato debe tener entre 1 y 12 alimentos.");
  const ids = new Set();
  const totales = { carbs: 0, protein: 0, fat: 0, kcal: 0, fiber: 0 };
  const alimentos = ingredientes.map((item) => {
    const alimento = catalogo.find((f) => f.id === item.id);
    if (!alimento || ids.has(item.id))
      throw new Error("Alimento desconocido o repetido.");
    ids.add(item.id);
    const nutrientes = nutrientesPorPeso(alimento, item.grams);
    for (const key of Object.keys(totales)) {
      totales[key] =
        nutrientes[key] == null || totales[key] == null
          ? null
          : totales[key] + nutrientes[key];
    }
    // Only trusted source metadata is carried forward; ignore model-supplied macros.
    return {
      ...alimento,
      grams: item.grams,
      nutrients: Object.fromEntries(
        Object.entries(nutrientes).map(([k, v]) => [
          k,
          v == null ? null : redondear(v),
        ]),
      ),
    };
  });
  return {
    foods: alimentos,
    totals: Object.fromEntries(
      Object.entries(totales).map(([k, v]) => [
        k,
        v == null ? null : redondear(v),
      ]),
    ),
    hasVegetable: alimentos.some((f) => f.group === "verdura"),
    hasProtein: alimentos.some((f) => ["proteína", "lácteo"].includes(f.group)),
    note: "Valores estimados. La preparación, la marca y el peso comestible cambian el aporte real.",
  };
}

export function ajustarAlimento(
  ingredientes,
  idAjustable,
  referencia,
  catalogo,
) {
  if (!Number.isFinite(referencia) || referencia <= 0 || referencia > 300)
    throw new Error("Referencia de conteo no válida.");
  const actual = ingredientes.find((f) => f.id === idAjustable);
  const alimento = catalogo.find((f) => f.id === idAjustable);
  if (!actual || !alimento || alimento.per100g.carbs < 5)
    throw new Error("Selecciona un alimento con carbohidratos para ajustar.");
  // Validate every ingredient before arithmetic; do not silently accept an unknown id.
  calcularPlato(ingredientes, catalogo);
  const otros = ingredientes.filter((f) => f.id !== idAjustable);
  const consumidos = otros.length
    ? calcularPlato(otros, catalogo).totals.carbs
    : 0;
  if (consumidos >= referencia)
    throw new Error(
      "Los otros alimentos ya cubren la referencia. Revisa el plato; no se elimina una comida automáticamente.",
    );
  const gramos = redondear(
    ((referencia - consumidos) * 100) / alimento.per100g.carbs,
  );
  if (gramos <= 0 || gramos > 600)
    throw new Error(
      "La porción calculada no es razonable para este alimento. Revisa la selección con nutrición.",
    );
  return ingredientes.map((f) =>
    f.id === idAjustable
      ? { id: f.id, grams: gramos }
      : { id: f.id, grams: f.grams },
  );
}
