import { parseStoryline, type StorylineConfig } from './config';
import { EngineView, Intent, IntentResult } from './contract';
import { mockStream } from '../ai/mockStream';
import { EngineError, parse, type EngineClient } from './client';
import type { Evaluator } from './sim/evaluator';
import { createEngine, IntentError } from './sim/engine';
import salesElevator from './storylines/sales-elevator.json';
import { neededStyles } from './sim/policies';

/**
 * The mock engine adapter: the same engine code the server runs, in the browser, on a storyline
 * fixture. Loaded lazily by createDefaultClient so it never weighs on the initial bundle.
 */
export function defaultStoryline(): StorylineConfig {
  const r = parseStoryline(salesElevator);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
}

/**
 * Demo and test aid, mock only: opens every profile, then plays the periods before `period` with the
 * needed styles and no actions, so a later period (interviews from week 3, the week 4 sponsor briefing) can be opened.
 */
async function fastForward(engine: ReturnType<typeof createEngine>, period: number) {
  while (engine.view().clock.period < period && engine.view().phase !== 'ended') {
    if (engine.view().phase === 'style') await engine.dispatch({ type: 'confirmStyles', styles: await neededStyles(engine) });
    await engine.dispatch({ type: 'endPeriod' });
    const v = engine.view();
    if (v.pendingReward) await engine.dispatch({ type: 'chooseReward', reward: v.pendingReward[0] });
    if (engine.view().phase === 'periodEnd') await engine.dispatch({ type: 'startNextPeriod' });
  }
}

export function createMockClient(opts: { config?: StorylineConfig; seed?: number; evaluator?: Evaluator; latencyMs?: number; tokensPerSecond?: number; startPeriod?: number } = {}): EngineClient {
  const engine = createEngine(opts.config ?? defaultStoryline(), { seed: opts.seed ?? 1, evaluator: opts.evaluator });
  const ready = opts.startPeriod && opts.startPeriod > 1 ? fastForward(engine, opts.startPeriod) : Promise.resolve();
  const wait = async () => { await ready; if (opts.latencyMs) await new Promise(r => setTimeout(r, opts.latencyMs)); };
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
    },
    // The mock engine already has the NPC's words; it streams them at a speaking pace.
    streamTurn: (_id, turn, signal) => mockStream(turn.text, { signal, turnId: turn.id, tokensPerSecond: opts.tokensPerSecond ?? 14 })
  };
}

