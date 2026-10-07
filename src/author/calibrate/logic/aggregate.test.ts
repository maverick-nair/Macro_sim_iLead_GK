import { describe, expect, it } from 'vitest';
import { copyViolations } from '../../../i18n/copy';
import { aggregate, checkSummary, expectedLevels, personaStats, targetTierOf, type AggregateFacts } from './aggregate';
import { CalibrationResults, type PersonaKey, type RunResult } from './schema';

const TIERS = [{ key: 'platinum', name: 'Platinum', min: 850 }, { key: 'gold', name: 'Gold', min: 700 }, { key: 'silver', name: 'Silver', min: 500 }, { key: 'bronze', name: 'Bronze', min: 0 }];
const SCALE = ['Novice', 'Developing', 'Proficient', 'Advanced', 'Role Model'];
const ACTIONS = [{ key: 'f2f', name: 'Meet face to face' }, { key: 'coach', name: 'Coach' }, { key: 'assess', name: 'Assess member' }];
const tierOf = (score: number) => { const i = TIERS.findIndex(t => score >= t.min); return { key: TIERS[i].key, name: TIERS[i].name, index: i }; };

let n = 0;
function run(persona: PersonaKey, score: number, o: Partial<RunResult> = {}): RunResult {
  return {
    persona, index: n++, seed: 1, probe: null, score, max: 1000, tier: tierOf(score), share: score / 800, level: { beginner: 0, developing: 1, proficient: 3, expert: 4 }[persona],
    skills: [], adaptability: score / 10, bands: { strong: Math.round(score / 100), adequate: 2, weak: Math.round(10 - score / 100), harmful: 0 },
    concerns: persona === 'expert' ? ['kent'] : [], actions: { f2f: 2, coach: 1, assess: 0 }, events: { expected: 4, handled: persona === 'expert' ? 4 : 1 }, ...o
  };
}
const facts: AggregateFacts = {
  storyline: { id: 's', name: 'Sales' }, configHash: 'abc', lens: { title: 'Readiness Based Leadership', styles: [{ key: 'D', name: 'Directing' }, { key: 'P', name: 'Partnering' }] },
  scale: SCALE, scoreMax: 1000, tiers: TIERS, actions: ACTIONS, settings: { seed: 1, probes: true, personas: { beginner: 3, developing: 3, proficient: 3, expert: 3 } },
  ranOn: 'browser', players: 'templates', createdAt: '2026-10-07T00:00:00.000Z', durationMs: 10
};
const good = () => [
  ...[300, 350, 320].map(s => run('beginner', s)), ...[500, 560, 540].map(s => run('developing', s)),
  ...[700, 760, 740].map(s => run('proficient', s)), ...[880, 900, 910].map(s => run('expert', s))
];
const probes = (scores: Array<[string, string, number]>) => scores.map(([kind, key, score]) => run(kind === 'style' ? 'proficient' : 'developing', score, { probe: { kind: kind as 'style' | 'action', key } }));
const status = (r: CalibrationResults) => Object.fromEntries(r.checks.map(c => [c.key, c.status]));

describe('calibration aggregation', () => {
  it('summarizes each persona: score range, tier, revenue, skills, agreement', () => {
    const s = personaStats('expert', good(), { tiers: TIERS, target: TIERS[1], scale: SCALE });
    expect(s.score).toEqual({ min: 880, max: 910, mean: 896.667, median: 900 });
    expect(s.tier).toEqual({ key: 'platinum', name: 'Platinum' });
    expect(s.reachedTarget).toBe(3);
    expect(s.level).toEqual({ index: 4, name: 'Role Model' });
    expect(s.agreement).toBe(1);
    expect(s.tiers.find(t => t.key === 'platinum')?.count).toBe(3);
    expect(s.concerns).toBe(1);
  });

  it('passes a well calibrated storyline', () => {
    const r = aggregate(good(), probes([['style', 'D', 500], ['action', 'coach', 450]]), facts);
    expect(CalibrationResults.parse(r)).toBeTruthy();
    expect(status(r)).toEqual({ ordered: 'pass', expertTier: 'pass', beginnerTier: 'pass', skills: 'pass', conversations: 'pass', separation: 'pass', dominant: 'pass', unused: 'warn', events: 'pass' });
    expect(r.checks.find(c => c.key === 'unused')?.title).toBe('Nobody used "Assess member": it may be hard to find or not worth the time');
    expect(r.checks.find(c => c.key === 'beginnerTier')?.title).toBe('Beginner players never reach Gold');
    expect(r.checks.find(c => c.key === 'expertTier')?.title).toBe('Expert players reach Gold in 3 of 3 runs');
    expect(r.concernsByPerson).toEqual({ expert: { kent: 3 } });
    expect(checkSummary(r.checks)).toBe('8 passed, 1 to look at');
  });

  it('fails when scores do not rise, Experts miss the tier or Beginners reach it', () => {
    const runs = [...[750, 720, 760].map(s => run('beginner', s)), ...[500, 560, 540].map(s => run('developing', s)), ...[700, 760, 740].map(s => run('proficient', s)), ...[600, 690, 710].map(s => run('expert', s))];
    const r = aggregate(runs, [], { ...facts, settings: { ...facts.settings, probes: false } });
    expect(status(r)).toMatchObject({ ordered: 'fail', expertTier: 'fail', beginnerTier: 'fail' });
    expect(r.checks.find(c => c.key === 'ordered')?.title).toBe('Scores do not rise with proficiency: Developing scores no higher than Beginner and Expert scores no higher than Proficient');
    expect(r.checks.find(c => c.key === 'expertTier')?.fix).toMatch(/lower where Gold starts/);
    expect(r.checks.some(c => c.key === 'dominant')).toBe(false);
  });

  it('flags a dominant style or action, and warns on one that matches Proficient play', () => {
    const r = aggregate(good(), probes([['style', 'P', 720], ['style', 'P', 760], ['action', 'coach', 500]]), facts);
    const d = r.checks.find(c => c.key === 'dominant')!;
    expect(d.status).toBe('fail');
    expect(d.title).toBe('A single strategy wins without good leadership: Leading everyone as Partnering reaches Gold (740 points)');
    // Against Platinum, a probe at Proficient's average is a warning, not a failure.
    const w = aggregate(good(), probes([['action', 'coach', 740]]), { ...facts, targetTier: 'platinum' }).checks.find(c => c.key === 'dominant')!;
    expect(w.status).toBe('warn');
    expect(w.title).toContain('Spending every day on Coach scores as well as Proficient players');
  });

  it('warns when neighbouring levels score close, and on skill ratings that do not match the level', () => {
    const runs = [...[300, 350, 320].map(s => run('beginner', s)), ...[330, 360, 340].map(s => run('developing', s, { level: 4 })), ...[700, 760, 740].map(s => run('proficient', s)), ...[880, 900, 910].map(s => run('expert', s, { level: 1 }))];
    const r = aggregate(runs, [], facts);
    expect(r.checks.find(c => c.key === 'separation')).toMatchObject({ status: 'warn', title: 'Beginner and Developing score within 20 points' });
    const skills = r.checks.find(c => c.key === 'skills')!;
    expect(skills.status).toBe('warn');
    expect(skills.title).toBe('Skill ratings match each level in only 50% of runs');
    expect(skills.detail).toContain('Expert players were rated Developing most often (expected Advanced or Role Model)');
  });

  it('expects skill levels by place on the scale', () => {
    expect((['beginner', 'developing', 'proficient', 'expert'] as const).map(p => expectedLevels(p, 5))).toEqual([[0, 1], [1, 2], [2, 3], [3, 4]]);
    expect((['beginner', 'developing', 'proficient', 'expert'] as const).map(p => expectedLevels(p, 3))).toEqual([[0, 1], [0, 1], [1, 2], [1, 2]]);
    expect((['beginner', 'developing', 'proficient', 'expert'] as const).map(p => expectedLevels(p, 4))).toEqual([[0, 1], [1, 2], [1, 2], [2, 3]]);
  });

  it('picks the target tier: asked for, else the second from the top', () => {
    expect(targetTierOf(TIERS).key).toBe('gold');
    expect(targetTierOf(TIERS, 'platinum').key).toBe('platinum');
    expect(targetTierOf(TIERS.slice(2)).key).toBe('silver');
  });

  it('works with only some personas, and writes plain copy', () => {
    const r = aggregate(good().filter(x => x.persona === 'expert'), [], facts);
    expect(r.personas.map(p => p.persona)).toEqual(['expert']);
    expect(r.checks.map(c => c.key)).toEqual(['expertTier', 'skills', 'unused', 'events']);
    for (const res of [r, aggregate(good(), probes([['style', 'P', 900]]), facts)]) for (const c of res.checks) for (const t of [c.title, c.detail, c.fix]) if (t) expect(copyViolations(t), t).toEqual([]);
  });
});
