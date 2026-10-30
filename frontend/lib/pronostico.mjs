const MINUTO = 60 * 1000;

/** Datos suficientes y actuales antes de consultar o reutilizar un pronóstico. */
export function validarCurvaPronostico(lecturas, ahora = Date.now()) {
  if (!Array.isArray(lecturas) || lecturas.length === 0) {
    return { ok: false, mensaje: 'Esperando lecturas recientes del sensor.' };
  }

  const ultimoInstante = new Date(lecturas.at(-1)?.timestamp).getTime();
  if (!Number.isFinite(ultimoInstante) || ultimoInstante > ahora + 5 * MINUTO) {
    return { ok: false, mensaje: 'La fecha de la última lectura no es válida para un pronóstico.' };
  }
  if (ahora - ultimoInstante > 15 * MINUTO) {
    return { ok: false, mensaje: 'La última lectura tiene más de 15 minutos. Esperando datos recientes del sensor.' };
  }

  // Tras una desconexión, las últimas filas pueden incluir días anteriores.
  // El modelo recibe únicamente la última hora que describe su contexto.
  const curva = lecturas.filter((lectura) => {
    const instante = new Date(lectura.timestamp).getTime();
    return Number.isFinite(instante) && instante >= ahora - 60 * MINUTO && instante <= ahora + 5 * MINUTO;
  });
  if (curva.length < 3) {
    return { ok: false, mensaje: 'Esperando al menos 3 lecturas de la última hora para generar un pronóstico.' };
  }
  return { ok: true, lecturas: curva };
}
