import type { PeriodUnit } from '../action/days';
import type { BadgeChipProps } from '../gamification/Badge';

export type { PeriodUnit };

export type MetricKey = 'skill' | 'morale' | 'result' | 'trust';
export type StyleKey = 'D' | 'G' | 'P' | 'E';
export type Tone = 'gain' | 'decline' | 'neutral';

/** A tier of the Leadership Score, lowest first. */
export interface EndTier {
  key: string;
  name: string;
}

/** The run's results: money against target, conversions and the four team metrics from start to end. */
export interface EndResults {
  revenue: number;
  target: number;
  /** Revenue over target, as the engine sends it (1 is the whole target). */
  share: number;
  conversions: number;
  /** The line under the conversions, worded by the caller. */
  conversionsNote: string;
  conversionsTone: Tone;
  kpis: Array<{ metric: MetricKey; start: number; end: number }>;
}

/** A key moment (SBI). Text is engine content (D60). */
export interface EndMoment {
  id: string;
  kind: 'best' | 'revisit';
  period: number;
  title: string;
  /** The person's portrait, or a placeholder. */
  img: string;
  situation: string;
  behaviour: string;
  quote: string | null;
  impact: string;
  /** The style set for that person that period, if any. */
  intent: StyleKey | null;
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** The reflection: questions (authored), answers and the 1 to 5 rating. Controlled by the caller. */
export interface EndReflection {
  questions: string[];
  answers: string[];
  rating: number | null;
  onAnswer: (index: number, text: string) => void;
  onRate: (rating: number) => void;
  /** The question being dictated into, or null. */
  dictating?: number | null;
  /** The mic beside an answer: start or stop dictation. */
  onMic: (index: number) => void;
  /** Save state and the Save answers button. Absent in the design gallery, which has no save row. */
  save?: { state: SaveState; onSave: () => void; busy?: boolean };
}

export interface EndScreenProps {
  minHeight?: string;
  /** Focus the headline on arrival (the playable app, where the end screen replaces the board). */
  focusOnOpen?: boolean;
  periods: number;
  periodUnit: PeriodUnit;
  /** Everyone on the team over the run. */
  people: number;
  /** Lowest first. */
  tiers: EndTier[];
  /** Key of the tier reached. */
  tier: string;
  score: number;
  scoreMax: number;
  results: EndResults;
  moments: EndMoment[];
  badges: BadgeChipProps[];
  reflection: EndReflection;
  onViewReport: () => void;
  onDownload: () => void;
  onEmail: () => void;
  /** An email is on its way: the button waits. */
  emailing?: boolean;
  /** The read only board. Absent in the design gallery. */
  onLookAtBoard?: () => void;
}
