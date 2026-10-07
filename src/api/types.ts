import type { Settings, PlannedAction } from '../app/types';
import type { LiveVariant, Outcome, Scenario, StyleKey } from '../data/types';
import type { GroupReportInput } from '../engine/groupContract';
import type { HistoryEntry } from '../engine/reportContract';

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
  /** Emails the participant's development report to their work address, once the run has ended. */
  emailReport(): Promise<void>;
  /**
   * The development report as a PDF file rendered by the server, or null where there is no PDF service
   * (the app then opens the print view and the browser saves the PDF).
   */
  reportPdf(): Promise<Blob | null>;
  /** Who launched the run (LMS or GenieKreator launch), for the report header; null fields when unknown. */
  getProfile(): Promise<{ name: string | null; cohort: string | null }>;
  /**
   * The cohort leaderboard (scoring-and-report.md 6): ranked by Leadership Score, ties by conversions,
   * then contextual capability %. `you` is this participant's own result, sent so the server can place it.
   */
  getLeaderboard(input: { size: number; anonymous: boolean; you: LeaderboardResult }): Promise<Leaderboard>;
  /**
   * The client theme authored in GenieKreator (src/theme/schema.ts), as raw JSON, or null when the
   * simulation uses the iLead theme. The theme loader validates and corrects it (D72).
   */
  getTheme(): Promise<unknown>;
  /**
   * The participant's earlier attempts at this simulation (D75), oldest first: each attempt's run summary
   * (`RunSummary`) and its report headline, for the report's progress section. Null when there are none
   * (proposed `GET /history`, 404 is none). The report parses it with `History` (src/engine/reportContract.ts).
   */
  getHistory(): Promise<HistoryEntry[] | null>;
  /**
   * The group report for a cohort (D75, D77), for the organization, not the participant: proposed
   * `GET /cohort/{id}/report`, built on the server by `buildGroupReport` from the cohort's run summaries
   * (or `POST /cohort/report` with `GroupReportRequest` where the server stores only summaries). Null
   * when there is no such cohort (404). The page parses it with `GroupReport` (src/engine/groupContract.ts).
   */
  getGroupReport(cohortId: string): Promise<GroupReportInput | null>;
}

export interface LeaderboardResult { score: number; conversions: number; capability: number }
export interface Leaderboard {
  /** The top `size`, plus this participant when outside it. `name` is null when anonymous. */
  entries: Array<LeaderboardResult & { rank: number; name: string | null; you: boolean }>;
  total: number;
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
