import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { printAST } from '@formatjs/icu-messageformat-parser/printer.js';

/**
 * Pseudo locales for layout testing (D83), built from the English catalog, loaded only when the launch
 * asks for one:
 * - `en-XA`: accented letters and a third more length, in brackets, to find text that overflows,
 *   is cut off, or is not in the catalog (it shows plain).
 * - `ar-XB`: every message forced right to left, with the page in `dir="rtl"`, to find layouts that
 *   do not mirror.
 * Placeholders, plurals and selects are kept; only the visible text changes.
 */
const ACCENTS: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ó', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ú', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ó', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ú', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž'
};
const RLO = '‮', PDF = '‬';

function walk(els: MessageFormatElement[], f: (text: string) => string): MessageFormatElement[] {
  return els.map(el => {
    if (el.type === TYPE.literal) return { ...el, value: f(el.value) };
    if (el.type === TYPE.select || el.type === TYPE.plural) return { ...el, options: Object.fromEntries(Object.entries(el.options).map(([k, o]) => [k, { ...o, value: walk(o.value, f) }])) };
    if (el.type === TYPE.tag) return { ...el, children: walk(el.children, f) };
    return el;
  });
}

const accent = (t: string) => t.replace(/[a-zA-Z]/g, c => ACCENTS[c] ?? c);
const visible = (els: MessageFormatElement[]): number => els.reduce((n, el) => n + (el.type === TYPE.literal ? el.value.length : 4), 0);

export function pseudoMessage(message: string, tag: string): string {
  let ast: MessageFormatElement[];
  try { ast = parse(message); } catch { return message; }
  if (!ast.length) return message;
  if (tag === 'ar-XB') return RLO + printAST(ast) + PDF;
  const pad = '·'.repeat(Math.max(1, Math.round(visible(ast) / 3)));
  return `[${printAST(walk(ast, accent))} ${pad}]`;
}

export function pseudoCatalog(messages: Record<string, string>, tag: string): Record<string, string> {
  return Object.fromEntries(Object.entries(messages).map(([k, v]) => [k, pseudoMessage(v, tag)]));
}
