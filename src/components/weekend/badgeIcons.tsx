import type { ReactNode } from 'react';
import { BADGE_RULES, badgeIcon as icon } from '../gamification/badgeIcons';

/** The badge icon at the award medal's size (64, as in the design's frame w3). One icon set: `gamification/badgeIcons`. */
export function badgeIcon(rule: string): ReactNode {
  return <span className="block size-16">{icon(rule)}</span>;
}

/** Every rule with its own icon, for the stories. */
export const BADGE_ICON_RULES = BADGE_RULES;
