import { describe, expect, it } from 'vitest';
import { copyViolations } from '../../../i18n/copy';
import { actionMix, archetypeChecks, mixDistance } from './archetypes';
import { personaStats } from './aggregate';
import { knownFinding } from './findings';
import { mechanicsChecks, rangeOverlap, sd } from './mechanics';
import type { Check, PersonaKey, PersonaStats, RunResult } from './schema';
import { describeProbe, strategyChecks } from './strategy';

/** The checks added for the first synthetic player audit (D149, D150): combined probes, player types, mechanics. */

const TIERS = [{ key: 'platinum', name: 'Platinum', min: 850 }, { key: 'gold', name: 'Gold', min: 700 }, { key: 'bronze', name: 'Bronze', min: 0 }];
const SCALE = ['Novice', 'Developing', 'Proficient', 'Advanced', 'Role Model'];
const STYLES = [{ key: 'D', name: 'Directing' }, { key: 'P', name: 'Partnering' }];
const ACTIONS = [{ key: 'energize', name: 'Energize the team' }, { key: 'f2f', name: 'Meet face to face' }, { key: 'coach', name: 'Coach member' }, { key: 'fire', name: 'Let go' }];

let n = 0;
function run(persona: PersonaKey, score: number, o: Partial<RunResult> = {}): RunResult {
  const i = TIERS.findIndex(t => score >= t.min);
  return {
    persona, index: n++, seed: 1, probe: null, score, max: 1000, tier: { key: TIERS[i].key, name: TIERS[i].name, index: i }, share: score / 800, level: 3,
    skills: [], adaptability: 80, bands: { strong: 5, adequate: 2, weak: 1, harmful: 0 }, concerns: [], actions: { f2f: 3, coach: 2 }, events: { expected: 2, handled: 2 }, ...o
  };
}
const probe = (kind: NonNullable<RunResult['probe']>['kind'], key: string, ...scores: number[]) => scores.map(s => run('expert', s, { probe: { kind, key } }));
const stats = (persona: PersonaKey, runs: RunResult[]): PersonaStats => personaStats(persona, runs, { tiers: TIERS, target: TIERS[1], scale: SCALE });
const EXPERT = stats('expert', [run('expert', 930), run('expert', 950)]);
const strategy = (probes: RunResult[], expert: PersonaStats | undefined = EXPERT) => strategyChecks({ probes, probesRan: true, expert, target: TIERS[1], styles: STYLES, actions: ACTIONS });
const find = (cs: Check[], key: Check['key']) => cs.find(c => c.key === key);
const plain = (cs: Check[]) => { for (const c of cs) for (const t of [c.title, c.detail, c.fix]) if (t) expect(copyViolations(t), t).toEqual([]); };

describe('combined strategy probes (D149)', () => {
  it('fail when a pair of actions repeated with sound reading beats the Expert: the energize exploit', () => {
    const cs = strategy([...probe('pair', 'energize+f2f', 980, 985), ...probe('pair', 'coach+f2f', 820, 830), ...probe('energize', 'D', 640, 650, 660), ...probe('busy', '', 340, 350)]);
    const c = find(cs, 'combined')!;
    expect(c.status).toBe('fail');
    expect(c.title).toBe('A routine wins over judgement: Repeating Energize the team and Meet face to face, reading people as an Expert does beats Expert play (983 points against 940)');
    expect(c.fix).toContain('give Energize the team and Meet face to face a cooldown');
    plain(cs);
  });

  it('fail when a strategy that does not read people reaches the target tier, but not a pair that only reaches it by reading people', () => {
    const energize = find(strategy(probe('energize', 'P', 700, 720, 710)), 'combined')!;
    expect(energize).toMatchObject({ status: 'fail', title: 'A routine wins over judgement: Team energy every week with everyone led as Partnering reaches Gold (710 points)' });
    expect(find(strategy(probe('busy', '', 760, 780)), 'combined')).toMatchObject({ status: 'fail', title: 'A routine wins over judgement: Taking as many actions as the days allow, in any style reaches Gold (770 points)' });
    // A pair reads people as an Expert does: reaching the target tier is that reading, not the routine.
    expect(find(strategy(probe('pair', 'coach+f2f', 900, 910)), 'combined')).toMatchObject({ status: 'pass', title: 'No routine of repeated actions beats good leadership' });
  });

  it('pass when no combined probe beats the Expert or reaches the tier without reading people, and say which came closest', () => {
    const c = find(strategy([...probe('pair', 'coach+f2f', 900, 910), ...probe('energize', 'D', 600, 620, 610), ...probe('busy', '', 300, 320)]), 'combined')!;
    expect(c.status).toBe('pass');
    expect(c.detail).toBe('3 combined strategies tried; the best, repeating coach member and meet face to face, reading people as an expert does, averages 905 against the Expert\'s 940.');
  });

  it('warn when reading people right without acting reaches the target tier: the do nothing Gold', () => {
    const idle = find(strategy(probe('idle', '', 770, 778)), 'idle')!;
    expect(idle).toMatchObject({ status: 'warn', title: 'Reading people right without taking any action reaches Gold (774 points)' });
    expect(idle.fix).toContain('stays under Gold');
    expect(find(strategy(probe('idle', '', 600, 640)), 'idle')).toMatchObject({ status: 'pass', title: 'Reading people right without acting stays under Gold' });
    // `idle` is never part of the combined check.
    expect(find(strategy(probe('idle', '', 990, 990)), 'combined')).toBeUndefined();
  });

  it('say nothing with the probes off, and judge only the tier without Expert runs', () => {
    expect(strategyChecks({ probes: probe('pair', 'coach+f2f', 999), probesRan: false, expert: EXPERT, target: TIERS[1], styles: STYLES, actions: ACTIONS })).toEqual([]);
    expect(find(strategyChecks({ probes: probe('pair', 'coach+f2f', 999), probesRan: true, expert: undefined, target: TIERS[1], styles: STYLES, actions: ACTIONS }), 'combined')?.status).toBe('pass');
  });

  it('describe each probe in plain words', () => {
    const c = { styles: STYLES, actions: ACTIONS };
    expect(describeProbe('energize', 'D', c)).toBe('Team energy every week with everyone led as Directing');
    expect(describeProbe('pair', 'energize+coach', c)).toBe('Repeating Energize the team and Coach member, reading people as an Expert does');
    expect(describeProbe('idle', '', c)).toBe('Reading everyone right and taking no action');
    expect(describeProbe('busy', '', c)).toBe('Taking as many actions as the days allow, in any style');
  });
});

describe('the bundled storyline\'s known findings (D149)', () => {
  it('report a known failure as advice on a storyline that plays the bundled actions, with the finding', () => {
    const fail: Check = { key: 'combined', status: 'fail', title: 't', detail: 'd', fix: 'f' };
    expect(knownFinding(true, fail)).toMatchObject({ status: 'warn', title: 't', fix: 'f' });
    expect(knownFinding(true, fail).detail).toMatch(/^A finding in the bundled Sales Elevator's calibrated actions.* d$/);
    expect(knownFinding(false, fail)).toBe(fail);
    expect(knownFinding(true, { ...fail, key: 'dominant' })).toMatchObject({ status: 'fail' });
    expect(knownFinding(true, { ...fail, status: 'pass' }).status).toBe('pass');
  });
});

describe('player type checks (D150)', () => {
  const types = (a: Partial<RunResult>, b: Partial<RunResult>, scores: [number, number]) => {
    const runs = [run('riskTaker', scores[0], a), run('riskTaker', scores[0], a), run('conservative', scores[1], b), run('conservative', scores[1], b)];
    return { runs, personas: [stats('riskTaker', runs), stats('conservative', runs)] };
  };

  it('measure how alike two action mixes are', () => {
    const a = actionMix([run('riskTaker', 1, { actions: { f2f: 3, fire: 1 } })]);
    expect(a.get('f2f')).toBe(0.75);
    expect(mixDistance(a, a)).toBe(0);
    expect(mixDistance(a, actionMix([run('riskTaker', 1, { actions: { coach: 4 } })]))).toBe(1);
  });

  it('warn when two different player types end up with the same journey', () => {
    const same = types({ actions: { f2f: 6, coach: 4 } }, { actions: { f2f: 6, coach: 3 } }, [700, 705]);
    const c = find(archetypeChecks({ ...same, scoreMax: 1000 }), 'archetypes')!;
    expect(c.status).toBe('warn');
    expect(c.title).toBe('Different ways of leading end up the same: Risk taker and Conservative (93% the same actions, 700 and 705 points)');
    plain([c]);
  });

  it('pass when the journeys differ in actions or in outcome', () => {
    const actions = types({ actions: { fire: 2, f2f: 2, coach: 1 } }, { actions: { f2f: 6 } }, [700, 705]);
    expect(find(archetypeChecks({ ...actions, scoreMax: 1000 }), 'archetypes')).toMatchObject({ status: 'pass', title: 'Each player type plays out differently' });
    const outcome = types({ actions: { f2f: 6, coach: 4 } }, { actions: { f2f: 6, coach: 4 } }, [700, 800]);
    expect(find(archetypeChecks({ ...outcome, scoreMax: 1000 }), 'archetypes')?.status).toBe('pass');
  });

  it('warn when People first beats the Expert on score and revenue: no trade-off', () => {
    const people = [run('peopleFirst', 975, { share: 1.98 }), run('peopleFirst', 985, { share: 2 })];
    const expert = [run('expert', 950, { share: 1.5 }), run('expert', 954, { share: 1.6 })];
    const all = [...people, ...expert];
    const c = find(archetypeChecks({ personas: [stats('expert', all), stats('peopleFirst', all)], runs: all, scoreMax: 1000 }), 'tradeOff')!;
    expect(c).toMatchObject({ status: 'warn', title: 'Putting people first beats the Expert on both score and revenue (980 points and 199% of target, against 952 and 155%)' });
    plain([c]);
    // Better score but less revenue is a trade-off.
    const traded = [...people.map(r => ({ ...r, share: 1.2 })), ...expert];
    expect(find(archetypeChecks({ personas: [stats('expert', traded), stats('peopleFirst', traded)], runs: traded, scoreMax: 1000 }), 'tradeOff')?.status).toBe('pass');
  });
});

describe('mechanics and noise (D149)', () => {
  const level = (persona: PersonaKey, scores: number[], p: { business: number; people: number; leadership: number; streak: number; capped: boolean }) => stats(persona, scores.map(s => run(persona, s, { pillars: p })));

  it('warn when most of a gap between levels is the streak bonus', () => {
    const cs = mechanicsChecks([
      level('developing', [500, 520], { business: 180, people: 90, leadership: 230, streak: 0, capped: false }),
      level('proficient', [640, 660], { business: 200, people: 110, leadership: 250, streak: 100, capped: false })
    ]);
    expect(find(cs, 'mechanics')).toMatchObject({ status: 'warn', title: 'A mechanic drives the separation: 71% of the gap between Developing and Proficient comes from the streak bonus' });
    expect(find(cs, 'mechanics')?.fix).toMatch(/^Soften the streak/);
    plain(cs);
  });

  it('warn when Business is capped for two levels, and pass when nothing dominates', () => {
    const capped = mechanicsChecks([
      level('proficient', [860, 880], { business: 270, people: 200, leadership: 300, streak: 100, capped: true }),
      level('expert', [930, 950], { business: 270, people: 230, leadership: 340, streak: 100, capped: true })
    ]);
    expect(find(capped, 'mechanics')?.title).toBe('A mechanic drives the separation: Business is capped for Proficient and Expert: they pass the revenue target, so revenue beyond it adds nothing and only People and Leadership separate them');
    const fine = mechanicsChecks([
      level('beginner', [300, 340], { business: 120, people: 50, leadership: 130, streak: 0, capped: false }),
      level('developing', [480, 520], { business: 180, people: 90, leadership: 190, streak: 25, capped: false })
    ]);
    expect(find(fine, 'mechanics')).toMatchObject({ status: 'pass' });
  });

  it('warn when neighbouring levels overlap by more than 20%, with each level\'s spread', () => {
    expect(rangeOverlap({ min: 400, max: 600 }, { min: 450, max: 460 })).toBe(1);
    expect(rangeOverlap({ min: 0, max: 100 }, { min: 90, max: 200 })).toBe(0.1);
    expect(rangeOverlap({ min: 0, max: 100 }, { min: 150, max: 200 })).toBe(0);
    expect(sd([1, 3])).toBe(1);
    const p = { business: 0, people: 0, leadership: 0, streak: 0, capped: false };
    const close = mechanicsChecks([level('developing', [400, 600], p), level('proficient', [500, 700], p)]);
    expect(find(close, 'overlap')).toMatchObject({ status: 'warn', title: 'Neighbouring levels\' scores overlap: Developing and Proficient (50%)' });
    const apart = mechanicsChecks([level('developing', [400, 500], p), level('proficient', [480, 700], p)]);
    expect(find(apart, 'overlap')).toMatchObject({ status: 'pass', detail: 'Developing 400 to 500 (SD 50), Proficient 480 to 700 (SD 110).' });
  });
});
