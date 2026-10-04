import type { MetricKey } from '../../engine/contract';

/** More than this many people moving the same way on one metric read as one chip. */
export const TEAM_WIDE = 2;

export interface Chip { subject: string; metric: MetricKey; delta: number; count: number }

/**
 * Groups wide changes so a team message stays readable: more than TEAM_WIDE people moving the same
 * way on one metric become one chip with how many people moved and the average move. A chip with
 * count 1 belongs to one person.
 */
export function teamChips(raw: Array<{ subject: string; metric: MetricKey; delta: number }>, everyone = Infinity): Chip[] {
  // One person's several changes on a metric (for different reasons) net to one move first.
  const net = new Map<string, { subject: string; metric: MetricKey; delta: number }>();
  for (const c of raw) {
    const k = `${c.subject}|${c.metric}`;
    const prev = net.get(k);
    net.set(k, prev ? { ...prev, delta: prev.delta + c.delta } : { subject: c.subject, metric: c.metric, delta: c.delta });
  }
  const changes = [...net.values()].filter(c => c.delta !== 0);
  const out: Chip[] = [];
  for (const metric of [...new Set(changes.map(c => c.metric))]) {
    for (const sign of [1, -1]) {
      const group = changes.filter(c => c.metric === metric && Math.sign(c.delta) === sign);
      if (group.length > TEAM_WIDE) out.push({ subject: group.length >= everyone ? 'team' : 'group', metric, delta: Math.round(group.reduce((a, c) => a + c.delta, 0) / group.length), count: group.length });
      else out.push(...group.map(c => ({ ...c, count: 1 })));
    }
  }
  return out;
}
