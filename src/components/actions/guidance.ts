import type { EngineView, MemberView } from '../../engine/contract';
import type { useI18n } from '../../i18n';
import type { PeriodUnit } from '../action/days';
import { intentOf } from './intent';

export { byIntent, intentOf, INTENTS, type Intent } from './intent';

type ActionV = EngineView['actions'][number];

/**
 * Guiding the action choice (D234): the Actions panel groups a person's actions by what they are for, and marks
 * at most two that suit that person now, each with a plain reason. Pure functions of the engine view, so the
 * board never computes outcomes: the hint reads only what the participant can already see.
 */

/** Why an action fits now. Numbers only when the participant can see them (stats revealed, D39). */
export type FitReason =
  | { code: 'promise' }
  | { code: 'morale'; morale: number }
  | { code: 'mood'; mood: 'frustrated' | 'concerned' }
  | { code: 'neglect'; periods: number }
  | { code: 'missed' }
  | { code: 'assess' }
  | { code: 'skill'; skill: number }
  | { code: 'result'; result: number };
export interface FitHint { key: string; reason: FitReason }

export type GuidanceView = Pick<EngineView, 'phase' | 'purpose' | 'actions' | 'members' | 'promises'>;

/** Morale under this reads as concerned (the engine's mood line); skill under this is worth training, a result from this worth rewarding. */
const LOW_MORALE = 45, LOW_SKILL = 40, HIGH_RESULT = 75;
/** A promise due within this many sub-periods is worth keeping now. */
const PROMISE_SOON = 2;
/** A repeat that would land at less than this share is not worth suggesting (D171). */
const MIN_SHARE = 0.5;
/** Face to face first: the conversation formats in the order a hint prefers them. */
const TALK_FORMATS = ['roleplay', 'meeting', 'chat', 'plan'];
const MAX_HINTS = 2;

/**
 * Up to two actions that suit this person now, best first. None when the guide is off (the participant turned tips
 * off, D99), in an assessment run (purpose `assessment`), off the plain board, or for someone not on the team. Never a
 * blocked action, nor a repeat that would land at under half its effect, and never two conversations.
 */
export function fitsNow(v: GuidanceView, memberId: string, { guide }: { guide: boolean }): FitHint[] {
  const m = v.members.find(x => x.id === memberId);
  if (!guide || v.purpose === 'assessment' || v.phase !== 'board' || !m) return [];
  const share = (a: ActionV) => a.repeatFor?.[m.id]?.share ?? 1;
  // Strictly null: a missing entry is not known to be open.
  const open = v.actions.filter(a => a.scope === 'member' && a.blockedFor[m.id] === null && share(a) >= MIN_SHARE);
  const formatRank = (a: ActionV) => { const i = TALK_FORMATS.indexOf(a.format ?? ''); return i < 0 ? TALK_FORMATS.length : i; };
  const conversations = open.filter(a => a.rule === 'styleOption' && a.kind !== 'static')
    .map((a, i) => ({ a, i })).sort((x, y) => share(y.a) - share(x.a) || formatRank(x.a) - formatRank(y.a) || x.i - y.i).map(x => x.a);
  const byRule = (rule: ActionV['rule']) => open.find(a => a.rule === rule);

  const out: FitHint[] = [];
  const add = (a: ActionV | undefined, reason: FitReason) => {
    if (!a || out.length >= MAX_HINTS || out.some(h => h.key === a.key)) return;
    // One conversation is advice enough.
    if (intentOf(a) === 'talk' && out.some(h => intentOf(v.actions.find(x => x.key === h.key)!) === 'talk')) return;
    out.push({ key: a.key, reason });
  };

  const promise = v.promises.find(p => p.memberId === m.id && p.state === 'open' && p.dueInSubPeriods <= PROMISE_SOON);
  if (promise) {
    const keeps = open.filter(a => promise.keptBy.includes(a.key));
    add(conversations.find(a => keeps.includes(a)) ?? keeps[0], { code: 'promise' });
  }
  if (m.morale !== null ? m.morale < LOW_MORALE : m.mood === 'frustrated' || m.mood === 'concerned')
    add(conversations[0], m.morale !== null ? { code: 'morale', morale: m.morale } : { code: 'mood', mood: m.mood as 'frustrated' | 'concerned' });
  if (m.neglected) add(conversations[0], { code: 'neglect', periods: m.unattended ?? 0 });
  if (m.lastReaction === 'neg') add(conversations[0], { code: 'missed' });
  if (!m.assessedStages.length) add(byRule('assess'), { code: 'assess' });
  if (m.skill !== null && m.skill < LOW_SKILL && (m.morale ?? LOW_MORALE) >= LOW_MORALE) add(byRule('training'), { code: 'skill', skill: m.skill });
  if (m.result !== null && m.result >= HIGH_RESULT && (m.morale ?? 0) >= LOW_MORALE) add(byRule('reward'), { code: 'result', result: m.result });
  return out;
}

type Translate = ReturnType<typeof useI18n>['t'];
/** The person's name, and the storyline's period for "No time alone with you for 3 weeks". */
type Who = Pick<MemberView, 'name'> & { periodUnit: PeriodUnit };

/** A hint's reason in words, for the row under the action's name. */
export function fitText(t: Translate, r: FitReason, who: Who): string {
  const name = who.name.split(' ')[0];
  switch (r.code) {
    case 'promise': return t('actions.fit.promise', { name });
    case 'morale': return t('actions.fit.morale', { n: r.morale });
    case 'mood': return t('actions.fit.mood', { mood: r.mood });
    case 'neglect': return t('actions.fit.neglect', { n: r.periods, unit: who.periodUnit, name });
    case 'missed': return t('actions.fit.missed');
    case 'assess': return t('actions.fit.assess', { name });
    case 'skill': return t('actions.fit.skill', { n: r.skill });
    case 'result': return t('actions.fit.result', { n: r.result });
  }
}
