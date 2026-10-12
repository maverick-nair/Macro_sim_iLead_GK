import type { EngineView, MetricKey } from '../../engine/contract';
import { currentTier } from '../gamification/display';

/**
 * What the desk's status band shows (D211), read from the engine view only. It places engine values
 * against thresholds the engine sends (the pace marker, the tiers, the sponsor's lines); it never computes
 * a score, a star or an outcome. Pure, so it is unit tested.
 */

export type Dir = 'up' | 'down' | 'flat';
export const dirOf = (delta: number): Dir => (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');

export interface BandKpi { metric: MetricKey; value: number; /** Since the period started. */ delta: number }

export interface BandMoney {
  value: number;
  target: number;
  /** Earned so far as a share of the target, 0 to 1. */
  share: number;
  /** Where the run should be by now (`clock.runShare`), 0 to 1. */
  pace: number;
  /** Money above (positive) or below (negative) the pace marker. */
  gap: number;
  state: 'ahead' | 'behind' | 'onPace';
}

export interface BandTier {
  key: string;
  name: string;
  /** The next tier up and the points still needed, or null at the top tier. */
  next: { name: string; toGo: number } | null;
  /** Progress from this tier's threshold to the next one's, 0 to 1 (1 at the top tier). */
  progress: number;
}

export interface BandSponsor {
  value: number;
  /** Since the last period ended; null before the first period end. */
  delta: number | null;
  unlockAt: number;
  checkInBelow: number;
  /** At or over the reward line, under the check in line, or between them. */
  state: 'reward' | 'checkIn' | 'between';
}

export interface BandModel {
  kpis: BandKpi[];
  money: BandMoney;
  tier: BandTier | null;
  /** Stars earned in the last finished period, or null before any period has ended. */
  stars: { earned: number; period: number } | null;
  sponsor: BandSponsor;
}

/** Under half a percent of the target either side of the marker reads as on pace. */
const ON_PACE = 0.005;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export type BandView = Pick<EngineView, 'kpis' | 'money' | 'clock' | 'score' | 'gamification' | 'periods' | 'sponsor'>;

/**
 * The tier a score is in, by the engine's thresholds (the engine's own tier once the run has ended), the next
 * tier up with the points still needed, and how far along the way the score is. Null with no tiers.
 */
export function tierProgress(total: number, tiers: Array<{ key: string; name: string; min: number }>, final: { key: string; name: string } | null): BandTier | null {
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const at = sorted.findIndex(x => x.key === currentTier(total, sorted, final));
  if (at < 0) return null;
  const cur = sorted[at], up = at > 0 ? sorted[at - 1] : null;
  return {
    key: cur.key, name: final?.name ?? cur.name,
    next: up ? { name: up.name, toGo: Math.max(0, Math.ceil(up.min - total)) } : null,
    progress: up ? clamp01((total - cur.min) / Math.max(1, up.min - cur.min)) : 1
  };
}

export function bandModel(v: BandView): BandModel {
  const kpis = v.kpis.map(k => ({ metric: k.metric, value: k.value, delta: Math.round(k.value - k.start) }));

  const target = v.money.target;
  const pace = clamp01(v.clock.runShare);
  const gap = v.money.value - target * pace;
  const money: BandMoney = {
    value: v.money.value, target, share: target > 0 ? clamp01(v.money.value / target) : 0, pace, gap,
    state: target > 0 && Math.abs(gap) < target * ON_PACE ? 'onPace' : gap >= 0 ? 'ahead' : 'behind'
  };

  const tier = tierProgress(v.score.total, v.gamification.tiers, v.score.tier);
  const last = v.periods[v.periods.length - 1];
  const s = v.sponsor;
  return {
    kpis, money, tier,
    stars: last ? { earned: last.week.stars, period: last.period } : null,
    sponsor: {
      value: s.value, delta: last ? Math.round(s.value - last.sponsor.to) : null, unlockAt: s.unlockAt, checkInBelow: s.checkInBelow,
      state: s.value >= s.unlockAt ? 'reward' : s.value < s.checkInBelow ? 'checkIn' : 'between'
    }
  };
}
