/**
 * Money formatting for a storyline. Negative amounts use the minus sign, per the copy rules. Kept
 * apart from the Zod schema in config.ts so the board's first load does not carry the schema.
 */
export interface MoneySettings {
  currency: string;
  locale: string;
  display: 'symbol' | 'narrowSymbol' | 'code';
}

export type MoneyFormatter = ReturnType<typeof makeFormatter>;
const formatters = new Map<string, MoneyFormatter>();

/**
 * Building an Intl formatter is slow (three per call showed in the first load's long task, D78): one
 * set per currency, locale and display, each formatter made on first use.
 */
export function moneyFormatter(money: MoneySettings): MoneyFormatter {
  const key = `${money.locale}|${money.currency}|${money.display}`;
  let f = formatters.get(key);
  if (!f) formatters.set(key, (f = makeFormatter(money)));
  return f;
}

function makeFormatter(money: MoneySettings) {
  const base = { style: 'currency' as const, currency: money.currency, currencyDisplay: money.display };
  let full: Intl.NumberFormat | undefined;
  let exact: Intl.NumberFormat | undefined;
  let compact: Intl.NumberFormat | undefined;
  const fix = (s: string) => s.replace(/-/g, '−');
  return {
    /** HUD and board: whole units, "$41,200", "¥4,120,000", "₹41,20,000". */
    format: (n: number) => fix((full ??= new Intl.NumberFormat(money.locale, { ...base, minimumFractionDigits: 0, maximumFractionDigits: 0 })).format(n)),
    /** Report tables: the currency's own decimals. */
    exact: (n: number) => fix((exact ??= new Intl.NumberFormat(money.locale, base)).format(n)),
    /** Tight spaces: "$240K", "₹24L". */
    compact: (n: number) => fix((compact ??= new Intl.NumberFormat(money.locale, { ...base, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 })).format(n))
  };
}
