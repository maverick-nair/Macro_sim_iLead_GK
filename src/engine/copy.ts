/**
 * Engine copy as message codes (D60, D83). The engine never writes a participant facing sentence of
 * its own: it sends a code with parameters, and the client words it from the ICU catalog in the
 * participant's language (`src/i18n/messages/<locale>/engine.json`, `src/i18n/engineCopy.ts`).
 *
 * Authored copy (the storyline's events, emails, persona lines, report narratives) stays a plain string
 * in the storyline's language (`StorylineConfig.locale`). Where authored copy has engine words filled
 * in, the engine sends a template: the authored text with its placeholders, filled on the client.
 *
 * Kept free of imports so the server, the mock and the client share it.
 */

/** Money, formatted on the client in the participant's locale (or the storyline's, when none is set). */
export interface MoneyParam { money: number; currency: string; locale: string; display: 'symbol' | 'narrowSymbol' | 'code' }
/** A list joined with the locale's words: "A, B and C", "A, B or C", or commas only ("A, B, C"). */
export interface ListParam { list: Param[]; conj: 'and' | 'or' | 'comma' }
/** A catalog message: `engine.*` code and its parameters. */
export interface Msg { code: string; params?: Record<string, Param> }
/** Authored copy with {placeholders} filled on the client (the values may be messages). */
export interface Template { template: string; params: Record<string, Param> }
export type Param = string | number | Msg | Template | MoneyParam | ListParam;
/** What the engine sends wherever the participant reads text: authored text, a message, or a template. */
export type Copy = string | Msg | Template;

export const msg = (code: string, params?: Record<string, Param>): Msg => (params ? { code, params } : { code });
export const listOf = (list: Param[], conj: ListParam['conj'] = 'and'): ListParam => ({ list, conj });
export const moneyOf = (money: number, m: { currency: string; locale: string; display: MoneyParam['display'] }): MoneyParam => ({ money, currency: m.currency, locale: m.locale, display: m.display });
export const template = (text: string, params: Record<string, Param>): Template => ({ template: text, params });

export const isMsg = (v: unknown): v is Msg => typeof v === 'object' && v !== null && typeof (v as Msg).code === 'string';
export const isTemplate = (v: unknown): v is Template => typeof v === 'object' && v !== null && typeof (v as Template).template === 'string';
export const isMoney = (v: unknown): v is MoneyParam => typeof v === 'object' && v !== null && typeof (v as MoneyParam).money === 'number';
export const isList = (v: unknown): v is ListParam => typeof v === 'object' && v !== null && Array.isArray((v as ListParam).list);

/** Whether a message has this code (engine logic that used to compare English labels). */
export const hasCode = (c: Copy | undefined | null, code: string) => isMsg(c) && c.code === code;
/** A stable key for a piece of copy, for de-duplication (equal keys word the same in every locale). */
export const copyKey = (c: Copy) => (typeof c === 'string' ? c : JSON.stringify(c));
