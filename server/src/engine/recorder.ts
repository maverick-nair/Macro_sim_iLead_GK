import type { Evaluator, NpcModel } from '../ports';

/**
 * Exact replay with real models. The engine is deterministic given its seed and intents, but a model's
 * words are not: so every model call an intent makes is recorded with the intent in the event log, and a
 * replay answers those calls from the log, in order, instead of asking the model again. The engine sees
 * the same answers and reaches the same state, whatever the model would say today.
 */
export type AiCall = { k: 'evaluate' | 'reply' | 'npc'; out: unknown };

export class ReplayError extends Error {
  readonly code = 'replayFailed';
}

export class Recorder {
  private calls: AiCall[] = [];
  private replay: AiCall[] | null = null;

  /** Starts recording one intent's calls. */
  begin() { this.calls = []; this.replay = null; }
  /** Starts replaying one intent's recorded calls. */
  replaying(calls: AiCall[]) { this.calls = []; this.replay = [...calls]; }
  /** The calls since `begin`, for the event log. */
  take(): AiCall[] { const c = this.calls; this.calls = []; return c; }
  /** Every recorded call was used: a replay that leaves some over did not follow the original path. */
  finish() {
    const left = this.replay?.length ?? 0;
    this.replay = null;
    if (left) throw new ReplayError(`replay left ${left} recorded model call(s) unused`);
  }

  async call<T>(k: AiCall['k'], live: () => T | Promise<T>): Promise<T> {
    if (this.replay) {
      const next = this.replay.shift();
      if (!next || next.k !== k) throw new ReplayError(`replay expected a recorded ${k} call, found ${next ? next.k : 'none'}`);
      return structuredClone(next.out) as T;
    }
    const out = await live();
    // A copy: the engine may adjust what it was given (the evaluator's flags), the log keeps what the model said.
    this.calls.push({ k, out: out === undefined ? null : structuredClone(out) });
    return out;
  }

  evaluator(base: Evaluator): Evaluator {
    return {
      evaluate: input => this.call('evaluate', () => base.evaluate(input)),
      reply: async input => (await this.call('reply', async () => (base.reply ? await base.reply(input) : null))) ?? ''
    };
  }

  npc(base: NpcModel): NpcModel {
    return { reply: ctx => this.call('npc', () => base.reply(ctx)) };
  }
}
