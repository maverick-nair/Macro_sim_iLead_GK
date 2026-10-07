import type { Evaluation } from '../../../engine/sim/types';

/**
 * Why a conversation got its rating, in plain words for the author (D113): what the evaluator saw
 * (questions, acknowledgement, a next step, a promise, the concern), what was missing, and whether the
 * style the words showed fit the person's need. Pure: built from the evaluation and what the player meant.
 */

export const BAND_NAME = { strong: 'Strong', adequate: 'Adequate', weak: 'Weak', harmful: 'Harmful' } as const;
const RED_FLAG: Record<string, string> = { abuse: 'abusive words', blame: 'blaming the person', discrimination: 'a discriminatory question', policyBreach: 'a breach of policy' };

export interface ExplainInput {
  evaluation: Evaluation | null;
  format: string;
  /** First name of the person, or null for the team or the sponsor. */
  name: string | null;
  /** The style the player meant to show and the one the words showed, by name; whether it fit the need, and the need's label. */
  intended: string | null;
  shown: string | null;
  fit: boolean | null;
  needLabel: string | null;
  /** The person had a concern they had not shared, and whether it surfaced. */
  concern: boolean;
  surfaced: boolean;
  /** Formats with no style tag (meetings, briefings, interviews): style is not part of the reason. */
  tagged: boolean;
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function explain(x: ExplainInput): string {
  const e = x.evaluation;
  if (!e) return 'The conversation ended before anything was rated, so nothing changed.';
  const band = BAND_NAME[e.band];
  if (e.redFlags.length) return `Why ${band}: the words included ${list(e.redFlags.map(f => RED_FLAG[f] ?? f))}, which makes any conversation Harmful.`;
  const did: string[] = [];
  const missed: string[] = [];
  const who = x.name ?? (x.format === 'meeting' ? 'the team' : 'them');
  if (e.flags.acknowledged) did.push(`acknowledged how ${who === 'the team' ? 'the team feels' : `${who} feels`}`);
  if (e.flags.openQuestions > 0) did.push(e.flags.openQuestions === 1 ? 'asked an open question' : `asked ${e.flags.openQuestions} open questions`);
  else missed.push('asked no open question');
  if (e.flags.invitedContribution) did.push(`invited ${who === 'them' ? 'their' : `${who}'s`} ideas`);
  if (e.flags.specificNextStep) did.push('agreed a clear next step');
  else if (x.format !== 'interview') missed.push('left no clear next step');
  if (e.flags.promise) did.push('made a promise to follow up');
  if (x.concern && x.surfaced) did.push(`surfaced what was really bothering ${x.name ?? 'them'}`);
  else if (x.concern) missed.push(`did not explore what is really bothering ${x.name ?? 'them'}, so the concern stayed hidden`);
  if (!e.flags.acknowledged && (e.band === 'weak' || e.band === 'adequate')) missed.push('did not acknowledge how they feel');

  const parts: string[] = [];
  if (did.length && missed.length) parts.push(`${list(did)}, but ${list(missed)}.`);
  else if (did.length) parts.push(`${list(did)}.`);
  else parts.push(`${list(missed)}.`);
  const dims = e.dimensions.map(d => `${d.key.replace(/_/g, ' ')} ${BAND_NAME[d.band]}`);
  if (dims.length) parts.push(`Rubric: ${list(dims)}.`);
  if (x.tagged && x.shown) {
    const need = x.needLabel ? ` (${x.needLabel.toLowerCase()})` : '';
    if (x.fit === true) parts.push(`The words read as ${x.shown}, which fit ${x.name ?? 'their'}${x.name ? "'s" : ''} need${need}.`);
    else if (x.fit === false) parts.push(`The words read as ${x.shown}, which did not fit ${x.name ?? 'their'}${x.name ? "'s" : ''} need${need}.`);
    if (x.intended && x.intended !== x.shown) parts.push(`The player meant ${x.intended}, but the words did not show it.`);
  }
  return `Why ${band}: ${parts.join(' ')}`;
}
