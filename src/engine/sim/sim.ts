import type { StorylineConfig } from '../config';
import type { Rng } from './rng';
import { applyEffect, applyTrust, clamp, mismatchType, neededStyle, styleDifference, type Mismatch, type Style, type Triple } from './rules';
import { runEvents, scheduleEvents } from './events';
import { checkBadges } from './score';
import type { Change, InboxMessage, LogEntry, MemberSim, MetricKey, Reason, Sim } from './types';

/**
 * Simulation state and the passage of time: funnel, scheduled events, triggers, promises and
 * messages (docs/SIMULATION.md sections 2, 3 and 6). Mutates the Sim it is given; the engine
 * wraps it so callers only see snapshots.
 */

export function createSim(config: StorylineConfig, seed: number): Sim {
  const high = config.thresholds.high;
  const members: MemberSim[] = config.members.map(p => ({
    id: p.id, stage: p.homeStage, ...p.start, trust: p.start.trust ?? config.trustRules.start, trustCap: config.trustRules.capPerSubPeriod, trustMovedThisSub: 0,
    style: null, lastStyle: null, lastReaction: null, neededAtStart: neededStyle(p.start, high),
    away: 0, awayReason: null, resultHistory: [], periodEnds: [], stageSincePeriod: 1,
    revealed: false, concernShared: false, lastChange: 0, recognizedAt: null, reassignedInPeriod: null,
    trainedInPeriod: null, assessedStages: [], assessments: {}, neededPrevStart: null, awaySetAt: -1, trainingRequestedPeriod: null, roleChangeRequestedPeriod: null, lowestResult: p.start.result, lowestMorale: p.start.morale
  }));
  const sim: Sim = {
    config, seed, period: 1, sub: 0, spent: 0, bonusPeriod: null, absSub: 0, phase: 'style', members, departed: [],
    candidates: config.candidates.map(c => c.id), availableAt: {},
    funnel: { conversions: 0, value: 0, periodValue: 0, stageOut: config.stages.map(() => 0), stageOutPeriod: config.stages.map(() => 0) },
    decisions: { period: [], run: [] }, styleUses: { D: 0, G: 0, P: 0, E: 0 },
    periods: [], streak: 0, streakBonus: 0, badges: [],
    sponsor: { value: config.gamification.sponsor.start, causes: [] }, pendingReward: null, promises: [], inbox: [], cards: [],
    runStart: { morale: 0, trust: 0 }, liveRecords: [], fairRecognitions: 0, hireBudget: false, freeTeamActivity: false, checkInPeriod: null,
    events: { schedule: {}, fired: [], pending: [] }, pulseAtStart: 0,
    triggerCount: {}, log: [], outcome: null, liveCount: 0, voicePeriods: {},
    periodStart: { morale: 0, kpis: { skill: 0, morale: 0, result: 0, trust: 0 } }, seq: 0, interactions: {}, liveTaken: {}, intentGaps: {}, touched: [], touchedTeam: false, sponsorAtStart: config.gamification.sponsor.start
  };
  sim.events.schedule = scheduleEvents(sim);
  markPeriodStart(sim);
  sim.runStart = { morale: sim.periodStart.kpis.morale, trust: sim.periodStart.kpis.trust };
  return sim;
}

export const perPeriod = (sim: Sim) => sim.config.time.subPeriod.perPeriod;
export const totalSubs = (sim: Sim) => perPeriod(sim) * sim.config.time.period.count;
/** Share of the run completed, 0 to 1. */
export const runFraction = (sim: Sim) => sim.absSub / totalSubs(sim);
/** Sub-periods of time this period: one more after a bonus day, one less after a CEO check in. */
export const capacity = (sim: Sim) => perPeriod(sim) + (sim.bonusPeriod === sim.period ? 1 : 0) - (sim.checkInPeriod === sim.period ? 1 : 0);
export const capacityLeft = (sim: Sim) => Math.max(0, capacity(sim) - sim.spent);
export const nextId = (sim: Sim, prefix: string) => `${prefix}${++sim.seq}`;
export const present = (sim: Sim) => sim.members;
export const available = (sim: Sim) => sim.members.filter(m => m.away === 0);
export const member = (sim: Sim, id: string) => sim.members.find(m => m.id === id);
export const person = (sim: Sim, id: string) => sim.config.members.find(p => p.id === id) ?? sim.config.candidates.find(p => p.id === id)!;
export const firstName = (sim: Sim, id: string) => person(sim, id).name.split(' ')[0];
export const pronoun = (sim: Sim, id: string) => person(sim, id).pronoun;
export const stageName = (sim: Sim, key: string) => sim.config.stages.find(s => s.key === key)?.name ?? key;
export const needed = (sim: Sim, m: MemberSim) => neededStyle(m, sim.config.thresholds.high);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Team averages count the people who are available (Configuration Spec dials); everyone, if nobody is. */
export const teamAverage = (sim: Sim, k: MetricKey) => {
  const here = sim.members.filter(m => m.away === 0);
  return Math.round(avg((here.length ? here : sim.members).map(m => m[k])));
};

/** Options for mismatchType from the storyline's trust rules (D30, D49). */
export const misread = (sim: Sim, m: MemberSim) => ({ trust: m.trust, lowTrust: sim.config.trustRules.lowTrust.below, lowTrustChance: sim.config.trustRules.lowTrust.chance });

export const STYLE_NAMES: Record<Style, string> = { D: 'Directing', G: 'Guiding', P: 'Partnering', E: 'Entrusting' };
const METRIC_NAMES: Record<MetricKey, string> = { skill: 'skill', morale: 'morale', result: 'result', trust: 'trust' };

/** Fills a storyline template: {name}, {stage}. */
export function fill(text: string, sim: Sim, memberId: string | null): string {
  if (!memberId) return text;
  const m = member(sim, memberId);
  return text.replace(/\{name\}/g, firstName(sim, memberId)).replace(/\{stage\}/g, m ? stageName(sim, m.stage) : '');
}

export function gendered(body: { he: string; she: string; they?: string }, sim: Sim, memberId: string | null) {
  const p = memberId ? pronoun(sim, memberId) : 'he';
  return fill(p === 'she' ? body.she : p === 'they' ? body.they ?? body.he : body.he, sim, memberId);
}

/** Applies a skill, morale, result change to a member and returns the reasoned changes. */
export function effectChanges(sim: Sim, rng: Rng, m: MemberSim, effect: Triple, reason: Reason, opts: { boost?: number; scale?: number; useTrust?: boolean } = {}): Change[] {
  const before = { skill: m.skill, morale: m.morale, result: m.result };
  const applied = applyEffect(m, effect, rng, { trust: opts.useTrust === false ? undefined : m.trust, multiplier: sim.config.trustRules.multiplier, boost: opts.boost, scale: opts.scale });
  const out: Change[] = [];
  (['skill', 'morale', 'result'] as const).forEach((k, i) => {
    if (applied[i] !== 0) out.push({ subject: m.id, metric: k, from: before[k], to: m[k], delta: applied[i], reason });
  });
  m.lastChange = applied[1] + applied[2];
  if (applied[1] + applied[2] !== 0) m.lastReaction = applied[1] + applied[2] > 0 ? 'pos' : 'neg';
  m.lowestResult = Math.min(m.lowestResult, m.result);
  m.lowestMorale = Math.min(m.lowestMorale, m.morale);
  return out;
}

export function trustChange(m: MemberSim, delta: number, reason: Reason): Change[] {
  const from = m.trust;
  const d = applyTrust(m, delta, m.trustCap);
  return d === 0 ? [] : [{ subject: m.id, metric: 'trust', from, to: m.trust, delta: d, reason }];
}

/** The sponsor meter's rule in words, from the authored numbers (scoring-and-report.md 6). */
function sponsorRule(sim: Sim) {
  const s = sim.config.gamification.sponsor, f = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`), unit = sim.config.time.period.unit;
  return `Sponsor confidence moves with briefings (${f(s.briefing.strong)}, ${f(s.briefing.adequate)}, ${f(s.briefing.weak)} or ${f(s.briefing.harmful)} by how they land), revenue against each ${unit}'s share of the target (${f(s.periodPace.met)} or ${f(s.periodPace.missed)}) and escalations (${f(s.escalation)}).`;
}

export function sponsorChange(sim: Sim, delta: number, text: string): Change[] {
  const from = sim.sponsor.value;
  sim.sponsor.value = clamp(from + delta);
  const d = sim.sponsor.value - from;
  if (d === 0) return [];
  sim.sponsor.causes = [{ text, delta: d }, ...sim.sponsor.causes].slice(0, 3);
  return [{ subject: 'sponsor', metric: 'confidence', from, to: sim.sponsor.value, delta: d, reason: { label: text, cause: text, rule: sponsorRule(sim), evidence: [] } }];
}

export function log(sim: Sim, entry: Omit<LogEntry, 'id' | 'period' | 'sub'>) {
  sim.log.push({ id: nextId(sim, 'l'), period: sim.period, sub: sim.sub, ...entry });
}

export function record(sim: Sim, m: MemberSim, chosen: Style, source: string): Mismatch {
  const n = needed(sim, m);
  const d = { memberId: m.id, chosen, needed: n, mismatch: styleDifference(chosen, n), source };
  sim.decisions.period.push(d);
  sim.decisions.run.push(d);
  sim.styleUses[chosen]++;
  return d.mismatch;
}

function markPeriodStart(sim: Sim) {
  scheduleBriefing(sim);
  sim.periodStart = {
    morale: teamAverage(sim, 'morale'),
    kpis: { skill: teamAverage(sim, 'skill'), morale: teamAverage(sim, 'morale'), result: teamAverage(sim, 'result'), trust: teamAverage(sim, 'trust') }
  };
  for (const m of sim.members) { m.neededPrevStart = sim.period > 1 ? m.neededAtStart : null; m.neededAtStart = needed(sim, m); }
  sim.touched = [];
  sim.touchedTeam = false;
  sim.sponsorAtStart = sim.sponsor.value;
  sim.pulseAtStart = (sim.periodStart.kpis.morale + sim.periodStart.kpis.trust) / 2;
}

export { markPeriodStart };

// ---------------------------------------------------------------- time

/** Spends capacity; every whole sub-period crossed runs (6.1). */
export function spend(sim: Sim, rng: Rng, cost: number) {
  sim.spent += cost;
  while (Math.floor(sim.spent + 1e-9) > sim.sub && sim.sub < perPeriod(sim)) runSubPeriod(sim, rng);
}

/** Runs the rest of the period's sub-periods. */
export function runRemaining(sim: Sim, rng: Rng) {
  while (sim.sub < perPeriod(sim)) runSubPeriod(sim, rng);
}

export function runSubPeriod(sim: Sim, rng: Rng) {
  for (const m of sim.members) m.trustMovedThisSub = 0;
  sim.sub += 1;
  sim.absSub += 1;
  if (sim.sub === 1) triggersAtPeriodStart(sim, rng);
  runFunnel(sim);
  checkBadges(sim, 'conversion');
  runEvents(sim, rng);
  triggersEverySub(sim, rng);
  dueChecks(sim);
  for (const m of sim.members) {
    if (m.away > 0 && m.awaySetAt !== sim.absSub && --m.away === 0) m.awayReason = null;
    m.resultHistory.push(m.result);
    m.lowestResult = Math.min(m.lowestResult, m.result);
  }
}

/** Funnel step (Model doc, section 6). */
export function runFunnel(sim: Sim) {
  const { stages, money, performanceThreshold } = sim.config;
  let input = money.inputPerSubPeriod[Math.min(sim.period, money.inputPerSubPeriod.length) - 1];
  stages.forEach((st, i) => {
    const inStage = sim.members.filter(m => m.stage === st.key);
    const average = inStage.length ? avg(inStage.map(m => (m.away > 0 ? 0 : m.result))) : 0;
    // Model doc formula, normalized so a stage never beats its conversion ratio (DECISIONS D36).
    const out = Math.max(0, input * st.conversionRatio * (average + performanceThreshold) / (100 + performanceThreshold));
    sim.funnel.stageOut[i] += out;
    sim.funnel.stageOutPeriod[i] += out;
    input = out;
  });
  sim.funnel.conversions += input;
  const value = input * money.valuePerConversion;
  sim.funnel.value += value;
  sim.funnel.periodValue += value;
}

/** Ideal throughput per stage for the period: everyone in the funnel performing at the High threshold. */
export function idealThroughput(sim: Sim): number[] {
  const { stages, money, performanceThreshold, thresholds } = sim.config;
  let input = money.inputPerSubPeriod[Math.min(sim.period, money.inputPerSubPeriod.length) - 1] * perPeriod(sim);
  return stages.map(st => (input = input * st.conversionRatio * (thresholds.high + performanceThreshold) / (100 + performanceThreshold)));
}

// ---------------------------------------------------------------- events (6.3)

// ---------------------------------------------------------------- triggers (6.4)

const fired = (sim: Sim, kind: string) => sim.triggerCount[kind] ?? 0;

function trigger(sim: Sim, kind: string) {
  return sim.config.triggers.find(t => t.kind === kind && fired(sim, kind) < t.maxTimes);
}

function fire(sim: Sim, rng: Rng, kind: string, m: MemberSim, extra: { away?: number; leave?: boolean; message?: boolean } = {}) {
  const t = trigger(sim, kind)!;
  sim.triggerCount[kind] = fired(sim, kind) + 1;
  const text = gendered(t.message, sim, m.id);
  const reason: Reason = { label: TRIGGER_LABELS[kind] ?? kind, cause: text, rule: TRIGGER_RULES[kind] ?? '', evidence: [{ quote: text, by: person(sim, m.id).name.split(' ')[0], judgedByAI: false }] };
  const changes = t.impact.some(v => v !== 0) ? effectChanges(sim, rng, m, t.impact, reason, { useTrust: false }) : [];
  if (extra.away) { m.away = extra.away; m.awayReason = 'leave'; m.awaySetAt = sim.absSub; }
  if (extra.leave) {
    sim.members = sim.members.filter(x => x !== m);
    sim.departed.push(m);
  }
  if (extra.message !== false) addMessage(sim, { from: m.id, kind: 'chat', title: reason.label, body: text, dueIn: 2, urgent: kind === 'resignation' || kind === 'complains' });
  log(sim, { kind: 'trigger', title: reason.label, memberIds: [m.id], changes });
}

const TRIGGER_LABELS: Record<string, string> = {
  casualLeave: 'Casual leave', medicalLeave: 'Medical leave', clueless: 'Clueless in a new role', demoralized: 'Demoralized',
  lackOfTraining: 'Lack of training', moraleDrops: 'Morale drops', resignation: 'Resignation', roleChangeRequest: 'Role change request',
  complains: 'Team member complains', trainingRequest: 'Training request'
};
const TRIGGER_RULES: Record<string, string> = {
  clueless: 'Moving someone to a new role without training costs them skill.',
  lackOfTraining: 'A long slide in result with no training lowers skill, morale and result.',
  moraleDrops: 'Strong performers who go unrecognized for a while lose morale.',
  resignation: 'People leave when result collapses, or when trust and morale are both very low.',
  roleChangeRequest: 'People who stay in one role a long time ask to move. Ignoring it costs trust.',
  complains: 'A falling result or low trust over time leads to a complaint.'
};

const periodsFor = (sim: Sim, fraction: number) => Math.max(1, Math.round(fraction * sim.config.time.period.count));
const decliningPeriods = (m: MemberSim, n: number) => {
  const ends = m.periodEnds.map(e => e.result);
  if (ends.length < n + 1) return false;
  const tail = ends.slice(-(n + 1));
  return tail.every((v, i) => i === 0 || v < tail[i - 1]);
};

function triggersAtPeriodStart(sim: Sim, rng: Rng) {
  const p = (kind: string, key: string, dflt: number) => (sim.config.triggers.find(t => t.kind === kind)?.params[key] ?? dflt);
  const count = sim.config.time.period.count;

  // Casual leave around 3/8, 5/8 and 7/8 of the run, first sub-period.
  if (trigger(sim, 'casualLeave') && [3, 5, 7].map(x => Math.round(x * count / 8)).includes(sim.period)) {
    const m = sim.members.find(x => x.result > p('casualLeave', 'resultAbove', 70) && x.away === 0 && sim.members.some(o => o !== x && o.stage === x.stage));
    if (m) fire(sim, rng, 'casualLeave', m, { away: p('casualLeave', 'away', 5) });
  }
  // Clueless: reassigned last period and not trained since.
  if (trigger(sim, 'clueless')) {
    const m = sim.members.find(x => x.reassignedInPeriod === sim.period - 1 && (x.trainedInPeriod ?? 0) < sim.period - 1);
    if (m) fire(sim, rng, 'clueless', m);
  }
  // Demoralized: result under 20 after 30% of the run.
  if (trigger(sim, 'demoralized') && runFraction(sim) >= p('demoralized', 'fromFraction', 0.3)) {
    const m = sim.members.find(x => x.result < p('demoralized', 'resultBelow', 20));
    if (m) fire(sim, rng, 'demoralized', m);
  }
  // Lack of training: result falling for half the run's periods.
  if (trigger(sim, 'lackOfTraining')) {
    const n = periodsFor(sim, p('lackOfTraining', 'decliningFraction', 0.5));
    const m = sim.members.find(x => decliningPeriods(x, n));
    if (m) fire(sim, rng, 'lackOfTraining', m);
  }
  // Morale drops: result over 60 for a quarter of the run with no recognition.
  if (trigger(sim, 'moraleDrops')) {
    const n = periodsFor(sim, p('moraleDrops', 'sustainedFraction', 0.25));
    const since = sim.absSub - n * perPeriod(sim);
    const m = sim.members.find(x => x.periodEnds.length >= n && x.periodEnds.slice(-n).every(e => e.result > p('moraleDrops', 'resultAbove', 60)) && (x.recognizedAt === null || x.recognizedAt < since));
    if (m) fire(sim, rng, 'moraleDrops', m);
  }
  // Role change request: same stage for a third of the run. Ignoring it costs trust (checked at period end).
  if (trigger(sim, 'roleChangeRequest')) {
    const n = periodsFor(sim, p('roleChangeRequest', 'sameStageFraction', 0.33));
    const m = sim.members.find(x => sim.period - x.stageSincePeriod >= n && x.roleChangeRequestedPeriod === null);
    if (m) { m.roleChangeRequestedPeriod = sim.period; fire(sim, rng, 'roleChangeRequest', m); }
  }
  // Complaint: result falling for a quarter of the run, or trust under 25 for two periods.
  if (trigger(sim, 'complains')) {
    const n = periodsFor(sim, p('complains', 'decliningFraction', 0.25));
    const tb = p('complains', 'trustBelow', 25);
    const m = sim.members.find(x => decliningPeriods(x, n) || (x.periodEnds.length >= 2 && x.periodEnds.slice(-2).every(e => e.trust < tb)));
    if (m) fire(sim, rng, 'complains', m);
  }
  // Training request: someone below the skill midpoint asks, in roughly every third period.
  if (trigger(sim, 'trainingRequest') && sim.period > 1 && sim.period % 3 === 0) {
    const m = sim.members.filter(x => x.skill < sim.config.thresholds.amber && x.away === 0).sort((a, b) => a.skill - b.skill)[0];
    if (m) { m.trainingRequestedPeriod = sim.period; fire(sim, rng, 'trainingRequest', m); }
  }
  // Medical leave around a quarter, half and three quarters of the run, second sub-period handled in everySub.
}

function triggersEverySub(sim: Sim, rng: Rng) {
  const p = (kind: string, key: string, dflt: number) => (sim.config.triggers.find(t => t.kind === kind)?.params[key] ?? dflt);
  const count = sim.config.time.period.count;
  if (trigger(sim, 'medicalLeave') && sim.sub === 2 && [0.25, 0.5, 0.75].map(f => Math.max(1, Math.round(f * count))).includes(sim.period)) {
    const m = sim.members.find(x => x.result > p('medicalLeave', 'resultAbove', 70) && x.away === 0);
    if (m) fire(sim, rng, 'medicalLeave', m, { away: p('medicalLeave', 'away', 2) });
  }
  if (trigger(sim, 'resignation') && runFraction(sim) >= p('resignation', 'fromFraction', 0.2)) {
    const m = sim.members.find(x => x.result < p('resignation', 'resultBelow', 10) || (x.trust < p('resignation', 'trustBelow', 15) && x.morale < p('resignation', 'moraleBelow', 20)));
    if (m && sim.members.length > 1) fire(sim, rng, 'resignation', m, { leave: true });
  }
}

// ---------------------------------------------------------------- messages and promises

/** Briefing periods: as authored, or the mid point and the last period (Design doc: weeks 4 and 8 of 8). */
export function briefingPeriods(sim: Sim): number[] {
  const count = sim.config.time.period.count;
  const set = sim.config.sponsor.briefings ?? (count < 2 ? [count] : [Math.ceil(count / 2), count]);
  return set.filter(n => n <= count);
}

/** A sponsor briefing opens in the briefing periods, due by the end of that period. */
function scheduleBriefing(sim: Sim) {
  if (!briefingPeriods(sim).includes(sim.period)) return;
  if (sim.inbox.some(m => m.briefing && m.atAbsSub === sim.absSub)) return;
  const first = sim.config.sponsor.name.split(' ')[0];
  addMessage(sim, { from: 'sponsor', kind: 'sponsor', title: `Briefing with ${first}`, body: `${first} wants your update on the team and the target this ${sim.config.time.period.unit}.`, dueIn: perPeriod(sim) - 1, urgent: true });
  sim.inbox[sim.inbox.length - 1].briefing = true;
}

export function addMessage(sim: Sim, msg: { from: string; kind: InboxMessage['kind']; title: string; body: string; dueIn: number | null; urgent?: boolean }) {
  sim.inbox.push({ id: nextId(sim, 'm'), from: msg.from, kind: msg.kind, title: msg.title, body: msg.body, atAbsSub: sim.absSub,
    dueAbsSub: msg.dueIn === null ? null : sim.absSub + msg.dueIn, urgent: !!msg.urgent, state: 'open' });
}

/** Unanswered messages past due cost trust (3.1); promises past due are broken (5.4). */
function dueChecks(sim: Sim) {
  for (const msg of sim.inbox) {
    if (msg.state !== 'open' || msg.dueAbsSub === null || sim.absSub <= msg.dueAbsSub) continue;
    msg.state = 'expired';
    const m = member(sim, msg.from);
    if (m) {
      const changes = trustChange(m, -5, { label: 'No reply', cause: `${firstName(sim, m.id)} did not hear back from you in time.`, rule: 'A message left unanswered past its due day lowers trust by 5.', evidence: [] });
      log(sim, { kind: 'trigger', title: 'Message went unanswered', memberIds: [m.id], changes });
    } else if (msg.briefing) {
      // A skipped briefing escalates (Design doc: issue escalated to the CEO, −10).
      log(sim, { kind: 'trigger', title: 'Sponsor briefing missed', memberIds: [], changes: sponsorChange(sim, sim.config.gamification.sponsor.escalation, 'Missed the sponsor briefing') });
    } else if (msg.from === 'sponsor') {
      log(sim, { kind: 'trigger', title: 'Sponsor message unanswered', memberIds: [], changes: sponsorChange(sim, -5, 'No reply yet to the sponsor') });
    }
  }
  for (const pr of sim.promises) {
    if (pr.state !== 'open' || sim.absSub <= pr.dueAbsSub) continue;
    pr.state = 'broken';
    const m = member(sim, pr.memberId);
    if (m) {
      const changes = trustChange(m, -8, { label: 'Promise broken', cause: `You told ${firstName(sim, m.id)}: "${pr.text}", and it did not happen in time.`, rule: 'A broken promise lowers trust by 8.', evidence: [{ quote: pr.text, by: 'You', judgedByAI: true }] });
      log(sim, { kind: 'trigger', title: 'Promise broken', memberIds: [m.id], changes });
    }
  }
}

/** Keeps any open promise that this action with this member fulfils (5.4). */
export function keepPromises(sim: Sim, actionKey: string, memberIds: string[]): Change[] {
  const out: Change[] = [];
  for (const pr of sim.promises) {
    if (pr.state !== 'open' || !memberIds.includes(pr.memberId) || !pr.fulfilledBy.includes(actionKey)) continue;
    pr.state = 'kept';
    const m = member(sim, pr.memberId);
    if (m) out.push(...trustChange(m, 6, { label: 'Promise kept', cause: `You did what you told ${firstName(sim, m.id)} you would: "${pr.text}".`, rule: 'Keeping a promise by its due day raises trust by 6.', evidence: [{ quote: pr.text, by: 'You', judgedByAI: true }] }));
  }
  return out;
}

export const metricName = (k: MetricKey) => METRIC_NAMES[k];
