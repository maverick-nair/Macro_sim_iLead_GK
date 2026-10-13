import { bandScore, roundHalfUp } from '../sim/score';
import { firstName } from '../sim/sim';
import type { Band, LiveRecord, Sim } from '../sim/types';
import { msg, type Copy, type Msg } from '../copy';
import { stakeholderReadRecords } from '../sim/stakeholders';

/**
 * Skill ratings (docs/genie/scoring-and-report.md 5.4), shared by the report (`build.ts`) and the run
 * summary (`summary.ts`). Pure functions of the run.
 */

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const shortName = (sim: Sim, id: string) => (id === 'sponsor' ? sim.config.sponsor.name.split(' ')[0] : firstName(sim, id));

/** "Week 2, Meet face to face with Kent" */
export function when(sim: Sim, r: LiveRecord): Msg {
  const who = r.memberIds.length === 1 ? shortName(sim, r.memberIds[0]) : r.actionKey === 'sponsor' ? shortName(sim, 'sponsor') : null;
  const base = { unit: sim.config.time.period.unit, n: r.period, title: r.title ?? r.actionKey };
  return who ? msg('engine.when.with', { ...base, name: who }) : msg('engine.when', base);
}

/** The level index a skill score reaches on the storyline's scale. */
export const levelOf = (sim: Sim, score: number) => sim.config.report.scale.reduce((lv, l, i) => (score >= l.min ? i : lv), 0);

export interface SkillRating {
  key: string;
  name: string;
  reportOnly: boolean;
  order: number;
  observations: number;
  /** Rounded skill score, or null without enough evidence. */
  score: number | null;
  rawScore: number | null;
  capped: boolean;
  /** Capped by what the participant did (D144): the signal, its share and the level the words alone reached. */
  reconciled: { signal: BehaviourSignal; pct: number; from: number } | null;
  level: { index: number; name: string } | null;
  anchor: string | null;
  quotes: Array<{ text: string; when: Copy }>;
  /** The live records this skill was observed in, most recent last. */
  recordIds: string[];
  /** Whether every record behind the rating was reviewed by an assessor, some were, or none. */
  review: 'assessor' | 'mixed' | 'ai';
}

/**
 * The leadership reads of the choices the participant made (D137), as records the ratings read beside the
 * conversations: one observation per skill read, no quotes (a choice has no words).
 */
export function choiceRecords(sim: Sim): LiveRecord[] {
  return sim.choices.filter(c => c.by === 'you' && c.read.length).map(c => ({
    id: c.id, period: c.period, sub: c.sub, actionKey: `choice:${c.eventKey}`, format: 'choice', band: c.read[0].band, memberIds: c.memberId ? [c.memberId] : [],
    title: c.title, quotes: [], skills: c.read.map(x => ({ key: x.skill, band: x.band, evidence: [] }))
  }));
}

export type BehaviourSignal = 'styleFit' | 'diagnosis';

/**
 * What the participant did, against what people needed (D144): `styleFit` is the share of every style
 * choice that fit (overall leadership adaptability), `diagnosis` the share of weekly style settings that
 * fit. Null without any such choice.
 */
export function behaviourSignals(sim: Sim): Record<BehaviourSignal, number | null> {
  const all = sim.decisions.run, weekly = all.filter(d => d.source === 'weeklyStyle');
  const share = (xs: typeof all) => (xs.length ? (100 * xs.filter(d => d.mismatch === 0).length) / xs.length : null);
  return { styleFit: share(all), diagnosis: share(weekly) };
}

/**
 * The cap reconciliation puts on a skill (D144): the lowest configured signal with data and the highest
 * level it allows, or null when the skill is not reconciled, has no signal, or no cap applies.
 */
export function reconcileCap(sim: Sim, key: string, signals = behaviourSignals(sim)): { signal: BehaviourSignal; pct: number; level: number } | null {
  const rc = sim.config.report.reconcile;
  const measured = (rc.skills[key] ?? []).flatMap(s => (signals[s] === null ? [] : [{ signal: s, pct: signals[s]! }])).sort((a, b) => a.pct - b.pct);
  const low = measured[0];
  if (!low) return null;
  const cap = [...rc.caps].sort((a, b) => a.below - b.below).find(c => low.pct < c.below);
  return cap ? { ...low, level: Math.min(cap.level, sim.config.report.scale.length - 1) } : null;
}

export function rateSkills(sim: Sim): SkillRating[] {
  const r = sim.config.report;
  // Stakeholder conversations are live records already; their static decisions' reads join the choices' (D164).
  const records = [...sim.liveRecords, ...choiceRecords(sim), ...stakeholderReadRecords(sim)];
  const signals = behaviourSignals(sim);
  return r.skills.map((sk, order) => {
    const obs = records.flatMap(rec => (rec.skills ?? []).filter(o => o.key === sk.key).map(o => ({ ...o, rec })));
    const interactions = new Set(obs.map(o => o.rec.id ?? o.rec));
    // Report only skills (a secondary lens, D70) always need 2 observations from 2 interactions.
    const minObs = sk.reportOnly ? Math.max(2, r.minObservations) : r.minObservations;
    const enough = obs.length >= minObs && interactions.size >= Math.min(2, minObs);
    let raw = obs.length ? mean(obs.map(o => bandScore(sim, o.band))) : null;
    const capped = obs.some(o => o.band === 'harmful');
    let idx = enough && raw !== null ? (capped ? Math.min(levelOf(sim, raw), 1) : levelOf(sim, raw)) : null;
    // Words alone do not rate a skill about adapting: what the participant chose caps it (D144). The score
    // is held under the next level too, so the score out of 10, the level and the overall level agree.
    const cap = idx === null ? null : reconcileCap(sim, sk.key, signals);
    const reconciled = cap && idx !== null && idx > cap.level ? { signal: cap.signal, pct: cap.pct, from: idx } : null;
    if (reconciled) {
      idx = cap!.level;
      raw = Math.min(raw!, r.scale[idx + 1].min - 1);
    }
    // Up to N verbatim quotes, highest band first, then most recent; only words that are in the transcript.
    const rank: Record<Band, number> = { strong: 0, adequate: 1, weak: 2, harmful: 3 };
    const quotes = [...obs]
      .sort((a, b) => rank[a.band] - rank[b.band] || (b.rec.period - a.rec.period) || ((b.rec.sub ?? 0) - (a.rec.sub ?? 0)))
      .flatMap(o => o.evidence.filter(q => (o.rec.quotes ?? []).some(t => t.includes(q))).map(q => ({ text: q, when: when(sim, o.rec) })))
      .filter((q, i, arr) => arr.findIndex(x => x.text === q.text) === i)
      .slice(0, r.evidencePerSkill);
    const recs = [...new Set(obs.map(o => o.rec))];
    const reviewed = recs.filter(x => x.reviewed).length;
    return {
      key: sk.key, name: sk.name, reportOnly: sk.reportOnly, order, observations: obs.length, score: enough && raw !== null ? roundHalfUp(raw) : null, rawScore: raw, capped: enough && capped, reconciled,
      level: idx === null ? null : { index: idx, name: r.scale[idx].name }, anchor: idx === null ? null : sk.anchors[idx] ?? null, quotes,
      recordIds: recs.map(x => x.id ?? '').filter(Boolean),
      review: recs.length && reviewed === recs.length ? 'assessor' : reviewed ? 'mixed' : 'ai'
    };
  });
}

/** The overall level (5.4): from the mean of rated primary skills, when at least half are rated. */
export function overallOf(sim: Sim, skills: SkillRating[]) {
  const scored = skills.filter(s => !s.reportOnly);
  const rated = scored.filter(s => s.level !== null);
  if (rated.length < Math.ceil(scored.length / 2) || !rated.length) return { score: null, level: null };
  const score = mean(rated.map(s => s.rawScore!));
  return { score, level: levelOf(sim, score) };
}
