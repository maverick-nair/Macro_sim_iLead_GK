import { IntlMessageFormat, type PrimitiveType } from 'intl-messageformat';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { formatDelta, MINUS } from './copy';
import { en } from './messages/en';

export { formatDelta, sanitizeCopy } from './copy';

/**
 * String catalog. Every participant facing string lives in `messages/<locale>/*.json` as an ICU
 * message. Components call `t('key', values)`. Keys are typed from the English catalog.
 */
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type Values = Record<string, PrimitiveType>;

interface Locale { messages: Messages; dir: 'ltr' | 'rtl' }
const LOCALES: Record<string, Locale> = { en: { messages: en, dir: 'ltr' } };
const RTL = new Set(['ar', 'he', 'fa', 'ur']);

export interface I18n {
  locale: string;
  dir: 'ltr' | 'rtl';
  t: (key: MessageKey, values?: Values) => string;
  delta: (n: number) => string;
  number: (n: number) => string;
}

export function createI18n(locale = 'en', override?: Partial<Messages>): I18n {
  const base = LOCALES[locale] ?? LOCALES.en;
  const messages: Messages = { ...LOCALES.en.messages, ...base.messages, ...override };
  const cache = new Map<string, IntlMessageFormat>();
  const nf = new Intl.NumberFormat(locale);
  const t = (key: MessageKey, values?: Values): string => {
    let f = cache.get(key);
    if (!f) {
      f = new IntlMessageFormat(messages[key] ?? key, locale);
      cache.set(key, f);
    }
    // Intl formats negative numbers with a hyphen; copy rules want the minus sign.
    return String(f.format(values)).replace(/-(?=\d)/g, MINUS);
  };
  return {
    locale,
    dir: RTL.has(locale.split('-')[0]) ? 'rtl' : base.dir,
    t,
    delta: n => formatDelta(n, locale),
    number: n => nf.format(n).replace(/-(?=\d)/g, MINUS)
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
