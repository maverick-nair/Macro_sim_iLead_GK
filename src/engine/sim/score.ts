import { firstName, idealThroughput, teamAverage } from './sim';
import type { Band, Sim } from './types';
import { msg, type Msg } from '../copy';

/**
 * Game scores on the GenieKreator formulas (docs/genie/scoring-and-report.md section 6). Every input is
 * authored in `config.gamification`; the formulas are engine behaviour. Skill ratings never come from here.
 */

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
/** Display rounding: half up (scoring-and-report.md 1.5). */
export const roundHalfUp = (n: number) => Math.floor(n + 0.5);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const bandScore = (sim: Sim, band: Band) => sim.config.gamification.liveBandScores[band];

/** Contextual capability %: style tagged choices that matched what the person needed, whole run. */
export function capability(sim: Sim) {
  const all = sim.decisions.run;
  return all.length ? (100 * all.filter(d => d.mismatch === 0).length) / all.length : 0;
}

/**
 * Mean band score of the run's live interactions, or null when there were none. Choices the participant made
 * count as well, each at the mean of its leadership read (D137); a choice with no read, or left to its default, does not.
 */
export function liveMean(sim: Sim, period?: number) {
  const recs = period === undefined ? sim.liveRecords : sim.liveRecords.filter(r => r.period === period);
  const reads = sim.choices.filter(c => c.by === 'you' && c.read.length && (period === undefined || c.period === period)).map(c => mean(c.read.map(x => bandScore(sim, x.band))));
  // Static stakeholder decisions with a leadership read count the same way (D164).
  const shReads = (sim.stakeholderRecords ?? []).filter(r => r.read.length && (period === undefined || r.period === period)).map(r => mean(r.read.map(x => bandScore(sim, x.band))));
  const all = [...recs.map(r => bandScore(sim, r.band)), ...reads, ...shReads];
  return all.length ? mean(all) : null;
}

/**
 * A business variable's score, 0 to 100 (D136): where it sits in its range, the top of the range best (or the
 * bottom, for a variable where less is better).
 */
export function variableScore(sim: Sim, key: string) {
  const v = sim.config.variables.find(x => x.key === key);
  if (!v) return 0;
  const pos = 100 * ((sim.vars[key] ?? v.start) - v.min) / (v.max - v.min);
  return clamp(v.higherIsBetter ? pos : 100 - pos);
}

/** The Business pillar (D136): revenue against the target, with each weighted variable taking its share. */
export function businessPillar(sim: Sim) {
  const revenue = clamp((100 * sim.funnel.value) / sim.config.money.target);
  const weighted = sim.config.variables.filter(v => v.weight > 0);
  if (!weighted.length) return revenue;
  const w = weighted.reduce((a, v) => a + v.weight, 0);
  return clamp((1 - w) * revenue + weighted.reduce((a, v) => a + v.weight * variableScore(sim, v.key), 0));
}

export const pulse = (sim: Sim) => (teamAverage(sim, 'morale') + teamAverage(sim, 'trust')) / 2;

/** The three pillars, 0 to 100 each. */
export function pillars(sim: Sim) {
  const business = businessPillar(sim);
  const people = clamp(50 + (teamAverage(sim, 'morale') - sim.runStart.morale) + 0.5 * (teamAverage(sim, 'trust') - sim.runStart.trust));
  const cap = capability(sim);
  const live = liveMean(sim);
  const leadership = live === null ? cap : 0.5 * cap + 0.5 * live;
  return { business, people, leadership, capability: cap, live };
}

/** Leadership Score: (scale − streak cap) / 100 × weighted pillars + streak bonus, 0 to scale. */
export function leadershipScore(sim: Sim) {
  const g = sim.config.gamification;
  const p = pillars(sim);
  const perPoint = (g.scale - g.streak.cap) / 100;
  const total = roundHalfUp(perPoint * (g.weights.business * p.business + g.weights.people * p.people + g.weights.leadership * p.leadership) + sim.streakBonus);
  return { ...p, total: clamp(total, 0, g.scale), bonus: sim.streakBonus, max: g.scale };
}

export function tierFor(sim: Sim, total: number) {
  return sim.config.gamification.tiers.find(t => total >= t.min) ?? sim.config.gamification.tiers[sim.config.gamification.tiers.length - 1];
}

/** The week score and its stars (scoring-and-report.md 6, Weekly stars). */
export function weekScore(sim: Sim) {
  const g = sim.config.gamification;
  const weekly = sim.decisions.period.filter(d => d.source === 'weeklyStyle');
  const correct = weekly.filter(d => d.mismatch === 0).length;
  const fitPct = weekly.length ? (100 * correct) / weekly.length : 0;
  const recs = sim.liveRecords.filter(r => r.period === sim.period);
  const live = recs.length ? { count: recs.length, mean: mean(recs.map(r => bandScore(sim, r.band))) } : null;
  const last = sim.config.stages.length - 1;
  const output = sim.funnel.stageOutPeriod[last];
  const ideal = idealThroughput(sim)[last];
  const funnelPct = ideal > 0 ? Math.min(100, (100 * output) / ideal) : 0;
  // With no live interaction, the live weight moves to style fit; the funnel part stays (DECISIONS D62).
  const score = live ? 0.5 * fitPct + 0.3 * live.mean + 0.2 * funnelPct : 0.8 * fitPct + 0.2 * funnelPct;
  const stars = g.stars.filter(t => score >= t).length;
  return { score: roundHalfUp(score), stars, styleFit: { correct, total: weekly.length, pct: roundHalfUp(fitPct) }, live: live && { count: live.count, mean: roundHalfUp(live.mean) }, funnel: { output, ideal, pct: roundHalfUp(funnelPct) } };
}

/** Advances the streak after a period with this many stars. Returns the bonus earned this period. */
export function advanceStreak(sim: Sim, stars: number) {
  const s = sim.config.gamification.streak;
  if (stars < s.minStars) { sim.streak = 0; return 0; }
  sim.streak += 1;
  if (sim.streak < s.length) return 0;
  const bonus = Math.max(0, Math.min(s.bonus, s.cap - sim.streakBonus));
  sim.streakBonus += bonus;
  return bonus;
}

/** Periods still needed for the next streak bonus, or null when the cap is reached. */
export function nextStreakBonus(sim: Sim) {
  const s = sim.config.gamification.streak;
  if (sim.streakBonus >= s.cap) return null;
  return Math.max(1, s.length - sim.streak);
}

// ---------------------------------------------------------------- badges (6.1)

export type BadgeMoment = 'conversion' | 'periodEnd' | 'interaction' | 'runEnd';

/** Awards every badge whose rule holds at this moment. Each badge is earned once. */
export function checkBadges(sim: Sim, moment: BadgeMoment) {
  const have = new Set(sim.badges.map(b => b.key));
  for (const b of sim.config.gamification.badges) {
    if (have.has(b.key)) continue;
    const reason = rule(sim, b.rule, moment);
    if (reason) sim.badges.push({ key: b.key, period: sim.period, reason });
  }
}

function rule(sim: Sim, r: string, moment: BadgeMoment): Msg | null {
  const unit = sim.config.time.period.unit;
  switch (r) {
    case 'first_close':
      return moment === 'conversion' && sim.funnel.conversions >= 1 ? msg('engine.badge.firstClose') : null;
    case 'read_the_room': {
      if (moment !== 'periodEnd') return null;
      const w = sim.decisions.period.filter(d => d.source === 'weeklyStyle');
      const ok = w.filter(d => d.mismatch === 0).length;
      return w.length && ok / w.length >= 0.9 ? msg('engine.badge.readTheRoom', { ok, total: w.length, unit }) : null;
    }
    case 'flex_master': {
      if (moment !== 'periodEnd') return null;
      // Every style of the lens (D70), each at the right moment at least twice.
      const counts: Record<string, number> = Object.fromEntries(sim.config.lens.styles.map(s => [s.key, 0]));
      for (const d of sim.decisions.run) if (d.mismatch === 0 && d.chosen in counts) counts[d.chosen]++;
      return Object.values(counts).every(n => n >= 2) ? msg('engine.badge.flexMaster') : null;
    }
    case 'concern_uncovered': {
      if (moment !== 'interaction') return null;
      const n = [...sim.members, ...sim.departed].filter(m => m.concernShared).length;
      const need = Math.min(5, sim.members.length);
      return n >= need ? msg('engine.badge.concern', { n }) : null;
    }
    case 'promise_keeper': {
      if (moment !== 'runEnd') return null;
      const made = sim.promises.filter(p => p.state !== 'open' || p.dueAbsSub <= sim.absSub);
      return made.length >= 3 && !made.some(p => p.state === 'broken') ? msg('engine.badge.promiseKeeper', { n: made.length }) : null;
    }
    case 'fair_hand':
      return moment === 'interaction' || moment === 'periodEnd' ? (sim.fairRecognitions >= 3 ? msg('engine.badge.fairHand') : null) : null;
    case 'turnaround': {
      if (moment !== 'periodEnd') return null;
      const m = sim.members.find(x => x.lowestMorale < 30 && x.morale > 60);
      return m ? msg('engine.badge.turnaround', { name: firstName(sim, m.id), morale: m.morale }) : null;
    }
    case 'change_champion': {
      if (moment !== 'interaction') return null;
      // Strong overall band in a conversation that rates Communicating change (the report's linkage matrix, 5.2).
      // Report only skills (a secondary lens, D70) never feed badges.
      if (sim.config.report.skills.some(s => s.key === 'communicating_change' && s.reportOnly)) return null;
      const rates = (rec: Sim['liveRecords'][number]) => (sim.config.report.linkage[rec.actionKey] ?? []).includes('communicating_change');
      const n = sim.liveRecords.filter(rec => rec.band === 'strong' && rates(rec)).length;
      return n >= 2 ? msg('engine.badge.changeChampion') : null;
    }
    case 'steady_hand':
      return moment === 'runEnd' && !sim.liveRecords.some(rec => rec.band === 'harmful') ? msg('engine.badge.steadyHand') : null;
    case 'target_crusher':
      return moment === 'periodEnd' && sim.funnel.value >= sim.config.money.target ? msg('engine.badge.targetCrusher') : null;
  }
  return null;
}
