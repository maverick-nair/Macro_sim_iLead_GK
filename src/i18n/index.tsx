import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { appLocale, createI18n, type I18n, type Messages } from './core';

export { formatDelta, sanitizeCopy } from './copy';
export { addLocale, appLocale, createI18n, registerMessages, setAppLocale } from './core';
export type { I18n, MessageKey, Messages, Values } from './core';

/**
 * String catalog. Every participant facing string lives in `messages/<locale>/*.json` as an ICU
 * message. Components call `t('key', values)`. Keys are typed from the English catalog. The locale is
 * the launch's (`?locale=`, D83), set in `main.tsx` before the first render.
 */
const I18nContext = createContext<I18n | null>(null);
let fallback: I18n | null = null;

export function I18nProvider({ locale, messages, children }: { locale?: string; messages?: Partial<Messages>; children: ReactNode }) {
  const tag = locale ?? appLocale();
  const value = useMemo(() => createI18n(tag, messages), [tag, messages]);
  // Language and direction on a layout neutral wrapper, so screen readers and RTL locales follow the catalog.
  return <I18nContext.Provider value={value}><div lang={tag} dir={value.dir} className="contents">{children}</div></I18nContext.Provider>;
}

/** Outside a provider (stories, tests, the app shell above its provider): the launch locale's catalog. */
const current = (v: I18n | null) => v ?? (fallback?.locale === appLocale() ? fallback : (fallback = createI18n()));
export const useI18n = () => current(useContext(I18nContext));
export const useT = () => current(useContext(I18nContext)).t;
