import { msg, type Param } from './copy';

/**
 * The sales unit's words as message parameters (D227): `unitOne` ("deal"), `unitMany` ("deals"), `UnitMany` ("Deals",
 * for the start of a line) and `aUnit` ("a deal"). A storyline that names its unit ("outlet order") sends its own
 * words, with "a" or "an" before the singular; one that does not sends the catalog's, so the copy reads as before in
 * every language. Kept free of the schema, so the engine, the report and the player share it.
 */
export type UnitParams = Record<'unitOne' | 'unitMany' | 'UnitMany' | 'aUnit', Param>;

/** The authored unit, or null for the catalog's word. */
export type SalesUnit = { one: string; other: string } | null | undefined;

const capital = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
/** "a" or "an" before an English word, by its first letter (an hour and a user are rare in sales units). */
export const withArticle = (one: string) => `${/^[aeiou]/i.test(one.trim()) ? 'an' : 'a'} ${one.trim()}`;

/** The unit's words as engine message parameters. */
export function unitParams(unit: SalesUnit): UnitParams {
  if (!unit) return { unitOne: msg('engine.unit.one'), unitMany: msg('engine.unit.many'), UnitMany: msg('engine.unit.Many'), aUnit: msg('engine.unit.a') };
  return { unitOne: unit.one, unitMany: unit.other, UnitMany: capital(unit.other), aUnit: withArticle(unit.one) };
}

export type UnitWords = Record<keyof UnitParams, string> & { custom: 'yes' | 'no' };

/** The unit's words for the player's own catalog (`t`), as plain strings. */
export function unitWords(t: (key: 'unit.one' | 'unit.many' | 'unit.Many' | 'unit.a') => string, unit: SalesUnit): UnitWords {
  if (!unit) return { unitOne: t('unit.one'), unitMany: t('unit.many'), UnitMany: t('unit.Many'), aUnit: t('unit.a'), custom: 'no' };
  return { unitOne: unit.one, unitMany: unit.other, UnitMany: capital(unit.other), aUnit: withArticle(unit.one), custom: 'yes' };
}
