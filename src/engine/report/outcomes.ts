import { businessPillar, roundHalfUp } from '../sim/score';
import { relationLevel } from '../sim/stakeholderState';
import type { Sim } from '../sim/types';
import { contradicts, gatherEvidence, strengths, type Dimension, type Evidence } from './evidence';
import { behaviourSignals, overallOf, type SkillRating } from './ratings';
import type { RunSummary } from './summary';
import { overallVerdict, type Bar, type VerdictGates, type VerdictKey } from './verdict';

/**
 * The overall level capped by what happened (D168), and the outcome gates an assessment verdict reads (D169).
 *
 * The overall level starts from the words: the mean of the reconciled skill ratings (D144). Words alone do not
 * rate a leader whose choices did not fit, whose numbers fell short or whose team fell apart, so each gate the
 * run triggers holds the level at or under its cap (`report.outcomes`, defaults in report/defaults.ts):
 * - fit: style fit and diagnosis, on the reconcile caps (under 40% Developing, under 70% Proficient);
 * - business: revenue against target, or the Business pillar when the storyline weights business variables;
 * - people: morale, trust and skill change over everyone who was on the team, and the people who left (weak, or collapsed);
 * - stakeholders: relationships outside the team that ended strained and lower than they started;
 * - decisions: choice events left to their default.
 * The lowest cap wins. Then the contradiction guard (D143, D145): a level above the middle of the scale praises
 * the whole run, so it stands only when no core dimension (conversations, style fit, people, business) is weak by
 * `report.evidence`; otherwise it is held at the middle. With the defaults the gates already hold it there; the
 * guard keeps an author's looser caps honest. The score is held under the next level, as D144 holds a skill's.
 */

export type Gate = 'fit' | 'business' | 'people' | 'stakeholders' | 'decisions' | 'guard';
/** In the order a reason is told. */
export const GATES: Gate[] = ['fit', 'people', 'business', 'stakeholders', 'decisions', 'guard'];
/** The gates about outcomes, which an assessment verdict must clear to meet the bar (D169). */
export const OUTCOME_GATES: Gate[] = ['business', 'people', 'stakeholders', 'decisions'];

/** A fact behind a cap, worded by `engine.report.capReason`. Percentages and points are rounded. */
export type Reason =
  | { kind: 'styleFit' | 'diagnosis' | 'revenue' | 'pillar' | 'words'; pct: number }
  | { kind: 'left' | 'morale' | 'trust' | 'skill' | 'stakeholders'; n: number }
  | { kind: 'decisions'; n: number; total: number }
  /** Of the team's four averages, `n` rose by `total` points or more (strong people outcomes need two). */
  | { kind: 'rises'; n: number; total: number };

export interface Cap { gate: Gate; level: number; reasons: Reason[] }

export interface OverallLevel {
  score: number | null;
  level: number | null;
  /** What the words alone reached. */
  words: { score: number | null; level: number | null };
  /** Every gate the run triggered, lowest level first. */
  caps: Cap[];
  /** The caps that held the level under what the words reached, lowest first. */
  binding: Cap[];
}

const CORE: Dimension[] = ['words', 'styleFit', 'people', 'business'];
const byGate = (a: Cap, b: Cap) => a.level - b.level || GATES.indexOf(a.gate) - GATES.indexOf(b.gate);
/** The first cap, lowest `below` first, that a value falls under. */
const capFor = (value: number, caps: Array<{ below: number; level: number }>) => [...caps].sort((a, b) => a.below - b.below).find(c => value < c.below) ?? null;

/** The business measure (D168): the Business pillar when the storyline weights business variables, else revenue as % of target. */
export function businessMeasure(sim: Sim, e: Evidence): { kind: 'pillar' | 'revenue'; pct: number } {
  return sim.config.variables.some(v => v.weight > 0) ? { kind: 'pillar', pct: businessPillar(sim) } : { kind: 'revenue', pct: e.share };
}

/** Every gate the run triggers (D168), lowest level first. */
export function levelCaps(sim: Sim, e: Evidence): Cap[] {
  const r = sim.config.report, o = r.outcomes;
  const top = r.scale.length - 1;
  const at = (level: number) => Math.min(level, top);
  const caps: Cap[] = [];

  // Style fit and diagnosis: the lowest signal sets the cap; every signal under that cap's threshold is a reason.
  const signals = behaviourSignals(sim);
  const measured = o.fit.signals.flatMap(s => (signals[s] === null ? [] : [{ kind: s, pct: signals[s]! }]));
  const lowest = [...measured].sort((a, b) => a.pct - b.pct)[0];
  const fit = lowest ? capFor(lowest.pct, o.fit.caps ?? r.reconcile.caps) : null;
  if (fit) caps.push({ gate: 'fit', level: at(fit.level), reasons: measured.filter(m => m.pct < fit.below).map(m => ({ kind: m.kind, pct: roundHalfUp(m.pct) })) });

  // Business: revenue against target, or the Business pillar.
  const business = businessMeasure(sim, e);
  const bCap = capFor(business.pct, o.business.caps);
  if (bCap) caps.push({ gate: 'business', level: at(bCap.level), reasons: [{ kind: business.kind, pct: roundHalfUp(business.pct) }] });

  // People: collapsed first, then weak. A threshold of 0 is off.
  // Everyone who was on the team counts, people away and people who left included (D170).
  const ch = e.everyone ?? e.change;
  const fall = { morale: -ch.morale, trust: -ch.trust, skill: -ch.skill };
  for (const tier of ['collapsed', 'weak'] as const) {
    const g = o.people[tier];
    const reasons: Reason[] = [];
    if (e.departed >= g.left) reasons.push({ kind: 'left', n: e.departed });
    for (const [m, drop] of [['morale', g.moraleDrop], ['trust', g.trustDrop], ['skill', g.skillDrop]] as const) {
      if (drop > 0 && fall[m] >= drop) reasons.push({ kind: m, n: Math.round(fall[m]) });
    }
    if (reasons.length) { caps.push({ gate: 'people', level: at(g.level), reasons }); break; }
  }

  // Stakeholders: relationships that ended strained and lower than they started.
  const strained = sim.config.stakeholders.filter(s => {
    const st = sim.stakeholders?.[s.key];
    return !!st && relationLevel(st) === 'strained' && st.trust + st.satisfaction < s.start.trust + s.start.satisfaction;
  }).length;
  if (strained && strained >= o.stakeholders.strained) caps.push({ gate: 'stakeholders', level: at(o.stakeholders.level), reasons: [{ kind: 'stakeholders', n: strained }] });

  // Decisions left to their default.
  const total = e.choices.decided + e.choices.defaulted;
  if (total >= o.decisions.min && (100 * e.choices.defaulted) / total >= o.decisions.defaulted) {
    caps.push({ gate: 'decisions', level: at(o.decisions.level), reasons: [{ kind: 'decisions', n: e.choices.defaulted, total }] });
  }
  return caps.sort(byGate);
}

/** The core dimensions the data calls weak (D143): what a level above the middle, or a verdict that meets the bar, would wrongly praise. */
export function contradicted(e: Evidence, t: Sim['config']['report']['evidence']): Dimension[] {
  const s = strengths(e, t);
  return CORE.filter(d => s[d] !== null && contradicts({ dimension: d, tone: 'positive' }, e, t));
}

/** A weak dimension, as a reason. */
export function reasonFor(d: Dimension, e: Evidence, t: Sim['config']['report']['evidence']): Reason {
  if (d === 'business') return { kind: 'revenue', pct: roundHalfUp(e.share) };
  if (d === 'styleFit') return { kind: 'styleFit', pct: roundHalfUp(e.styleFit ?? 0) };
  if (d === 'words') return { kind: 'words', pct: roundHalfUp(e.words ?? 0) };
  if (e.departed > 0) return { kind: 'left', n: e.departed };
  const ch = e.everyone ?? e.change;
  return -ch.morale >= t.people.moraleDrop ? { kind: 'morale', n: Math.round(-ch.morale) } : { kind: 'trust', n: Math.round(-ch.trust) };
}

/** The overall level (D168): the words' level, capped by every gate the run triggers, then guarded. */
export function cappedOverall(sim: Sim, skills: SkillRating[], e: Evidence): OverallLevel {
  const r = sim.config.report;
  const words = overallOf(sim, skills);
  const caps = levelCaps(sim, e);
  if (words.level === null || words.score === null) return { ...words, words, caps, binding: [] };
  let level = Math.min(words.level, ...caps.map(c => c.level));
  const middle = Math.floor((r.scale.length - 1) / 2);
  const weak = level > middle ? contradicted(e, r.evidence) : [];
  if (weak.length) {
    caps.push({ gate: 'guard', level: middle, reasons: weak.map(d => reasonFor(d, e, r.evidence)) });
    caps.sort(byGate);
    level = middle;
  }
  const score = level < words.level ? Math.min(words.score, r.scale[level + 1].min - 1) : words.score;
  return { score, level, words, caps, binding: caps.filter(c => c.level < words.level!) };
}

/** What an assessment verdict reads beside the level (D169). */
export function verdictGates(caps: Cap[], e: Evidence, t: Sim['config']['report']['evidence'], bar: Bar): VerdictGates {
  const s = strengths(e, t);
  const outcome = caps.filter(c => OUTCOME_GATES.includes(c.gate));
  return {
    gated: outcome.length > 0,
    belowBar: outcome.some(c => c.level < bar.overall),
    strong: s.business === 'strong' && s.people === 'strong',
    contradicted: contradicted(e, t).length > 0
  };
}

/**
 * The reasons a level or verdict tells, at most `max`: one per cap first, lowest cap first, then the caps'
 * further reasons in the same order; never the same fact twice.
 */
export function reasonsOf(caps: Cap[], max = 3): Reason[] {
  const out: Reason[] = [];
  const sorted = [...caps].sort(byGate);
  const add = (r: Reason | undefined) => { if (r && !out.some(y => y.kind === r.kind)) out.push(r); };
  for (const c of sorted) add(c.reasons.find(x => !out.some(y => y.kind === x.kind)));
  for (const c of sorted) c.reasons.forEach(add);
  return out.slice(0, max);
}

export interface RunOutcome {
  evidence: Evidence;
  overall: OverallLevel;
  /** Assessment: the verdict on the capped level and the gates, and the one the words alone would reach. */
  verdict: { key: VerdictKey | null; words: VerdictKey | null; gates: VerdictGates } | null;
}

/** The capped overall level and, for an assessment, the verdict, from the run (D168, D169). */
export function outcomeOf(sim: Sim, skills: SkillRating[], objectives: RunSummary['objectives'], assessment: boolean): RunOutcome {
  const r = sim.config.report, bar = r.assessment.bar;
  const evidence = gatherEvidence(sim, { objectives });
  const overall = cappedOverall(sim, skills, evidence);
  if (!assessment) return { evidence, overall, verdict: null };
  const levels = skills.filter(s => !s.reportOnly).map(s => s.level?.index ?? null);
  const gates = verdictGates(overall.caps, evidence, r.evidence, bar);
  return { evidence, overall, verdict: { key: overallVerdict(overall.level, levels, bar, gates), words: overallVerdict(overall.words.level, levels, bar), gates } };
}
