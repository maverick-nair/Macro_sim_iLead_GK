import { MockDrafter } from '../../src/author/drafter';
import type { AuthorDraftRequest, AuthorDraftResponse, AuthorTurnRequest, AuthorTurnResponse } from '../../src/api/author';
import type { AuthorEditRequest, AuthorEditResponse } from '../../src/api/authorEdit';
import { heuristicEvaluator, type EvaluationInput, type Evaluator as EngineEvaluator } from '../../src/engine/sim/evaluator';
import { personaNpc, type NpcContext, type NpcModel as EngineNpcModel, type NpcReply } from '../../src/engine/sim/live';
import type { Band, Evaluation } from '../../src/engine/sim/types';
import type { StorylineConfig } from '../../src/engine/config';
import type { SyntheticSpeaker } from '../../src/engine/sim/syntheticSpeech';

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

/** Ask Kora with a model (`POST /genie/author/edit`, D127). Null: not offered, and the app uses its rules. */
export interface AuthorEditor {
  edit(req: AuthorEditRequest): Promise<AuthorEditResponse | null>;
}

export interface TranscriptResult { kind: 'partial' | 'final'; text: string }

export interface TranscriptionOptions {
  /** Container and codec, as MediaRecorder reports it, for example `audio/webm;codecs=opus`. */
  mimeType: string;
  /** The speech mode the app records in. */
  mode: 'pushToTalk' | 'openMic';
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

/** The server's logger as the `ai/` module takes it. */
export interface AiLogger { info(msg: string, f?: Record<string, unknown>): void; warn(msg: string, f?: Record<string, unknown>): void; error(msg: string, f?: Record<string, unknown>): void }

/**
 * What each `ai/` factory receives: the role's config from the module's own `configFromEnv(process.env)`
 * (ai/src/env.ts; every variable is in docs/AI.md section 8), with `provider` from AI_PROVIDER and the
 * server's JSON logger. The evaluator also gets `onAudit`, which logs how each evaluation went.
 */
export interface AiRoleConfigs {
  npc: { provider: 'mock' | 'anthropic'; logger: AiLogger; [k: string]: unknown };
  evaluator: { provider: 'mock' | 'anthropic'; logger: AiLogger; onAudit(audit: Record<string, unknown>): void; [k: string]: unknown };
  author: { provider: 'mock' | 'anthropic'; logger: AiLogger; [k: string]: unknown };
  transcriber: { provider: 'mock' | 'http'; logger: AiLogger; http?: { url: string; key?: string }; [k: string]: unknown };
  synthetic: { provider: 'mock' | 'anthropic'; logger: AiLogger; [k: string]: unknown };
}

/** The `ai/` module's exports (ai/src/index.ts). Factories may be async. */
export interface AiModule {
  createNpcModel(config: AiRoleConfigs['npc']): NpcModel | Promise<NpcModel>;
  createEvaluator(config: AiRoleConfigs['evaluator']): Evaluator | Promise<Evaluator>;
  createAuthorDrafter(config: AiRoleConfigs['author']): AuthorDrafter | Promise<AuthorDrafter>;
  /** Ask Kora with a model (D127). Optional: without it `/genie/author/edit` answers 501 and the app's rules answer. */
  createAuthorEditor?(config: AiRoleConfigs['author']): AuthorEditor | Promise<AuthorEditor>;
  createTranscriber?(config: AiRoleConfigs['transcriber']): unknown;
  /** GenieKreator's synthetic players with AI (D112): a persona's lines in a calibration. Optional: without it the templates speak. */
  createSyntheticPlayer?(config: AiRoleConfigs['synthetic']): SyntheticSpeaker | Promise<SyntheticSpeaker>;
  configFromEnv?(env: Record<string, string | undefined>): Partial<Record<keyof AiRoleConfigs, Record<string, unknown>>>;
  sceneFromStoryline?(storyline: StorylineConfig): Record<string, unknown>;
}

/** The ports the server runs with. */
export interface AiPorts {
  provider: 'mock' | 'anthropic';
  npc: NpcModel;
  evaluator: Evaluator;
  author: AuthorDrafter;
  /** Ask Kora with a model (D127). Unset: `/genie/author/edit` answers 501 and the app reads instructions with its rules. */
  editor?: AuthorEditor;
  /** Null: speech is off (`SPEECH_PROVIDER=off`), and the transcription routes answer 501. */
  transcriber: Transcriber | null;
  /** Synthetic players' words in a calibration (D112). Unset: the engine's offline templates. */
  synthetic?: SyntheticSpeaker;
  /** The storyline's scene for NPC calls (the ai/ module's `sceneFromStoryline`: locale, organisation, sponsor). */
  scene?(storyline: StorylineConfig): Record<string, unknown>;
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
