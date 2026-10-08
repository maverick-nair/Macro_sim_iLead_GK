import type { Check } from './schema';

/**
 * Findings the bundled storylines are known to have (D149). A check that fails for one of these, on that
 * storyline, is reported as advisory with the finding said plainly, so `npm run synthetic -- --check` keeps
 * guarding everything else. Only the bundled storylines are listed, by id; an author's draft never matches
 * (drafts are `draft_<company>`), so the check fails there as it should. Remove an entry once the storyline
 * is fixed.
 */
export const KNOWN_FINDINGS: Record<string, Partial<Record<Check['key'], string>>> = {
  sales_elevator: {
    combined: 'A storyline finding on the bundled Sales Elevator, kept as advice until its actions are rebalanced (D149): with an Expert\'s reading of people, repeating two actions (team energy, a team meeting or a 1:1) every week beats the Expert\'s rounded play, because the actions have no cooldown or diminishing effect and ignored events cost little.'
  }
};

/** The check as reported: a known finding on its bundled storyline fails as advice, with the finding in the detail. */
export function knownFinding(storylineId: string, check: Check): Check {
  const note = KNOWN_FINDINGS[storylineId]?.[check.key];
  if (!note || check.status !== 'fail') return check;
  return { ...check, status: 'warn', detail: check.detail ? `${note} ${check.detail}` : note };
}
