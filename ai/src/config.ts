import type { LlmTransport } from './llm/transport';
import type { AiLogger, EvaluationAudit, EvaluatorInput, Provider } from './types';

/**
 * Configuration for the factories. Everything is passed in this object: the AI layer never reads the
 * environment itself. `configFromEnv` (env.ts) is the mapping the server can use; docs/AI.md lists every
 * field with its recommended environment variable.
 */

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** One model role's settings. Only the model id has to be right; the rest have sensible defaults. */
export interface ModelSettings {
  /** Model id. */
  model: string;
  /** Output ceiling for one call, thinking included. */
  maxTokens: number;
  /** How much the model thinks before it answers. Lower is faster and cheaper. */
  effort: Effort;
  /** Sampling temperature. Sent only when set: current default models reject sampling parameters. */
  temperature?: number;
  /** Per request timeout. A timed out request is retried up to `maxRetries` times. */
  timeoutMs: number;
  /** Retries on rate limits, overload, 5xx, timeouts and connection errors (the SDK's retry policy). */
  maxRetries: number;
}

/** Anthropic connection settings shared by every role. */
export interface AnthropicSettings {
  /** API key. Left out, the SDK resolves its own default credentials. Never commit a key. */
  apiKey?: string;
  /** API base URL, for a gateway or proxy. */
  baseURL?: string;
  /**
   * When a request is declined by a safety classifier, the API re-runs it on the recommended fallback
   * model in the same call (server side fallbacks). On by default; turn it off on platforms without it.
   */
  refusalFallback?: boolean;
  /** Cache the stable prompt prefix (instructions, storyline, persona, rubric). On by default. */
  promptCaching?: boolean;
  /** Cache lifetime: 5 minutes (default) or 1 hour (worth it for long cohorts on one storyline). */
  cacheTtl?: '5m' | '1h';
  /** A ready made transport. Tests pass a fake; the server never needs this. */
  transport?: LlmTransport;
}

interface Common {
  provider: Provider;
  anthropic?: AnthropicSettings;
  /** Overrides of the role's model settings. */
  model?: Partial<ModelSettings>;
  logger?: AiLogger;
}

export interface NpcModelConfig extends Common {
  /**
   * How streamed words are released. `sentence` (default) holds each sentence until the guardrails have
   * read it, so a line that breaks a guardrail never reaches the participant. `none` releases words as
   * they arrive and only checks the whole reply at the end (lower latency, weaker guarantee).
   */
  holdBack?: 'sentence' | 'none';
}

export interface EvaluatorConfig extends Common {
  /** Called with every evaluation's audit record (store it with the interaction). */
  onAudit?(audit: EvaluationAudit, input: EvaluatorInput): void;
  /** Repair retries after an answer that fails validation. Default 1. Then the mock answers and an error is logged. */
  repairRetries?: number;
}

export interface AuthorDrafterConfig extends Common {
  repairRetries?: number;
}

export interface HttpSpeechSettings {
  /** Base URL of the streaming speech to text service (SPEECH_URL). */
  url: string;
  /** Credential for the service (SPEECH_KEY). Sent as `Authorization: Bearer <key>` unless changed below. */
  key?: string;
  /** Header that carries the key. Default `Authorization`. */
  authHeader?: string;
  /** Scheme before the key. Default `Bearer`; empty string sends the bare key (for `x-api-key` style headers). */
  authScheme?: string;
  /** Per request timeout. Default 15000. */
  timeoutMs?: number;
  /** Extra headers, for example a tenant id. */
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export interface TranscriberConfig {
  provider: 'mock' | 'http';
  http?: HttpSpeechSettings;
  /** Mock: the words it pretends to hear, one segment or several. */
  mock?: { script?: string | string[]; wordsPerChunk?: number };
  logger?: AiLogger;
}

/** Model ids appear only here, as configuration defaults. */
export const DEFAULTS: Record<'npc' | 'evaluator' | 'author', ModelSettings> = {
  npc: { model: 'claude-opus-5-5', maxTokens: 2048, effort: 'low', timeoutMs: 30_000, maxRetries: 2 },
  evaluator: { model: 'claude-opus-5-5', maxTokens: 16_000, effort: 'high', timeoutMs: 120_000, maxRetries: 2 },
  author: { model: 'claude-opus-5-5', maxTokens: 32_000, effort: 'high', timeoutMs: 300_000, maxRetries: 2 }
};

export function settingsFor(role: keyof typeof DEFAULTS, override?: Partial<ModelSettings>): ModelSettings {
  const out = { ...DEFAULTS[role] };
  for (const [k, v] of Object.entries(override ?? {})) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

export const consoleLogger: AiLogger = {
  info: (m, d) => console.info(`[ai] ${m}`, d ?? ''),
  warn: (m, d) => console.warn(`[ai] ${m}`, d ?? ''),
  error: (m, d) => console.error(`[ai] ${m}`, d ?? '')
};

export const silentLogger: AiLogger = { info() {}, warn() {}, error() {} };
