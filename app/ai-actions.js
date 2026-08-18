'use server';

import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';

import { COOKIE_SESION, tokenValido } from '@/lib/auth';
import { getContextoVigilante, getContextoSemanal } from '@/lib/queries';
import { hora, fechaLarga } from '@/lib/glucosa';
import { normalizarTendencia } from '@/lib/menus';

/**
 * Análisis con Gemini.
 *
 * Los identificadores de modelo viven en variables de entorno: si Google
 * renombra o retira uno, se cambia en Vercel sin volver a desplegar código.
 */
const MODELO_VIGILANTE = process.env.GEMINI_MODEL_FLASH || 'gemini-3.6-flash';
const MODELO_AUDITOR = process.env.GEMINI_MODEL_PRO || 'gemini-3.1-pro-preview';

/** Minutos que se reutiliza un pronóstico antes de volver a gastar cuota. */
const TTL_VIGILANTE = Number(process.env.VIGILANTE_TTL_MINUTOS || 5) * 60 * 1000;

const PROMPT_VIGILANTE =
  'Eres un endocrinólogo de urgencias. Analiza esta curva de glucosa reciente y ' +
  'los carbohidratos activos. Cada lectura trae la flecha de tendencia del sensor ' +
  'FreeStyle Libre 2, que indica la velocidad de cambio en ese instante: ' +
  '"subiendo rápido" y "bajando rápido" equivalen a más de 2 mg/dL por minuto, ' +
  '"subiendo" y "bajando" a entre 1 y 2 mg/dL por minuto, y "estable" a menos de ' +
  '1 mg/dL por minuto. Usa la flecha de la última lectura para proyectar hacia ' +
  'dónde va la curva, no solo los valores. Responde ÚNICAMENTE con una alerta ' +
  'corta (máx 2 líneas) si prevés una caída por debajo de 70 mg/dL o un pico ' +
  'arriba de 250 mg/dL en los próximos 40 minutos. Si todo está estable, ' +
  "responde 'Estable'.";

const PROMPT_AUDITOR =
  'Eres un endocrinólogo experto analizando los datos semanales de un paciente ' +
  'con dosis fijas (Desayuno 4U, Comida 5U, Cena 6U). Analiza los patrones de la ' +
  'semana. Identifica si algún horario específico está causando hiperglucemias o ' +
  'hipoglucemias consistentes. Genera un reporte en formato Markdown, directo y ' +
  'profesional, sugiriendo si se debe consultar al médico para modificar la dosis ' +
  'base de algún horario o si el problema son las porciones.';

/**
 * Las Server Actions son endpoints POST reales. El proxy ya las cubre, pero
 * se revisa aquí también: si mañana cambia el matcher, esto no queda abierto.
 */
async function haySesion() {
  const almacen = await cookies();
  return tokenValido(almacen.get(COOKIE_SESION)?.value);
}

function cliente() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('Falta GEMINI_API_KEY en las variables de entorno.');
    error.configuracion = true;
    throw error;
  }
  // GEMINI_BASE_URL permite apuntar a un endpoint distinto (pruebas o proxy).
  const baseUrl = process.env.GEMINI_BASE_URL;
  return new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
}

function describirError(err) {
  const mensaje = err?.message || String(err);
  if (/not found|does not exist|unsupported model|404/i.test(mensaje)) {
    return `El modelo no existe o tu API key no tiene acceso. ${mensaje}`;
  }
  if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(mensaje)) {
    return `Se agotó la cuota gratuita por ahora. ${mensaje}`;
  }
  if (/api key|401|403|PERMISSION_DENIED/i.test(mensaje)) {
    return `La API key fue rechazada. ${mensaje}`;
  }
  return mensaje;
}

// ---------------------------------------------------------------- VIGILANTE

// Caché en memoria: el sensor solo produce un dato cada 5 minutos, así que
// refrescar el dashboard cada minuto no debe disparar una llamada cada vez.
let cacheVigilante = null;

function formatearContextoVigilante({ lecturas, ultimaComida, insulinaReciente }) {
  // La flecha se traduce a texto: "FortyFiveDown" no le dice nada al modelo,
  // "bajando" sí, y es justo lo que necesita para proyectar la curva.
  const curva = lecturas
    .map((l) => {
      const t = normalizarTendencia(l.trend_arrow);
      const flecha = t ? `${t.glifo} ${t.texto.toLowerCase()}` : 'sin tendencia';
      return `${hora(l.timestamp)}  ${l.glucose_value} mg/dL  ${flecha}`;
    })
    .join('\n');

  const ultima = lecturas.at(-1);
  const tendenciaFinal = normalizarTendencia(ultima?.trend_arrow);

  const comida = ultimaComida
    ? `${ultimaComida.meal_type} a las ${hora(ultimaComida.timestamp)}: ` +
      `${ultimaComida.description} (${Number(ultimaComida.carbs_grams)} g de carbohidratos)`
    : 'Sin comidas registradas en las últimas 5 horas.';

  const dosis = insulinaReciente.length
    ? insulinaReciente
        .map((i) => `${i.type} ${Number(i.units)} U a las ${hora(i.timestamp)}`)
        .join('; ')
    : 'Sin dosis registradas en las últimas 6 horas.';

  return [
    `Hora actual: ${hora(new Date())}`,
    '',
    'Lecturas del sensor (última hora, de la más antigua a la más reciente),',
    'con valor y flecha de tendencia:',
    curva || 'Sin lecturas.',
    '',
    ultima
      ? `Estado ahora mismo: ${ultima.glucose_value} mg/dL, ` +
        `${tendenciaFinal ? tendenciaFinal.texto.toLowerCase() : 'sin tendencia disponible'}.`
      : '',
    `Última comida: ${comida}`,
    `Insulina reciente: ${dosis}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Pronóstico a 40 minutos. Devuelve `estable: true` cuando no hay nada que
 * avisar, para que el dashboard no grite sin motivo.
 */
export async function pronosticoCorto() {
  if (!(await haySesion())) return { ok: false, mensaje: 'Sesión no válida.' };

  try {
    const contexto = await getContextoVigilante();

    if (contexto.lecturas.length < 3) {
      return { ok: true, estable: true, mensaje: 'Aún no hay lecturas suficientes.' };
    }

    // La clave incluye la última lectura: si no llegó dato nuevo, no se
    // vuelve a llamar a Gemini aunque se refresque la pantalla.
    const clave = String(contexto.lecturas.at(-1)?.timestamp);
    if (cacheVigilante && cacheVigilante.clave === clave && Date.now() < cacheVigilante.expira) {
      return { ...cacheVigilante.valor, deCache: true };
    }

    const ai = cliente();
    const respuesta = await ai.models.generateContent({
      model: MODELO_VIGILANTE,
      contents: formatearContextoVigilante(contexto),
      config: {
        systemInstruction: PROMPT_VIGILANTE,
        temperature: 0.2,
        maxOutputTokens: 200,
      },
    });

    const texto = (respuesta.text || '').trim();
    const valor = {
      ok: true,
      estable: /^estable/i.test(texto) || texto === '',
      mensaje: texto || 'Estable',
      modelo: MODELO_VIGILANTE,
    };

    cacheVigilante = { clave, valor, expira: Date.now() + TTL_VIGILANTE };
    return valor;
  } catch (err) {
    console.error('[pronosticoCorto]', err);
    return { ok: false, mensaje: describirError(err), configuracion: Boolean(err?.configuracion) };
  }
}

// ---------------------------------------------------------------- AUDITOR

function formatearContextoSemanal({ porHora, porDia, comidas, insulina, totalLecturas }) {
  const tablaHoras = porHora
    .map(
      (h) =>
        `${String(h.hora).padStart(2, '0')}:00  prom ${h.promedio}  min ${h.minimo}  ` +
        `max ${h.maximo}  bajas ${h.bajas}/${h.lecturas}  altas ${h.altas}/${h.lecturas}`
    )
    .join('\n');

  const tablaDias = porDia
    .map((d) => `${d.dia}  prom ${d.promedio}  min ${d.minimo}  max ${d.maximo}  en rango ${d.en_rango}%`)
    .join('\n');

  const listaComidas = comidas
    .map((c) => `${c.cuando}  ${c.meal_type}  ${Number(c.carbs_grams)} g  ${c.description || ''}`.trim())
    .join('\n');

  const listaInsulina = insulina
    .map((i) => `${i.cuando}  ${i.type}  ${Number(i.units)} U`)
    .join('\n');

  return [
    `Reporte generado el ${fechaLarga(new Date())}. Rango objetivo: 70-180 mg/dL.`,
    `Total de lecturas analizadas: ${totalLecturas}.`,
    '',
    '## Glucosa promedio por hora del día (7 días)',
    tablaHoras || 'Sin datos.',
    '',
    '## Resumen por día',
    tablaDias || 'Sin datos.',
    '',
    '## Comidas registradas',
    listaComidas || 'Sin comidas registradas.',
    '',
    '## Dosis de insulina registradas',
    listaInsulina || 'Sin dosis registradas.',
  ].join('\n');
}

/** Auditoría profunda de la semana. Tarda: el modelo Pro razona antes de responder. */
export async function auditoriaSemanal() {
  if (!(await haySesion())) return { ok: false, mensaje: 'Sesión no válida.' };

  try {
    const contexto = await getContextoSemanal();

    if (contexto.totalLecturas < 50) {
      return {
        ok: false,
        mensaje:
          'Todavía no hay suficientes datos de la semana para un análisis con sentido. ' +
          `Solo hay ${contexto.totalLecturas} lecturas.`,
      };
    }

    const ai = cliente();
    const respuesta = await ai.models.generateContent({
      model: MODELO_AUDITOR,
      contents: formatearContextoSemanal(contexto),
      config: {
        systemInstruction: PROMPT_AUDITOR,
        temperature: 0.4,
      },
    });

    const markdown = (respuesta.text || '').trim();
    if (!markdown) return { ok: false, mensaje: 'El modelo devolvió una respuesta vacía.' };

    return {
      ok: true,
      markdown,
      modelo: MODELO_AUDITOR,
      lecturas: contexto.totalLecturas,
      generadoEn: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[auditoriaSemanal]', err);
    return { ok: false, mensaje: describirError(err), configuracion: Boolean(err?.configuracion) };
  }
}

/**
 * Diagnóstico: qué modelos ve realmente tu API key. Útil cuando Google
 * renombra algo y las llamadas empiezan a fallar con "model not found".
 */
export async function listarModelosDisponibles() {
  if (!(await haySesion())) return { ok: false, mensaje: 'Sesión no válida.' };

  try {
    const ai = cliente();
    const nombres = [];
    for await (const modelo of await ai.models.list()) {
      if (modelo?.name) nombres.push(modelo.name.replace(/^models\//, ''));
      if (nombres.length >= 60) break;
    }
    return {
      ok: true,
      modelos: nombres.sort(),
      configurados: { vigilante: MODELO_VIGILANTE, auditor: MODELO_AUDITOR },
    };
  } catch (err) {
    console.error('[listarModelosDisponibles]', err);
    return { ok: false, mensaje: describirError(err) };
  }
}
