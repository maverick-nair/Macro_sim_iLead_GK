/**
 * Business variables as the participant reads them (D136): money in the storyline's currency (compact), a
 * percentage, or points. Pure: the caller passes the money and number formatters it has.
 */
export type VariableFormat = 'money' | 'percent' | 'points';

export interface Formatters {
  money: { compact: (n: number) => string };
  number: (n: number) => string;
}

/** A value: "$60K", "70%" or "62". With `signed`, a change: "+$5K", "−6%", "+3". */
export function formatVariable(f: Formatters, format: VariableFormat, value: number, signed = false): string {
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '−' : '') : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const body = format === 'money' ? f.money.compact(abs) : f.number(Math.round(abs));
  return format === 'percent' ? `${sign}${body}%` : `${sign}${body}`;
}

/** The direction of a change, and whether it is good news for this variable (null when it did not move). */
export function variableTrend(value: number, start: number, higherIsBetter: boolean): { dir: 'up' | 'down' | 'flat'; better: boolean | null } {
  const dir = value > start ? 'up' : value < start ? 'down' : 'flat';
  return { dir, better: dir === 'flat' ? null : (dir === 'up') === higherIsBetter };
}
