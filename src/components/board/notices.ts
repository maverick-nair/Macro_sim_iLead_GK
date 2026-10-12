import type { EngineView } from '../../engine/contract';

/**
 * What the board may notify: progress milestones the engine reached (D93) and one time tips at key
 * moments (D99), read from the view only. Pure, so it is unit tested; the board shows each once.
 */

export type Notice =
  | { key: string; kind: 'milestone'; milestone: EngineView['milestones'][number] }
  | { key: string; kind: 'tip'; tip: 'hireUnlocked' | 'noDays' | 'seatOpen'; stage?: string }
  | { key: string; kind: 'alert'; alert: 'neglect'; ids: string[]; weeks: number }
  | { key: string; kind: 'alert'; alert: 'silence' };

type MilestoneView = Pick<EngineView, 'milestones'>;
type Shown = { has(key: string): boolean };

/** Milestones reached that have not been shown yet, oldest first. */
export function newMilestones(view: MilestoneView, shown: Shown): Notice[] {
  return view.milestones.filter(m => !shown.has(`milestone:${m.key}`)).map(m => ({ key: `milestone:${m.key}`, kind: 'milestone', milestone: m }));
}

/**
 * The tips due now, on the plain board (D99, 1.0's tips at key moments): Hire member has unlocked; no
 * days are left in the period; a stage has fewer people than its ideal (someone left), so a seat is open.
 * Each tip has a key, so the board shows it once.
 */
export function dueTips(view: Pick<EngineView, 'phase' | 'live' | 'actions' | 'clock' | 'funnel'>): Notice[] {
  if (view.phase !== 'board' || view.live) return [];
  const out: Notice[] = [];
  const hire = view.actions.find(a => a.rule === 'hire');
  const hireOpen = !!hire && view.clock.period >= hire.unlockPeriod && hire.blocked?.reason !== 'locked';
  if (hire && hire.unlockPeriod > 1 && hireOpen) out.push({ key: 'tip:hireUnlocked', kind: 'tip', tip: 'hireUnlocked' });
  if (view.clock.capacityLeft <= 0) out.push({ key: 'tip:noDays', kind: 'tip', tip: 'noDays' });
  for (const st of view.funnel) if (st.ideal > 0 && st.members < st.ideal) out.push({ key: `tip:seatOpen:${st.key}`, kind: 'tip', tip: 'seatOpen', stage: st.key });
  return out;
}

/**
 * What neglect is costing now (D173, D174), on the plain board, once a period each, whatever the guide setting:
 * people past the neglect window (they lose heart and deliver less until you make time), and a sponsor who will
 * lose confidence at this period's end unless you give them a word. Only when the storyline has realism.
 */
export function dueAlerts(view: Pick<EngineView, 'phase' | 'live' | 'clock' | 'members' | 'sponsor'>): Notice[] {
  if (view.phase !== 'board' || view.live) return [];
  const out: Notice[] = [];
  const neglected = view.members.filter(m => m.neglected && m.away === 0);
  if (neglected.length) out.push({ key: `alert:neglect:${view.clock.period}`, kind: 'alert', alert: 'neglect', ids: neglected.map(m => m.id), weeks: Math.min(...neglected.map(m => m.unattended ?? 0)) });
  const s = view.sponsor;
  if (s.silence && s.update && s.update.blocked !== 'off' && s.silence.weeks + 1 >= s.silence.costsFrom) out.push({ key: `alert:silence:${view.clock.period}`, kind: 'alert', alert: 'silence' });
  return out;
}
