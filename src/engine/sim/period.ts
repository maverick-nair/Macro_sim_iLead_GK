import type { Rng } from './rng';
import { IntentError } from './actions';
import { upcomingNews } from './events';
import { sponsorLevel } from './view';
import { advanceStreak, checkBadges, leadershipScore, nextStreakBonus, pulse, roundHalfUp, tierFor, weekScore } from './score';
import { addMessage, idealThroughput, log, markPeriodStart, perPeriod, runRemaining, sponsorChange, teamAverage, trustChange, firstName } from './sim';
import type { Change, PeriodSummary, Sim } from './types';

/** Period end, gamification and the move to the next period (docs/SIMULATION.md section 7). */

export function endPeriod(sim: Sim, rng: Rng): PeriodSummary {
  if (sim.phase !== 'board') throw new IntentError('The period can only end from the board', 'wrongPhase');
  // Conversations left open when the period ends are closed unfinished: they never score later.
  for (const [id, it] of Object.entries(sim.interactions)) {
    delete sim.interactions[id];
    log(sim, { kind: 'interaction', title: `${sim.config.actions.find(a => a.key === it.actionKey)?.name ?? 'Conversation'} left unfinished`, memberIds: it.memberIds, changes: [] });
  }
  runRemaining(sim, rng);
  drift(sim);
  const g = sim.config.gamification;
  const count = sim.config.time.period.count;
  const target = sim.config.money.target;
  const valueIdeal = target / count;
  const pace = sim.funnel.value / (valueIdeal * sim.period);

  // Week score, stars and streak (scoring-and-report.md 6).
  const week = weekScore(sim);
  const streakBonus = advanceStreak(sim, week.stars);

  // Sponsor confidence: the period's revenue against its share of the target.
  const sFrom = sim.sponsorAtStart;
  const unit = sim.config.time.period.unit;
  const onPace = sim.funnel.periodValue >= valueIdeal;
  const paceChanges = sponsorChange(sim, onPace ? g.sponsor.periodPace.met : g.sponsor.periodPace.missed, onPace ? `Revenue on pace this ${unit}` : `Revenue behind pace this ${unit}`);
  if (paceChanges.length) log(sim, { kind: 'periodEnd', title: onPace ? `Revenue on pace this ${unit}` : `Revenue behind pace this ${unit}`, memberIds: [], changes: paceChanges });
  // Crossing the unlock line upward offers one reward; dropping below the check in line costs a day next period.
  // No unlock at the last period end: there is no next period to use it in.
  const unlockOffer = sim.period < count && sFrom < g.sponsor.unlockAt && sim.sponsor.value >= g.sponsor.unlockAt ? [...g.unlocks] : null;
  sim.pendingReward = unlockOffer;
  const checkIn = sFrom >= g.sponsor.checkInBelow && sim.sponsor.value < g.sponsor.checkInBelow && sim.period < count;
  if (checkIn) {
    sim.checkInPeriod = sim.period + 1;
    const first = sim.config.sponsor.name.split(' ')[0];
    addMessage(sim, { from: 'sponsor', kind: 'news', title: 'CEO check in', body: `${first}'s confidence has dropped. The CEO wants a check in, which takes a ${sim.config.time.subPeriod.unit} of your time next ${unit}.`, dueIn: null, urgent: true });
  }

  // Role change requests ignored through the period cost trust (6.4).
  for (const m of sim.members) {
    if (m.roleChangeRequestedPeriod !== null && m.roleChangeRequestedPeriod < sim.period && m.reassignedInPeriod !== sim.period) {
      trustChange(m, sim.config.triggers.find(t => t.kind === 'roleChangeRequest')?.params.ignoredTrust ?? -4, { label: 'Request ignored', cause: `${firstName(sim, m.id)} asked to change roles and nothing happened.`, rule: 'Ignoring a role change request lowers trust.', evidence: [] });
      m.roleChangeRequestedPeriod = null;
    }
    m.periodEnds.push({ result: m.result, morale: m.morale, trust: m.trust });
  }

  checkBadges(sim, 'periodEnd');
  if (sim.period >= count) checkBadges(sim, 'runEnd');
  const newBadges = sim.badges.filter(b => b.period === sim.period).map(b => ({ key: b.key, reason: b.reason }));

  const kpis = Object.fromEntries((['skill', 'morale', 'result', 'trust'] as const).map(k => [k, { start: sim.periodStart.kpis[k], end: teamAverage(sim, k) }])) as PeriodSummary['kpis'];
  const ideal = idealThroughput(sim);
  const cumulativeIdeal = sim.config.stages.map((_, i) => ideal[i] + sim.periods.reduce((acc, p) => acc + p.funnel[i].ideal, 0));
  const funnel = sim.config.stages.map((st, i) => ({ stage: st.key, throughput: sim.funnel.stageOutPeriod[i], ideal: ideal[i], cumulative: sim.funnel.stageOut[i], cumulativeIdeal: cumulativeIdeal[i] }));
  const ratios = funnel.map(f => (f.ideal > 0 ? f.throughput / f.ideal : 1));
  const worst = ratios.indexOf(Math.min(...ratios));
  const bottleneck = ratios[worst] < 1 ? funnel[worst].stage : null;
  const story = storyOf(sim, week, kpis, pace, bottleneck);
  const summary: PeriodSummary = {
    period: sim.period, headline: story.headline, line: story.line, week, kpis,
    valueThisPeriod: sim.funnel.periodValue, valueIdeal, cumulativeValue: sim.funnel.value, pace,
    streak: { count: sim.streak, bonus: streakBonus, total: sim.streakBonus, next: nextStreakBonus(sim) },
    newBadges, sponsor: { from: sFrom, to: sim.sponsor.value, fromLevel: sponsorLevel(sim, sFrom), toLevel: sponsorLevel(sim) },
    pulse: { from: roundHalfUp(sim.pulseAtStart), to: roundHalfUp(pulse(sim)) },
    funnel, bottleneck, unlockOffer, checkIn, news: sim.period < count ? upcomingNews(sim) : []
  };
  sim.periods.push(summary);
  log(sim, { kind: 'periodEnd', title: `End of ${unit} ${sim.period}`, memberIds: [], changes: [] });
  sim.phase = sim.period >= count ? 'ended' : 'periodEnd';
  return summary;
}

/**
 * The week end banner, worded from what happened: someone who bounced back, else the stars; then one
 * sentence on people and one on the business (D60: engine text is server content).
 */
function storyOf(sim: Sim, week: PeriodSummary['week'], kpis: PeriodSummary['kpis'], pace: number, bottleneck: string | null) {
  const unit = sim.config.time.period.unit;
  const start = new Map(sim.members.map(m => [m.id, m.periodEnds.length > 1 ? m.periodEnds[m.periodEnds.length - 2].morale : sim.config.members.find(p => p.id === m.id)?.start.morale ?? m.morale]));
  const back = sim.members.map(m => ({ m, gain: m.morale - (start.get(m.id) ?? m.morale) })).filter(x => x.gain >= 8 && (start.get(x.m.id) ?? 100) < 50).sort((a, b) => b.gain - a.gain)[0];
  const headline = back ? `${firstName(sim, back.m.id)} is back in the game.`
    : week.stars === 3 ? `A ${unit} to remember.`
    : week.stars === 2 ? `A solid ${unit}.`
    : week.stars === 1 ? `A mixed ${unit}.`
    : `A hard ${unit}.`;
  const people = week.styleFit.total
    ? `You gave ${week.styleFit.correct} of ${week.styleFit.total} people the style they needed${kpis.morale.end > kpis.morale.start ? ', and team morale rose' : kpis.morale.end < kpis.morale.start ? ', but team morale slipped' : ''}.`
    : '';
  const stage = bottleneck ? sim.config.stages.find(s => s.key === bottleneck)?.name ?? bottleneck : null;
  const business = pace >= 1
    ? `Revenue is on pace${stage ? `; ${stage} is the stage to watch next ${unit}` : ''}.`
    : `Revenue is behind pace${stage ? `, so next ${unit} is about ${stage}` : ''}.`;
  return { headline, line: [people, business].filter(Boolean).join(' ') };
}

/** Applies a chosen unlock reward (Configuration Spec, Unlock rewards). */
export function chooseReward(sim: Sim, key: string) {
  if (!sim.pendingReward?.includes(key)) throw new IntentError('No such reward on offer', 'noReward');
  sim.pendingReward = null;
  if (key === 'bonus_day') sim.bonusPeriod = sim.period + 1;
  if (key === 'hire_budget') sim.hireBudget = true;
  if (key === 'team_activity') sim.freeTeamActivity = true;
  log(sim, { kind: 'periodEnd', title: `Reward taken: ${REWARD_NAMES[key] ?? key}`, memberIds: [], changes: [] });
}

const REWARD_NAMES: Record<string, string> = { bonus_day: 'a bonus day', hire_budget: 'extra hire budget', team_activity: 'a team activity without cooldown' };

export function startNextPeriod(sim: Sim) {
  if (sim.phase !== 'periodEnd') throw new IntentError('The period has not ended', 'wrongPhase');
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
  const score = leadershipScore(sim);
  return { ...score, tier: tierFor(sim, score.total) };
}

export { perPeriod };

/**
 * Weekly drift (Configuration Spec, Targets and KPIs): anyone nobody acted with this period loses a
 * little morale and result. Team wide actions count for everyone; weekly style setting does not.
 */
function drift(sim: Sim) {
  const { morale, result } = sim.config.drift;
  if (!morale && !result) return;
  if (sim.touchedTeam) return;
  const touched = new Set(sim.touched);
  const unit = sim.config.time.period.unit;
  const changes: Change[] = [];
  for (const m of sim.members) {
    if (touched.has(m.id) || m.away > 0) continue;
    const reason = { label: 'Left alone', cause: `Nobody spent time with ${firstName(sim, m.id)} this ${unit}.`, rule: `Without any attention, people lose ${morale} morale${result ? ` and ${result} result` : ''} a ${unit}.`, evidence: [] };
    for (const [k, by] of [['morale', morale], ['result', result]] as const) {
      if (!by) continue;
      const from = m[k], to = Math.max(0, from - by);
      if (to !== from) { m[k] = to; changes.push({ subject: m.id, metric: k, from, to, delta: to - from, reason }); }
    }
  }
  if (changes.length) log(sim, { kind: 'periodEnd', title: 'Some people were left alone', memberIds: [...new Set(changes.map(c => c.subject))], changes });
}
