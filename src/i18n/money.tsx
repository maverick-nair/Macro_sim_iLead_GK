import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { moneyFormatter } from '../engine/money';
import { explicitFormatLocale } from './core';

/**
 * Money formatting for the running storyline: currency, locale and display come from the
 * GenieKreator config (docs/SIMULATION.md 1.1). Components call useMoney().format(n).
 */
export type MoneyConfig = Parameters<typeof moneyFormatter>[0];
export type Money = ReturnType<typeof moneyFormatter>;

const DEFAULT: MoneyConfig = { currency: 'USD', locale: 'en-US', display: 'symbol' };
const MoneyContext = createContext<Money>(moneyFormatter(DEFAULT));

export function MoneyProvider({ money, children }: { money: Pick<MoneyConfig, 'currency' | 'locale' | 'display'>; children: ReactNode }) {
  const { currency, display } = money;
  // The participant's locale when the launch names one (D83), else the storyline's own (lakh grouping in en-IN).
  const locale = explicitFormatLocale() ?? money.locale;
  const value = useMemo(() => moneyFormatter({ currency, locale, display }), [currency, locale, display]);
  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export const useMoney = () => useContext(MoneyContext);
