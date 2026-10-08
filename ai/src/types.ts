import type { AuthorDraftRequest, AuthorDraftResponse, AuthorTurnRequest, AuthorTurnResponse } from '../../src/api/author';
import type { AuthorEditRequest, AuthorEditResponse } from '../../src/api/authorEdit';
import type { EvaluationInput, Evaluator as EngineEvaluator } from '../../src/engine/sim/evaluator';
import type { NpcContext, NpcModel as EngineNpcModel, NpcReply } from '../../src/engine/sim/live';
import type { Band, Evaluation } from '../../src/engine/sim/types';
import type { StorylineConfig } from '../../src/engine/config';

/** The storyline's world (D130): company, product, market and the sponsor's voice. */
export type StorylineWorld = NonNullable<StorylineConfig['world']>;

/**
 * The AI layer's public contracts (docs/AI.md). Every interface here is satisfied by a mock (no model,
 * deterministic, used by tests, demos and the quality gates offline) and by an Anthropic implementation.
 * The engine's own interfaces (`NpcModel` in src/engine/sim/live.ts, `Evaluator` in
 * src/engine/sim/evaluator.ts) are extended, never changed, so the server can hand these objects
 * straight to the engine.
 */

export type { Band, Evaluation, EvaluationInput, NpcContext, NpcReply };

export type Provider = 'mock' | 'anthropic';

/** Where a log line goes. The default writes to the console; the server can pass its own logger. */
export interface AiLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface CallOptions {
  /** Aborts the call. A streamed NPC reply stops at once and the stream ends without a `done` event. */
  signal?: AbortSignal;
}

/* ------------------------------------------------------------------------------------------------
 * NPC
 * ---------------------------------------------------------------------------------------------- */

/** One line said so far in the conversation. `by` is 'you' for the participant, else a person id or 'sponsor'. */
export interface HistoryTurn {
  by: string;
  /** The speaker's display name, when it is not the participant. */
  name?: string;
  text: string;
  /** The participant spoke over this line: it stopped here. */
  interrupted?: boolean;
}

/** What the NPC knows about the scene, beyond the engine's `NpcContext`. Everything is optional. */
export interface NpcScene {
  /** BCP 47 locale of the run (the storyline's language). Replies are written in it. Default `en`. */
  locale?: string;
  /** The conversation so far, oldest first, not counting `said`. */
  history?: HistoryTurn[];
  /** The organisation, product and sponsor, for small talk that stays in the story. */
  story?: { name?: string; organisation?: string; sponsor?: { name: string; title: string }; product?: string; world?: StorylineWorld };
  /** Team meeting: who is in the room, who has the floor (the speaker) and who has a hand up. */
  meeting?: { attendees: Array<{ id: string; name: string; title?: string }>; hands: string[] };
  /** The team feels unsafe (Safety below 40, scoring-and-report.md 2.3): concerns are harder to surface. */
  guarded?: boolean;
  /** Interview: the role being hired for. */
  role?: string;
  /** The lens's styles, so the character sheet names the styles a persona reacts to (D130). */
  styles?: Array<{ key: string; name: string; short?: string }>;
}

/** The engine's context plus the scene. The engine's `NpcContext` alone is enough; the scene makes replies better. */
export type NpcTurnContext = NpcContext & NpcScene;

export type NpcStreamEvent =
  /** Words to show (and speak). Already filtered and sanitized for the copy rules. */
  | { type: 'token'; text: string }
  /** The whole reply, with the signals the engine reads. Always the last event unless the call was aborted. */
  | { type: 'done'; reply: NpcReply; meta: NpcReplyMeta };

export interface NpcReplyMeta {
  provider: Provider;
  promptVersion: string;
  model: string | null;
  /** The reply came from the persona stand in because the model failed, refused or broke a guardrail. */
  fallback: boolean;
  /** Guardrails that fired on this reply (for example `leak`, `outOfRole`). */
  guards: string[];
  latencyMs: number;
}

/**
 * The NPC's words for one turn: a streamed persona reply that follows the storyline persona, the hidden
 * concern, mood, trust, the conversation so far, the format and the meeting floor. `reply` satisfies the
 * engine's `NpcModel`; `stream` is what the server sends to the client as server sent events.
 */
export interface NpcModel extends EngineNpcModel {
  readonly provider: Provider;
  reply(ctx: NpcTurnContext, opts?: CallOptions): Promise<NpcReply>;
  stream(ctx: NpcTurnContext, opts?: CallOptions): AsyncIterable<NpcStreamEvent>;
}

/* ------------------------------------------------------------------------------------------------
 * Evaluator
 * ---------------------------------------------------------------------------------------------- */

/** A skill the interaction rates, with its anchors (lowest level first), so the model reads the framework. */
export interface SkillDef { key: string; name: string; anchors?: string[]; description?: string }

/**
 * The engine's `EvaluationInput` plus the context a model needs. The model sees the participant's words
 * only: `usedVoice` is passed through to the result and never reaches the model (score the words, not
 * the voice).
 */
export interface EvaluatorInput extends EvaluationInput {
  /** BCP 47 locale of the run. Reasons are written in it; scoring reads content in any language. */
  locale?: string;
  actionKey?: string;
  actionName?: string;
  /** What the participant was asked to do (LiveSettings.goal). */
  goal?: string;
  /** Rubric dimensions with their authored labels (LiveSettings.rubric). Overrides `rubric` keys' labels. */
  rubricLabels?: Record<string, string>;
  /** Names and anchors of the skills in `skills`. Left out, the default framework's. */
  skillDefs?: SkillDef[];
  /** The whole conversation, for context. Only the participant's turns can be quoted. */
  transcript?: HistoryTurn[];
  /** Who the participant spoke to, and the concern they carry (to judge whether it was invited). Never quoted back. */
  counterpart?: { name: string; title?: string; hiddenConcern?: string };
  /** Action keys a promise can be fulfilled by. Default: the engine's follow up actions. */
  promiseActions?: string[];
}

/** Audit record for every evaluation (the report's methodology and the assessor review read it). */
export interface EvaluationAudit {
  provider: Provider;
  /** Prompt version, `evaluator@<n>+<format>@<n>#<hash>`, recorded for every evaluation. */
  promptVersion: string;
  model: string | null;
  /** The mock produced this evaluation because the model failed twice or refused. */
  fallback: boolean;
  /** The first answer failed validation and the repair retry was used. */
  repaired: boolean;
  /** Quotes the model gave that are not verbatim in the participant's words, dropped. */
  droppedQuotes: string[];
  /** Observations dropped or lowered for want of verbatim evidence. */
  adjustments: string[];
  /** One reason per rubric dimension, in the run's locale (assessor review). */
  reasons: Record<string, string>;
  locale: string;
  latencyMs: number;
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
  error?: string;
}

/**
 * Bands per rubric dimension, the overall band, the style shown (one of the lens's styles), skill
 * observations with verbatim quotes, red flags, a promise, the intent of an email and whether the hidden
 * concern was invited. `evaluate` returns exactly the engine's `Evaluation`; `evaluateWithAudit` adds the
 * audit record.
 */
export interface Evaluator extends EngineEvaluator {
  readonly provider: Provider;
  evaluate(input: EvaluatorInput, opts?: CallOptions): Promise<Evaluation>;
  evaluateWithAudit(input: EvaluatorInput, opts?: CallOptions): Promise<{ evaluation: Evaluation; audit: EvaluationAudit }>;
  reply?(input: { format: string; text: string; band: Band }): string | Promise<string>;
}

/* ------------------------------------------------------------------------------------------------
 * Author drafter
 * ---------------------------------------------------------------------------------------------- */

/**
 * GenieKreator's author chat on the server (`POST /author/turn`, `POST /author/draft`). The same shapes as
 * `Drafter` in src/author/drafter.ts and src/api/author.ts. A draft always passes the storyline schema and
 * the copy guard: when the model's does not, after one repair, the templates draft is returned.
 */
export interface AuthorDrafter {
  readonly provider: Provider;
  readonly source: 'server' | 'templates';
  turn(req: AuthorTurnRequest, opts?: CallOptions): Promise<AuthorTurnResponse>;
  draft(req: AuthorDraftRequest, opts?: CallOptions): Promise<AuthorDraftResponse>;
}

/**
 * Ask Kora on the server (`POST /author/edit`, D127): an instruction and a compact view of the fields
 * Kora may change become set operations on those fields, or a reply. Null means "not offered" (the mock),
 * and the app reads the instruction with its own rules. Throws when the model's answer stays unusable.
 */
export interface AuthorEditor {
  readonly provider: Provider;
  readonly source: 'server' | 'rules';
  edit(req: AuthorEditRequest, opts?: CallOptions): Promise<AuthorEditResponse | null>;
}

/* ------------------------------------------------------------------------------------------------
 * Transcriber (server side speech to text)
 * ---------------------------------------------------------------------------------------------- */

export interface TranscriptResult { kind: 'partial' | 'final'; text: string }

export interface TranscriberOpenOptions {
  /** Container and codec of the chunks, as the browser's MediaRecorder reports it. */
  mimeType: string;
  mode: 'pushToTalk' | 'openMic';
  /** BCP 47 language of the interaction. */
  language?: string;
  /** Results as they arrive, for a server that pushes them (for example over server sent events). */
  onResult?(result: TranscriptResult): void;
  signal?: AbortSignal;
}

/**
 * One transcription. Mirrors the browser contract (docs/SPEECH.md): chunks in `seq` order, a repeated
 * `seq` is ignored, `end` returns the remaining finals, `abort` discards audio and text. Only text comes
 * back: no audio is kept and nothing is inferred from the voice.
 */
export interface TranscriberSession {
  readonly id: string;
  push(chunk: Uint8Array, seq: number): Promise<TranscriptResult[]>;
  end(): Promise<TranscriptResult[]>;
  abort(): Promise<void>;
}

export interface Transcriber {
  readonly provider: 'mock' | 'http';
  open(options: TranscriberOpenOptions): Promise<TranscriberSession>;
}
