import { IntlMessageFormat, type PrimitiveType } from 'intl-messageformat';
import { formatDelta, MINUS } from './copy';
import { en, type LazyMessages } from './messages/en';

/**
 * The string catalog without React (D83): locales, the launch locale, and `createI18n`. The engine
 * contract words engine copy through it at the boundary (`engineCopy.ts`), so it stays free of React.
 *
 * Every participant facing string lives in `messages/<locale>/*.json` as an ICU message. Keys are typed
 * from the English catalog. Another locale may leave keys out: they fall back to English one by one.
 */
export type MessageKey = keyof typeof en | keyof LazyMessages;
export type Messages = Record<MessageKey, string>;
export type Values = Record<string, PrimitiveType>;
export type Dir = 'ltr' | 'rtl';

interface Locale { messages: Partial<Record<string, string>>; dir: Dir; format?: string }
const LOCALES: Record<string, Locale> = { en: { messages: en, dir: 'ltr' } };
const RTL = new Set(['ar', 'he', 'fa', 'ur']);

/** Adds a catalog (a lazily loaded language, or a pseudo locale). `format` is the locale numbers and dates use. */
export function addLocale(tag: string, messages: Partial<Record<string, string>>, opts: { dir?: Dir; format?: string } = {}) {
  LOCALES[tag] = { messages, dir: opts.dir ?? (RTL.has(tag.split('-')[0]) ? 'rtl' : 'ltr'), format: opts.format };
  shared.delete(tag);
}

/**
 * Copy for screens that load on demand (end screen, report, week end), registered by those screens when
 * their code loads, so it stays out of the first load (D67). Read at call time by every `t`. A non English
 * locale registers its own lazy copy under its tag.
 */
const registered: Record<string, Record<string, string>> = { en: {} };
/** Locales derived from English (the pseudo locales): English copy registered later is derived too. */
const mirrors: Array<[string, (m: Record<string, string>) => Record<string, string>]> = [];
export function registerMessages(messages: Record<string, string>, locale = 'en') {
  Object.assign((registered[locale] ??= {}), messages);
  if (locale === 'en') for (const [tag, derive] of mirrors) Object.assign((registered[tag] ??= {}), derive(messages));
}
/** Derives a locale's lazily registered copy from English, now and whenever English copy registers. */
export function mirrorRegistered(tag: string, derive: (m: Record<string, string>) => Record<string, string>) {
  mirrors.push([tag, derive]);
  Object.assign((registered[tag] ??= {}), derive(registered.en));
}

/** Pseudo locales for testing (D83): `en-XA` is accented and a third longer, `ar-XB` is mirrored right to left. */
export const PSEUDO = { 'en-XA': { dir: 'ltr' as Dir }, 'ar-XB': { dir: 'rtl' as Dir } };
export const isPseudo = (tag: string): tag is keyof typeof PSEUDO => tag in PSEUDO;

/** The catalog a tag reads: an exact match, else its language ("es-MX" reads "es"), else English. */
export function catalogFor(tag: string): string {
  if (LOCALES[tag]) return tag;
  const lang = tag.split('-')[0];
  return LOCALES[lang] ? lang : 'en';
}

let launchLocale = 'en';
let launchExplicit = false;
/**
 * The participant's locale, from the launch (`?locale=`), set once before the first render. With none,
 * English copy and the storyline's own money locale (D83).
 */
export function setAppLocale(tag: string | null | undefined) {
  launchExplicit = !!tag;
  launchLocale = normalize(tag) ?? 'en';
}
export const appLocale = () => launchLocale;
/** The locale numbers, dates and money format in when the launch named one, else null. */
export const explicitFormatLocale = () => (launchExplicit ? formatLocaleOf(launchLocale) : null);

function normalize(tag: string | null | undefined): string | null {
  if (!tag) return null;
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? null;
  } catch {
    return null;
  }
}

/** Pseudo locales format numbers and dates as their base language does (English digits for `ar-XB`, to keep them readable in tests). */
export const formatLocaleOf = (tag: string) => LOCALES[tag]?.format ?? (isPseudo(tag) ? 'en' : tag);
export const dirOf = (tag: string): Dir => LOCALES[catalogFor(tag)]?.dir === 'rtl' || RTL.has(tag.split('-')[0]) ? 'rtl' : 'ltr';

export interface I18n {
  locale: string;
  dir: Dir;
  t: (key: MessageKey, values?: Values) => string;
  /** Any catalog key, for codes that come as data (engine copy). Missing keys come back as the key. */
  tk: (key: string, values?: Values) => string;
  delta: (n: number) => string;
  number: (n: number, opts?: Intl.NumberFormatOptions) => string;
  /** A date in the participant's locale: "7 October 2026", "October 2026". */
  date: (d: Date, opts?: Intl.DateTimeFormatOptions) => string;
  /** The locale numbers and dates use. */
  formatLocale: string;
}

/*
 * Each message used to resolve its locale, a native call that made up most of the first load's long
 * task on a slow CPU (D78): one lookup per locale, shared by every message.
 */
const resolveLocale = IntlMessageFormat.resolveLocale;
const resolved = new Map<string, Intl.Locale | undefined>();
IntlMessageFormat.resolveLocale = locales => {
  const key = String(locales);
  if (!resolved.has(key)) resolved.set(key, resolveLocale(locales));
  return resolved.get(key);
};
/** Parsed messages per locale, shared by every catalog without overrides (each provider used to parse its own). */
const shared = new Map<string, Map<string, IntlMessageFormat>>();

export function createI18n(locale = appLocale(), override?: Partial<Messages>): I18n {
  const cat = catalogFor(locale);
  const base = LOCALES[cat];
  const fmt = formatLocaleOf(locale);
  // The English catalog as is when nothing is overridden: copying ~1500 keys per provider showed in the first load's long task (D78).
  const lookup = (key: string): string | undefined => override?.[key as MessageKey] ?? base.messages[key] ?? registered[cat]?.[key] ?? (cat === 'en' ? undefined : en[key as keyof typeof en]) ?? registered.en[key];
  let cache = override ? undefined : shared.get(locale);
  if (!cache) {
    cache = new Map<string, IntlMessageFormat>();
    if (!override) shared.set(locale, cache);
  }
  const formats = cache;
  // Made on first use: building an Intl formatter is not free, and many catalogs never format a number.
  let nf: Intl.NumberFormat | undefined;
  const tk = (key: string, values?: Values): string => {
    let f = formats.get(key);
    if (!f) {
      const text = lookup(key);
      if (text === undefined) return key;
      f = new IntlMessageFormat(text, fmt);
      formats.set(key, f);
    }
    // Intl formats negative numbers with a hyphen; copy rules want the minus sign.
    return String(f.format(values)).replace(/-(?=\d)/g, MINUS);
  };
  return {
    locale,
    dir: dirOf(locale),
    t: tk,
    tk,
    delta: n => formatDelta(n, fmt),
    number: (n, opts) => (opts ? new Intl.NumberFormat(fmt, opts) : (nf ??= new Intl.NumberFormat(fmt))).format(n).replace(/-(?=\d)/g, MINUS),
    date: (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => new Intl.DateTimeFormat(fmt, opts).format(d),
    formatLocale: fmt
  };
}
