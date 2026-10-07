import type { z } from 'zod';
import type { ModelSettings } from '../config';
import type { AiLogger } from '../types';

/**
 * A provider neutral view of one model call. The Anthropic transport (anthropic.ts) turns it into SDK
 * parameters; tests use the fake transport (fake.ts). Everything the implementations do (prompt
 * assembly, validation, repair, guardrails, fallbacks) is written against this, so it is tested without
 * a network.
 */

export interface TextBlock {
  text: string;
  /** Marks the end of a stable prefix: everything up to and including this block is cached. */
  cache?: boolean;
}

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string | TextBlock[];
}

export interface LlmRequest {
  /** What the call is for, in logs. */
  label: string;
  settings: ModelSettings;
  /** Stable instructions first, then stable context; mark the last stable block `cache`. */
  system: TextBlock[];
  messages: LlmMessage[];
  /** Structured output: the reply is JSON matching this schema. */
  jsonSchema?: Record<string, unknown>;
}

export interface LlmUsage { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }

export interface LlmResult {
  text: string;
  /** `end_turn`, `max_tokens`, `refusal`, ... */
  stopReason: string | null;
  model: string;
  usage: LlmUsage;
}

export type LlmStreamEvent = { type: 'text'; text: string } | { type: 'end'; result: LlmResult };

export interface LlmTransport {
  complete(req: LlmRequest, signal?: AbortSignal): Promise<LlmResult>;
  /** Text deltas, then one `end`. Aborting the signal ends the iteration quietly (no `end`). */
  stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmStreamEvent>;
}

export const NO_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export class RefusalError extends Error {
  constructor(label: string) { super(`${label}: the model declined the request`); this.name = 'RefusalError'; }
}

export class StructuredOutputError extends Error {
  constructor(message: string, readonly attempts: Array<{ raw: string; issues: string[] }>) { super(message); this.name = 'StructuredOutputError'; }
}

export const isAbort = (e: unknown, signal?: AbortSignal) => !!signal?.aborted || (e instanceof Error && (e.name === 'AbortError' || e.name === 'APIUserAbortError'));

/** The JSON object in a reply: the whole text, or the first `{` to the last `}` when the model added words around it. */
export function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('The reply holds no JSON object');
  }
}

export interface StructuredOptions<T> {
  /** Checks beyond the schema (for example keys that must be among the requested ones). Return issues, or none. */
  check?(value: T): string[];
  /** How many repair retries after a failed answer. */
  repairs: number;
  /** The repair instruction, with `{{issues}}` for the list of problems. */
  repairPrompt: string;
  signal?: AbortSignal;
  logger: AiLogger;
}

export interface StructuredResult<T> { value: T; repaired: boolean; result: LlmResult; usage: LlmUsage }

const add = (a: LlmUsage, b: LlmUsage): LlmUsage => ({
  inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens,
  cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens, cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens
});

/**
 * One structured call: the reply is parsed and validated with the Zod schema (and `check`). A reply that
 * fails is sent back once with its issues for a repair. Still failing, it throws `StructuredOutputError`
 * and the caller falls back to the mock. A refusal throws `RefusalError` (no repair: it would refuse again).
 */
export async function structuredCall<T>(transport: LlmTransport, req: LlmRequest, schema: z.ZodType<T>, o: StructuredOptions<T>): Promise<StructuredResult<T>> {
  const attempts: Array<{ raw: string; issues: string[] }> = [];
  let messages = req.messages;
  let usage = NO_USAGE;
  for (let attempt = 0; attempt <= o.repairs; attempt++) {
    const result = await transport.complete({ ...req, messages }, o.signal);
    usage = add(usage, result.usage);
    if (result.stopReason === 'refusal') throw new RefusalError(req.label);
    let issues: string[];
    let value: T | undefined;
    try {
      const parsed = schema.safeParse(extractJson(result.text));
      if (parsed.success) {
        value = parsed.data;
        issues = o.check?.(parsed.data) ?? [];
      } else issues = parsed.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`);
    } catch (e) {
      issues = [result.stopReason === 'max_tokens' ? 'The reply was cut off at the token limit' : String((e as Error).message)];
    }
    if (value !== undefined && !issues.length) return { value, repaired: attempt > 0, result, usage };
    attempts.push({ raw: result.text, issues });
    o.logger.warn(`${req.label}: reply failed validation`, { attempt, issues: issues.slice(0, 8) });
    messages = [
      ...req.messages,
      { role: 'assistant', content: result.text || '(empty)' },
      { role: 'user', content: o.repairPrompt.replace('{{issues}}', issues.slice(0, 20).map(i => `- ${i}`).join('\n')) }
    ];
  }
  throw new StructuredOutputError(`${req.label}: no valid reply after ${o.repairs + 1} attempts`, attempts);
}

/* ------------------------------------------------------------------------------------------------
 * JSON Schema helpers for structured output: every object closed, every property required (nullable
 * where optional), no numeric or length constraints (the API does not take them; Zod checks those).
 * ---------------------------------------------------------------------------------------------- */

type Schema = Record<string, unknown>;
export const js = {
  str: (description?: string): Schema => ({ type: 'string', ...(description ? { description } : {}) }),
  int: (description?: string): Schema => ({ type: 'integer', ...(description ? { description } : {}) }),
  num: (description?: string): Schema => ({ type: 'number', ...(description ? { description } : {}) }),
  bool: (description?: string): Schema => ({ type: 'boolean', ...(description ? { description } : {}) }),
  enum: (values: readonly string[], description?: string): Schema => ({ type: 'string', enum: [...values], ...(description ? { description } : {}) }),
  arr: (items: Schema, description?: string): Schema => ({ type: 'array', items, ...(description ? { description } : {}) }),
  nullable: (s: Schema): Schema => ({ anyOf: [s, { type: 'null' }] }),
  obj: (properties: Record<string, Schema>, description?: string): Schema => ({
    type: 'object', properties, required: Object.keys(properties), additionalProperties: false, ...(description ? { description } : {})
  })
};
