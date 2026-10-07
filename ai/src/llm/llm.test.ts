import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { settingsFor, silentLogger } from '../config';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { languageName, loadPrompt, parsePrompt, render, versionOf } from '../prompts';
import { createAnthropicTransport, FALLBACK_BETA, toParams, type AnthropicClientLike } from './anthropic';
import { createFakeTransport } from './fake';
import { extractJson, RefusalError, StructuredOutputError, structuredCall, type LlmRequest } from './transport';

const req = (over: Partial<LlmRequest> = {}): LlmRequest => ({
  label: 'test', settings: settingsFor('evaluator'),
  system: [{ text: 'rules' }, { text: 'context', cache: true }],
  messages: [{ role: 'user', content: 'hello' }], ...over
});

describe('prompts', () => {
  it('parses the header and versions the text with a hash', () => {
    const p = parsePrompt('---\nid: demo\nversion: 3\n---\nSay {{what}}.');
    expect(p).toMatchObject({ id: 'demo', version: 3, text: 'Say {{what}}.' });
    expect(versionOf(p)).toMatch(/^demo@3#[0-9a-f]{8}$/);
    expect(versionOf(parsePrompt('---\nid: demo\nversion: 3\n---\nSay it.'))).not.toBe(versionOf(p));
    expect(() => parsePrompt('no header')).toThrow(/header/);
    expect(() => parsePrompt('---\nid: x\nversion: zero\n---\nx')).toThrow(/version/);
  });

  it('fills placeholders and refuses a missing one', () => {
    expect(render('Hi {{name}}, {{n}} left', { name: 'Kent', n: 2 })).toBe('Hi Kent, 2 left');
    expect(() => render('Hi {{nme}}', { name: 'Kent' })).toThrow(/nme/);
  });

  it('every prompt file loads with an id and a version, and none uses dashes as punctuation', () => {
    const dir = fileURLToPath(new URL('../../prompts/', import.meta.url));
    const names = [...readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)), ...readdirSync(`${dir}evaluator`).map(f => `evaluator/${f.slice(0, -3)}`)];
    expect(names.length).toBeGreaterThanOrEqual(13);
    for (const n of names) {
      const p = loadPrompt(n);
      expect(p.version).toBeGreaterThanOrEqual(1);
      expect(p.text, n).not.toMatch(/[—–]|[^\S\n]-[^\S\n]/);
    }
  });

  it('names the run language for the model', () => {
    expect(languageName('es-MX')).toMatch(/Spanish/);
    expect(languageName('en')).toBe('English');
  });
});

describe('Anthropic request parameters', () => {
  it('caches the stable prefix, sets effort and the schema, and opts into refusal fallbacks', () => {
    const p = toParams(req({ jsonSchema: { type: 'object' } }));
    expect(p.model).toBe(settingsFor('evaluator').model);
    expect(p.max_tokens).toBe(settingsFor('evaluator').maxTokens);
    expect(p.system).toEqual([{ type: 'text', text: 'rules' }, { type: 'text', text: 'context', cache_control: { type: 'ephemeral' } }]);
    expect(p.output_config).toEqual({ effort: 'high', format: { type: 'json_schema', schema: { type: 'object' } } });
    expect(p.betas).toEqual([FALLBACK_BETA]);
    expect(p.fallbacks).toBe('default');
    expect('temperature' in p).toBe(false);
    expect('thinking' in p).toBe(false);
  });

  it('follows the settings: no caching, an hour cache, no fallbacks, a temperature', () => {
    expect(toParams(req(), { promptCaching: false }).system).toEqual([{ type: 'text', text: 'rules' }, { type: 'text', text: 'context' }]);
    expect((toParams(req(), { cacheTtl: '1h' }).system as Array<{ cache_control?: unknown }>)[1].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    const p = toParams(req({ settings: { ...settingsFor('npc'), temperature: 0.4 } }), { refusalFallback: false });
    expect(p.betas).toBeUndefined();
    expect(p.fallbacks).toBeUndefined();
    expect(p.temperature).toBe(0.4);
    expect(p.output_config).toEqual({ effort: 'low' });
  });

  it('streams text deltas through the SDK client, then the final message, with per request timeout and retries', async () => {
    const calls: unknown[] = [];
    const final = { model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hi there' }], usage: { input_tokens: 5, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: null } };
    const client = {
      beta: { messages: { stream(body: unknown, options: unknown) {
        calls.push({ body, options });
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'message_start' };
            yield { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'x' } };
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi ' } };
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'there' } };
          },
          finalMessage: async () => final
        };
      } } }
    } as unknown as AnthropicClientLike;
    const t = createAnthropicTransport({}, client);
    const events = [];
    for await (const e of t.stream(req())) events.push(e);
    expect(events).toEqual([{ type: 'text', text: 'Hi ' }, { type: 'text', text: 'there' }, { type: 'end', result: { text: 'Hi there', stopReason: 'end_turn', model: 'm', usage: { inputTokens: 5, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 0 } } }]);
    expect(await t.complete(req())).toMatchObject({ text: 'Hi there' });
    expect(calls[0]).toMatchObject({ options: { timeout: settingsFor('evaluator').timeoutMs, maxRetries: 2 } });
  });

  it('ends a stream quietly when the caller aborts', async () => {
    const ac = new AbortController();
    const client = { beta: { messages: { stream: () => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } };
        ac.abort();
        throw Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' });
      },
      finalMessage: async () => { throw new Error('never'); }
    }) } } } as unknown as AnthropicClientLike;
    const out = [];
    for await (const e of createAnthropicTransport({}, client).stream(req(), ac.signal)) out.push(e);
    expect(out).toEqual([{ type: 'text', text: 'Hi' }]);
  });
});

describe('structured calls', () => {
  const Shape = z.object({ n: z.number().int() });
  const opts = { repairs: 1, repairPrompt: 'Fix:\n{{issues}}', logger: silentLogger };

  it('reads JSON, even with words around it', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":1} done')).toEqual({ a: 1 });
    expect(() => extractJson('nothing')).toThrow();
  });

  it('returns a valid first answer without repair', async () => {
    const t = createFakeTransport(['{"n":2}']);
    const r = await structuredCall(t, req(), Shape, opts);
    expect(r).toMatchObject({ value: { n: 2 }, repaired: false });
  });

  it('repairs once: the bad answer and its issues go back to the model', async () => {
    const t = createFakeTransport(['{"n":"two"}', '{"n":2}']);
    const r = await structuredCall(t, req(), Shape, opts);
    expect(r).toMatchObject({ value: { n: 2 }, repaired: true });
    const second = t.requests[1].messages;
    expect(second).toHaveLength(3);
    expect(second[1]).toEqual({ role: 'assistant', content: '{"n":"two"}' });
    expect(second[2].content).toMatch(/^Fix:\n- n: /);
  });

  it('counts check issues as failures, and gives up after the repair', async () => {
    const warn = vi.fn();
    const t = createFakeTransport(['{"n":1}', 'not json']);
    const err = await structuredCall(t, req(), Shape, { ...opts, logger: { ...silentLogger, warn }, check: v => (v.n < 2 ? ['n: too small'] : []) }).catch(e => e);
    expect(err).toBeInstanceOf(StructuredOutputError);
    expect((err as StructuredOutputError).attempts.map(a => a.issues[0])).toEqual(['n: too small', expect.stringMatching(/JSON/)]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not repair a refusal', async () => {
    const t = createFakeTransport([{ text: '', stopReason: 'refusal' }, '{"n":1}']);
    await expect(structuredCall(t, req(), Shape, opts)).rejects.toBeInstanceOf(RefusalError);
    expect(t.pending).toBe(1);
  });
});
