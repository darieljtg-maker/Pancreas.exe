import crypto from 'node:crypto';

/**
 * Candado de la aplicación.
 *
 * El PIN se valida en el SERVIDOR y la sesión viaja en una cookie httpOnly.
 * No se usa NEXT_PUBLIC_APP_PIN como fuente principal porque todo lo que
 * lleva ese prefijo se incrusta en el JavaScript que descarga el navegador:
 * cualquiera podría leer el PIN desde las herramientas de desarrollo.
 * Se acepta como respaldo para no romper una configuración ya existente.
 */

export const COOKIE_SESION = 'pancreasos_sesion';
export const DIAS_SESION = 30;

/** Longitud mínima aceptada. Con 4 dígitos solo hay 10 000 combinaciones. */
export const LARGO_MINIMO = 4;

export function pinConfigurado() {
  const pin = (process.env.APP_PIN || process.env.NEXT_PUBLIC_APP_PIN || '').trim();
  return pin.length >= LARGO_MINIMO ? pin : '';
}

export function hayPin() {
  return pinConfigurado() !== '';
}

/**
 * Token determinista derivado del PIN. Al no guardar sesiones en ningún lado,
 * el proxy puede validar la cookie recalculándolo, sin base de datos.
 * Cambiar el PIN invalida automáticamente todas las sesiones abiertas.
 */
export function tokenEsperado() {
  const pin = pinConfigurado();
  if (!pin) return null;
  return crypto.createHmac('sha256', pin).update('pancreasos-sesion-v1').digest('hex');
}

/** Comparación en tiempo constante: no filtra información por el tiempo de respuesta. */
export function tokenValido(token) {
  const esperado = tokenEsperado();
  if (!esperado || typeof token !== 'string' || token.length !== esperado.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado));
  } catch {
    return false;
  }
}

export function pinCorrecto(intento) {
  const pin = pinConfigurado();
  if (!pin || typeof intento !== 'string' || intento.length !== pin.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(intento), Buffer.from(pin));
  } catch {
    return false;
  }
}

export const opcionesCookie = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DIAS_SESION * 24 * 60 * 60,
};
