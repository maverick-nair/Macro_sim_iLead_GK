import type { MoodKey, StyleKey } from '../../data/types';

export type { PeriodUnit } from '../action/days';

/** The numbers shown on the style setting screen, on the shared 0 to 100 scale. */
export interface StyleSettingStats {
  skill: number;
  morale: number;
  trust: number;
}

/** One team member as the style setting screen needs them. Data only; the engine fills it. */
export interface StyleSettingMember {
  id: string;
  name: string;
  /** For running text ("Peter's applies when..."). Defaults to the first word of `name`. */
  shortName?: string;
  /** The line under the name: the member's stage or job title, from data. */
  title: string;
  img: string;
  mood: MoodKey;
  /** Away (in training or on leave): still settable; the style applies when they return. */
  away: boolean;
  awayReason?: 'training' | 'leave';
  /** For "Applies when he is back". Defaults to they. */
  pronoun?: 'he' | 'she' | 'they';
  /** Null when the engine has not revealed them. */
  stats: StyleSettingStats | null;
  /** The engine hides stats until the participant first opens the profile (spec, member card). */
  statsHidden?: boolean;
  /** Last period's style and how the member reacted to it. Null in the first period. */
  lastStyle: StyleKey | null;
  lastReaction: 'pos' | 'neg' | null;
  /** This period's style. Null until the participant picks one. */
  style: StyleKey | null;
  /** Optional one line reason ("Kent is new and unsure"). Empty when none. */
  rationale: string;
}

export const shortName = (m: StyleSettingMember) => m.shortName ?? m.name.trim().split(/\s+/)[0];

/** True when stats should be replaced by the "open the profile" line. */
export const statsHidden = (m: StyleSettingMember) => m.statsHidden === true || m.stats === null;

/** The border and the summary's "Changed" mark: a style that differs from last period's. */
export const styleChanged = (m: StyleSettingMember) => m.style !== null && m.lastStyle !== null && m.style !== m.lastStyle;

/** Portrait backdrop on this screen: calm, or grey while away. */
export const portraitBackdrop = (away: boolean) => (away ? 'bg-(image:--il-fill-portrait-away)' : 'bg-(image:--il-fill-portrait-calm)');

/** First letters of the first and last name, for the sponsor's avatar. */
export const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length === 0 ? '' : (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
};
