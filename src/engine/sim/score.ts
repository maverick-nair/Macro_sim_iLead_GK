import { firstName, idealThroughput, teamAverage } from './sim';
import type { Band, Sim } from './types';

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

/** Mean band score of the run's live interactions, or null when there were none. */
export function liveMean(sim: Sim, period?: number) {
  const recs = period === undefined ? sim.liveRecords : sim.liveRecords.filter(r => r.period === period);
  return recs.length ? mean(recs.map(r => bandScore(sim, r.band))) : null;
}

export const pulse = (sim: Sim) => (teamAverage(sim, 'morale') + teamAverage(sim, 'trust')) / 2;

/** The three pillars, 0 to 100 each. */
export function pillars(sim: Sim) {
  const business = clamp((100 * sim.funnel.value) / sim.config.money.target);
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

/** Interactions that rate Communicating change (scoring-and-report.md 5.2): Meet the team, Send email, the swap and exit talks. */
const COMMUNICATES_CHANGE = new Set(['meeting', 'email']);
const CHANGE_RULES = new Set(['swap', 'fire']);

/** Awards every badge whose rule holds at this moment. Each badge is earned once. */
export function checkBadges(sim: Sim, moment: BadgeMoment) {
  const have = new Set(sim.badges.map(b => b.key));
  for (const b of sim.config.gamification.badges) {
    if (have.has(b.key)) continue;
    const reason = rule(sim, b.rule, moment);
    if (reason) sim.badges.push({ key: b.key, period: sim.period, reason });
  }
}

function rule(sim: Sim, r: string, moment: BadgeMoment): string | null {
  const unit = sim.config.time.period.unit;
  switch (r) {
    case 'first_close':
      return moment === 'conversion' && sim.funnel.conversions >= 1 ? 'Your team closed its first deal.' : null;
    case 'read_the_room': {
      if (moment !== 'periodEnd') return null;
      const w = sim.decisions.period.filter(d => d.source === 'weeklyStyle');
      const ok = w.filter(d => d.mismatch === 0).length;
      return w.length && ok / w.length >= 0.9 ? `${ok} of ${w.length} people got the style they needed this ${unit}.` : null;
    }
    case 'flex_master': {
      if (moment !== 'periodEnd') return null;
      const counts = { D: 0, G: 0, P: 0, E: 0 };
      for (const d of sim.decisions.run) if (d.mismatch === 0) counts[d.chosen]++;
      return Object.values(counts).every(n => n >= 2) ? 'You used every style at the right moment at least twice.' : null;
    }
    case 'concern_uncovered': {
      if (moment !== 'interaction') return null;
      const n = [...sim.members, ...sim.departed].filter(m => m.concernShared).length;
      const need = Math.min(5, sim.members.length);
      return n >= need ? `${n} people opened up to you about what was on their mind.` : null;
    }
    case 'promise_keeper': {
      if (moment !== 'runEnd') return null;
      const made = sim.promises.filter(p => p.state !== 'open' || p.dueAbsSub <= sim.absSub);
      return made.length >= 3 && !made.some(p => p.state === 'broken') ? `You made ${made.length} promises and kept every one.` : null;
    }
    case 'fair_hand':
      return moment === 'interaction' || moment === 'periodEnd' ? (sim.fairRecognitions >= 3 ? 'You recognized people three times and nobody felt passed over.' : null) : null;
    case 'turnaround': {
      if (moment !== 'periodEnd') return null;
      const m = sim.members.find(x => x.lowestMorale < 30 && x.morale > 60);
      return m ? `${firstName(sim, m.id)} went from morale below 30 to ${m.morale}.` : null;
    }
    case 'change_champion': {
      if (moment !== 'interaction') return null;
      const n = sim.liveRecords.filter(rec => rec.band === 'strong' && (COMMUNICATES_CHANGE.has(rec.format) || CHANGE_RULES.has(sim.config.actions.find(a => a.key === rec.actionKey)?.rule ?? ''))).length;
      return n >= 2 ? 'You explained a change really well, twice.' : null;
    }
    case 'steady_hand':
      return moment === 'runEnd' && !sim.liveRecords.some(rec => rec.band === 'harmful') ? 'No conversation went badly in the whole run.' : null;
    case 'target_crusher':
      return moment === 'periodEnd' && sim.funnel.value >= sim.config.money.target ? 'Your team reached the revenue target.' : null;
  }
  return null;
}
