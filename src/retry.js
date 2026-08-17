'use strict';

const { logger } = require('./logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta fn con reintentos y backoff exponencial + jitter.
 *
 * Los errores marcados con `fatal = true` (credenciales inválidas, esquema
 * incorrecto) no se reintentan: reintentar no los va a arreglar y solo
 * retrasaría el aviso al operador.
 */
async function withRetry(fn, options = {}) {
  const {
    attempts = 4,
    baseDelayMs = 2000,
    maxDelayMs = 60000,
    label = 'operación',
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if (err && err.fatal) {
        logger.debug(`${label}: error fatal, no se reintenta.`);
        throw err;
      }
      if (attempt === attempts) break;

      // Si el servidor pidió esperar (429/503 con Retry-After) lo respetamos.
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = backoff * (0.8 + Math.random() * 0.4);
      const delay = Math.round(Math.max(err.retryAfterMs || 0, jitter));

      logger.warn(
        `${label} falló (intento ${attempt}/${attempts}): ${logger.describeError(err)}. ` +
          `Reintento en ${Math.round(delay / 1000)}s.`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

module.exports = { withRetry, sleep };
