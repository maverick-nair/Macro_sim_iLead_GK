import { hasCode } from '../copy';
import { bandScore, capability } from '../sim/score';
import type { Sim } from '../sim/types';
import { mean } from './ratings';
import type { RunSummary } from './summary';

/**
 * Reading the run as evidence (D143). The report's headline and summary come from what happened, not
 * from the skill level alone: business result, people outcomes, style fit, conversation quality,
 * activity, the sponsor and the events left unanswered. Each dimension is strong, weak or in between
 * by the storyline's thresholds (`report.evidence`), and every claim the narrative makes names the
 * dimension it rests on, so a claim the data contradicts can be refused (`contradicts`).
 */

export type Dimension = 'business' | 'people' | 'styleFit' | 'words' | 'activity' | 'sponsor' | 'events';
export type Strength = 'strong' | 'ok' | 'weak';
export type Tone = 'positive' | 'negative' | 'neutral';
export type Thresholds = Sim['config']['report']['evidence'];

/** The run's numbers behind the narrative. Changes are team averages, end minus start. */
export interface Evidence {
  /** Revenue as % of target. */
  share: number;
  change: { skill: number; morale: number; result: number; trust: number };
  /** People who resigned, and everyone who left (resigned or let go). */
  resigned: number;
  departed: number;
  /** Share of style choices that fit, %; null without any. */
  styleFit: number | null;
  /** Share of weekly style settings that fit, %; null without any. */
  diagnosis: number | null;
  /** Mean band score of the run's conversations, with at least two; else null. */
  words: number | null;
  conversations: number;
  /** Conversations that went well or landed. */
  landed: number;
  actions: number;
  /** Distinct actions used. */
  breadth: number;
  periods: number;
  sponsor: { start: number; end: number };
  /** Messages, briefings and events left unanswered, and those answered. */
  missed: number;
  answered: number;
}

/** Codes of the log entries that mean something went unanswered. */
export const MISSED = ['engine.log.unanswered', 'engine.escalated', 'engine.log.briefingMissed', 'engine.log.sponsorUnanswered'];

export function gatherEvidence(sim: Sim, run: RunSummary): Evidence {
  const t = run.objectives.team;
  const weekly = sim.decisions.run.filter(d => d.source === 'weeklyStyle');
  const recs = sim.liveRecords;
  return {
    share: run.objectives.share,
    change: { skill: t.skill.end - t.skill.start, morale: t.morale.end - t.morale.start, result: t.result.end - t.result.start, trust: t.trust.end - t.trust.start },
    resigned: sim.triggerCount.resignation ?? 0,
    departed: sim.departed.length,
    styleFit: sim.decisions.run.length ? capability(sim) : null,
    diagnosis: weekly.length ? (100 * weekly.filter(d => d.mismatch === 0).length) / weekly.length : null,
    words: recs.length >= 2 ? mean(recs.map(r => bandScore(sim, r.band))) : null,
    conversations: recs.length,
    landed: recs.filter(r => r.band === 'strong' || r.band === 'adequate').length,
    actions: sim.actionRecords.length,
    breadth: new Set(sim.actionRecords.map(r => r.actionKey)).size,
    periods: Math.max(1, sim.periods.length),
    sponsor: { start: sim.periods[0]?.sponsor.from ?? sim.sponsor.value, end: sim.sponsor.value },
    missed: sim.log.filter(l => MISSED.some(code => hasCode(l.title, code))).length,
    answered: recs.filter(r => r.actionKey === 'reply' || r.actionKey === 'sponsor').length
  };
}

/** How strong each dimension was; null where the run gives no evidence (no conversations, no style choices). */
export function strengths(e: Evidence, t: Thresholds): Record<Dimension, Strength | null> {
  const band = (v: number | null, th: { strong: number; weak: number }): Strength | null => (v === null ? null : v >= th.strong ? 'strong' : v < th.weak ? 'weak' : 'ok');
  const c = e.change, p = t.people;
  const peopleWeak = c.morale <= -p.moraleDrop || c.trust <= -p.trustDrop || e.resigned > 0;
  const rises = [c.skill, c.morale, c.result, c.trust].filter(v => v >= p.rise).length;
  const perPeriod = e.actions / e.periods;
  const sponsor = e.sponsor.end - e.sponsor.start;
  return {
    business: band(e.share, t.business),
    people: peopleWeak ? 'weak' : rises >= 2 ? 'strong' : 'ok',
    styleFit: band(e.styleFit, t.styleFit),
    words: band(e.words, t.words),
    activity: band(perPeriod, t.activity),
    sponsor: sponsor >= t.sponsor.strong ? 'strong' : sponsor <= t.sponsor.weak ? 'weak' : 'ok',
    events: e.missed >= t.events.weak ? 'weak' : e.missed === 0 && e.answered > 0 ? 'strong' : 'ok'
  };
}

/** A sentence the narrative wants to say, and what it says about which dimension. */
export interface Claim<T = unknown> { dimension: Dimension; tone: Tone; text: T }

/**
 * The contradiction guard (D143): a claim the data contradicts. Praise of a dimension whose metric is
 * under its weak threshold, or criticism of one at or over its strong threshold, is refused. A claim
 * about a dimension with no evidence can only be neutral.
 */
export function contradicts(claim: Pick<Claim, 'dimension' | 'tone'>, e: Evidence, t: Thresholds): boolean {
  if (claim.tone === 'neutral') return false;
  const s = strengths(e, t)[claim.dimension];
  if (s === null) return true;
  return claim.tone === 'positive' ? s === 'weak' : s === 'strong';
}

/** The claims the data allows, in order. */
export const guard = <T>(claims: Array<Claim<T>>, e: Evidence, t: Thresholds) => claims.filter(c => !contradicts(c, e, t));

/**
 * The run's profile: the shape of what happened, which picks the headline. Read in this order, first
 * match wins:
 * - readNoAction: few actions, but the style choices fit (read people well, rarely acted).
 * - absent: few actions, and the style choices did not fit well either.
 * - wordsNotChoices: the conversations went well but the style choices mostly did not fit.
 * - allRound: target met and people outcomes strong.
 * - numbersAtCost: the business result was not weak, the people outcomes were.
 * - peopleFirst: people outcomes strong, the target not met.
 * - bothSlipped: people outcomes and the business result both weak.
 * - mixed: anything else.
 */
export const PROFILES = ['readNoAction', 'absent', 'wordsNotChoices', 'allRound', 'numbersAtCost', 'peopleFirst', 'bothSlipped', 'mixed'] as const;
export type Profile = (typeof PROFILES)[number];

/** What each profile's headline says: the claims the guard checks before the headline is used. */
export const HEADLINE_CLAIMS: Record<Profile, Array<Pick<Claim, 'dimension' | 'tone'>>> = {
  readNoAction: [{ dimension: 'styleFit', tone: 'positive' }, { dimension: 'activity', tone: 'negative' }],
  absent: [{ dimension: 'activity', tone: 'negative' }],
  wordsNotChoices: [{ dimension: 'words', tone: 'positive' }, { dimension: 'styleFit', tone: 'negative' }],
  allRound: [{ dimension: 'business', tone: 'positive' }, { dimension: 'people', tone: 'positive' }],
  numbersAtCost: [{ dimension: 'business', tone: 'positive' }, { dimension: 'people', tone: 'negative' }],
  peopleFirst: [{ dimension: 'people', tone: 'positive' }, { dimension: 'business', tone: 'negative' }],
  bothSlipped: [{ dimension: 'people', tone: 'negative' }, { dimension: 'business', tone: 'negative' }],
  mixed: []
};

export function classify(e: Evidence, t: Thresholds): Profile {
  const s = strengths(e, t);
  const when: Record<Profile, boolean> = {
    readNoAction: s.activity === 'weak' && s.styleFit === 'strong',
    absent: s.activity === 'weak',
    wordsNotChoices: (s.words === 'strong' || s.words === 'ok') && s.styleFit === 'weak',
    allRound: s.business === 'strong' && s.people === 'strong',
    numbersAtCost: s.business !== 'weak' && s.people === 'weak',
    peopleFirst: s.people === 'strong' && s.business !== 'strong',
    bothSlipped: s.people === 'weak' && s.business === 'weak',
    mixed: true
  };
  // The headline must pass the guard too: a profile is only chosen when nothing in the data contradicts it.
  return PROFILES.find(p => when[p] && HEADLINE_CLAIMS[p].every(c => !contradicts(c, e, t)))!;
}
