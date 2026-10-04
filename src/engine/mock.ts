import { parseStoryline, type StorylineConfig } from './config';
import { EngineView, Intent, IntentResult } from './contract';
import { EngineError, parse, type EngineClient } from './client';
import type { Evaluator } from './sim/evaluator';
import { createEngine, IntentError } from './sim/engine';
import salesElevator from './storylines/sales-elevator.json';

/**
 * The mock engine adapter: the same engine code the server runs, in the browser, on a storyline
 * fixture. Loaded lazily by createDefaultClient so it never weighs on the initial bundle.
 */
export function defaultStoryline(): StorylineConfig {
  const r = parseStoryline(salesElevator);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
}

export function createMockClient(opts: { config?: StorylineConfig; seed?: number; evaluator?: Evaluator; latencyMs?: number } = {}): EngineClient {
  const engine = createEngine(opts.config ?? defaultStoryline(), { seed: opts.seed ?? 1, evaluator: opts.evaluator });
  const wait = () => (opts.latencyMs ? new Promise(r => setTimeout(r, opts.latencyMs)) : Promise.resolve());
  return {
    async view() {
      await wait();
      return parse(EngineView, engine.view());
    },
    async send(intent) {
      const checked = parse(Intent, intent);
      await wait();
      try {
        return parse(IntentResult, await engine.dispatch(checked));
      } catch (e) {
        if (e instanceof IntentError) throw new EngineError(e.message, e.code);
        throw e;
      }
    }
  };
}

