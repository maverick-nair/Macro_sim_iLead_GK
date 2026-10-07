import type { EngineView, MetricKey } from '../../engine/contract';

/**
 * The team wide History (D95): the engine's log, week by week, newest week first, with each person's
 * skill, morale, result and trust changes and the reasons behind them. Pure, so it is unit tested; the
 * panel only renders what this returns. Nothing here computes an outcome: it groups what the engine logged.
 */

/** What to show: one person, and one kind of entry (an action or conversation key, `styles`, `events` or `week`). */
export interface HistoryFilter { person: string | null; what: string | null }

export interface HistoryPersonChange {
  id: string;
  name: string;
  changes: Array<{ metric: MetricKey; delta: number }>;
  /** The distinct reasons behind this person's changes, as the engine worded them. */
  reasons: string[];
}

export interface HistoryEntry {
  id: string;
  when: { period: number; sub: number };
  kind: EngineView['history'][number]['kind'];
  title: string;
  quote: string | null;
  /** People who changed, in team order; people the entry is about with no change come after, with none. */
  people: HistoryPersonChange[];
  /** Sponsor confidence moved by this much, or null. */
  sponsor: number | null;
}

export interface HistoryWeek { period: number; entries: HistoryEntry[] }

/** The filter's "what" for a log entry. */
export function entryWhat(e: EngineView['history'][number]): string {
  if (e.kind === 'style') return 'styles';
  if (e.kind === 'event' || e.kind === 'trigger') return 'events';
  if (e.kind === 'periodEnd') return 'week';
  return e.action ?? 'other';
}

const ORDER: MetricKey[] = ['skill', 'morale', 'result', 'trust'];

/** Groups the log by week, newest week first and newest entry first within it, filtered. */
export function historyWeeks(view: Pick<EngineView, 'history' | 'members' | 'clock'>, filter: HistoryFilter, names: (id: string) => string | null): HistoryWeek[] {
  const team = view.members.map(m => m.id);
  const rank = (id: string) => { const i = team.indexOf(id); return i < 0 ? team.length : i; };
  const out = new Map<number, HistoryEntry[]>();
  for (const e of view.history) {
    if (filter.what && entryWhat(e) !== filter.what) continue;
    const involved = new Set([...e.memberIds, ...e.changes.map(c => c.subject)].filter(id => id !== 'team' && id !== 'sponsor'));
    if (filter.person && !involved.has(filter.person) && !(e.memberIds.length === 0 && e.changes.some(c => c.subject === 'team'))) continue;
    const people: HistoryPersonChange[] = [];
    for (const id of [...involved].sort((a, b) => rank(a) - rank(b))) {
      const name = names(id);
      if (!name) continue;
      const mine = e.changes.filter((c): c is typeof c & { metric: MetricKey } => c.subject === id && c.metric !== 'confidence');
      const sums = new Map<MetricKey, number>();
      for (const c of mine) sums.set(c.metric, (sums.get(c.metric) ?? 0) + c.delta);
      people.push({
        id, name,
        changes: ORDER.filter(k => sums.has(k) && sums.get(k) !== 0).map(k => ({ metric: k, delta: sums.get(k)! })),
        reasons: [...new Set(mine.map(c => c.reason.cause))]
      });
    }
    // A person filter shows that person's line only, so the week reads as their story.
    const shown = filter.person ? people.filter(p => p.id === filter.person) : people;
    const sponsor = e.changes.filter(c => c.subject === 'sponsor').reduce((s, c) => s + c.delta, 0);
    const entry: HistoryEntry = {
      id: e.id, when: { period: e.period, sub: Math.min(e.sub + 1, view.clock.capacity) }, kind: e.kind, title: e.title, quote: e.quote ?? null,
      people: shown.sort((a, b) => Number(b.changes.length > 0) - Number(a.changes.length > 0)), sponsor: sponsor || null
    };
    const list = out.get(e.period) ?? [];
    list.push(entry);
    out.set(e.period, list);
  }
  return [...out.entries()].sort((a, b) => b[0] - a[0]).map(([period, entries]) => ({ period, entries: entries.reverse() }));
}

/** The filter's choices: the people (team order, then anyone who has left) and the kinds of entry that are in the log. */
export function historyOptions(view: Pick<EngineView, 'history' | 'members' | 'actions'>, names: (id: string) => string | null) {
  const ids = [...view.members.map(m => m.id)];
  for (const e of view.history) for (const id of e.memberIds) if (!ids.includes(id)) ids.push(id);
  const people = ids.map(id => ({ id, name: names(id) })).filter((p): p is { id: string; name: string } => !!p.name);
  const present = new Set(view.history.map(entryWhat));
  const actionKeys = view.actions.map(a => a.key).filter(k => present.has(k));
  const what = [
    ...(['styles'] as const).filter(k => present.has(k)),
    ...actionKeys,
    ...(['reply', 'sponsor', 'events', 'week'] as const).filter(k => present.has(k))
  ];
  return { people, what };
}
