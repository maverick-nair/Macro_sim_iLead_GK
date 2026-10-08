import type { StorylineConfig } from '../config';
import { energizeAction, levelPolicy, type PlayerApi, type Policy, type Step } from './syntheticPolicy';
import type { EngineView } from './view';

/**
 * Probes for dominant strategies (D114, D149). A probe plays one narrow strategy all run. Two families:
 *
 * Without leadership (styles at random, or one style for everyone): if one of these reaches the target tier
 * or beats the Expert, a strategy wins without reading people.
 *   style     one style for everyone, otherwise sound (Proficient) play
 *   action    one action every day it can be taken, styles at random
 *   energize  one style for everyone and team energy every week, otherwise sound play
 *   busy      as many actions as the days allow, any action, styles at random, every event answered
 *
 * With an Expert's reading of people but a narrow set of actions: if one of these beats the Expert, the
 * actions reward repetition over judgement (the audit: weekly team energy and 1:1s beat the Expert).
 *   pair      two actions, alternated, every day they can be taken; no events, no follow ups
 *   idle      reads everyone right every week and takes no action at all (a warning when it reaches the
 *             target tier: diagnosis alone carries the score)
 */
export type Probe =
  | { kind: 'style'; style: string }
  | { kind: 'action'; action: string }
  | { kind: 'energize'; style: string }
  | { kind: 'busy' }
  | { kind: 'pair'; actions: [string, string] }
  | { kind: 'idle' };

export type ProbeKind = Probe['kind'];

/** Probes judged against the Expert only, because they read people as an Expert does. */
export const READING_PROBES: ReadonlySet<ProbeKind> = new Set(['pair', 'idle']);

/** A probe's key: the style, the action, or the two actions joined by "+". */
export function probeKey(p: Probe): string {
  switch (p.kind) {
    case 'style': case 'energize': return p.style;
    case 'action': return p.action;
    case 'pair': return p.actions.join('+');
    default: return '';
  }
}

/** Which level's play a probe borrows, and so which persona it is recorded under. */
export function probePersona(p: Probe): 'developing' | 'proficient' | 'expert' {
  return p.kind === 'action' || p.kind === 'busy' ? 'developing' : p.kind === 'pair' || p.kind === 'idle' ? 'expert' : 'proficient';
}

const randomStyle = (p: PlayerApi) => p.rng.pick(p.keys);
const none = () => 0;

/** One action, taken whenever it can be, with someone picked at random (the D114 action probe). */
function oneAction(p: PlayerApi, v: EngineView, key: string, who: 'random' | 'neediest'): Step | null {
  const a = v.actions.find(x => x.key === key);
  if (!a) return null;
  if (a.scope !== 'member') return p.stepFor(v, key, null, 'probe', p.teamStyle(v));
  const open = (who === 'neediest' ? p.neediest(v) : v.members).filter(m => !a.blockedFor[m.id]);
  if (!open.length) return null;
  const order = who === 'random' ? [p.rng.pick(open)] : open;
  for (const m of order) {
    const step = p.stepFor(v, key, m.id, 'probe', p.styles[m.id]);
    if (step) return step;
  }
  return null;
}

export function probePolicy(probe: Probe, config: StorylineConfig): Policy {
  const base = levelPolicy(probePersona(probe));
  switch (probe.kind) {
    case 'style':
      return { ...base, style: () => probe.style, meetingStyle: () => probe.style };
    case 'action':
      return { ...base, style: randomStyle, respond: none, meetings: false, next: (p, v) => oneAction(p, v, probe.action, 'random') };
    case 'energize': {
      const energize = energizeAction(config);
      return {
        ...base, style: () => probe.style, meetingStyle: () => probe.style,
        first: (p, v) => {
          if (!energize || p.memo.get('energized') === v.clock.period) return null;
          const step = p.stepFor(v, energize.key, null, 'probe');
          if (step) p.memo.set('energized', v.clock.period);
          return step;
        }
      };
    }
    case 'busy':
      return {
        ...base, style: randomStyle, respond: () => 1, meetings: false,
        next: (p, v) => {
          const open = v.actions.filter(a => a.rule !== 'fire' && a.rule !== 'hire' && (a.scope === 'team' ? !a.blocked : v.members.some(m => !a.blockedFor[m.id])));
          for (let i = 0; i < 6 && open.length; i++) {
            const step = oneAction(p, v, p.rng.pick(open).key, 'random');
            if (step) return step;
          }
          return null;
        }
      };
    case 'pair': {
      const [a, b] = probe.actions;
      return {
        ...base, respond: none, meetings: false,
        next: (p, v) => {
          // Alternate: the one taken less this week first, then the other.
          const n = (k: string) => p.memo.get(`${v.clock.period}:${k}`) ?? 0;
          for (const key of n(a) <= n(b) ? [a, b] : [b, a]) {
            const step = oneAction(p, v, key, 'neediest');
            if (step) { p.memo.set(`${v.clock.period}:${key}`, n(key) + 1); return step; }
          }
          return null;
        }
      };
    }
    case 'idle':
      return { ...base, respond: none, meetings: false, next: () => null };
  }
}

/** Actions a pair may use: every action but hiring and letting go (rare by design, D132) and team energy. */
const pairable = (config: StorylineConfig) => config.actions.filter(a => a.rule !== 'hire' && a.rule !== 'fire' && a !== energizeAction(config)).map(a => a.key);

/** How many pairs `topPairs` gives for this storyline, known before any probe plays. */
export function pairCount(config: StorylineConfig, top = 3): number {
  const k = Math.min(top, pairable(config).length) + (energizeAction(config) ? 1 : 0);
  return (k * (k - 1)) / 2;
}

/**
 * The pairs to probe (D149): every pair among the `top` actions by single action probe score and team energy,
 * when the storyline has it, since its effect multiplies sound style setting. Hiring and letting go are left
 * out (rare by design, D132).
 */
export function topPairs(config: StorylineConfig, singles: Array<{ action: string; score: number }>, top = 3): Array<[string, string]> {
  const ok = new Set(pairable(config));
  const means = new Map<string, number[]>(config.actions.filter(a => ok.has(a.key)).map(a => [a.key, []]));
  for (const s of singles) means.get(s.action)?.push(s.score);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : -1);
  const best = [...means].sort((x, y) => avg(y[1]) - avg(x[1]) || x[0].localeCompare(y[0])).slice(0, top).map(([k]) => k);
  const energize = energizeAction(config)?.key;
  const pool = energize ? [...best, energize] : best;
  const out: Array<[string, string]> = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) out.push([pool[i], pool[j]]);
  return out;
}
