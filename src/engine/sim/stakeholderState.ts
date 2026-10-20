import type { StorylineConfig } from '../config';
import type { Copy } from '../copy';
import type { Sim, StakeholderState } from './types';

/**
 * Stakeholder relationships (D160, docs/SIMULATION.md 6.9): each stakeholder's trust in the participant and their
 * satisfaction, 0 to 100, kept for the run, with every move and its cause. The primitives only: what moves them lives
 * in `stakeholders.ts`. A storyline without stakeholders has none of this, so it plays exactly as before.
 */

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Every stakeholder's relationship at the start of the run. */
export function startStakeholders(config: Pick<StorylineConfig, 'stakeholders'>): Record<string, StakeholderState> {
  return Object.fromEntries((config.stakeholders ?? []).map(s => [s.key, {
    trust: s.start.trust, satisfaction: s.start.satisfaction, atStart: { trust: s.start.trust, satisfaction: s.start.satisfaction }, engaged: [], moves: [], concernShared: false
  }]));
}

export const stakeholderConfig = (sim: Pick<Sim, 'config'>, key: string) => sim.config.stakeholders.find(s => s.key === key);
export const isStakeholder = (sim: Pick<Sim, 'config'>, id: string | null | undefined) => !!id && sim.config.stakeholders.some(s => s.key === id);

/** Moves a stakeholder's trust and satisfaction within 0 to 100 and keeps the move with its cause. Returns what applied. */
export function moveRelation(sim: Sim, key: string, d: { trust?: number; satisfaction?: number }, cause: Copy): { trust: number; satisfaction: number } {
  const st = sim.stakeholders[key];
  if (!st) return { trust: 0, satisfaction: 0 };
  const t0 = st.trust, s0 = st.satisfaction;
  st.trust = clamp(t0 + (d.trust ?? 0));
  st.satisfaction = clamp(s0 + (d.satisfaction ?? 0));
  const moved = { trust: st.trust - t0, satisfaction: st.satisfaction - s0 };
  if (moved.trust || moved.satisfaction) st.moves.push({ period: sim.period, sub: sim.sub, cause, ...moved });
  return moved;
}

/** A stakeholder's trust or satisfaction now (a missing stakeholder reads 0). */
export const relationOf = (sim: Sim, key: string, measure: 'trust' | 'satisfaction') => sim.stakeholders[key]?.[measure] ?? 0;

/**
 * How the relationship shapes what an interaction achieves (D161): gains land in full at trust 50, at half at trust 0
 * and at a quarter more at trust 100; below trust 50 losses land harder, up to half again at trust 0.
 */
export function relationScale(trust: number): { gain: number; loss: number } {
  const t = Math.max(0, Math.min(100, trust));
  return { gain: t >= 50 ? 1 + 0.25 * (t - 50) / 50 : 0.5 + 0.5 * t / 50, loss: t >= 50 ? 1 : 1 + 0.5 * (50 - t) / 50 };
}

/** At each period start, the relationship the board's trend and the week end read from. */
export function markRelationsStart(sim: Sim) {
  for (const st of Object.values(sim.stakeholders)) st.atStart = { trust: st.trust, satisfaction: st.satisfaction };
}

/** A relationship in one word, from the mean of trust and satisfaction (the board and the report). */
export function relationLevel(st: { trust: number; satisfaction: number }): 'strained' | 'cool' | 'steady' | 'good' | 'strong' {
  const m = (st.trust + st.satisfaction) / 2;
  return m < 30 ? 'strained' : m < 45 ? 'cool' : m < 60 ? 'steady' : m < 75 ? 'good' : 'strong';
}
