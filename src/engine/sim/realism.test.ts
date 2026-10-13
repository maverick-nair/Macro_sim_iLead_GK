import { describe, expect, it } from 'vitest';
import { parseStoryline, REALISM_DEFAULTS, type StorylineConfig } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import clientTrust from '../storylines/client-trust.json';
import { createEngine } from './engine';
import { neededStyles } from './policies';
import { addDayLoss, attend, escalationRevenue, idleDays, noteUse, onAction, personOutput, repeatOf, saturation, teamOutput } from './realism';
import { realismWeekEnd, sponsorSilence } from './realismPeriod';
import { advanceStreak, businessPillar, peoplePillar, quietWeek, revenueScore } from './score';
import { createSim, effectChanges } from './sim';
import { createRng } from './rng';
import type { Sim } from './types';

/**
 * Realism (D171 to D178, docs/SIMULATION.md 3.6): diminishing returns on repeats, the team's time, the cost of
 * neglect, silence and idle days, and the score's curves. Each test names the rule and reads the defaults.
 */
const parse = (raw: unknown): StorylineConfig => { const p = parseStoryline(raw); if (!p.ok) throw new Error(p.issues.join('\n')); return p.config; };
const config = parse(salesElevator);
const R = config.realism!;
const fresh = (cfg = config): Sim => { const s = createSim(cfg, 1); s.phase = 'board'; return s; };
const action = (key: string) => config.actions.find(a => a.key === key)!;

describe('realism is opt in', () => {
  it('both bundled storylines have it; left out, the run keeps no realism state', () => {
    expect(config.realism).toBeDefined();
    expect(parse(clientTrust).realism).toBeDefined();
    expect(fresh({ ...config, realism: undefined }).realism).toBeUndefined();
    expect(REALISM_DEFAULTS.neglect.weeks).toBe(4);
  });
});

describe('diminishing returns (D171)', () => {
  it('the same action with the same person lands at 100%, 60%, 35%, 20%, recovering as uses leave the window', () => {
    const sim = fresh();
    const f2f = action('f2f');
    const shares: number[] = [];
    for (let i = 0; i < 4; i++) { shares.push(repeatOf(sim, f2f, 'kent').share); noteUse(sim, f2f, 'kent'); }
    expect(shares).toEqual(R.repeat.decay);
    // Someone else starts at full; so does Kent once the window has passed.
    expect(repeatOf(sim, f2f, 'beth').share).toBe(1);
    sim.absSub += R.repeat.window;
    expect(repeatOf(sim, f2f, 'kent')).toMatchObject({ uses: 0, share: 1 });
  });

  it('scales only the good part of an effect', () => {
    const reason = { label: 'x', cause: 'x', rule: 'x', evidence: [] };
    const apply = (share?: number) => {
      const sim = fresh();
      const m = sim.members[0];
      m.morale = 50; m.skill = 50; m.result = 50; m.trust = 60;
      return effectChanges(sim, createRng(1), m, [0, 10, -4], reason, share === undefined ? {} : { share });
    };
    const [full, half] = [apply(), apply(0.5)];
    const delta = (cs: typeof full, k: string) => cs.find(c => c.metric === k)!.delta;
    expect(delta(half, 'morale')).toBeLessThan(delta(full, 'morale'));
    expect(delta(half, 'result')).toBe(delta(full, 'result'));
  });

  it('a team action repeated in its window tires everyone and costs that day output', () => {
    const sim = fresh();
    const energize = action('energize');
    const lunch = energize.options.find(o => o.key === 'team_lunch')!;
    const before = sim.members.map(m => m.morale);
    expect(onAction(sim, energize, lunch, [], 1, { uses: 0, share: 1, ago: null })).toEqual([]);
    const tired = onAction(sim, energize, lunch, [], 1, { uses: 1, share: 0.6, ago: 3 });
    expect(tired.filter(c => c.metric === 'morale').every(c => c.delta === R.fatigue.morale)).toBe(true);
    expect(sim.members.map(m => m.morale)).toEqual(before.map(x => Math.max(0, x + R.fatigue.morale)));
    expect(sim.realism!.evidence.fatigue).toBe(1);
  });
});

describe('the team\'s time (D172)', () => {
  it('a team building day takes half of each of its days; a lunch a tenth; hiring none', () => {
    const sim = fresh();
    const energize = action('energize');
    onAction(sim, energize, energize.options.find(o => o.key === 'team_building')!, [], 2, { uses: 0, share: 1, ago: null });
    sim.absSub += 1;
    expect(teamOutput(sim)).toBeCloseTo(0.5, 6);
    sim.absSub += 1;
    expect(teamOutput(sim)).toBeCloseTo(0.5, 6);
    sim.absSub += 1;
    expect(teamOutput(sim)).toBe(1);
    const other = fresh();
    onAction(other, energize, energize.options.find(o => o.key === 'team_lunch')!, [], 1, { uses: 0, share: 1, ago: null });
    other.absSub += 1;
    expect(teamOutput(other)).toBeCloseTo(0.9, 6);
    const hire = action('hire');
    const third = fresh();
    onAction(third, hire, hire.options[0], [], 2, { uses: 0, share: 1, ago: null });
    third.absSub += 1;
    expect(teamOutput(third)).toBe(1);
  });

  it('a day lost is capped at 90%', () => {
    const sim = fresh();
    addDayLoss(sim, 0.7, 1); addDayLoss(sim, 0.7, 1);
    sim.absSub += 1;
    expect(teamOutput(sim)).toBeCloseTo(0.1, 6);
  });
});

describe('the cost of inaction for the business (D173)', () => {
  it('an ignored event costs a share of a week\'s target', () => {
    expect(escalationRevenue(fresh())).toBe(-Math.round(R.escalation.revenue * config.money.target / config.time.period.count));
  });

  it('after two weeks with no word, sponsor confidence slips each week end; a word resets it', () => {
    const sim = fresh();
    sim.sponsor.value = 50;
    sim.period = 1; sponsorSilence(sim);
    expect(sim.sponsor.value).toBe(50);
    sim.period = 2; sponsorSilence(sim);
    expect(sim.sponsor.value).toBe(50 + R.sponsor.decay);
    sim.realism!.sponsorContact = 3;
    sim.period = 3; sponsorSilence(sim);
    expect(sim.sponsor.value).toBe(50 + R.sponsor.decay);
  });

  it('your own update to the sponsor costs a day, once a week, and counts as a word', async () => {
    const e = createEngine(config, { seed: 3 });
    await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
    const left = e.view().clock.capacityLeft;
    expect(e.view().sponsor.update).toEqual({ cost: 1, blocked: null });
    const o = await e.dispatch({ type: 'openConversation', kind: 'sponsor' });
    expect(o.view.clock.capacityLeft).toBe(left - R.sponsor.update.cost);
    const r = await e.dispatch({ type: 'submitInteraction', interactionId: o.interactionId!, text: 'Honestly we are behind on conversions. I own that. The plan is to coach Peter by Friday, and I need support on leads.' });
    expect(r.view.sponsor.update!.blocked).toBe('done');
    expect(r.view.sponsor.silence!.weeks).toBe(0);
    await expect(e.dispatch({ type: 'openConversation', kind: 'sponsor' })).rejects.toMatchObject({ code: 'blocked' });
  });
});

describe('the cost of inaction for people (D174)', () => {
  it('someone with no one to one time for the window loses morale and trust each further week, and delivers less', () => {
    const sim = fresh();
    const kent = sim.members.find(m => m.id === 'kent')!;
    kent.morale = 60; kent.trust = 60; kent.skill = 80;
    const out = personOutput(sim, kent);
    for (let w = 1; w < R.neglect.weeks; w++) { sim.period = w; realismWeekEnd(sim); }
    expect([kent.morale, kent.trust]).toEqual([60, 60]);
    sim.period = R.neglect.weeks; realismWeekEnd(sim);
    expect([kent.morale, kent.trust]).toEqual([60 + R.neglect.morale, 60 + R.neglect.trust]);
    expect(personOutput(sim, kent)).toBeCloseTo(out * (1 - R.neglect.output), 6);
    // Time of their own puts it right.
    attend(sim, ['kent']);
    expect(personOutput(sim, kent)).toBeCloseTo(out, 6);
  });

  it('days left unused at the week end deliver less', () => {
    const sim = fresh();
    idleDays(sim, 2, 2);
    sim.absSub += 1;
    expect(teamOutput(sim)).toBeCloseTo(1 - R.idle.output, 6);
    expect(sim.realism!.evidence.idleDays).toBe(2);
  });

  it('a week with no action, conversation or decision is quiet', () => {
    const sim = fresh();
    expect(quietWeek(sim, 1)).toBe(true);
    sim.actionRecords.push({ id: 'a1', period: 1, sub: 0, actionKey: 'training', optionKey: null, scope: 'member', reached: ['kent'], effects: {}, uses: [] });
    expect(quietWeek(sim, 1)).toBe(false);
  });
});

describe('the score\'s curves (D175 to D177)', () => {
  it('revenue at the target is worth 85 of the Business pillar, and more counts with diminishing value', () => {
    const sim = fresh();
    const at = (share: number) => { sim.funnel.value = share * config.money.target; return revenueScore(sim); };
    expect(at(0.5)).toBeCloseTo(42.5, 6);
    expect(at(1)).toBe(R.score.atTarget);
    expect(at(1.5)).toBeCloseTo(85 + 15 * (1 - Math.exp(-1)), 6);
    expect(at(3)).toBeLessThan(100);
  });

  it('sponsor confidence takes a fifth of the Business pillar', () => {
    const sim = fresh();
    sim.funnel.value = config.money.target;
    sim.sponsor.value = 100;
    expect(businessPillar(sim)).toBeCloseTo(0.8 * 85 + 0.2 * 100, 6);
    sim.sponsor.value = 0;
    expect(businessPillar(sim)).toBeCloseTo(0.8 * 85, 6);
  });

  it('the People pillar rises with diminishing value and each leaver costs points', () => {
    const sim = fresh();
    // The start is the team's rounded average, so the pillar opens within a point of 50.
    const start = peoplePillar(sim);
    expect(start).toBeCloseTo(50, 0);
    for (const m of sim.members) m.morale += 30;
    expect(peoplePillar(sim) - 50).toBeLessThan(50 * (1 - Math.exp(-1)) + 1);
    expect(peoplePillar(sim) - 50).toBeGreaterThan(50 * (1 - Math.exp(-1)) - 1);
    for (const m of sim.members) m.morale -= 30;
    const gone = sim.members.pop()!;
    sim.departed.push(gone);
    const without = { ...sim, departed: [] };
    expect(peoplePillar(without) - peoplePillar(sim)).toBeCloseTo(R.score.leavers, 6);
  });

  it('the streak bonus grows a little every good week, with no cliff at the third', () => {
    const sim = fresh();
    const bonuses = [3, 3, 3, 1, 3].map(n => advanceStreak(sim, n));
    expect(bonuses[0]).toBeGreaterThan(0);
    expect(bonuses[1]).toBeGreaterThan(bonuses[0]);
    expect(bonuses[3]).toBe(0);
    expect(bonuses[4]).toBe(bonuses[0]);
    const all = fresh();
    for (let i = 0; i < config.time.period.count; i++) advanceStreak(all, 3);
    expect(all.streakBonus).toBeGreaterThan(90);
    expect(all.streakBonus).toBeLessThanOrEqual(config.gamification.streak.cap);
  });
});

describe('morale saturation (D178)', () => {
  it('result gains from actions shrink above a healthy morale, to 40% at 100', () => {
    const sim = fresh();
    const m = sim.members[0];
    m.morale = R.output.healthy;
    expect(saturation(sim, m)).toBe(1);
    m.morale = 100;
    expect(saturation(sim, m)).toBeCloseTo(R.output.saturation, 6);
  });
});
