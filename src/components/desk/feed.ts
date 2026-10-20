import type { EngineView, MetricKey } from '../../engine/contract';
import { teamChips } from '../board/chips';

/**
 * The feedback in the desk's feed (D212): the last thing the participant did that the engine logged (styles
 * set, an action, a conversation, a decision), with what it changed. Read from the view's history only, so
 * it stays after the outcome panel is dismissed and after a reload. Pure, so it is unit tested.
 */
export type LogEntry = EngineView['history'][number];

/** The participant's own doings: styles, actions, conversations and the decisions they made (D137). */
const mine = (l: LogEntry) => l.kind === 'style' || l.kind === 'action' || l.kind === 'interaction' || (l.kind === 'event' && !!l.action?.startsWith('choice:'));

export function lastFeedback(view: Pick<EngineView, 'history'>): LogEntry | null {
  for (let i = view.history.length - 1; i >= 0; i--) if (mine(view.history[i])) return view.history[i];
  return null;
}

export interface FeedChangeFact {
  /** A member id, `team`, `group` (several people) or `sponsor`. */
  subject: string;
  metric: MetricKey | 'confidence';
  /** The move, rounded; never 0. */
  delta: number;
  /** People behind a `group` move. */
  count: number;
}

/**
 * What an entry changed, at most `max` moves: people's moves grouped as the outcome panel groups them (a team
 * wide move is one), then the sponsor's confidence. `more` counts what did not fit.
 */
export function feedbackChanges(entry: LogEntry, everyone: number, max = 3): { changes: FeedChangeFact[]; more: number } {
  const people = teamChips(entry.changes.filter((c): c is typeof c & { metric: MetricKey } => c.metric !== 'confidence' && c.subject !== 'sponsor'), everyone)
    .map(c => ({ subject: c.subject, metric: c.metric as FeedChangeFact['metric'], delta: Math.round(c.delta), count: c.count }));
  const sponsor = entry.changes.filter(c => c.metric === 'confidence').reduce((a, c) => a + c.delta, 0);
  const all = [...people, ...(Math.round(sponsor) ? [{ subject: 'sponsor', metric: 'confidence' as const, delta: Math.round(sponsor), count: 1 }] : [])].filter(c => c.delta !== 0);
  return { changes: all.slice(0, max), more: Math.max(0, all.length - max) };
}
