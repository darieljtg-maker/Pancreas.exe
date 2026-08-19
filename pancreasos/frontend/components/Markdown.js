import { Fragment } from 'react';

/**
 * Renderizador de Markdown mínimo, sin dependencias.
 *
 * Construye elementos de React en vez de inyectar HTML: el texto viene de un
 * modelo de lenguaje, y así no hay forma de que lo devuelto acabe ejecutándose
 * como marcado en la página.
 *
 * Cubre lo que genera Gemini en un reporte: encabezados, listas, negritas,
 * cursivas, código, citas y separadores.
 */

const RE_INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`]+`)/g;

function inline(texto, prefijo) {
  return texto.split(RE_INLINE).filter(Boolean).map((trozo, i) => {
    const clave = `${prefijo}-${i}`;

    if (/^(\*\*|__).+(\*\*|__)$/.test(trozo)) {
      return (
        <strong key={clave} className="font-semibold text-texto">
          {trozo.slice(2, -2)}
        </strong>
      );
    }
    if (/^\*[^*]+\*$/.test(trozo)) {
      return <em key={clave}>{trozo.slice(1, -1)}</em>;
    }
    if (/^`[^`]+`$/.test(trozo)) {
      return (
        <code key={clave} className="rounded bg-superficie-alta px-1.5 py-0.5 font-mono text-[0.85em]">
          {trozo.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={clave}>{trozo}</Fragment>;
  });
}

const TAMANOS = {
  1: 'text-xl font-bold mt-5 mb-2',
  2: 'text-lg font-bold mt-5 mb-2',
  3: 'text-base font-semibold mt-4 mb-1.5',
  4: 'text-sm font-semibold mt-3 mb-1 uppercase tracking-wide text-tenue',
};

export default function Markdown({ texto }) {
  if (!texto) return null;

  const lineas = String(texto).replace(/\r\n/g, '\n').split('\n');
  const bloques = [];
  let i = 0;

  const nuevaClave = () => `b${bloques.length}`;

  while (i < lineas.length) {
    const linea = lineas[i];

    if (!linea.trim()) {
      i += 1;
      continue;
    }

    // Bloque de código cercado.
    if (/^```/.test(linea)) {
      const cuerpo = [];
      i += 1;
      while (i < lineas.length && !/^```/.test(lineas[i])) cuerpo.push(lineas[i++]);
      i += 1;
      bloques.push(
        <pre
          key={nuevaClave()}
          className="my-3 overflow-x-auto rounded-lg bg-superficie-alta p-3 font-mono text-xs"
        >
          {cuerpo.join('\n')}
        </pre>
      );
      continue;
    }

    // Separador.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(linea.trim())) {
      bloques.push(<hr key={nuevaClave()} className="my-4 border-borde" />);
      i += 1;
      continue;
    }

    // Encabezado.
    const enc = /^(#{1,6})\s+(.*)$/.exec(linea);
    if (enc) {
      const nivel = Math.min(enc[1].length, 4);
      const Etiqueta = `h${Math.min(nivel + 1, 6)}`;
      bloques.push(
        <Etiqueta key={nuevaClave()} className={TAMANOS[nivel]}>
          {inline(enc[2], nuevaClave())}
        </Etiqueta>
      );
      i += 1;
      continue;
    }

    // Cita.
    if (/^>\s?/.test(linea)) {
      const cuerpo = [];
      while (i < lineas.length && /^>\s?/.test(lineas[i])) {
        cuerpo.push(lineas[i].replace(/^>\s?/, ''));
        i += 1;
      }
      bloques.push(
        <blockquote
          key={nuevaClave()}
          className="my-3 border-l-2 border-acento/60 pl-3 text-sm text-tenue"
        >
          {inline(cuerpo.join(' '), nuevaClave())}
        </blockquote>
      );
      continue;
    }

    // Listas.
    const esVinneta = (l) => /^\s*[-*+]\s+/.test(l);
    const esNumerada = (l) => /^\s*\d+[.)]\s+/.test(l);

    if (esVinneta(linea) || esNumerada(linea)) {
      const ordenada = esNumerada(linea);
      const coincide = ordenada ? esNumerada : esVinneta;
      const items = [];
      while (i < lineas.length && coincide(lineas[i])) {
        items.push(lineas[i].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''));
        i += 1;
      }
      const Etiqueta = ordenada ? 'ol' : 'ul';
      bloques.push(
        <Etiqueta
          key={nuevaClave()}
          className={`my-2 flex flex-col gap-1.5 pl-5 text-sm ${
            ordenada ? 'list-decimal' : 'list-disc'
          }`}
        >
          {items.map((it, k) => (
            <li key={k} className="pl-1 marker:text-acento">
              {inline(it, `${nuevaClave()}-${k}`)}
            </li>
          ))}
        </Etiqueta>
      );
      continue;
    }

    // Párrafo: se juntan las líneas seguidas.
    const parrafo = [];
    while (
      i < lineas.length &&
      lineas[i].trim() &&
      !/^(#{1,6}\s|>|```|-{3,})/.test(lineas[i]) &&
      !esVinneta(lineas[i]) &&
      !esNumerada(lineas[i])
    ) {
      parrafo.push(lineas[i].trim());
      i += 1;
    }
    bloques.push(
      <p key={nuevaClave()} className="my-2 text-sm leading-relaxed">
        {inline(parrafo.join(' '), nuevaClave())}
      </p>
    );
  }

  return <div className="text-texto">{bloques}</div>;
}
