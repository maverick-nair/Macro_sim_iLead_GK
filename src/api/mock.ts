import { DEFAULT_SCENARIO } from '../data/scenario';
import type { Scenario } from '../data/types';
import type { Settings } from '../app/types';
import type { MockGroupOptions } from './mockGroup';
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

/** A sample cohort for the mock leaderboard: names and results drawn from the participant id, the same every time. */
const PEERS = ['Aisha Rahman', 'Ben Okafor', 'Chen Wei', 'Dana Kowalski', 'Elif Demir', 'Farid Haddad', 'Grace Mensah', 'Hiro Tanaka', 'Isla Murray', 'Jonas Berg', 'Kavya Iyer', 'Luca Romano', 'Maya Cohen', 'Nina Petrova'];
function sampleCohort(participant: string) {
  let h = 2166136261;
  for (let i = 0; i < participant.length; i++) h = Math.imul(h ^ participant.charCodeAt(i), 16777619);
  const next = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  return PEERS.map(name => ({ name, score: Math.round(300 + next() * 600), conversions: Math.round(3 + next() * 6), capability: Math.round(30 + next() * 65) }));
}

/**
 * The mock's client theme: `client: 'halden'` serves the Halden sample (src/theme/samples), and
 * `themeUrl` (a path on this site) serves any theme JSON, standing in for `GET /theme`. Both load on
 * demand, outside the first load.
 */
export interface MockThemeOptions { client?: string | null; themeUrl?: string | null; history?: boolean; group?: MockGroupOptions }

async function mockTheme({ client, themeUrl }: MockThemeOptions): Promise<unknown> {
  if (themeUrl && /^\/(?!\/)/.test(themeUrl)) {
    const res = await fetch(themeUrl, { headers: { Accept: 'application/json' } });
    return res.status === 404 ? null : res.ok ? await res.json() : Promise.reject(new Error(`GET ${themeUrl} failed with ${res.status}`));
  }
  if (client === 'halden') return (await import('../theme/samples/halden.json')).default;
  return null;
}

export function createMockApi(opts: { scenario?: Scenario; latencyMs?: number; participant?: string; name?: string | null } & MockThemeOptions = {}): IleadApi {
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
    endWeek: () => wait(undefined, 0),
    emailReport: () => wait(undefined),
    // No PDF service in the mock: the app opens the print view and the browser saves the PDF.
    reportPdf: () => wait(null, 0),
    getProfile: () => wait({ name: opts.name ?? null, cohort: null }, 0),
    getLeaderboard: ({ size, anonymous, you }) => {
      const all = [...sampleCohort(participant).map(p => ({ ...p, you: false })), { ...you, name: opts.name ?? null, you: true }]
        .sort((a, b) => b.score - a.score || b.conversions - a.conversions || b.capability - a.capability)
        .map((e, i) => ({ ...e, rank: i + 1, name: anonymous && !e.you ? null : e.name }));
      const top = all.slice(0, size);
      const me = all.find(e => e.you)!;
      return wait({ entries: top.some(e => e.you) ? top : [...top, me], total: all.length });
    },
    getTheme: () => mockTheme(opts),
    // `history: true` (`?history=1`): one earlier attempt, played by the calibration's random player, for
    // demos of the report's progress section. It loads the engine on demand, outside the first load.
    getHistory: async () => (opts.history ? (await import('./mockHistory')).mockHistory() : wait(null, 0)),
    // A cohort played by the AI players, with the cached benchmark (`group`: purpose, lens, size). Loaded on demand.
    getGroupReport: async cohortId => (await import('./mockGroup')).mockGroupReport(cohortId, opts.group)
  };
}
