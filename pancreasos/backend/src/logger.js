'use strict';

/**
 * Logger minimo con niveles y timestamp local.
 * No usamos dependencias externas para que el worker arranque aunque
 * npm install se haya hecho a medias.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

let currentLevel = LEVELS.info;

function setLevel(name) {
  const level = LEVELS[String(name || '').toLowerCase()];
  if (level) currentLevel = level;
}

function stamp() {
  // Se muestra en la zona horaria del proceso (variable TZ del .env).
  return new Date().toLocaleString('sv-SE', { hour12: false });
}

function write(stream, tag, args) {
  stream(`[${stamp()}] ${tag}`, ...args);
}

/**
 * Convierte un error en algo legible sin filtrar credenciales ni volcar
 * el objeto completo de axios (que incluye headers con el token).
 */
function describeError(err) {
  if (!err) return 'error desconocido';
  if (typeof err === 'string') return err;

  const parts = [err.message || String(err)];
  if (err.code) parts.push(`(code=${err.code})`);
  if (err.httpStatus) parts.push(`(http=${err.httpStatus})`);
  if (err.apiStatus !== undefined) parts.push(`(apiStatus=${err.apiStatus})`);

  let cause = err.cause;
  let depth = 0;
  while (cause && depth < 3) {
    parts.push(`<- ${cause.message || cause}`);
    cause = cause.cause;
    depth += 1;
  }
  return parts.join(' ');
}

const logger = {
  setLevel,
  describeError,
  debug: (...args) => currentLevel <= LEVELS.debug && write(console.log, 'DEBUG', args),
  info: (...args) => currentLevel <= LEVELS.info && write(console.log, 'INFO ', args),
  warn: (...args) => currentLevel <= LEVELS.warn && write(console.warn, 'WARN ', args),
  error: (...args) => currentLevel <= LEVELS.error && write(console.error, 'ERROR', args),
  /** Linea suelta sin timestamp, para banners y resumenes. */
  plain: (...args) => currentLevel <= LEVELS.info && console.log(...args),
};

module.exports = { logger, LEVELS };
