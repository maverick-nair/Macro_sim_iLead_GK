import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage, BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages';
import type { AnthropicSettings } from '../config';
import { isAbort, NO_USAGE, type LlmRequest, type LlmResult, type LlmStreamEvent, type LlmTransport, type LlmUsage, type TextBlock } from './transport';

/**
 * The Anthropic transport: an `LlmRequest` becomes a Messages API call through the official SDK.
 *
 * - Every call streams (`messages.stream`), and structured calls read the final message: long outputs
 *   never hit an HTTP timeout, and NPC replies show their first words early.
 * - Thinking is left to the model's default (adaptive); `effort` sets how much it thinks.
 * - The stable prefix (instructions, storyline, persona, rubric) carries a cache breakpoint.
 * - Structured output uses `output_config.format` with a JSON schema; the caller validates with Zod.
 * - Refusals: with `refusalFallback` the API re-runs a declined request on the recommended fallback
 *   model; a final `refusal` stop reason is returned for the caller to handle.
 * - Timeouts and retries are per request (the SDK retries 408, 409, 429, 5xx and connection errors).
 */

export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type StreamParams = BetaMessageStreamParams;

/** The part of the SDK client this transport uses, so tests can pass a fake. A real `Anthropic` client fits. */
export interface AnthropicStreamLike extends AsyncIterable<{ type: string; delta?: unknown }> {
  finalMessage(): Promise<BetaMessage>;
}
export interface AnthropicClientLike {
  beta: { messages: { stream(body: StreamParams, options?: { signal?: AbortSignal; timeout?: number; maxRetries?: number }): AnthropicStreamLike } };
}

/** The SDK request body for an `LlmRequest`. Exported for tests: what is cached, what is sent. */
export function toParams(req: LlmRequest, s: Pick<AnthropicSettings, 'refusalFallback' | 'promptCaching' | 'cacheTtl'> = {}): StreamParams {
  const caching = s.promptCaching ?? true;
  const cacheControl = { type: 'ephemeral' as const, ...(s.cacheTtl === '1h' ? { ttl: '1h' as const } : {}) };
  const block = (b: TextBlock) => ({ type: 'text' as const, text: b.text, ...(caching && b.cache ? { cache_control: cacheControl } : {}) });
  const params: StreamParams = {
    model: req.settings.model,
    max_tokens: req.settings.maxTokens,
    system: req.system.map(block),
    messages: req.messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : m.content.map(block) })),
    output_config: {
      effort: req.settings.effort,
      ...(req.jsonSchema ? { format: { type: 'json_schema' as const, schema: req.jsonSchema } } : {})
    },
    ...(req.settings.temperature !== undefined ? { temperature: req.settings.temperature } : {})
  };
  if (s.refusalFallback ?? true) {
    params.betas = [FALLBACK_BETA];
    params.fallbacks = 'default';
  }
  return params;
}

function usageOf(m: BetaMessage | null): LlmUsage {
  if (!m) return NO_USAGE;
  const u = m.usage;
  return { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 };
}

function resultOf(m: BetaMessage): LlmResult {
  const text = m.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
  return { text, stopReason: m.stop_reason ?? null, model: m.model, usage: usageOf(m) };
}

const textDelta = (e: { type: string; delta?: unknown }): string | null => {
  if (e.type !== 'content_block_delta' || !e.delta || typeof e.delta !== 'object') return null;
  const d = e.delta as { type?: string; text?: string };
  return d.type === 'text_delta' && typeof d.text === 'string' ? d.text : null;
};

export function createAnthropicTransport(settings: AnthropicSettings = {}, client?: AnthropicClientLike): LlmTransport {
  const sdk: AnthropicClientLike = client ?? new Anthropic({ ...(settings.apiKey ? { apiKey: settings.apiKey } : {}), ...(settings.baseURL ? { baseURL: settings.baseURL } : {}) });
  const open = (req: LlmRequest, signal?: AbortSignal) =>
    sdk.beta.messages.stream(toParams(req, settings), { signal, timeout: req.settings.timeoutMs, maxRetries: req.settings.maxRetries });

  return {
    async complete(req, signal) {
      const stream = open(req, signal);
      return resultOf(await stream.finalMessage());
    },
    async *stream(req, signal): AsyncGenerator<LlmStreamEvent> {
      const stream = open(req, signal);
      try {
        for await (const event of stream) {
          const t = textDelta(event);
          if (t) yield { type: 'text', text: t };
        }
        yield { type: 'end', result: resultOf(await stream.finalMessage()) };
      } catch (e) {
        if (isAbort(e, signal)) return;
        throw e;
      }
    }
  };
}
