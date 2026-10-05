import type { PeriodUnit, SubPeriodUnit } from '../action/days';

export type { PeriodUnit, SubPeriodUnit };

/** The six onboarding steps, in order (spec, Onboarding). */
export const ONBOARDING_STEPS = ['lang', 'sponsor', 'consent', 'voice', 'how', 'team'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const isOnboardingStep = (v: string | null | undefined): v is OnboardingStep => !!v && (ONBOARDING_STEPS as readonly string[]).includes(v);

/** A configured language. Name and note are written in that language, so they are data, not catalog. */
export interface OnboardingLanguage {
  id: string;
  name: string;
  note: string;
}

export type SponsorTab = 'welcome' | 'product' | 'targets';
export const SPONSOR_TABS: SponsorTab[] = ['welcome', 'product', 'targets'];

export interface OnboardingSponsor {
  name: string;
  /** Title and organisation, worded by the caller with `onboarding.sponsor.role`. */
  role: string;
  /** Shown on the brand fill when there is no portrait. */
  initials: string;
  img: string | null;
  /** The welcome letter, one list of paragraphs per tab, from the storyline. */
  letter: Record<SponsorTab, string[]>;
  /** The sponsor's welcome video, when the storyline has one: its caption line and an optional label over it. */
  video: { caption: string; label?: string } | null;
}

export type OnboardingFactKey = 'previous' | 'tenure' | 'experience' | 'skills' | 'remarks';
export const ONBOARDING_FACTS: OnboardingFactKey[] = ['previous', 'tenure', 'experience', 'skills', 'remarks'];

export interface OnboardingStats {
  skill: number;
  morale: number;
  result: number;
  trust: number;
}

export interface OnboardingMember {
  id: string;
  name: string;
  title: string;
  img: string | null;
  /** Stage name, from the storyline. */
  stage: string;
  /** Null while the engine keeps them hidden (until the profile has been opened). */
  stats: OnboardingStats | null;
  /** The profile has been read before (the engine revealed the stats). */
  read: boolean;
  facts: Record<OnboardingFactKey, string>;
}

/**
 * How the voice check stands: not tried, heard the test phrase, the browser blocked the mic, or there
 * is no microphone this browser can record from (none plugged in, or no recording support).
 */
export type VoiceCheck = 'idle' | 'heard' | 'denied' | 'unavailable';
