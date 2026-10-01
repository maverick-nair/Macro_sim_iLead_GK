import type { Settings, PlannedAction } from '../app/types';
import type { LiveVariant, Outcome, Scenario, StyleKey } from '../data/types';

/**
 * The iLead participant API.
 *
 * Every screen talks to the simulation through this interface. Two adapters ship:
 * `createMockApi` (in memory, serves the design prototype's scenario, used by
 * default and by the screens gallery) and `createHttpApi` (JSON over HTTP,
 * enabled by setting `VITE_ILEAD_API_URL`). Swap adapters in `src/api/index.ts`.
 */
export interface IleadApi {
  /** Scenario config authored in GenieKreator: team, styles, actions, inbox, events. */
  getScenario(): Promise<Scenario>;
  /** Where the participant left off, or null for a fresh run. */
  getSession(): Promise<SessionSnapshot | null>;
  saveSettings(settings: Settings): Promise<void>;
  /** Leadership style for one member for the current week. */
  setStyle(input: { week: number; memberId: string; style: StyleKey }): Promise<void>;
  /** Commits a planned action and the days it costs. */
  planAction(input: { week: number; day: number; cost: number; item?: PlannedAction }): Promise<void>;
  /**
   * Submits a finished live interaction. The server's AI judges the response and
   * authored rules decide the consequences, returned as an Outcome.
   */
  submitInteraction(input: InteractionSubmission): Promise<Outcome>;
  endWeek(input: { week: number }): Promise<void>;
}

export interface SessionSnapshot {
  week: number;
  day: number;
  capacity: number;
  /** Seconds left on the session clock. */
  secs: number;
  styles: Record<string, StyleKey>;
  settings: Settings;
}

export interface InteractionSubmission {
  variant: LiveVariant;
  /** Member (or 'sponsor') the interaction was with. */
  who: string;
  week: number;
  day: number;
  /** Final transcript the participant approved, in order. */
  turns?: Array<{ by: 'you' | string; text: string }>;
}

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}
