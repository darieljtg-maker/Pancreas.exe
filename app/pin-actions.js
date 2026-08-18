'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  COOKIE_SESION,
  hayPin,
  opcionesCookie,
  pinConfigurado,
  pinCorrecto,
  tokenEsperado,
} from '@/lib/auth';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Un PIN de 4 dígitos se agota en segundos si se puede probar sin costo.
// Este retardo no lo hace imposible, pero sí lento y ruidoso en los logs.
let fallosRecientes = 0;

export async function verificarPin(_previo, formData) {
  if (!hayPin()) {
    return {
      ok: false,
      mensaje: 'Falta configurar APP_PIN en las variables de entorno de Vercel.',
    };
  }

  const intento = String(formData.get('pin') || '');
  if (!intento) return { ok: false, mensaje: 'Escribe el PIN.' };

  if (!pinCorrecto(intento)) {
    fallosRecientes = Math.min(fallosRecientes + 1, 8);
    await espera(400 + fallosRecientes * 300);
    return { ok: false, mensaje: 'PIN incorrecto.' };
  }

  fallosRecientes = 0;
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, tokenEsperado(), opcionesCookie);

  return { ok: true, mensaje: 'Correcto.' };
}

export async function cerrarSesion() {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
  redirect('/pin');
}

/** Solo la longitud, para que el teclado sepa cuándo enviar. No filtra el PIN. */
export async function largoDelPin() {
  return pinConfigurado().length;
}
