import type { ReactNode } from 'react';

/**
 * Badge artwork, one simple line icon per badge rule, drawn in the medal at 64 in the current colour.
 * Icons are not copy: the badge's name and reason carry the meaning. Rules without an icon here (a
 * custom badge) get the Listener icon from the design.
 */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const LISTENER = (
  <Icon>
    <path d="M6 8a6 6 0 0 1 12 0c0 7-6 6-6 10"></path>
    <path d="M9 8a3 3 0 0 1 6 0"></path>
    <circle cx="12" cy="21" r="1"></circle>
  </Icon>
);

const ICONS: Record<string, ReactNode> = {
  listener: LISTENER,
  first_close: (
    <Icon>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4 2.5 4H5" />
    </Icon>
  ),
  read_the_room: (
    <Icon>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  flex_master: (
    <Icon>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Icon>
  ),
  concern_uncovered: (
    <Icon>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
      <path d="M12 8v4" />
      <circle cx="12" cy="15.5" r="0.6" />
    </Icon>
  ),
  promise_keeper: (
    <Icon>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  ),
  fair_hand: (
    <Icon>
      <path d="M12 4v16" />
      <path d="M8 20h8" />
      <path d="M5 7h14" />
      <path d="M5 7l-3 6a3 3 0 0 0 6 0z" />
      <path d="M19 7l-3 6a3 3 0 0 0 6 0z" />
    </Icon>
  ),
  turnaround: (
    <Icon>
      <path d="M20 11a8 8 0 0 0-14.9-3.9" />
      <path d="M4 3v4.5h4.5" />
      <path d="M4 13a8 8 0 0 0 14.9 3.9" />
      <path d="M20 21v-4.5h-4.5" />
    </Icon>
  ),
  change_champion: (
    <Icon>
      <path d="M3 10v4h4l7 5V5l-7 5z" />
      <path d="M17.5 9a4 4 0 0 1 0 6" />
      <path d="M20 6.5a8 8 0 0 1 0 11" />
    </Icon>
  ),
  steady_hand: (
    <Icon>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14" />
      <path d="M5 13a7 7 0 0 0 14 0" />
      <path d="M9 11h6" />
    </Icon>
  ),
  target_crusher: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </Icon>
  )
};

/** The icon for a badge rule, or the Listener icon for a rule without one. */
export function badgeIcon(rule: string): ReactNode {
  return ICONS[rule] ?? LISTENER;
}

/** Every rule with its own icon, for the stories. */
export const BADGE_ICON_RULES = Object.keys(ICONS);
