import type { CSSProperties } from 'react';

/**
 * Converts a CSS declaration string into a React style object.
 *
 * The screens were designed as inline CSS strings. Keeping them as strings (with
 * `${}` interpolation) keeps the port pixel faithful and easy to diff against the
 * design source. Results are memoised, so repeated renders are cheap.
 * Custom properties (`--ik-text`) are kept verbatim, everything else is camelCased.
 */
const cache = new Map<string, CSSProperties>();

export function css(text: string): CSSProperties {
  const hit = cache.get(text);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of splitDeclarations(text)) {
    const i = decl.indexOf(':');
    if (i < 1) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || value === '') continue;
    const key = prop.startsWith('--')
      ? prop
      : prop.replace(/^-(webkit|moz|ms)-/, (_, v: string) => v[0].toUpperCase() + v.slice(1) + '-').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = value;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(text, out as CSSProperties);
  return out as CSSProperties;
}

/** Splits on `;` that are not inside parentheses or quotes (url(), oklch(), data URIs). */
function splitDeclarations(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/**
 * Pseudo class styles (`:hover`, `:focus-visible`, ...) for elements that are
 * otherwise styled inline. Returns a generated class name. Declarations are made
 * `!important` so they win over the inline style, which is how the design runtime
 * applies its `style-hover` attributes.
 */
let sheet: CSSStyleSheet | null = null;
const pseudoCache = new Map<string, string>();
let n = 0;

export function pseudo(kind: string, declarations: string): string {
  const key = kind + '|' + declarations;
  const hit = pseudoCache.get(key);
  if (hit) return hit;
  if (!sheet) {
    const el = document.createElement('style');
    el.setAttribute('data-il-pseudo', '');
    document.head.appendChild(el);
    sheet = el.sheet!;
  }
  const cls = 'ilp' + (n++).toString(36);
  const isElement = kind === 'before' || kind === 'after';
  const body = isElement ? declarations : importantify(declarations);
  sheet.insertRule(`.${cls}${isElement ? '::' : ':'}${kind}{${body}}`, sheet.cssRules.length);
  pseudoCache.set(key, cls);
  return cls;
}

function importantify(declarations: string): string {
  return splitDeclarations(declarations)
    .map(d => d.trim())
    .filter(Boolean)
    .map(d => (/!important\s*$/.test(d) ? d : d + ' !important'))
    .join(';');
}

/** Joins class names, skipping falsy entries. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}
