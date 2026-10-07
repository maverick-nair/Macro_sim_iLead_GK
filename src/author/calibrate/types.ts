import type { CalibrationRunner } from './logic/client';
import type { CalibrationResults, Check, PersonaKey } from './logic/schema';

/**
 * The contract of `<CalibrateSlot>` (D118), GenieKreator's "Test with synthetic players" tab. The host
 * (the /author workspace) passes the draft it is editing; the slot renders the setup, the results and
 * the playthrough view, and runs the calibration on the server or in this browser.
 */
export interface CalibrateSlotProps {
  /**
   * The draft simulation config as authored (a `StorylineConfig` input, docs/schemas/storyline-config.json).
   * Pass the current draft on every render: results from an earlier draft show as out of date. A draft that
   * does not parse shows its issues instead of running.
   */
  config: unknown;
  /**
   * Base of the GenieKreator API, for example `/genie` (`VITE_GENIE_URL`). Set: calibrations run on the
   * server (`POST {apiBase}/calibrations`), with the server's evaluator and AI players when configured.
   * Unset, or a server without the endpoint: they run in this browser, in a Web Worker.
   */
  apiBase?: string | null;
  /** Results the host kept from an earlier run (with the draft). Playthroughs need a new run to watch. */
  results?: CalibrationResults | null;
  /** Called with each new run's results: keep them with the draft, and pass them to `calibrationPublishCheck`. */
  onResults?(results: CalibrationResults): void;
  /** When given, each check that needs a look has an "Ask Kora" button, which calls this with the check. */
  onAsk?(check: Check, results: CalibrationResults): void;
  /** Playthroughs per persona to start with (default 5 each, 0 leaves a persona out). */
  defaultRuns?: Partial<Record<PersonaKey, number>>;
  /** The level of the slot's own heading, to fit the host page (default 2). */
  headingLevel?: 2 | 3;
  /** False when the host page already shows the title and introduction (the /author tab); default true. */
  heading?: boolean;
  /** Tests and stories: a runner instead of the server or the Web Worker. */
  runner?: CalibrationRunner;
}

export type { CalibrationResults, Check, PersonaKey };
