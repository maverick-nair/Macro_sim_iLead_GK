import { personaNpc } from '../../../src/engine/sim/live';
import { silentLogger, type ModelSettings } from '../config';
import { ReplyFilter, type GuardContext, type NpcGuard } from '../guards/npc';
import type { LlmResult, LlmTransport } from '../llm/transport';
import type { AiLogger, CallOptions, NpcModel, NpcReply, NpcReplyMeta, NpcStreamEvent, NpcTurnContext } from '../types';
import { wordEnglish } from '../../../src/i18n/engineCopyEn';
import { buildNpcRequest, npcPromptVersion, TRUST_FLOOR } from './prompt';

/**
 * NPC models. Both run every reply through the same guardrails (guards/npc.ts) and stream it the same
 * way, so the server treats them alike. The mock is the engine's persona stand in (`personaNpc`); it is
 * also the fallback when the model fails, refuses or breaks a guardrail before any word was shown.
 */

const guardContext = (ctx: NpcTurnContext): GuardContext => ({
  hiddenConcern: ctx.speaker.persona?.hiddenConcern,
  concernLine: ctx.speaker.persona?.concernLine,
  shareBlocked: ctx.concernRevealed ? false : ctx.speaker.trust < TRUST_FLOOR || !!ctx.guarded
});

/** Whether a reply may count as the concern surfacing. The model proposes; these rules have the last word. */
const mayReveal = (ctx: NpcTurnContext) => !!ctx.speaker.persona?.concernLine && !ctx.concernRevealed && ctx.speaker.trust >= TRUST_FLOOR && !ctx.guarded;

async function collect(stream: AsyncIterable<NpcStreamEvent>): Promise<NpcReply> {
  let reply: NpcReply | null = null;
  for await (const e of stream) if (e.type === 'done') reply = e.reply;
  if (!reply) throw Object.assign(new Error('The reply was cancelled'), { name: 'AbortError' });
  return reply;
}

/** The persona stand in as a stream: its reply, word by word, through the guardrails. */
async function* personaStream(ctx: NpcTurnContext, signal: AbortSignal | undefined, meta: Omit<NpcReplyMeta, 'latencyMs'>, started: number): AsyncGenerator<NpcStreamEvent> {
  const r = await personaNpc.reply(ctx);
  const filter = new ReplyFilter(guardContext(ctx), 'sentence');
  for (const word of wordEnglish(r.text).split(/(?<=\s)/)) {
    if (signal?.aborted) return;
    for (const text of filter.push(word)) yield { type: 'token', text };
    await Promise.resolve();
  }
  for (const text of filter.finish().out) yield { type: 'token', text };
  if (signal?.aborted) return;
  const text = filter.text || r.text;
  yield { type: 'done', reply: { text, ...(r.revealsConcern ? { revealsConcern: true } : {}), ...(r.signsOff ? { signsOff: true } : {}) }, meta: { ...meta, guards: [...meta.guards, ...filter.guards], latencyMs: Date.now() - started } };
}

export function createMockNpcModel(): NpcModel {
  const meta = { provider: 'mock' as const, promptVersion: 'persona-mock@1', model: null, fallback: false, guards: [] };
  const model: NpcModel = {
    provider: 'mock',
    stream: (ctx, opts) => personaStream(ctx, opts?.signal, meta, Date.now()),
    reply: (ctx, opts) => collect(model.stream(ctx, opts))
  };
  return model;
}

export interface AnthropicNpcOptions {
  transport: LlmTransport;
  settings: ModelSettings;
  holdBack?: 'sentence' | 'none';
  logger?: AiLogger;
}

export function createAnthropicNpcModel(o: AnthropicNpcOptions): NpcModel {
  const log = o.logger ?? silentLogger;
  const mode = o.holdBack ?? 'sentence';

  async function* stream(ctx: NpcTurnContext, opts?: CallOptions): AsyncGenerator<NpcStreamEvent> {
    const started = Date.now();
    const promptVersion = npcPromptVersion();
    const inner = new AbortController();
    const onAbort = () => inner.abort();
    opts?.signal?.addEventListener('abort', onAbort, { once: true });
    if (opts?.signal?.aborted) return;
    const filter = new ReplyFilter(guardContext(ctx), mode);
    const guards: NpcGuard[] = [];
    let result: LlmResult | null = null;
    let shown = false;
    try {
      try {
        for await (const ev of o.transport.stream(buildNpcRequest(ctx, o.settings), inner.signal)) {
          if (ev.type === 'end') { result = ev.result; continue; }
          for (const text of filter.push(ev.text)) { shown = true; yield { type: 'token', text }; }
          if (filter.blocked) { inner.abort(); break; }
        }
      } catch (e) {
        if (opts?.signal?.aborted) return;
        guards.push('error');
        log.error('npc: the model call failed; using the persona stand in', { error: String(e), speaker: ctx.speaker.id });
      }
      if (opts?.signal?.aborted) return;
      if (result?.stopReason === 'refusal') guards.push('refusal');
      const fin = filter.finish();
      if (!guards.includes('refusal')) for (const text of fin.out) { shown = true; yield { type: 'token', text }; }
      guards.push(...filter.guards);
      if (!filter.text && !guards.length) guards.push('empty');
      const meta = { provider: 'anthropic' as const, promptVersion, model: result?.model ?? o.settings.model, guards, latencyMs: 0 };
      const violated = filter.blocked;
      const failed = guards.includes('error') || guards.includes('refusal') || !filter.text;
      if ((violated || failed) && !shown) {
        // Nothing was shown yet: the persona stand in answers instead.
        log.warn('npc: reply replaced by the persona stand in', { guards, speaker: ctx.speaker.id });
        yield* personaStream(ctx, opts?.signal, { ...meta, fallback: true }, started);
        return;
      }
      if (violated && mode === 'none') {
        // Words were shown as they came: the reply the engine keeps is the stand in's.
        log.warn('npc: a shown reply broke a guardrail; the engine keeps the stand in', { guards, speaker: ctx.speaker.id });
        const r = await personaNpc.reply(ctx);
        yield { type: 'done', reply: { text: r.text, ...(r.signsOff ? { signsOff: true } : {}) }, meta: { ...meta, fallback: true, latencyMs: Date.now() - started } };
        return;
      }
      if (guards.length) log.warn('npc: the reply stopped early', { guards, speaker: ctx.speaker.id });
      const reply: NpcReply = { text: filter.text };
      if (!violated && !failed && fin.signals.reveal && mayReveal(ctx)) reply.revealsConcern = true;
      if (!violated && !failed && fin.signals.end) reply.signsOff = true;
      yield { type: 'done', reply, meta: { ...meta, fallback: false, latencyMs: Date.now() - started } };
    } finally {
      opts?.signal?.removeEventListener('abort', onAbort);
    }
  }

  const model: NpcModel = {
    provider: 'anthropic',
    stream,
    reply: (ctx, opts) => collect(stream(ctx, opts))
  };
  return model;
}
