import { PERSONA_KEYS, type CalibrationResults, type Check, type PersonaKey, type PersonaStats, type RunResult } from './schema';

/**
 * From playthroughs to the author's results and checks (D113, D114). Pure functions: no engine, no I/O.
 *
 * Checks, and when they pass:
 *   ordered       every persona averages a higher Leadership Score than the one below it (fail otherwise)
 *   expertTier    Experts reach the target tier in 80% of runs or more (fail otherwise)
 *   beginnerTier  Beginners reach it in 10% of runs or fewer (fail otherwise)
 *   skills        the overall skill rating sits in the persona's expected levels in 75% of runs (warn from 50%, fail below)
 *   conversations conversation ratings rise with proficiency (warn otherwise): the scoring pipeline itself
 *   separation    neighbouring personas average more than 5% of the scale apart (warn otherwise)
 *   dominant      no one style or one action probe averages the target tier (fail), or a Proficient score (warn)
 *   unused        every action was used by some persona, leaving out actions rare by design (warn otherwise)
 *   events        Experts answered 80% or more of the events that expect an answer (warn otherwise)
 *   styleEffect   Proficient play beats the best one style probe by 5% of the scale or more (fail otherwise):
 *                 a flat fit table, or one where one style fits everyone, makes reading people pointless
 *   conversationEffect  the same Proficient play with every conversation Strong reaches 5 points of the revenue
 *                 target more than with every conversation Weak (fail otherwise): conversations change what happens
 *   target        Beginners average under the revenue target and Experts at least half of it (fail otherwise),
 *                 Experts at least 80% of it (warn otherwise): a target trivially reachable, or out of reach
 */

export const NAMES: Record<PersonaKey, string> = { beginner: 'Beginner', developing: 'Developing', proficient: 'Proficient', expert: 'Expert' };
export const LABELS: Record<PersonaKey, string> = { beginner: 'Low performer', developing: 'Average performer', proficient: 'High performer', expert: 'Exceptional performer' };

export const THRESHOLDS = {
  expertTier: 0.8, beginnerTier: 0.1, skillsPass: 0.75, skillsWarn: 0.5, separation: 0.05, events: 0.8,
  styleEffect: 0.05, conversationEffect: 0.05, targetEasy: 1, targetHard: 0.5, targetLow: 0.8
} as const;

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const range = (xs: number[]) => ({ min: xs.length ? Math.min(...xs) : 0, max: xs.length ? Math.max(...xs) : 0, mean: Math.round(mean(xs) * 1000) / 1000, median: median(xs) });
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const ofRuns = (n: number, total: number) => `${n} of ${total} ${total === 1 ? 'run' : 'runs'}`;

/** The tier Experts should reach: the one asked for, else the second from the top (the top one when there are two). */
export function targetTierOf(tiers: Array<{ key: string; name: string; min: number }>, key?: string) {
  return tiers.find(t => t.key === key) ?? tiers[Math.min(1, tiers.length - 2)] ?? tiers[0];
}

/**
 * The overall skill levels each persona should be rated at, on a scale of `n` levels: the persona's
 * place on the scale, a level either side where it falls between two, and the bottom two and top two
 * for the Beginner and the Expert. On the default five levels: Beginner Novice or Developing, Developing
 * Developing or Proficient, Proficient Proficient or Advanced, Expert Advanced or Role Model.
 */
export function expectedLevels(persona: PersonaKey, n: number): [number, number] {
  const i = PERSONA_KEYS.indexOf(persona);
  const x = (i * (n - 1)) / 3;
  let lo = Math.floor(x), hi = Math.ceil(x);
  if (lo === hi) { if (i < 2) hi = Math.min(n - 1, hi + 1); else lo = Math.max(0, lo - 1); }
  return [lo, hi];
}

const levelFits = (r: RunResult, n: number) => { const [lo, hi] = expectedLevels(r.persona, n); const l = r.level ?? 0; return l >= lo && l <= hi; };

export function personaStats(persona: PersonaKey, runs: RunResult[], ctx: { tiers: Array<{ key: string; name: string; min: number }>; target: { min: number }; scale: string[] }): PersonaStats {
  const mine = runs.filter(r => r.persona === persona);
  const byScore = [...mine].sort((a, b) => a.score - b.score);
  const mid = byScore[Math.floor((byScore.length - 1) / 2)];
  const levels = mine.map(r => r.level);
  const counts = new Map<number | null, number>();
  for (const l of levels) counts.set(l, (counts.get(l) ?? 0) + 1);
  const common = [...counts].sort((a, b) => b[1] - a[1] || (b[0] ?? -1) - (a[0] ?? -1))[0]?.[0] ?? null;
  const bands = { strong: 0, adequate: 0, weak: 0, harmful: 0 };
  for (const r of mine) for (const k of Object.keys(bands) as Array<keyof typeof bands>) bands[k] += r.bands[k];
  const rated = bands.strong + bands.adequate + bands.weak + bands.harmful;
  return {
    persona,
    runs: mine.length,
    score: range(mine.map(r => r.score)),
    tier: mid ? { key: mid.tier.key, name: mid.tier.name } : { key: '', name: '' },
    tiers: ctx.tiers.map(t => ({ key: t.key, name: t.name, count: mine.filter(r => r.tier.key === t.key).length })),
    reachedTarget: mine.filter(r => r.score >= ctx.target.min).length,
    share: range(mine.map(r => r.share)),
    beatTarget: mine.filter(r => r.share >= 1).length,
    level: { index: common, name: common === null ? 'Not rated' : ctx.scale[common] ?? String(common) },
    agreement: mine.length ? mine.filter(r => levelFits(r, ctx.scale.length)).length / mine.length : 0,
    adaptability: Math.round(mean(mine.map(r => r.adaptability)) * 10) / 10,
    bandScore: rated ? Math.round(((bands.strong * 3 + bands.adequate * 2 + bands.weak) / rated) * 100) / 100 : 0,
    bands,
    concerns: Math.round(mean(mine.map(r => r.concerns.length)) * 10) / 10
  };
}

export interface CheckContext {
  personas: PersonaStats[];
  runs: RunResult[];
  probes: RunResult[];
  probesRan: boolean;
  target: { key: string; name: string; min: number };
  scale: string[];
  scoreMax: number;
  actions: Array<{ key: string; name: string; rare?: boolean }>;
  styles: Array<{ key: string; name: string }>;
}

export function checks(c: CheckContext): Check[] {
  const out: Check[] = [];
  const present = c.personas.filter(p => p.runs > 0);
  const stat = (k: PersonaKey) => present.find(p => p.persona === k);
  const target = c.target.name;

  // Scores rise with proficiency.
  if (present.length >= 2) {
    const drops = present.slice(1).map((p, i) => [present[i], p] as const).filter(([a, b]) => b.score.mean <= a.score.mean);
    const averages = present.map(p => `${NAMES[p.persona]} ${Math.round(p.score.mean)}`).join(', ');
    out.push(drops.length
      ? { key: 'ordered', status: 'fail', title: `Scores do not rise with proficiency: ${list(drops.map(([a, b]) => `${NAMES[b.persona]} scores no higher than ${NAMES[a.persona]}`))}`, detail: `Average Leadership Score: ${averages}.`, fix: 'Make reading people matter more: raise the effect of a style that fits, or the cost of one that misses, in the weekly styles and the conversation actions.' }
      : { key: 'ordered', status: 'pass', title: 'Scores rise with proficiency', detail: `Average Leadership Score: ${averages}.`, fix: null });
  }

  // Experts reach the target tier; Beginners do not.
  const expert = stat('expert');
  if (expert) {
    const ok = expert.reachedTarget / expert.runs >= THRESHOLDS.expertTier;
    out.push(ok
      ? { key: 'expertTier', status: 'pass', title: `Expert players reach ${target} in ${ofRuns(expert.reachedTarget, expert.runs)}`, detail: `Revenue ${pct(expert.share.mean)} of target on average.`, fix: null }
      : { key: 'expertTier', status: 'fail', title: `Expert players reach ${target} in only ${ofRuns(expert.reachedTarget, expert.runs)}`, detail: `They average ${Math.round(expert.score.mean)} points; ${target} starts at ${c.target.min}.`, fix: `Strong leadership should get there: lower where ${target} starts, or raise the leads entering the funnel so good play earns more.` });
  }
  const beginner = stat('beginner');
  if (beginner) {
    const ok = beginner.reachedTarget / beginner.runs <= THRESHOLDS.beginnerTier;
    out.push(ok
      ? { key: 'beginnerTier', status: 'pass', title: beginner.reachedTarget ? `Beginner players reach ${target} in only ${ofRuns(beginner.reachedTarget, beginner.runs)}` : `Beginner players never reach ${target}`, detail: `They average ${Math.round(beginner.score.mean)} points and ${pct(beginner.share.mean)} of target.`, fix: null }
      : { key: 'beginnerTier', status: 'fail', title: `Beginner players reach ${target} in ${ofRuns(beginner.reachedTarget, beginner.runs)}`, detail: `They average ${Math.round(beginner.score.mean)} points; ${target} starts at ${c.target.min}.`, fix: `Careless play should not get there: raise where ${target} starts or the funnel buffer, or make a style that misses cost more.` });
  }

  // Skill ratings match each level.
  const rated = present.reduce((n, p) => n + p.runs, 0);
  if (rated) {
    const agree = present.reduce((n, p) => n + p.agreement * p.runs, 0) / rated;
    const off = present.filter(p => p.agreement < THRESHOLDS.skillsPass).map(p => {
      const [lo, hi] = expectedLevels(p.persona, c.scale.length);
      return `${NAMES[p.persona]} players were rated ${p.level.name} most often (expected ${c.scale[lo]}${hi !== lo ? ` or ${c.scale[hi]}` : ''})`;
    });
    const status = agree >= THRESHOLDS.skillsPass ? 'pass' : agree >= THRESHOLDS.skillsWarn ? 'warn' : 'fail';
    out.push({ key: 'skills', status, title: status === 'pass' ? `Skill ratings match each level in ${pct(agree)} of runs` : `Skill ratings match each level in only ${pct(agree)} of runs`, detail: off.length ? `${off.join('. ')}.` : null, fix: status === 'pass' ? null : 'Check each conversation\'s rubric and the skills it rates: ratings should rise with the quality of what players say.' });
  }

  // The scoring pipeline: conversation ratings rise with proficiency.
  if (present.length >= 2) {
    const drops = present.slice(1).map((p, i) => [present[i], p] as const).filter(([a, b]) => b.bandScore <= a.bandScore);
    out.push(drops.length
      ? { key: 'conversations', status: 'warn', title: `Conversation ratings do not rise with proficiency: ${list(drops.map(([a, b]) => `${NAMES[b.persona]} rates no higher than ${NAMES[a.persona]}`))}`, detail: null, fix: 'Check the rubrics and the evaluator: what a stronger player says should rate higher.' }
      : { key: 'conversations', status: 'pass', title: 'Conversation ratings rise with proficiency', detail: present.map(p => `${NAMES[p.persona]} ${Math.round((p.bands.strong / Math.max(1, p.bands.strong + p.bands.adequate + p.bands.weak + p.bands.harmful)) * 100)}% Strong`).join(', ') + '.', fix: null });
  }

  // Each level scores clearly apart.
  if (present.length >= 2) {
    const gap = c.scoreMax * THRESHOLDS.separation;
    const close = present.slice(1).map((p, i) => [present[i], p] as const).filter(([a, b]) => b.score.mean > a.score.mean && b.score.mean - a.score.mean < gap);
    out.push(close.length
      ? { key: 'separation', status: 'warn', title: list(close.map(([a, b]) => `${NAMES[a.persona]} and ${NAMES[b.persona]} score within ${Math.round(b.score.mean - a.score.mean)} points`)), detail: `Levels this close are hard to tell apart in a report.`, fix: 'Make needs harder to read early on, so careful diagnosis pays off sooner, or make a strong conversation count for more.' }
      : { key: 'separation', status: 'pass', title: 'Each level scores clearly apart', detail: null, fix: null });
  }

  const proficient = stat('proficient');

  // Dominant strategies.
  if (c.probesRan && c.probes.length) {
    const groups = new Map<string, RunResult[]>();
    for (const p of c.probes) if (p.probe && p.probe.kind !== 'band') groups.set(`${p.probe.kind}:${p.probe.key}`, [...(groups.get(`${p.probe.kind}:${p.probe.key}`) ?? []), p]);
    const nameOf = (kind: string, key: string) => (kind === 'style' ? c.styles.find(s => s.key === key)?.name : c.actions.find(a => a.key === key)?.name) ?? key;
    const say = (kind: string, key: string) => (kind === 'style' ? `Leading everyone as ${nameOf(kind, key)}` : `Spending every day on ${nameOf(kind, key)}`);
      const winners: string[] = [], close: string[] = [];
    const fixes: string[] = [];
    for (const [g, rs] of groups) {
      const [kind, key] = g.split(':');
      const m = mean(rs.map(r => r.score));
      if (m >= c.target.min) { winners.push(`${say(kind, key)} reaches ${target} (${Math.round(m)} points)`); fixes.push(kind === 'style' ? `Make ${nameOf(kind, key)} miss more often: check its row in the lens's fit table and the effects of a style that does not fit.` : `Give ${nameOf(kind, key)} a cooldown, raise its cost or lower its effect.`); }
      else if (proficient && m >= proficient.score.mean) close.push(`${say(kind, key)} scores as well as Proficient players (${Math.round(m)} points)`);
    }
    out.push(winners.length
      ? { key: 'dominant', status: 'fail', title: `A single strategy wins without good leadership: ${list(winners)}`, detail: null, fix: fixes.join(' ') }
      : close.length
        ? { key: 'dominant', status: 'warn', title: `A single strategy does about as well as good leadership: ${list(close)}`, detail: null, fix: 'Check that adapting to each person pays off more than repeating one move.' }
        : { key: 'dominant', status: 'pass', title: 'No single strategy wins without good leadership', detail: `${groups.size} strategies tried: one style for everyone, and one action every day.`, fix: null });
  }

  // Unused actions: hiring and letting go are rare by design, so they are not counted (D132).
  const used = new Set(c.runs.flatMap(r => Object.entries(r.actions).filter(([, n]) => n > 0).map(([k]) => k)));
  const unused = c.actions.filter(a => !used.has(a.key) && !a.rare);
  const rare = c.actions.filter(a => a.rare && !used.has(a.key));
  const rareNote = rare.length ? `${list(rare.map(a => `"${a.name}"`))} ${rare.length === 1 ? 'is' : 'are'} rare by design and not counted.` : null;
  if (c.runs.length) {
    out.push(unused.length
      ? { key: 'unused', status: 'warn', title: `Nobody used ${list(unused.map(a => `"${a.name}"`))}: ${unused.length === 1 ? 'it' : 'they'} may be hard to find or not worth the time`, detail: rareNote, fix: `If ${unused.length === 1 ? 'it is' : 'they are'} meant to be rare, that is fine. Otherwise make ${unused.length === 1 ? 'it' : 'them'} cheaper, more useful or easier to find.` }
      : { key: 'unused', status: 'pass', title: rare.length ? 'Every action was used, apart from those rare by design' : 'Every action was used', detail: rareNote, fix: null });
  }

  // Styles change the outcome: Proficient play must beat leading everyone in the best single style.
  const styleProbes = new Map<string, number[]>();
  for (const p of c.probes) if (p.probe?.kind === 'style') styleProbes.set(p.probe.key, [...(styleProbes.get(p.probe.key) ?? []), p.score]);
  if (c.probesRan && proficient && styleProbes.size) {
    const [bestKey, bestScores] = [...styleProbes].sort((a, b) => mean(b[1]) - mean(a[1]))[0];
    const best = mean(bestScores);
    const name = c.styles.find(s => s.key === bestKey)?.name ?? bestKey;
    const margin = proficient.score.mean - best;
    out.push(margin < c.scoreMax * THRESHOLDS.styleEffect
      ? { key: 'styleEffect', status: 'fail', title: `Reading each person barely beats leading everyone the same way: Proficient players average ${Math.round(proficient.score.mean)}, leading everyone as ${name} ${Math.round(best)}`, detail: 'The style a participant picks for each person hardly changes the outcome.', fix: 'Check the lens\'s fit table: each need should have its own fitting style, no style should fit every need, and a style that misses should cost more than one that fits.' }
      : { key: 'styleEffect', status: 'pass', title: 'Styles change the outcome', detail: `Proficient players average ${Math.round(proficient.score.mean)}; the best single style for everyone, ${name}, ${Math.round(best)}.`, fix: null });
  }

  // Conversations change what happens: the same play with every conversation Strong, then Weak.
  const bandShare = (band: string) => c.probes.filter(p => p.probe?.kind === 'band' && p.probe.key === band).map(p => p.share);
  const strong = bandShare('strong'), weak = bandShare('weak');
  if (c.probesRan && strong.length && weak.length) {
    const gap = mean(strong) - mean(weak);
    out.push(gap < THRESHOLDS.conversationEffect
      ? { key: 'conversationEffect', status: 'fail', title: `Conversations do not change what happens: every conversation Strong reaches ${pct(mean(strong))} of the revenue target, every one Weak ${pct(mean(weak))}`, detail: 'A good conversation should leave the person and the results better off than a poor one.', fix: 'Check the conversation actions\' effects by band (their consequence tables) and the impact by style: a Strong conversation should do more than a Weak one.' }
      : { key: 'conversationEffect', status: 'pass', title: 'Conversations change what happens', detail: `Every conversation Strong reaches ${pct(mean(strong))} of the revenue target, every one Weak ${pct(mean(weak))}.`, fix: null });
  }

  // The revenue target suits the levels: not trivially reachable, not out of reach.
  if (beginner || expert) {
    const easy = beginner && beginner.share.mean >= THRESHOLDS.targetEasy;
    const hard = expert && expert.share.mean < THRESHOLDS.targetHard;
    const low = expert && expert.share.mean < THRESHOLDS.targetLow;
    const levels = [beginner && `Beginners ${pct(beginner.share.mean)}`, expert && `Experts ${pct(expert.share.mean)}`].filter(Boolean).join(', ');
    out.push(easy
      ? { key: 'target', status: 'fail', title: `The revenue target is too easy: Beginner players reach ${pct(beginner!.share.mean)} of it`, detail: `Revenue against the target: ${levels}.`, fix: 'Raise the revenue target, so only good leadership reaches it.' }
      : hard
        ? { key: 'target', status: 'fail', title: `The revenue target is out of reach: Expert players reach only ${pct(expert!.share.mean)} of it`, detail: `Revenue against the target: ${levels}.`, fix: 'Lower the revenue target, or raise the work entering the process, so strong leadership can reach it.' }
        : low
          ? { key: 'target', status: 'warn', title: `Expert players reach only ${pct(expert!.share.mean)} of the revenue target`, detail: `Revenue against the target: ${levels}.`, fix: 'Strong leadership should come close to the target: lower it a little.' }
          : { key: 'target', status: 'pass', title: 'The revenue target suits the levels', detail: `Revenue against the target: ${levels}.`, fix: null });
  }

  // Events that expect an answer can be answered.
  const er = c.runs.filter(r => r.persona === 'expert');
  const expected = er.reduce((n, r) => n + r.events.expected, 0);
  if (expected) {
    const handled = er.reduce((n, r) => n + r.events.handled, 0);
    const ok = handled / expected >= THRESHOLDS.events;
    out.push(ok
      ? { key: 'events', status: 'pass', title: `Expert players answered ${handled} of ${expected} events that call for an answer`, detail: null, fix: null }
      : { key: 'events', status: 'warn', title: `Expert players answered only ${handled} of ${expected} events that call for an answer`, detail: null, fix: 'Check each event\'s expected response: the action it asks for must be open, affordable and within the conversation limit in its window.' });
  }
  return out;
}

export interface AggregateFacts {
  storyline: { id: string; name: string };
  configHash: string;
  lens: { title: string; styles: Array<{ key: string; name: string }> };
  scale: string[];
  money: { currency: string; locale: string };
  scoreMax: number;
  tiers: Array<{ key: string; name: string; min: number }>;
  targetTier?: string;
  actions: Array<{ key: string; name: string; rare?: boolean }>;
  settings: { seed: number; probes: boolean; personas: Record<string, number> };
  ranOn: CalibrationResults['ranOn'];
  players: CalibrationResults['players'];
  createdAt: string;
  durationMs: number;
}

/** Every persona's numbers and the checks, from the playthroughs and probes. */
export function aggregate(runs: RunResult[], probes: RunResult[], f: AggregateFacts): CalibrationResults {
  const target = targetTierOf(f.tiers, f.targetTier);
  const personas = PERSONA_KEYS.filter(k => runs.some(r => r.persona === k)).map(k => personaStats(k, runs, { tiers: f.tiers, target, scale: f.scale }));
  const concernsByPerson: Record<string, Record<string, number>> = {};
  for (const r of runs) for (const id of r.concerns) { const m = (concernsByPerson[r.persona] ??= {}); m[id] = (m[id] ?? 0) + 1; }
  return {
    version: 1, storyline: f.storyline, configHash: f.configHash, lens: f.lens, scale: f.scale, money: f.money, scoreMax: f.scoreMax, tiers: f.tiers, targetTier: target,
    personas,
    checks: checks({ personas, runs, probes, probesRan: f.settings.probes, target, scale: f.scale, scoreMax: f.scoreMax, actions: f.actions, styles: f.lens.styles }),
    runs, probes, concernsByPerson, actions: f.actions, settings: f.settings, ranOn: f.ranOn, players: f.players, createdAt: f.createdAt, durationMs: f.durationMs
  };
}

/** "4 passed, 2 to look at". */
export function checkSummary(list: Check[]): string {
  const passed = list.filter(c => c.status === 'pass').length;
  const look = list.length - passed;
  return look ? `${passed} passed, ${look} to look at` : `All ${passed} passed`;
}
