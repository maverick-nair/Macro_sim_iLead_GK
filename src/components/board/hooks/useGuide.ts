import { useEffect, useState, type RefObject } from 'react';
import type { EngineView } from '../../../engine/contract';
import { guideOff, guideSeen, markGuideSeen, turnGuideOff } from '../../tour/guideStore';
import type { TourArea } from '../../tour/steps';
import type { TourEnd } from '../../tour/Tour';
import { dueAlerts, dueTips, newMilestones, type Notice } from '../notices';

type Keys = { has(key: string): boolean };
// What newMilestones, dueTips and dueAlerts read.
type NoticeView = Pick<EngineView, 'milestones' | 'phase' | 'live' | 'actions' | 'clock' | 'funnel' | 'members' | 'sponsor'>;

/** The notices due on the plain board: milestones not yet shown, tips once each (unless the guide is off), and alerts until dismissed. */
export function dueNotices(v: NoticeView, shown: Keys, dismissed: Keys): Notice[] {
  return [
    ...newMilestones(v, dismissed),
    ...(guideOff() ? [] : dueTips(v).filter(n => !dismissed.has(n.key) && (shown.has(n.key) || !guideSeen(n.key)))),
    // What neglect is costing now (D173, D174): each period, whatever the guide setting, until dismissed.
    ...dueAlerts(v).filter(n => !dismissed.has(n.key))
  ];
}

/**
 * Notices (D93, D99): milestones as the engine reaches them, and tips at key moments, once each. `active` is the
 * plain board outside the demo; elsewhere there are none.
 */
export function useNotices({ view: v, active }: { view: EngineView; active: boolean }) {
  /** Notices on screen this load, and the ones dismissed. Milestones reached before the board opened are not news (a resumed run). */
  const [shown, setShown] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(v.milestones.map(m => `milestone:${m.key}`)));
  const notices: Notice[] = active ? dueNotices(v, shown, dismissed) : [];
  const freshKeys = notices.filter(n => !shown.has(n.key)).map(n => n.key).join('|');
  useEffect(() => {
    if (!freshKeys) return;
    const fresh = freshKeys.split('|');
    // A tip is remembered as seen once it is on screen, so a reload does not repeat it (D99).
    for (const k of fresh) if (k.startsWith('tip:')) markGuideSeen(k);
    // A notice on screen stays until it is dismissed, even after its tip is marked seen (D78 keeps this pattern).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(s => new Set([...s, ...fresh]));
  }, [freshKeys]);
  const dismiss = (key: string) => setDismissed(d => new Set([...d, key]));
  return { notices, dismiss };
}

interface TourInput {
  /** Starts with this tour open (stories and tests). */
  start?: TourArea;
  /** The tour of the screen in front, or null when none may start there. */
  area: TourArea | null;
  /** A panel open over the board, or the run paused: no tour starts. */
  panel: unknown;
  paused?: boolean;
  /** The storyline's tour switch. */
  enabled: boolean;
  /** Where focus goes when the tour closes: the screen's heading. */
  focusHintRef: RefObject<(() => HTMLElement | null | undefined) | null>;
  h1Ref: RefObject<HTMLHeadingElement | null>;
}

/** The guided tours (D94): each starts on its own the first time its screen shows, unless switched off. */
export function useTour({ start, area, panel, paused, enabled, focusHintRef, h1Ref }: TourInput) {
  /** The guided tour that is running (D94), if any. */
  const [tour, setTour] = useState<TourArea | null>(start ?? null);
  useEffect(() => {
    if (!area || tour || panel || paused || !enabled || guideOff() || guideSeen(`tour:${area}`)) return;
    // A moment after the screen settles, so its targets are on screen.
    const id = setTimeout(() => setTour(cur => cur ?? area), 600);
    return () => clearTimeout(id);
  }, [area, tour, panel, paused, enabled]);
  const endTour = (how: TourEnd) => {
    if (tour) markGuideSeen(`tour:${tour}`);
    if (how === 'never') turnGuideOff();
    setTour(null);
    focusHintRef.current = () => h1Ref.current;
  };
  return { tour, setTour, endTour };
}
