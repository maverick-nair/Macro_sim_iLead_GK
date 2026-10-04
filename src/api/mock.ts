import { DEFAULT_SCENARIO } from '../data/scenario';
import type { Scenario } from '../data/types';
import type { Settings } from '../app/types';
import type { IleadApi } from './types';

/**
 * In memory adapter. Serves the design prototype's scenario and simulates
 * latency, so loading states show the same way they will against a server.
 */
/**
 * Settings are kept per participant (brief: settings persisted per participant). The mock keeps them
 * in this browser under the participant's id; the HTTP adapter stores them on the server.
 */
const settingsKey = (participant: string) => `ilead.settings.${participant}`;
function loadSettings(participant: string): Settings | null {
  try {
    const raw = localStorage.getItem(settingsKey(participant));
    return raw ? (JSON.parse(raw) as Settings) : null;
  } catch {
    return null;
  }
}
function storeSettings(participant: string, settings: Settings) {
  try { localStorage.setItem(settingsKey(participant), JSON.stringify(settings)); } catch { /* private mode or storage off: settings last for the session */ }
}

export function createMockApi(opts: { scenario?: Scenario; latencyMs?: number; participant?: string } = {}): IleadApi {
  const participant = opts.participant ?? 'local';
  const scenario = opts.scenario ?? DEFAULT_SCENARIO;
  const latency = opts.latencyMs ?? 250;
  const wait = <T>(value: T, ms = latency) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms));
  const clone = <T>(v: T): T => structuredClone(v);

  return {
    getScenario: () => wait(clone(scenario)),
    getSession: () => {
      const settings = loadSettings(participant);
      return wait(settings ? { week: 2, day: 3, capacity: 2.5, secs: 2292, styles: {}, settings } : null);
    },
    saveSettings: settings => { storeSettings(participant, settings); return wait(undefined, 0); },
    setStyle: () => wait(undefined, 0),
    planAction: () => wait(undefined, 0),
    // The prototype's "team is reacting" beat runs about 3 seconds while evaluation happens.
    submitInteraction: () => wait(clone(scenario.outcome), latency),
    endWeek: () => wait(undefined, 0)
  };
}
