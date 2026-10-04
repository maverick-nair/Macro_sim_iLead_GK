/**
 * Money formatting for a storyline. Negative amounts use the minus sign, per the copy rules. Kept
 * apart from the Zod schema in config.ts so the board's first load does not carry the schema.
 */
export interface MoneySettings {
  currency: string;
  locale: string;
  display: 'symbol' | 'narrowSymbol' | 'code';
}

export function moneyFormatter(money: MoneySettings) {
  const base = { style: 'currency' as const, currency: money.currency, currencyDisplay: money.display };
  const full = new Intl.NumberFormat(money.locale, { ...base, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const exact = new Intl.NumberFormat(money.locale, base);
  const compact = new Intl.NumberFormat(money.locale, { ...base, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const fix = (s: string) => s.replace(/-/g, '\u2212');
  return {
    /** HUD and board: whole units, "$41,200", "¥4,120,000", "₹41,20,000". */
    format: (n: number) => fix(full.format(n)),
    /** Report tables: the currency's own decimals. */
    exact: (n: number) => fix(exact.format(n)),
    /** Tight spaces: "$240K", "₹24L". */
    compact: (n: number) => fix(compact.format(n))
  };
}
