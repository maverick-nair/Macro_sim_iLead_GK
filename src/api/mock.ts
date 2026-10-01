import { DEFAULT_SCENARIO } from '../data/scenario';
import type { Scenario } from '../data/types';
import type { IleadApi } from './types';

/**
 * In memory adapter. Serves the design prototype's scenario and simulates
 * latency, so loading states show the same way they will against a server.
 */
export function createMockApi(opts: { scenario?: Scenario; latencyMs?: number } = {}): IleadApi {
  const scenario = opts.scenario ?? DEFAULT_SCENARIO;
  const latency = opts.latencyMs ?? 250;
  const wait = <T>(value: T, ms = latency) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms));
  const clone = <T>(v: T): T => structuredClone(v);

  return {
    getScenario: () => wait(clone(scenario)),
    getSession: () => wait(null),
    saveSettings: () => wait(undefined, 0),
    setStyle: () => wait(undefined, 0),
    planAction: () => wait(undefined, 0),
    // The prototype's "team is reacting" beat runs about 3 seconds while evaluation happens.
    submitInteraction: () => wait(clone(scenario.outcome), latency),
    endWeek: () => wait(undefined, 0)
  };
}
