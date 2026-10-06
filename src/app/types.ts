import type { LiveVariant, Member, MetricKey, StyleKey } from '../data/types';

/** Top level screens of the participant app. */
export type Screen = 'onboarding' | 'style' | 'board' | 'live' | 'reacting' | 'weekend' | 'end' | 'report';
export type Overlay = 'settings' | 'paused' | 'resume' | 'expired';
export type InputMode = 'text' | 'ptt' | 'open';

export interface Settings {
  /** Text size in percent: 100, 125, 150 or 200. Scales every font size from the app root (`--il-text-scale`). */
  text: number;
  captions: boolean;
  reduced: boolean;
  input: InputMode;
  clock: boolean;
  /** Consent to capture audio (Design doc, input rules): null until asked; false keeps play text only. */
  voiceConsent: boolean | null;
  /** The Actions panel folded to a rail on a narrow board (under 1280 wide, D58). Unset means open. */
  actionsCollapsed?: boolean;
}

/** A member with live stats, the style set for this week and a resolved portrait URL. */
export interface MemberView extends Member {
  img: string;
}

export interface PlannedAction {
  [key: string]: unknown;
}

/**
 * Live app model handed to every screen as `app`.
 * Mirrors the `app` object built in the prototype's iLeadApp.renderVals().
 */
export interface AppModel {
  members: MemberView[];
  /** Days of capacity left this week (0.5 steps). */
  capacity: number;
  week: number;
  day: number;
  /** True while the outcome panel should show on the board. */
  outcome: boolean;
  /** Member the current live interaction is with. */
  who: string;
  /** Member ids whose profile has been opened (onboarding unlock). */
  opened: string[];
  planned: PlannedAction[];
  settings: Settings;
  /** Frames in the screens gallery are frozen: no timers, no auto advance. */
  frozen: boolean;
  minH: string;
  /** Session clock, "m:ss". */
  clock: string;
  showClock: boolean;
  /** True when a client theme with a brand is active (D71). */
  client: boolean;
  dark: boolean;
}

/** Actions screens can call, handed to every screen as `act`. */
export interface AppActions {
  go: (screen: Screen, extra?: Partial<{ variant: LiveVariant; who: string; step: string | null; outcome: boolean }>) => void;
  /** Shows a toast for 3.4 seconds. */
  say: (text: string) => void;
  setStyle: (memberId: string, style: StyleKey) => void;
  /** Spends `cost` days and optionally records a planned action. */
  spend: (cost: number, item?: PlannedAction) => void;
  /** Starts a live interaction. */
  live: (variant: LiveVariant, who?: string) => void;
  openProfile: (memberId: string) => void;
  clearOutcome: () => void;
  overlay: (overlay: Overlay | null) => void;
  /** Updates and persists the participant's settings. */
  settings: (patch: Partial<Settings>) => void;
}

/** Common props for every screen component. */
export interface ScreenProps {
  d: import('../data/types').Scenario;
  app: AppModel;
  act: AppActions;
}

export type { MetricKey };
