// Se importa de config y no de db: este módulo lo usan también componentes
// cliente, y db.js arrastraría `pg` al bundle del navegador.
import { TZ, RANGO } from './config';

export { RANGO };

/**
 * Clasificación por rango. Los colores viven aquí y no dentro de los
 * componentes para que dashboard, gráfica y timeline nunca se contradigan.
 */
export function clasificar(valor) {
  if (valor == null) {
    return { nivel: 'sindato', etiqueta: 'Sin datos', color: '#8B98A5', clase: 'text-muted' };
  }
  if (valor < RANGO.bajo) {
    return { nivel: 'bajo', etiqueta: 'Bajo', color: '#FF4D4F', clase: 'text-bajo' };
  }
  if (valor > RANGO.alto) {
    return { nivel: 'alto', etiqueta: 'Alto', color: '#F5A524', clase: 'text-alto' };
  }
  return { nivel: 'rango', etiqueta: 'En rango', color: '#22C55E', clase: 'text-rango' };
}

/**
 * El worker guarda el nombre de Abbott si la columna es texto, o el código
 * 0-5 si es numérica. Aceptamos ambos para no depender del tipo de columna.
 */
const FLECHAS = {
  NotComputable: { glifo: '?', texto: 'Sin tendencia', grados: 0 },
  SingleDown: { glifo: '↓', texto: 'Bajando rápido', grados: 90 },
  FortyFiveDown: { glifo: '↘', texto: 'Bajando', grados: 45 },
  Flat: { glifo: '→', texto: 'Estable', grados: 0 },
  FortyFiveUp: { glifo: '↗', texto: 'Subiendo', grados: -45 },
  SingleUp: { glifo: '↑', texto: 'Subiendo rápido', grados: -90 },
};

const POR_CODIGO = ['NotComputable', 'SingleDown', 'FortyFiveDown', 'Flat', 'FortyFiveUp', 'SingleUp'];

export function tendencia(valor) {
  if (valor == null || valor === '') return FLECHAS.NotComputable;
  const clave = /^\d+$/.test(String(valor).trim())
    ? POR_CODIGO[Number(valor)]
    : String(valor).trim();
  return FLECHAS[clave] || FLECHAS.NotComputable;
}

/**
 * Todo el formato de fechas ocurre en el servidor con zona horaria explícita.
 * Si se hiciera en el cliente, el HTML del servidor y el del navegador
 * podrían no coincidir y React tiraría un error de hidratación.
 */
export function hora(fecha) {
  if (!fecha) return '--:--';
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: TZ,
  }).format(new Date(fecha));
}

export function fechaLarga(fecha) {
  const texto = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(new Date(fecha));

  // En español solo va en mayúscula la primera letra: "lunes, 17 de agosto".
  // La clase `capitalize` de CSS pondría "Lunes, 17 De Agosto".
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "hace 3 min" — más útil que una hora exacta para la última lectura. */
export function haceCuanto(fecha) {
  if (!fecha) return 'sin datos';
  const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return 'hace instantes';
  if (minutos === 1) return 'hace 1 min';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas === 1) return 'hace 1 hora';
  if (horas < 24) return `hace ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

/** Una lectura de más de 15 min significa que el teléfono no ha sincronizado. */
export function estaDesactualizada(fecha, minutos = 15) {
  if (!fecha) return true;
  return Date.now() - new Date(fecha).getTime() > minutos * 60000;
}
