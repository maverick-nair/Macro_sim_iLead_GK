import type { Rng } from './rng';
import { award } from './actions';
import { idealThroughput, log, markPeriodStart, perPeriod, runRemaining, sponsorChange, teamAverage, trustChange, firstName } from './sim';
import type { PeriodSummary, Sim } from './types';

/** Period end, gamification and the move to the next period (docs/SIMULATION.md section 7). */

export const RUN_MAX = 7200;
export const pillarMax = (sim: Sim) => 2400 / sim.config.time.period.count;
const UNLOCK_REWARDS = ['extra_day', 'quiet_word', 'free_lunch'];

export function endPeriod(sim: Sim, rng: Rng): PeriodSummary {
  if (sim.phase !== 'board') throw new Error('The period can only end from the board');
  runRemaining(sim, rng);
  const count = sim.config.time.period.count;
  const max = pillarMax(sim);
  const target = sim.config.money.target;
  const pace = sim.funnel.value / (target * sim.period / count);
  const periodPace = sim.funnel.periodValue / (target / count);
  const decisions = sim.decisions.period;
  const accuracy = decisions.length ? decisions.filter(d => d.mismatch === 0).length / decisions.length : 0;

  const business = Math.round(max * Math.min(1, periodPace) + (periodPace >= 1.1 ? 0.1 * max : 0));
  const people = Math.round(max * (0.5 * teamAverage(sim, 'morale') + 0.5 * teamAverage(sim, 'trust')) / 100);
  const leadership = Math.round(max * accuracy);
  const stars = {
    people: teamAverage(sim, 'morale') >= sim.periodStart.morale,
    leadership: accuracy >= 0.7,
    business: pace >= 1
  };
  const starCount = Object.values(stars).filter(Boolean).length;
  sim.streak = starCount >= 2 ? sim.streak + 1 : 0;
  const streakBonus = sim.streak > 0 && sim.streak % 3 === 0 ? Math.round(0.1 * 3 * max) : 0;
  sim.score.business += business;
  sim.score.people += people;
  sim.score.leadership += leadership;
  sim.score.bonus += streakBonus;

  // Badges (7.3).
  const before = new Set(sim.badges);
  const ideal = idealThroughput(sim);
  if (sim.funnel.stageOutPeriod.some((v, i) => v >= ideal[i])) award(sim, 'pipeline_builder');
  if (sim.members.every(m => m.away > 0 || m.morale >= 40)) award(sim, 'steady_hand');
  if (sim.members.some(m => m.lowestResult < 30 && m.result >= 60)) award(sim, 'turnaround');
  const vp = sim.voicePeriods[sim.period];
  if (vp && vp.total > 0 && vp.voice === vp.total) award(sim, 'clear_voice');
  if (sim.promises.filter(p => p.state === 'kept').length >= 3 && !sim.promises.some(p => p.state === 'broken')) award(sim, 'promise_keeper');
  if (accuracy === 1 && decisions.length) award(sim, 'right_style');
  const newBadges = sim.badges.filter(b => !before.has(b));

  // Sponsor confidence and unlock offers (7.5).
  const sFrom = sim.sponsor.value;
  if (pace >= 1) sponsorChange(sim, 10, 'On pace for the target');
  else if (pace < 0.8) sponsorChange(sim, -8, 'Behind pace on the target');
  let unlockOffer: string[] | null = null;
  for (const t of [60, 80]) {
    if (sFrom < t && sim.sponsor.value >= t && !sim.sponsor.crossed.includes(t)) {
      sim.sponsor.crossed.push(t);
      unlockOffer = UNLOCK_REWARDS;
    }
  }
  sim.pendingReward = unlockOffer;

  // Role change requests ignored through the period cost trust (6.4).
  for (const m of sim.members) {
    if (m.roleChangeRequestedPeriod !== null && m.roleChangeRequestedPeriod < sim.period && m.reassignedInPeriod !== sim.period) {
      trustChange(m, sim.config.triggers.find(t => t.kind === 'roleChangeRequest')?.params.ignoredTrust ?? -4, { label: 'Request ignored', cause: `${firstName(sim, m.id)} asked to change roles and nothing happened.`, rule: 'Ignoring a role change request lowers trust.', evidence: [] });
      m.roleChangeRequestedPeriod = null;
    }
    m.periodEnds.push({ result: m.result, morale: m.morale, trust: m.trust });
  }

  const kpis = Object.fromEntries((['skill', 'morale', 'result', 'trust'] as const).map(k => [k, { start: sim.periodStart.kpis[k], end: teamAverage(sim, k) }])) as PeriodSummary['kpis'];
  const summary: PeriodSummary = {
    period: sim.period, stars, kpis, valueThisPeriod: sim.funnel.periodValue, cumulativeValue: sim.funnel.value, pace, accuracy,
    points: { business, people, leadership, streakBonus }, streak: sim.streak, newBadges, sponsor: { from: sFrom, to: sim.sponsor.value },
    funnel: sim.config.stages.map((st, i) => ({ stage: st.key, throughput: sim.funnel.stageOutPeriod[i], ideal: ideal[i] })), unlockOffer
  };
  sim.periods.push(summary);
  log(sim, { kind: 'periodEnd', title: `End of period ${sim.period}`, memberIds: [], changes: [] });
  sim.phase = sim.period >= count ? 'ended' : 'periodEnd';
  return summary;
}

/** Applies a chosen unlock reward (7.5). */
export function chooseReward(sim: Sim, key: string) {
  if (!sim.pendingReward?.includes(key)) throw new Error('No such reward on offer');
  sim.pendingReward = null;
  if (key === 'extra_day') sim.bonusPeriod = sim.period + 1;
  if (key === 'quiet_word') {
    const m = sim.members.find(x => !x.concernShared && sim.config.members.find(p => p.id === x.id)?.hiddenConcern);
    if (m) m.concernShared = true;
  }
  if (key === 'free_lunch') sim.availableAt['energize:team_lunch'] = 0;
}

export function startNextPeriod(sim: Sim) {
  if (sim.phase !== 'periodEnd') throw new Error('The period has not ended');
  sim.period += 1;
  sim.sub = 0;
  sim.spent = 0;
  if (sim.pendingReward) sim.pendingReward = null;
  sim.funnel.periodValue = 0;
  sim.funnel.stageOutPeriod = sim.config.stages.map(() => 0);
  sim.decisions.period = [];
  sim.outcome = null;
  for (const m of sim.members) m.style = null;
  markPeriodStart(sim);
  sim.phase = 'style';
}

export function finalScore(sim: Sim) {
  const total = sim.score.business + sim.score.people + sim.score.leadership + sim.score.bonus;
  const share = total / RUN_MAX;
  const t = sim.config.tiers;
  const tier = share >= t.platinum ? 'platinum' : share >= t.gold ? 'gold' : share >= t.silver ? 'silver' : 'bronze';
  return { total, share, tier };
}

export { perPeriod };
