/**
 * Configuración compartida entre servidor y cliente.
 *
 * Vive en su propio módulo, sin dependencias, porque lo importan tanto
 * lib/db.js (servidor, usa pg) como lib/glucosa.js (lo usan componentes
 * cliente). Si estuviera en db.js, `pg` acabaría en el bundle del navegador.
 */

/** Zona horaria de referencia: define qué cuenta como "hoy". */
export const TZ = process.env.APP_TIMEZONE || 'America/Mexico_City';

/** Rango objetivo. Ajústalo si el endocrinólogo de Gaelito indica otro. */
export const RANGO = { bajo: 70, alto: 180 };
