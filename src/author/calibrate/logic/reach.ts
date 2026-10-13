import type { StorylineConfig } from '../../../engine/config';

/**
 * What a run can make, worked out from the process alone (D227): no synthetic player plays. The funnel's capacity is
 * the engine's own ideal throughput (`idealThroughput` in `src/engine/sim/sim.ts`): each week's new leads through every
 * stage's passing rate with everyone performing at the High threshold, over the run, times the deal value. What a level
 * typically makes is a share of that capacity, measured with GenieKreator's synthetic players on its own drafts (seven
 * briefs across industries, lenses, pacing and run lengths, `D227`), because people dynamics, real world costs, the
 * time a level gives each person and the events all sit between the funnel's best and what a run delivers.
 *
 * It is an estimate for the author while they type; the synthetic test (Test with synthetic players) measures it.
 */

/** A run mode's shares of the funnel's capacity, by level, as GenieKreator's synthetic players made them (D227). */
export const REACH_SHARES = {
  /** Four weeks, one live conversation a week. */
  lite: { beginner: 0.37, proficient: 0.47, expert: 0.64 },
  /** Eight weeks (or another length), one live conversation a week. */
  standard: { beginner: 0.39, proficient: 0.61, expert: 0.79 },
  /** Two or more live conversations a week. */
  full: { beginner: 0.37, proficient: 0.81, expert: 0.87 }
} as const;

/**
 * When the target is out of reach or trivially easy (the synthetic test's own lines, `THRESHOLDS` in `aggregate.ts`):
 * a Proficient player should come within 80% of the target, and a Beginner should not reach it.
 */
export const REACH_LIMITS = { proficientLow: 0.8, expertHard: 0.5, beginnerEasy: 1 } as const;

export type ReachVerdict = 'unreachable' | 'stretch' | 'fits' | 'easy';

export interface Reach {
  weeks: number;
  /** Conversions a week through the process at full pace (every stage at the High threshold), on average over the run. */
  perWeek: number;
  /** The value of one conversion. */
  value: number;
  /** Revenue at full pace over the run: perWeek times the weeks times the value. */
  capacity: number;
  target: number;
  mode: keyof typeof REACH_SHARES;
  /** Revenue a level typically makes, and its share of the target. */
  levels: Record<'beginner' | 'proficient' | 'expert', { revenue: number; share: number }>;
  /**
   * `unreachable`: even an Expert typically makes under half the target; `stretch`: a Proficient player makes under
   * 80% of it; `easy`: a Beginner reaches it; `fits` otherwise.
   */
  verdict: ReachVerdict;
  /** A target a Proficient player typically reaches, and the deal value that would make the current target one. */
  suggest: { target: number; value: number };
}

/** Rounds to two significant figures, as targets are written. */
export function roundish(n: number): number {
  if (!(n > 0)) return 0;
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}

/** The run mode the shares are read for. */
export function reachMode(c: Pick<StorylineConfig, 'time'>): Reach['mode'] {
  if ((c.time.liveCap ?? 1) >= 2) return 'full';
  return c.time.period.count <= 4 ? 'lite' : 'standard';
}

/** What a run of this storyline can make, and what each level typically makes of it. */
export function reachOf(c: Pick<StorylineConfig, 'time' | 'money' | 'stages' | 'performanceThreshold' | 'thresholds'>): Reach {
  const weeks = c.time.period.count;
  const days = c.time.subPeriod.perPeriod;
  const thr = c.performanceThreshold;
  const atHigh = (c.thresholds.high + thr) / (100 + thr);
  let conversions = 0;
  for (let w = 1; w <= weeks; w++) {
    const input = c.money.inputPerSubPeriod[Math.min(w, c.money.inputPerSubPeriod.length) - 1] * days;
    conversions += c.stages.reduce((flow, st) => flow * st.conversionRatio * atHigh, input);
  }
  const value = c.money.valuePerConversion;
  const capacity = conversions * value;
  const target = c.money.target;
  const mode = reachMode(c);
  const shares = REACH_SHARES[mode];
  const level = (k: keyof typeof shares) => ({ revenue: capacity * shares[k], share: (capacity * shares[k]) / target });
  const levels = { beginner: level('beginner'), proficient: level('proficient'), expert: level('expert') };
  const verdict: ReachVerdict = levels.expert.share < REACH_LIMITS.expertHard ? 'unreachable'
    : levels.proficient.share < REACH_LIMITS.proficientLow ? 'stretch'
      : levels.beginner.share >= REACH_LIMITS.beginnerEasy ? 'easy' : 'fits';
  return {
    weeks, perWeek: conversions / weeks, value, capacity, target, mode, levels, verdict,
    suggest: { target: roundish(levels.proficient.revenue), value: roundish(value * target / Math.max(1e-9, levels.proficient.revenue)) }
  };
}
