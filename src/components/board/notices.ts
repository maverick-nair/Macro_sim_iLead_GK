import type { EngineView } from '../../engine/contract';

/**
 * What the board may notify: progress milestones the engine reached (D93) and one time tips at key
 * moments (D99), read from the view only. Pure, so it is unit tested; the board shows each once.
 */

export type Notice =
  | { key: string; kind: 'milestone'; milestone: EngineView['milestones'][number] }
  | { key: string; kind: 'tip'; tip: 'hireUnlocked' | 'noDays' | 'seatOpen'; stage?: string };

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
