import type { ReactNode } from 'react';

/**
 * Badge artwork, owned by the UI: one simple line icon per badge rule (scoring-and-report.md 6.1).
 * The engine sends the rule; the storyline names and words the badge. Icons are drawn on a 24 grid
 * in the current colour, like the design's badge award medal, and fill their box: wrap one in a
 * sized element (`size-16` in the award medal, `size-5` on the shelf). An unknown rule (a custom
 * badge from GenieKreator) gets the plain medal.
 */
const ICONS: Record<string, ReactNode> = {
  // A deal closed: a tick in a circle.
  first_close: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></>,
  // Reading people: an eye.
  read_the_room: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  // Every style used well: the four style tiles.
  flex_master: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  // Someone opened up: a speech bubble with words in it.
  concern_uncovered: <><path d="M21 14a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M7.5 8h9" /><path d="M7.5 11.5h5" /></>,
  // Promises kept: a shield with a tick.
  promise_keeper: <><path d="M12 21.5s7.5-3.5 7.5-9.5V5.5L12 2.5 4.5 5.5V12c0 6 7.5 9.5 7.5 9.5z" /><path d="m9 12 2 2 4-4.5" /></>,
  // Fair recognition: balanced scales.
  fair_hand: <><path d="M12 3v17" /><path d="M7.5 20.5h9" /><path d="M4 7h16" /><path d="m4 7-2.5 6a2.5 2.5 0 0 0 5 0z" /><path d="m20 7-2.5 6a2.5 2.5 0 0 0 5 0z" /></>,
  // Morale turned around: a line that dips, then climbs.
  turnaround: <><path d="M2.5 9 8 15l4-3.5 9-7.5" /><path d="M15.5 4H21v5.5" /></>,
  // A change explained well: a megaphone.
  change_champion: <><path d="M3 10v4a1 1 0 0 0 1 1h3l6 4.5v-15L7 9H4a1 1 0 0 0-1 1z" /><path d="M16.5 9a4 4 0 0 1 0 6" /><path d="M19 6.5a8 8 0 0 1 0 11" /></>,
  // Nothing went badly: an anchor.
  steady_hand: <><circle cx="12" cy="5" r="2.5" /><path d="M12 7.5v14" /><path d="M5 12H2.5a9.5 9.5 0 0 0 19 0H19" /></>,
  // The target reached: a target.
  target_crusher: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>
};

/** A plain medal, for badge rules without their own icon. */
const MEDAL: ReactNode = <><circle cx="12" cy="9" r="6" /><path d="m8.5 13.5-1.5 8 5-3 5 3-1.5-8" /></>;

/** The badge rules with their own icon, in the default library's order. */
export const BADGE_RULES = Object.keys(ICONS);

/** The icon for a badge rule. Decorative: the badge's name carries the meaning. */
export function badgeIcon(rule: string): ReactNode {
  return (
    <svg className="size-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-badge-icon={rule in ICONS ? rule : 'medal'}>
      {ICONS[rule] ?? MEDAL}
    </svg>
  );
}
