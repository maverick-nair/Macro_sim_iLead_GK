import { IntlMessageFormat, type PrimitiveType } from 'intl-messageformat';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { formatDelta, MINUS } from './copy';
import { en, type LazyMessages } from './messages/en';

export { formatDelta, sanitizeCopy } from './copy';

/**
 * String catalog. Every participant facing string lives in `messages/<locale>/*.json` as an ICU
 * message. Components call `t('key', values)`. Keys are typed from the English catalog.
 */
export type MessageKey = keyof typeof en | keyof LazyMessages;
export type Messages = Record<MessageKey, string>;
export type Values = Record<string, PrimitiveType>;

interface Locale { messages: Messages; dir: 'ltr' | 'rtl' }
const LOCALES: Record<string, Locale> = { en: { messages: en as Messages, dir: 'ltr' } };

/**
 * Copy for screens that load on demand (end screen, report, week end), registered by those screens when
 * their code loads, so it stays out of the first load (D67). Read at call time by every `t`.
 */
const registered: Record<string, string> = {};
export function registerMessages(messages: Record<string, string>) {
  Object.assign(registered, messages);
}
const RTL = new Set(['ar', 'he', 'fa', 'ur']);

export interface I18n {
  locale: string;
  dir: 'ltr' | 'rtl';
  t: (key: MessageKey, values?: Values) => string;
  delta: (n: number) => string;
  number: (n: number) => string;
}

/** Parsed messages per locale, shared by every catalog without overrides (each provider used to parse its own). */
const shared = new Map<string, Map<string, IntlMessageFormat>>();

export function createI18n(locale = 'en', override?: Partial<Messages>): I18n {
  const base = LOCALES[locale] ?? LOCALES.en;
  // The English catalog as is when nothing is overridden: copying ~1500 keys per provider showed in the first load's long task (D78).
  const messages: Messages = !override && base === LOCALES.en ? base.messages : { ...LOCALES.en.messages, ...base.messages, ...override };
  let cache = override ? undefined : shared.get(locale);
  if (!cache) {
    cache = new Map<string, IntlMessageFormat>();
    if (!override) shared.set(locale, cache);
  }
  const formats = cache;
  // Made on first use: building an Intl formatter is not free, and many catalogs never format a number.
  let nf: Intl.NumberFormat | undefined;
  const t = (key: MessageKey, values?: Values): string => {
    let f = formats.get(key);
    if (!f) {
      const text = messages[key] ?? registered[key];
      if (text === undefined) return key;
      f = new IntlMessageFormat(text, locale);
      formats.set(key, f);
    }
    // Intl formats negative numbers with a hyphen; copy rules want the minus sign.
    return String(f.format(values)).replace(/-(?=\d)/g, MINUS);
  };
  return {
    locale,
    dir: RTL.has(locale.split('-')[0]) ? 'rtl' : base.dir,
    t,
    delta: n => formatDelta(n, locale),
    number: n => (nf ??= new Intl.NumberFormat(locale)).format(n).replace(/-(?=\d)/g, MINUS)
  };
}

const I18nContext = createContext<I18n>(createI18n());

export function I18nProvider({ locale = 'en', messages, children }: { locale?: string; messages?: Partial<Messages>; children: ReactNode }) {
  const value = useMemo(() => createI18n(locale, messages), [locale, messages]);
  // Language and direction on a layout neutral wrapper, so screen readers and RTL locales follow the catalog.
  return <I18nContext.Provider value={value}><div lang={locale} dir={value.dir} className="contents">{children}</div></I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
