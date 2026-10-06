import { describe, expect, it } from 'vitest';
import type { NeedKey } from '../lens';
import { GeneralEvent, parseStoryline, type StorylineConfig } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { blockedReason } from './actions';
import { createEngine } from './engine';
import { fireEvent, respond, runEvents, upcomingNews } from './events';
import { chooseReward, endPeriod, startNextPeriod } from './period';
import { neededStyles } from './policies';
import { createRng } from './rng';
import { advanceStreak, checkBadges, leadershipScore, tierFor, weekScore } from './score';
import { capacity, createSim, runSubPeriod } from './sim';
import { sponsorLevel } from './view';
import type { Sim } from './types';

/** M5: game scores on the GenieKreator formulas (docs/genie/scoring-and-report.md 6 and 9) and events. */
const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config: StorylineConfig = parsed.config;
const rng = () => createRng(1);
const fresh = (cfg = config) => { const s = createSim(cfg, 1); s.phase = 'board'; return s; };
const decide = (sim: Sim, n: number, ok: number, source = 'weeklyStyle') => {
  for (let i = 0; i < n; i++) {
    const d = { memberId: sim.members[i % sim.members.length].id, chosen: 'D' as const, need: (i < ok ? 'lowSkill_lowMorale' : 'highSkill_highMorale') as NeedKey, mismatch: (i < ok ? 0 : 2) as 0 | 2, source };
    sim.decisions.period.push(d); sim.decisions.run.push(d);
  }
};
const withEvents = (events: unknown[]): StorylineConfig => ({ ...config, events: events.map(e => GeneralEvent.parse(e)) });

describe('Leadership Score', () => {
  it('is 9 × (0.3 B + 0.3 P + 0.4 L) + streak, with L the capability % when there is no live interaction', () => {
    const sim = fresh();
    sim.funnel.value = config.money.target / 2; // B 50
    decide(sim, 10, 7); // capability 70
    const s = leadershipScore(sim);
    expect(s.business).toBe(50);
    expect(s.people).toBe(50); // no change since the start
    expect(s.leadership).toBe(70);
    expect(s.total).toBe(Math.floor(9 * (0.3 * 50 + 0.3 * 50 + 0.4 * 70) + 0.5));
    sim.liveRecords.push({ period: 1, actionKey: 'f2f', format: 'roleplay', band: 'strong', memberIds: ['kent'] });
    expect(leadershipScore(sim).leadership).toBe(0.5 * 70 + 0.5 * 100);
    sim.streakBonus = 50;
    expect(leadershipScore(sim).total).toBe(Math.floor(9 * (0.3 * 50 + 0.3 * 50 + 0.4 * 85) + 0.5) + 50);
  });

  it('caps B at 100 and keeps P inside 0 to 100', () => {
    const sim = fresh();
    sim.funnel.value = config.money.target * 2;
    for (const m of sim.members) { m.morale = 0; m.trust = 0; }
    const s = leadershipScore(sim);
    expect(s.business).toBe(100);
    expect(s.people).toBe(0);
  });

  it('places tiers at their boundaries: Platinum 850, Gold 700, Silver 500, Bronze below', () => {
    const sim = fresh();
    expect([499, 500, 699, 700, 849, 850, 1000].map(n => tierFor(sim, n).key)).toEqual(['bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'platinum']);
  });
});

describe('week score and stars', () => {
  it('is 0.5 fit + 0.3 live + 0.2 funnel, with stars at 50, 70 and 85', () => {
    const sim = fresh();
    decide(sim, 10, 10);
    sim.liveRecords.push({ period: 1, actionKey: 'f2f', format: 'roleplay', band: 'adequate', memberIds: ['kent'] });
    const w = weekScore(sim);
    expect(w.styleFit).toEqual({ correct: 10, total: 10, pct: 100 });
    expect(w.live).toEqual({ count: 1, mean: 70 });
    expect(w.score).toBe(Math.floor(0.5 * 100 + 0.3 * 70 + 0.2 * w.funnel.pct + 0.5));
  });

  it('with no live interaction, the live weight moves to style fit (D62)', () => {
    const sim = fresh();
    decide(sim, 10, 5);
    const w = weekScore(sim);
    expect(w.live).toBeNull();
    expect(w.score).toBe(Math.floor(0.8 * 50 + 0.2 * w.funnel.pct + 0.5));
  });

  it('counts stars at every threshold', () => {
    const sim = fresh();
    const stars = (score: number) => sim.config.gamification.stars.filter(t => score >= t).length;
    expect([49, 50, 69, 70, 84, 85].map(stars)).toEqual([0, 1, 1, 2, 2, 3]);
  });
});

describe('streak', () => {
  it('pays +25 from the third period in a row at 2 stars, +25 a period after, capped at 100, and resets for free', () => {
    const sim = fresh();
    expect([2, 2, 3, 2, 2, 3, 3].map(n => advanceStreak(sim, n))).toEqual([0, 0, 25, 25, 25, 25, 0]);
    expect(sim.streakBonus).toBe(100);
    expect(advanceStreak(sim, 1)).toBe(0);
    expect(sim.streak).toBe(0);
    expect(sim.streakBonus).toBe(100);
  });
});

describe('sponsor confidence and unlocks', () => {
  it('words confidence by the rule lines: low under 30, wavering, steady from 50, confident from 70, champion from 85', () => {
    const sim = fresh();
    expect([0, 29, 30, 49, 50, 69, 70, 84, 85, 100].map(v => sponsorLevel(sim, v))).toEqual(
      ['low', 'low', 'wavering', 'wavering', 'steady', 'steady', 'confident', 'confident', 'champion', 'champion']);
  });

  it('offers no unlock at the last period end', () => {
    const sim = fresh();
    sim.period = sim.config.time.period.count;
    sim.sponsorAtStart = 66; sim.sponsor.value = 69;
    sim.funnel.periodValue = config.money.target;
    runSubPeriodsWithoutFunnel(sim);
    expect(endPeriod(sim, rng()).unlockOffer).toBeNull();
  });

  it('moves with each briefing band: +20 for a strong one, −10 for a weak one', async () => {
    for (const [text, delta] of [['Honestly, we are behind on 2 stages and I own that. The biggest risk is proposals. I will coach the team; here is the plan: the call lists by Friday. What I need from you is support.', 20], ['ok.', -10]] as const) {
      const e = createEngine(config, { seed: 4 });
      await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
      while (e.view().clock.period < 4) {
        await e.dispatch({ type: 'endPeriod' });
        if (e.view().pendingReward) await e.dispatch({ type: 'chooseReward', reward: e.view().pendingReward![0] });
        await e.dispatch({ type: 'startNextPeriod' });
        await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
      }
      const brief = e.view().inbox.find(m => m.briefing)!;
      const o = await e.dispatch({ type: 'openConversation', kind: 'sponsor', messageId: brief.id });
      const r = await e.dispatch({ type: 'submitInteraction', interactionId: o.interactionId!, text });
      expect(r.changes.find(c => c.subject === 'sponsor')?.delta).toBe(delta);
    }
    expect(config.gamification.sponsor.briefing).toEqual({ strong: 20, adequate: 5, weak: -10, harmful: -25 });
  });

  it('adds +5 for a period on pace and −5 behind it, and logs why', () => {
    const sim = fresh();
    sim.sponsorAtStart = sim.sponsor.value = 50;
    const s = endPeriod(sim, rng());
    const expected = s.valueThisPeriod >= s.valueIdeal ? 5 : -5;
    expect(s.sponsor.to - s.sponsor.from).toBe(expected);
    expect(sim.log.some(l => l.title.startsWith('Revenue') && l.changes.some(c => c.subject === 'sponsor'))).toBe(true);
  });

  it('crossing 70 upward offers the three unlocks; each one works', () => {
    const sim = fresh();
    sim.sponsorAtStart = 66; sim.sponsor.value = 69;
    sim.funnel.periodValue = config.money.target; // on pace: +5 crosses 70
    runSubPeriodsWithoutFunnel(sim);
    const s = endPeriod(sim, rng());
    expect(s.unlockOffer).toEqual(['bonus_day', 'hire_budget', 'team_activity']);
    chooseReward(sim, 'bonus_day');
    startNextPeriod(sim);
    expect(capacity(sim)).toBe(sim.config.time.subPeriod.perPeriod + 1);
    sim.pendingReward = ['hire_budget', 'team_activity'];
    chooseReward(sim, 'hire_budget');
    expect(sim.hireBudget).toBe(true);
    expect(() => chooseReward(sim, 'team_activity')).toThrow();
  });

  it('dropping below 30 schedules a CEO check in that costs a day next period', () => {
    const sim = fresh();
    sim.sponsorAtStart = 32; sim.sponsor.value = 32;
    sim.funnel.periodValue = 0;
    runSubPeriodsWithoutFunnel(sim);
    const s = endPeriod(sim, rng());
    expect(s.checkIn).toBe(true);
    expect(sim.inbox.some(m => m.title === 'CEO check in')).toBe(true);
    startNextPeriod(sim);
    expect(capacity(sim)).toBe(sim.config.time.subPeriod.perPeriod - 1);
  });

  it('a team activity reward skips the energize cooldown once; extra hire budget opens hiring on a full team, for no days', () => {
    const sim = fresh();
    const energize = config.actions.find(a => a.key === 'energize')!;
    const hire = config.actions.find(a => a.key === 'hire')!;
    sim.availableAt.energize = sim.availableAt['energize:team_lunch'] = 99;
    expect(blockedReason(sim, energize, null, 'team_lunch')).toMatchObject({ reason: 'cooldown' });
    sim.freeTeamActivity = true;
    expect(blockedReason(sim, energize, null, 'team_lunch')).toBeNull();
    expect(['teamFull', 'locked']).toContain(blockedReason(sim, hire, null)!.reason);
    sim.hireBudget = true;
    expect(blockedReason(sim, hire, null)).toBeNull();
  });
});

/** Runs the period's sub-periods with no funnel movement, so tests control revenue. */
function runSubPeriodsWithoutFunnel(sim: Sim) {
  const keep = sim.funnel.periodValue;
  sim.config = { ...sim.config, money: { ...sim.config.money, inputPerSubPeriod: [0] } };
  while (sim.sub < sim.config.time.subPeriod.perPeriod) runSubPeriod(sim, rng());
  sim.funnel.periodValue = keep;
}

describe('badges (each condition true and false)', () => {
  const earned = (sim: Sim, key: string) => sim.badges.some(b => b.key === key);

  it('First Close: the first conversion', () => {
    const sim = fresh();
    sim.funnel.conversions = 0.9; checkBadges(sim, 'conversion'); expect(earned(sim, 'first_close')).toBe(false);
    sim.funnel.conversions = 1; checkBadges(sim, 'conversion'); expect(earned(sim, 'first_close')).toBe(true);
  });

  it('Read the Room: 90% weekly style fit', () => {
    const a = fresh(); decide(a, 10, 8); checkBadges(a, 'periodEnd'); expect(earned(a, 'read_the_room')).toBe(false);
    const b = fresh(); decide(b, 10, 9); checkBadges(b, 'periodEnd'); expect(earned(b, 'read_the_room')).toBe(true);
  });

  it('Flex Master: every style right at least twice', () => {
    const bestNeed = { D: 'lowSkill_lowMorale', G: 'lowSkill_highMorale', P: 'highSkill_lowMorale', E: 'highSkill_highMorale' } as const;
    const sim = fresh();
    const add = (s: 'D' | 'G' | 'P' | 'E', n: number) => { for (let i = 0; i < n; i++) sim.decisions.run.push({ memberId: 'kent', chosen: s, need: bestNeed[s], mismatch: 0, source: 'f2f' }); };
    add('D', 2); add('G', 2); add('P', 2); add('E', 1);
    checkBadges(sim, 'periodEnd'); expect(earned(sim, 'flex_master')).toBe(false);
    add('E', 1); checkBadges(sim, 'periodEnd'); expect(earned(sim, 'flex_master')).toBe(true);
  });

  it('Concern Uncovered: min(5, team size) people opened up', () => {
    const sim = fresh();
    sim.members.slice(0, 4).forEach(m => { m.concernShared = true; });
    checkBadges(sim, 'interaction'); expect(earned(sim, 'concern_uncovered')).toBe(false);
    sim.members[4].concernShared = true;
    checkBadges(sim, 'interaction'); expect(earned(sim, 'concern_uncovered')).toBe(true);
  });

  it('Promise Keeper: three made, none broken, at the end of the run', () => {
    const sim = fresh();
    const p = (state: 'kept' | 'broken') => ({ id: `p${sim.promises.length}`, memberId: 'kent', text: 'x', dueAbsSub: 0, fulfilledBy: [], state });
    sim.promises.push(p('kept'), p('kept'), p('broken'));
    checkBadges(sim, 'runEnd'); expect(earned(sim, 'promise_keeper')).toBe(false);
    const ok = fresh(); ok.promises.push(p('kept'), p('kept'), p('kept'));
    checkBadges(ok, 'runEnd'); expect(earned(ok, 'promise_keeper')).toBe(true);
  });

  it('Fair Hand: three recognitions nobody felt passed over by', () => {
    const sim = fresh();
    sim.fairRecognitions = 2; checkBadges(sim, 'interaction'); expect(earned(sim, 'fair_hand')).toBe(false);
    sim.fairRecognitions = 3; checkBadges(sim, 'interaction'); expect(earned(sim, 'fair_hand')).toBe(true);
  });

  it('Turnaround: morale from below 30 to above 60', () => {
    const sim = fresh();
    sim.members[0].lowestMorale = 25; sim.members[0].morale = 60;
    checkBadges(sim, 'periodEnd'); expect(earned(sim, 'turnaround')).toBe(false);
    sim.members[0].morale = 61;
    checkBadges(sim, 'periodEnd'); expect(earned(sim, 'turnaround')).toBe(true);
  });

  it('Change Champion: two Strong conversations that communicate change', () => {
    const sim = fresh();
    sim.liveRecords.push({ period: 1, actionKey: 'meet', format: 'meeting', band: 'strong', memberIds: [] });
    sim.liveRecords.push({ period: 1, actionKey: 'f2f', format: 'roleplay', band: 'strong', memberIds: ['kent'] });
    checkBadges(sim, 'interaction'); expect(earned(sim, 'change_champion')).toBe(false);
    sim.liveRecords.push({ period: 1, actionKey: 'swap', format: 'roleplay', band: 'strong', memberIds: ['kent'] });
    checkBadges(sim, 'interaction'); expect(earned(sim, 'change_champion')).toBe(true);
  });

  it('Steady Hand: no Harmful band in the run', () => {
    const a = fresh(); a.liveRecords.push({ period: 1, actionKey: 'f2f', format: 'roleplay', band: 'harmful', memberIds: [] });
    checkBadges(a, 'runEnd'); expect(earned(a, 'steady_hand')).toBe(false);
    const b = fresh(); checkBadges(b, 'runEnd'); expect(earned(b, 'steady_hand')).toBe(true);
  });

  it('Target Crusher: revenue reaches the target', () => {
    const sim = fresh();
    sim.funnel.value = config.money.target - 1; checkBadges(sim, 'periodEnd'); expect(earned(sim, 'target_crusher')).toBe(false);
    sim.funnel.value = config.money.target; checkBadges(sim, 'periodEnd'); expect(earned(sim, 'target_crusher')).toBe(true);
  });

  it('are earned once, with the period and the reason in words', () => {
    const sim = fresh();
    sim.funnel.conversions = 2;
    checkBadges(sim, 'conversion'); checkBadges(sim, 'conversion');
    expect(sim.badges.filter(b => b.key === 'first_close')).toEqual([{ key: 'first_close', period: 1, reason: 'Your team closed its first deal.' }]);
  });
});

describe('events', () => {
  const base = { title: 'Something happened', body: { he: 'It happened to {name}.', she: 'It happened to {name}.' }, card: 'signal', impact: [0, -2, 0] };

  it('draws random timing from the seed, the same every run; probability 0 never fires', () => {
    const cfg = withEvents([{ ...base, key: 'maybe', window: { from: 2, to: 4, probability: 100 } }, { ...base, key: 'never', window: { from: 2, to: 4, probability: 0 } }]);
    const a = createSim(cfg, 7), b = createSim(cfg, 7);
    expect(a.events.schedule.maybe).toEqual(b.events.schedule.maybe);
    expect(a.events.schedule.maybe!.period).toBeGreaterThanOrEqual(2);
    expect(a.events.schedule.maybe!.period).toBeLessThanOrEqual(4);
    expect(a.events.schedule.never).toBeNull();
  });

  it('a conditional event fires at a period start once its condition held at enough period ends', () => {
    const cfg = withEvents([{ ...base, key: 'low', when: { condition: 'teamMoraleBelow', value: 100, periods: 1 } }]);
    const sim = createSim(cfg, 1);
    runEvents(sim, rng());
    expect(sim.events.fired).toEqual([]); // no period has ended yet
    sim.phase = 'board';
    endPeriod(sim, rng());
    startNextPeriod(sim);
    sim.phase = 'board';
    runSubPeriod(sim, rng());
    expect(sim.events.fired).toEqual(['low']);
  });

  it('targets a stage: everyone in it, nobody else', () => {
    const cfg = withEvents([{ ...base, key: 'stage_hit', target: 'stage:leads', impact: [0, -5, 0] }]);
    const sim = createSim(cfg, 1);
    fireEvent(sim, rng(), cfg.events[0]);
    const hit = new Set(sim.log.at(-1)!.changes.map(c => c.subject));
    expect([...hit].every(id => sim.members.find(m => m.id === id)!.stage === 'leads')).toBe(true);
    expect(hit.size).toBe(sim.members.filter(m => m.stage === 'leads').length);
  });

  it('a chat from the target, answered in time, earns the authored bonus', () => {
    const cfg = withEvents([{ ...base, key: 'ask', target: 'kent', delivery: 'chat', response: { actions: ['f2f'], within: 2, onTime: [0, 4, 0] } }]);
    const sim = createSim(cfg, 1);
    fireEvent(sim, rng(), cfg.events[0]);
    const msg = sim.inbox.at(-1)!;
    expect(msg).toMatchObject({ from: 'kent', kind: 'chat', title: 'Something happened' });
    expect(sim.cards).toEqual([]);
    const changes = respond(sim, rng(), 'reply', [], msg.id);
    expect(changes.some(c => c.subject === 'kent' && c.metric === 'morale' && c.delta > 0)).toBe(true);
    expect(sim.events.pending).toEqual([]);
  });

  it('ignored past its window, it escalates: the sponsor hears of it and the follow up fires', () => {
    const cfg = withEvents([
      { ...base, key: 'ask', target: 'kent', delivery: 'chat', response: { actions: ['f2f'], within: 1 }, escalation: { event: 'complaint', sponsor: true } },
      { ...base, key: 'complaint', title: 'Kent complained', target: 'kent' }
    ]);
    const sim = createSim(cfg, 1);
    sim.phase = 'board';
    fireEvent(sim, rng(), cfg.events[0]);
    const before = sim.sponsor.value;
    runSubPeriod(sim, rng()); runSubPeriod(sim, rng());
    expect(sim.sponsor.value - before).toBeLessThanOrEqual(cfg.gamification.sponsor.escalation);
    expect(sim.events.fired).toContain('complaint');
    expect(sim.cards.some(c => c.key === 'complaint')).toBe(true);
  });

  it('a sponsor call rings as a card and leaves a message to answer', () => {
    const cfg = withEvents([{ ...base, key: 'call', target: 'sponsor', delivery: 'sponsorCall', card: 'crisis' }]);
    const sim = createSim(cfg, 1);
    fireEvent(sim, rng(), cfg.events[0]);
    expect(sim.cards.at(-1)).toMatchObject({ delivery: 'sponsorCall', card: 'crisis' });
    expect(sim.inbox.at(-1)).toMatchObject({ from: 'sponsor', kind: 'sponsor', urgent: true });
    expect(sim.cards.at(-1)!.messageId).toBe(sim.inbox.at(-1)!.id);
  });

  it('a bulletin for next period is news at this week end, and lands with no card', () => {
    const cfg = withEvents([{ ...base, key: 'news', period: 2, subPeriod: 1, delivery: 'bulletin', body: { he: 'Prices fell.', she: 'Prices fell.' }, impactText: 'Proposal converts slower.' }]);
    const sim = createSim(cfg, 1);
    expect(upcomingNews(sim)).toEqual([{ key: 'news', card: 'signal', title: 'Something happened', body: 'Prices fell.', impact: 'Proposal converts slower.' }]);
    sim.phase = 'board';
    const s = endPeriod(sim, rng());
    expect(s.news.map(n => n.key)).toEqual(['news']);
    startNextPeriod(sim); sim.phase = 'board';
    runSubPeriod(sim, rng());
    expect(sim.events.fired).toContain('news');
    expect(sim.cards.some(c => c.key === 'news')).toBe(false);
  });

  it('rejects events that cannot work: two timings, a chat to the whole team, an unknown follow up', () => {
    expect(GeneralEvent.safeParse({ ...base, key: 'x', period: 1, window: { from: 1, to: 2 } }).success).toBe(false);
    expect(GeneralEvent.safeParse({ ...base, key: 'x', delivery: 'chat' }).success).toBe(false);
    const bad = parseStoryline({ ...salesElevator, events: [{ ...base, key: 'x', period: 1, escalation: { event: 'nope' } }] });
    expect(bad.ok).toBe(false);
  });
});
