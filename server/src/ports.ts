import { MockDrafter } from '../../src/author/drafter';
import type { AuthorDraftRequest, AuthorDraftResponse, AuthorTurnRequest, AuthorTurnResponse } from '../../src/api/author';
import { heuristicEvaluator, type EvaluationInput, type Evaluator as EngineEvaluator } from '../../src/engine/sim/evaluator';
import { personaNpc, type NpcContext, type NpcModel as EngineNpcModel, type NpcReply } from '../../src/engine/sim/live';
import type { Band, Evaluation } from '../../src/engine/sim/types';

/**
 * The server's AI and speech ports (docs/SERVER.md "AI and speech"). The engine already defines the two
 * model seams it calls, so these ARE the engine's types, not copies:
 *
 * - `NpcModel` (src/engine/sim/live.ts): `reply(ctx: NpcContext): NpcReply | Promise<NpcReply>`, the other
 *   person's next line in a live conversation, in persona. It only talks; the rules decide consequences.
 * - `Evaluator` (src/engine/sim/evaluator.ts): `evaluate(input: EvaluationInput): Evaluation | Promise<Evaluation>`
 *   reads the participant's words (never the voice) and reports style, band, evidence and flags;
 *   optional `reply(...)` gives the other person's closing line when the client sent none.
 *
 * The other two are the server's own:
 * - `AuthorDrafter`: GenieKreator's author chat (`POST /genie/author/turn`, `/genie/author/draft`), the shapes
 *   in src/api/author.ts. Returning null means "not offered", and the app falls back to its templates.
 * - `Transcriber`: server side speech to text for the chunked upload contract in src/speech/transcription.ts.
 *
 * The defaults are the engine's transparent stand ins (`personaNpc`, `heuristicEvaluator`, the author chat's
 * `MockDrafter`) and a scripted transcriber. `AI_PROVIDER=anthropic` loads the real ones from the top level
 * `ai/` module (server/src/ai.ts).
 */
export type NpcModel = EngineNpcModel;
export type Evaluator = EngineEvaluator;
export type { EvaluationInput, Evaluation, NpcContext, NpcReply, Band };

export interface AuthorDrafter {
  turn(req: AuthorTurnRequest): Promise<AuthorTurnResponse | null>;
  draft(req: AuthorDraftRequest): Promise<AuthorDraftResponse | null>;
}

export interface TranscriptResult { kind: 'partial' | 'final'; text: string }

export interface TranscriptionOptions {
  /** Container and codec, as MediaRecorder reports it, for example `audio/webm;codecs=opus`. */
  mimeType: string;
  /** The speech mode the app records in (push to talk or open mic). */
  mode: string;
  /** BCP 47 language, when known. */
  language?: string;
}

/** One transcription: chunks arrive in order (seq from 0, no gaps; the server drops repeats). */
export interface TranscriptionSession {
  chunk(audio: Uint8Array, seq: number): Promise<TranscriptResult[]>;
  /** No more audio: every remaining final segment. */
  end(): Promise<TranscriptResult[]>;
  /** Drop the audio and any text. */
  cancel(): void | Promise<void>;
}

/**
 * Speech to text. Either shape works: `open` for streaming recognizers (partials while the participant
 * speaks), or `transcribe` for batch ones (the server buffers the chunks and transcribes on `end`).
 * Audio is never stored; only the transcript leaves the session (docs/SPEECH.md).
 */
export type Transcriber =
  | { open(options: TranscriptionOptions): TranscriptionSession | Promise<TranscriptionSession> }
  | { transcribe(input: { audio: Uint8Array; mimeType: string; language?: string }): Promise<{ text: string } | string> };

/** What `createNpcModel(config)` and the other `ai/` factories receive. */
export interface AiFactoryConfig {
  provider: 'anthropic';
  apiKey?: string;
  /** Model ids, when configured (`AI_MODEL` for all, or one per role). Unset: the module's own defaults. */
  models: { default?: string; npc?: string; evaluator?: string; author?: string };
  timeoutMs: number;
  /** A structured logger (JSON lines). Never log participant text. */
  logger: { info(msg: string, f?: Record<string, unknown>): void; warn(msg: string, f?: Record<string, unknown>): void; error(msg: string, f?: Record<string, unknown>): void };
  /** The raw environment, for module specific settings. */
  env: Record<string, string | undefined>;
}

/** The `ai/` module's exports (ai/src/types.ts on the other side). Factories may be async. */
export interface AiModule {
  createNpcModel(config: AiFactoryConfig): NpcModel | Promise<NpcModel>;
  createEvaluator(config: AiFactoryConfig): Evaluator | Promise<Evaluator>;
  createAuthorDrafter(config: AiFactoryConfig): AuthorDrafter | Promise<AuthorDrafter>;
  createTranscriber?(config: AiFactoryConfig): Transcriber | null | Promise<Transcriber | null>;
}

/** The ports the server runs with. */
export interface AiPorts {
  provider: 'mock' | 'anthropic';
  npc: NpcModel;
  evaluator: Evaluator;
  author: AuthorDrafter;
  /** Null: speech is off (`SPEECH_PROVIDER=off`), and the transcription routes answer 501. */
  transcriber: Transcriber | null;
}

/** The scripted stand in: each chunk reveals the next words of a fixed line, as the app's mock does. */
export function scriptedTranscriber(script = 'Thanks for making time. How are things going for you this week? Let us agree one next step by Friday.', wordsPerChunk = 2): Transcriber {
  return {
    open() {
      const words = script.split(/\s+/).filter(Boolean);
      let shown = 0;
      let done = false;
      return {
        async chunk() {
          if (done) return [];
          shown = Math.min(words.length, shown + wordsPerChunk);
          return [{ kind: 'partial', text: words.slice(0, shown).join(' ') }];
        },
        async end() {
          if (done) return [];
          done = true;
          return [{ kind: 'final', text: words.join(' ') }];
        },
        cancel() { done = true; }
      };
    }
  };
}

export function mockPorts(): AiPorts {
  const drafter = new MockDrafter();
  return {
    provider: 'mock',
    npc: personaNpc,
    evaluator: heuristicEvaluator,
    author: { turn: req => drafter.turn(req), draft: req => drafter.draft(req) },
    transcriber: scriptedTranscriber()
  };
}
