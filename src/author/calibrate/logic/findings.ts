import type { Check } from './schema';

/**
 * Findings the bundled storyline is known to have (D149). The bundled Sales Elevator's calibrated actions are
 * also what every /author draft starts from, so a check that fails for one of these findings on a storyline
 * that still plays those actions (`playsBundledActions` in ./bundled) is reported as advice, with the finding
 * said plainly, and `npm run synthetic -- --check` keeps guarding everything else. A storyline whose actions an
 * author changed gets the failure as it is. Remove an entry once the actions are rebalanced.
 */
export const BUNDLED_FINDINGS: Partial<Record<Check['key'], string>> = {
  combined: 'A finding in the bundled Sales Elevator\'s calibrated actions, which every draft starts from, kept as advice until they are rebalanced (D149): with an Expert\'s reading of people, repeating two actions (team energy, a team meeting, goals or feedback) every week beats the Expert\'s rounded play, because the actions have no diminishing effect when repeated and ignored events cost little. Changing what those actions do makes this check count in full.'
};

/** The check as reported: a known finding fails as advice on a storyline that plays the bundled actions. */
export function knownFinding(bundled: boolean, check: Check): Check {
  const note = bundled ? BUNDLED_FINDINGS[check.key] : undefined;
  if (!note || check.status !== 'fail') return check;
  return { ...check, status: 'warn', detail: check.detail ? `${note} ${check.detail}` : note };
}
