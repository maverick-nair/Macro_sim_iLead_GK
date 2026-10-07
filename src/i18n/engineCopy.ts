import { isList, isMoney, isMsg, isTemplate, type Copy, type Msg, type Param, type Template } from '../engine/copy';
import { moneyFormatter } from '../engine/money';
import { appLocale, createI18n, explicitFormatLocale, type I18n } from './core';

/**
 * Words engine copy in the participant's language (D60, D83). The engine contract calls this on every
 * text field as it parses a payload, so components only ever see strings, as before. A message is an
 * `engine.*` key of the ICU catalog with parameters; parameters may themselves be messages, lists,
 * money or authored templates, worded first. Authored strings pass through untouched.
 */
let cached: I18n | null = null;
const catalog = () => (cached && cached.locale === appLocale() ? cached : (cached = createI18n(appLocale())));

export function wordCopy(c: Copy, i18n: I18n = catalog()): string {
  if (typeof c === 'string') return c;
  if (isTemplate(c)) {
    const vals = wordParams(c.params, i18n);
    return c.template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vals ? String(vals[k]) : m));
  }
  return i18n.tk(c.code, c.params ? wordParams(c.params, i18n) : undefined);
}

function wordParams(params: Record<string, Param>, i18n: I18n): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) out[k] = wordParam(v, i18n);
  return out;
}

function wordParam(v: Param, i18n: I18n): string | number {
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (isMoney(v)) return moneyFormatter({ currency: v.currency, display: v.display, locale: explicitFormatLocale() ?? v.locale }).format(v.money);
  if (isList(v)) {
    const items = v.list.map(x => String(wordParam(x, i18n)));
    const sep = i18n.tk('engine.list.sep');
    if (v.conj === 'comma' || items.length < 2) return items.join(sep);
    return i18n.tk(`engine.list.${v.conj}`, { head: items.slice(0, -1).join(sep), last: items[items.length - 1] });
  }
  if (isMsg(v) || isTemplate(v)) return wordCopy(v, i18n);
  return String(v);
}

/** A payload with its engine copy worded. */
export type Worded<T> = T extends Msg | Template ? string
  : T extends string | number | boolean | null | undefined ? T
  : T extends Array<infer U> ? Array<Worded<U>>
  : T extends object ? { [K in keyof T]: Worded<T[K]> } : T;

/** Every piece of engine copy in a payload, worded: for tests and tools that read engine output directly. */
export function wordAll<T>(value: T, i18n: I18n = catalog()): Worded<T> {
  if (Array.isArray(value)) return value.map(v => wordAll(v, i18n)) as Worded<T>;
  if (value && typeof value === 'object') {
    if (isMsg(value) || isTemplate(value)) return wordCopy(value, i18n) as Worded<T>;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, wordAll(v, i18n)])) as Worded<T>;
  }
  return value as Worded<T>;
}
