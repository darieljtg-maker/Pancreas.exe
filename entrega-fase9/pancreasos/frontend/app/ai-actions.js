'use server';

import { cookies } from 'next/headers';
import { GoogleGenAI, Type } from '@google/genai';

import { COOKIE_SESION, tokenValido } from '@/lib/auth';
import { getContextoVigilante, getContextoSemanal } from '@/lib/queries';
import { hora, fechaLarga } from '@/lib/glucosa';
import { normalizarTendencia, CLASIFICACIONES_IG } from '@/lib/menus';
import { calcularUGP } from '@/lib/calculosNutricionales';

/**
 * Análisis con Gemini.
 *
 * Los identificadores de modelo viven en variables de entorno: si Google
 * renombra o retira uno, se cambia en Vercel sin volver a desplegar código.
 */
const MODELO_VIGILANTE = process.env.GEMINI_MODEL_FLASH || 'gemini-3.6-flash';
const MODELO_AUDITOR = process.env.GEMINI_MODEL_PRO || 'gemini-3.1-pro-preview';

const MODELO_IG = process.env.GEMINI_MODEL_IG || MODELO_VIGILANTE;

const PROMPT_VIGILANTE = `Eres un endocrinólogo pediátrico experto en monitoreo continuo de glucosa (MCG).
Analizas los datos de un paciente de 12 años con diabetes tipo 1 que usa FreeStyle
Libre 2 e insulina ULTRA-RÁPIDA (Lyumjev, inicio de acción ~2 minutos).

Recibes: la curva de glucosa de la última hora con su flecha de tendencia, la
última comida y la insulina administrada recientemente (que sigue activa).

Interpretación de las flechas del sensor:
- "subiendo rápido" / "bajando rápido": más de 2 mg/dL por minuto.
- "subiendo" / "bajando": entre 1 y 2 mg/dL por minuto.
- "estable": menos de 1 mg/dL por minuto.

Proyecta a 40 minutos combinando tres cosas: el valor actual, la velocidad que
marca la flecha de la ÚLTIMA lectura y la insulina que todavía está actuando.

REGLAS DE SALIDA, obligatorias:

1. Si proyectas que la glucosa cruzará un límite de seguridad (por debajo de
   70 mg/dL o por encima de 250 mg/dL) dentro de esos 40 minutos, responde con
   una alerta de MÁXIMO DOS ORACIONES que incluya siempre: el valor actual, el
   porqué (la tendencia o la insulina activa que lo provoca) y la acción
   concreta a tomar. Tono clínico y directo, sin rodeos ni saludos.
   Ejemplo del formato esperado:
   "⚠️ Alerta: Glucosa en 105 mg/dL pero bajando rápido (Flecha ⬇️). Sugiero
   colación ligera de 10g para amortiguar la caída."

2. Si la proyección se mantiene en rango seguro (70-150 mg/dL), responde única y
   exclusivamente con la palabra: Estable
   Sin puntuación, sin comillas, sin ninguna palabra adicional.

Nunca sugieras esperar antes de comer ni tiempos de pre-bolus: la insulina de
este paciente actúa en dos minutos y una espera provocaría hipoglucemia.
No inventes datos que no estén en el contexto.`;

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

/**
 * Caché en memoria del pronóstico, a nivel de módulo.
 *
 * La clave es el timestamp de la última lectura del sensor. Si no ha llegado
 * un dato nuevo, la entrada del modelo es idéntica y su salida también lo
 * sería: se devuelve lo guardado y NO se llama a Gemini. Sin esto, el
 * refresco del dashboard cada minuto quemaría la cuota gratuita (429) aunque
 * el sensor solo produzca una lectura cada 5 minutos.
 *
 * En Vercel cada instancia serverless tiene su propia copia; eso reduce las
 * llamadas, no las elimina del todo.
 */
let cacheVigilante = null; // { clave, valor }

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

    // Mismo timestamp que la vez anterior = mismos datos = misma respuesta.
    // Se devuelve la guardada sin tocar la API.
    const clave = String(contexto.lecturas.at(-1)?.timestamp);
    if (cacheVigilante && cacheVigilante.clave === clave) {
      return { ...cacheVigilante.valor, deCache: true };
    }

    const ai = cliente();
    const respuesta = await ai.models.generateContent({
      model: MODELO_VIGILANTE,
      contents: formatearContextoVigilante(contexto),
      config: {
        systemInstruction: PROMPT_VIGILANTE,
        temperature: 0.2,
        // Holgado a propósito: recortarlo demasiado era lo que devolvía
        // frases truncadas y sin sentido.
        maxOutputTokens: 400,
      },
    });

    const texto = (respuesta.text || '').trim();

    // "Estable" puede venir con punto o comillas por más que se pida limpio.
    const estable = texto === '' || /^["'*\s]*estable[.\s"']*$/i.test(texto);

    const valor = {
      ok: true,
      estable,
      mensaje: estable ? 'Estable' : texto,
      modelo: MODELO_VIGILANTE,
    };

    cacheVigilante = { clave, valor };
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

// ---------------------------------------------------------------- ÍNDICE GLUCÉMICO

const PROMPT_IG = `Eres un nutriólogo clínico especializado en diabetes tipo 1 infantil.
Recibes la descripción de una comida escrita por un cuidador, en español de México.

Clasifica la VELOCIDAD DE ABSORCIÓN del conjunto del plato, no de un ingrediente
suelto, considerando que la grasa, la proteína y la fibra frenan la absorción:

- "Alto": predominan azúcares simples o harinas refinadas sin grasa ni proteína
  que los frenen (jugos, refrescos, pan blanco, cereal de caja azucarado, papa,
  arroz blanco solo, fruta muy madura sola, dulces).
- "Medio": mezcla equilibrada de carbohidratos con algo de proteína o grasa
  (sándwich con queso, quesadillas, leche con cereal integral).
- "Bajo": predomina la proteína, la grasa o la fibra, con pocos carbohidratos
  de absorción rápida (carne con verduras, huevo, leguminosas, frutos secos).

En "warning" escribe UNA frase corta (máximo 15 palabras) señalando el
ingrediente que más acelera la absorción, o cadena vacía si no hay ninguno
destacable. No des indicaciones de dosis, ni de esperar antes de comer.

Responde solo con el JSON pedido.`;

const ESQUEMA_IG = {
  type: Type.OBJECT,
  properties: {
    clasificacionIG: { type: Type.STRING, enum: CLASIFICACIONES_IG },
    warning: { type: Type.STRING },
  },
  required: ['clasificacionIG', 'warning'],
};

// Misma comida escrita igual = mismo resultado. Se acota el tamaño para que
// el proceso no acumule memoria indefinidamente.
const cacheIG = new Map();
const MAX_CACHE_IG = 100;

/** Extrae el JSON aunque el modelo lo envuelva en ``` o le ponga texto. */
function extraerJson(texto) {
  if (!texto) return null;
  const limpio = String(texto).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const desde = limpio.indexOf('{');
    const hasta = limpio.lastIndexOf('}');
    if (desde === -1 || hasta <= desde) return null;
    try {
      return JSON.parse(limpio.slice(desde, hasta + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Clasifica la velocidad de absorción de una comida descrita en texto libre.
 * Devuelve siempre { ok, clasificacionIG, warning } ya parseado, para que el
 * componente no tenga que lidiar con JSON crudo ni con respuestas a medias.
 */
export async function analizarComidaIG(textoComida) {
  if (!(await haySesion())) return { ok: false, mensaje: 'Sesión no válida.' };

  const texto = String(textoComida || '').trim().slice(0, 500);
  if (texto.length < 3) {
    return { ok: false, mensaje: 'Describe la comida para poder analizarla.' };
  }

  const clave = texto.toLowerCase().replace(/\s+/g, ' ');
  if (cacheIG.has(clave)) return { ...cacheIG.get(clave), deCache: true };

  try {
    const ai = cliente();
    const respuesta = await ai.models.generateContent({
      model: MODELO_IG,
      contents: `Comida: ${texto}`,
      config: {
        systemInstruction: PROMPT_IG,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: ESQUEMA_IG,
      },
    });

    const datos = extraerJson(respuesta.text);
    if (!datos) {
      return { ok: false, mensaje: 'El modelo no devolvió un JSON interpretable.' };
    }

    // Nunca se confía en que la clasificación venga bien escrita.
    const clasificacion = CLASIFICACIONES_IG.find(
      (c) => c.toLowerCase() === String(datos.clasificacionIG || '').trim().toLowerCase()
    );
    if (!clasificacion) {
      return {
        ok: false,
        mensaje: `Clasificación no reconocida: "${datos.clasificacionIG}".`,
      };
    }

    const valor = {
      ok: true,
      clasificacionIG: clasificacion,
      warning: String(datos.warning || '').trim().slice(0, 200),
      modelo: MODELO_IG,
    };

    if (cacheIG.size >= MAX_CACHE_IG) cacheIG.delete(cacheIG.keys().next().value);
    cacheIG.set(clave, valor);
    return valor;
  } catch (err) {
    console.error('[analizarComidaIG]', err);
    return { ok: false, mensaje: describirError(err), configuracion: Boolean(err?.configuracion) };
  }
}

// ---------------------------------------------------------------- NUTRICIÓN

const MODELO_NUTRICION = process.env.GEMINI_MODEL_NUTRICION || MODELO_VIGILANTE;

const REGLAS_ALIMENTOS = `Reglas de alimentos, sin excepción:
- SOLO alimentos naturales: carnes, pescados, huevo, verduras, frutas,
  leguminosas, cereales integrales, tubérculos, frutos secos y semillas.
- CERO ultraprocesados: nada de embutidos, cereales de caja, barritas,
  galletas, panes industriales, salsas comerciales ni suplementos en polvo.
- Única excepción permitida: lácteos sin azúcar añadida (leche, yogurt
  natural, queso fresco, requesón).
- Cocina mexicana de casa siempre que se pueda; el paciente tiene 12 años.
- Especifica SIEMPRE si el gramaje es en CRUDO o en COCIDO. Para arroz,
  pasta, leguminosas y carnes el peso cambia mucho entre uno y otro.`;

const PROMPT_MENUS = `Eres un nutriólogo deportivo especializado en Diabetes tipo 1 infantil.
El paciente tiene 12.8 años, 41 kg, 1.52 m, entrena hipertrofia 4 veces por
semana y está en volumen limpio.

Crea 3 opciones de comida natural que cumplan EXACTAMENTE con los macros
pedidos. Tolerancia máxima: 5% en cada macro. Haz la aritmética de los
gramajes antes de responder y verifica que la suma cuadre.

${REGLAS_ALIMENTOS}

Las 3 opciones deben ser realmente distintas entre sí: distinta fuente de
proteína y distinta guarnición. En "preparacionCorta" describe el modo de
preparación en una sola frase.`;

const ESQUEMA_MENUS = {
  type: Type.OBJECT,
  properties: {
    opciones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          opcion: { type: Type.INTEGER },
          nombre: { type: Type.STRING },
          ingredientes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nombre: { type: Type.STRING },
                cantidad: { type: Type.STRING },
                estadoCrudoCocido: { type: Type.STRING, enum: ['crudo', 'cocido', 'no aplica'] },
              },
              required: ['nombre', 'cantidad', 'estadoCrudoCocido'],
            },
          },
          preparacionCorta: { type: Type.STRING },
          macros: {
            type: Type.OBJECT,
            properties: {
              proteina: { type: Type.NUMBER },
              carbos: { type: Type.NUMBER },
              grasa: { type: Type.NUMBER },
              calorias: { type: Type.NUMBER },
            },
            required: ['proteina', 'carbos', 'grasa', 'calorias'],
          },
        },
        required: ['opcion', 'nombre', 'ingredientes', 'preparacionCorta', 'macros'],
      },
    },
  },
  required: ['opciones'],
};

const cacheMenus = new Map();
const MAX_CACHE = 60;

function guardarEnCache(mapa, clave, valor) {
  if (mapa.size >= MAX_CACHE) mapa.delete(mapa.keys().next().value);
  mapa.set(clave, valor);
}

const numeroSeguro = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : 0);

/**
 * Genera 3 menús que cuadren con los macros de una comida concreta.
 * `macros` viene del motor antropométrico (ruta A o ruta B).
 */
export async function generarOpcionesComida({ nombreComida, proteina, carbos, grasa, calorias }) {
  if (!(await haySesion())) return { ok: false, mensaje: 'Sesión no válida.' };

  const p = numeroSeguro(proteina);
  const c = numeroSeguro(carbos);
  const g = numeroSeguro(grasa);
  const kcal = numeroSeguro(calorias);

  if (p + c + g <= 0) return { ok: false, mensaje: 'No hay macros que cubrir.' };

  const clave = `${nombreComida}|${p}|${c}|${g}`;
  if (cacheMenus.has(clave)) return { ...cacheMenus.get(clave), deCache: true };

  try {
    const ai = cliente();
    const respuesta = await ai.models.generateContent({
      model: MODELO_NUTRICION,
      contents:
        `Comida: ${nombreComida || 'comida'}.\n` +
        `Macros objetivo — Proteína: ${p} g, Carbohidratos: ${c} g, Grasa: ${g} g` +
        (kcal ? `, Calorías: ${kcal} kcal.` : '.'),
      config: {
        systemInstruction: PROMPT_MENUS,
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: ESQUEMA_MENUS,
      },
    });

    const datos = extraerJson(respuesta.text);
    const opciones = Array.isArray(datos?.opciones) ? datos.opciones : null;
    if (!opciones?.length) {
      return { ok: false, mensaje: 'El modelo no devolvió opciones interpretables.' };
    }

    // Se recalcula la desviación en el servidor: el modelo dice que cuadra,
    // pero eso hay que comprobarlo antes de enseñarlo como exacto.
    const limpias = opciones.slice(0, 3).map((o, i) => {
      const m = o.macros ?? {};
      const macros = {
        proteina: numeroSeguro(m.proteina),
        carbos: numeroSeguro(m.carbos),
        grasa: numeroSeguro(m.grasa),
        calorias: numeroSeguro(m.calorias),
      };
      const desvio = {
        proteina: p ? Math.round(((macros.proteina - p) / p) * 100) : 0,
        carbos: c ? Math.round(((macros.carbos - c) / c) * 100) : 0,
        grasa: g ? Math.round(((macros.grasa - g) / g) * 100) : 0,
      };
      return {
        opcion: Number(o.opcion) || i + 1,
        nombre: String(o.nombre || `Opción ${i + 1}`).slice(0, 120),
        preparacionCorta: String(o.preparacionCorta || '').slice(0, 400),
        ingredientes: (Array.isArray(o.ingredientes) ? o.ingredientes : [])
          .slice(0, 12)
          .map((ing) => ({
            nombre: String(ing?.nombre || '').slice(0, 80),
            cantidad: String(ing?.cantidad || '').slice(0, 40),
            estadoCrudoCocido: ['crudo', 'cocido', 'no aplica'].includes(ing?.estadoCrudoCocido)
              ? ing.estadoCrudoCocido
              : 'no aplica',
          }))
          .filter((ing) => ing.nombre),
        macros,
        desvio,
        // Más de 10% de diferencia deja de ser "exacto" y hay que avisarlo.
        cuadra: Math.max(...Object.values(desvio).map(Math.abs)) <= 10,
      };
    });

    const valor = { ok: true, opciones: limpias, objetivo: { proteina: p, carbos: c, grasa: g, calorias: kcal }, modelo: MODELO_NUTRICION };
    guardarEnCache(cacheMenus, clave, valor);
    return valor;
  } catch (err) {
    console.error('[generarOpcionesComida]', err);
    return { ok: false, mensaje: describirError(err), configuracion: Boolean(err?.configuracion) };
  }
}

// ---------------------------------------------------------------- ANTOJOS

const PROMPT_ANTOJO = `Eres un nutriólogo deportivo especializado en Diabetes tipo 1 infantil.
El paciente quiere comer algo concreto. Tu trabajo NO es negárselo: es
calcular en qué cantidad exacta encaja dentro de los macros que le quedan.

${REGLAS_ALIMENTOS}

Devuelve:
- "ingredientes": cada alimento que pidió, con la cantidad exacta en gramos
  o mililitros que cuadra con los macros disponibles, indicando crudo o cocido.
- "faltante": si tras esas cantidades aún sobran macros por cubrir, sugiere
  UN alimento natural concreto y su gramaje, con el texto en la forma
  "Para completar tu meta, añade X gramos de [alimento]". Cadena vacía si no
  falta nada.
- "highUGP": true SOLO si la suma de grasa y proteína del conjunto supera
  las 2 Unidades Grasa-Proteína (1 UGP = 100 kcal de grasa + proteína), que
  es cuando la digestión se alarga y la glucosa sube tarde.
- "advertencia": una frase corta si algo del antojo merece atención, o cadena
  vacía.

No des indicaciones de dosis de insulina ni tiempos de espera antes de comer.`;

const ESQUEMA_ANTOJO = {
  type: Type.OBJECT,
  properties: {
    ingredientes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nombre: { type: Type.STRING },
          cantidad: { type: Type.STRING },
          estadoCrudoCocido: { type: Type.STRING, enum: ['crudo', 'cocido', 'no aplica'] },
          proteina: { type: Type.NUMBER },
          carbos: { type: Type.NUMBER },
          grasa: { type: Type.NUMBER },
        },
        required: ['nombre', 'cantidad', 'estadoCrudoCocido', 'proteina', 'carbos', 'grasa'],
      },
    },
    totales: {
      type: Type.OBJECT,
      properties: {
        proteina: { type: Type.NUMBER },
        carbos: { type: Type.NUMBER },
        grasa: { type: Type.NUMBER },
        calorias: { type: Type.NUMBER },
      },
      required: ['proteina', 'carbos', 'grasa', 'calorias'],
    },
    faltante: { type: Type.STRING },
    highUGP: { type: Type.BOOLEAN },
    advertencia: { type: Type.STRING },
  },
  required: ['ingredientes', 'totales', 'faltante', 'highUGP', 'advertencia'],
};

/**
 * Calculadora inversa: parte del antojo y devuelve las cantidades que
 * encajan en los macros que quedan de la comida.
 */
export async function calcularAntojo({ antojo, nombreComida, proteina, carbos, grasa, calorias }) {
  if (!(await haySesion())) return { ok: false, mensaje: 'Sesión no válida.' };

  const texto = String(antojo || '').trim().slice(0, 400);
  if (texto.length < 3) return { ok: false, mensaje: 'Escribe qué se le antoja.' };

  const p = numeroSeguro(proteina);
  const c = numeroSeguro(carbos);
  const g = numeroSeguro(grasa);
  const kcal = numeroSeguro(calorias);

  try {
    const ai = cliente();
    const respuesta = await ai.models.generateContent({
      model: MODELO_NUTRICION,
      contents:
        `Comida: ${nombreComida || 'comida'}.\n` +
        `Se le antoja: ${texto}\n` +
        `Macros disponibles — Proteína: ${p} g, Carbohidratos: ${c} g, ` +
        `Grasa: ${g} g, Calorías: ${kcal} kcal.`,
      config: {
        systemInstruction: PROMPT_ANTOJO,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: ESQUEMA_ANTOJO,
      },
    });

    const datos = extraerJson(respuesta.text);
    if (!datos) return { ok: false, mensaje: 'El modelo no devolvió un JSON interpretable.' };

    const totales = {
      proteina: numeroSeguro(datos.totales?.proteina),
      carbos: numeroSeguro(datos.totales?.carbos),
      grasa: numeroSeguro(datos.totales?.grasa),
      calorias: numeroSeguro(datos.totales?.calorias),
    };

    // El flag del modelo no se toma al pie de la letra: las UGP son
    // aritmética pura y se recalculan aquí a partir de los totales.
    const { ugp, alto } = calcularUGP(totales);

    return {
      ok: true,
      ingredientes: (Array.isArray(datos.ingredientes) ? datos.ingredientes : [])
        .slice(0, 12)
        .map((i) => ({
          nombre: String(i?.nombre || '').slice(0, 80),
          cantidad: String(i?.cantidad || '').slice(0, 40),
          estadoCrudoCocido: ['crudo', 'cocido', 'no aplica'].includes(i?.estadoCrudoCocido)
            ? i.estadoCrudoCocido
            : 'no aplica',
          proteina: numeroSeguro(i?.proteina),
          carbos: numeroSeguro(i?.carbos),
          grasa: numeroSeguro(i?.grasa),
        }))
        .filter((i) => i.nombre),
      totales,
      faltante: String(datos.faltante || '').trim().slice(0, 250),
      advertencia: String(datos.advertencia || '').trim().slice(0, 250),
      ugp,
      highUGP: alto || datos.highUGP === true,
      modelo: MODELO_NUTRICION,
    };
  } catch (err) {
    console.error('[calcularAntojo]', err);
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
