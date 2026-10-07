import http from 'node:http';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AiConfigError, aiCandidates, loadAi, REPO_ROOT } from '../src/ai';
import { loadConfig } from '../src/config';
import { createLogger } from '../src/log';
import { mockPorts } from '../src/ports';
import { testServer, type TestServer } from './helpers';

const log = createLogger('silent');
const cfg = (env: Record<string, string>) => loadConfig({ NODE_ENV: 'test', ...env });
const load = (env: Record<string, string>, importer?: (s: string) => Promise<unknown>) => loadAi(cfg(env), log, importer, env);
const FIXTURE = path.relative(REPO_ROOT, path.join(import.meta.dirname, 'fixtures/ai-module.ts'));

let s: TestServer;
afterEach(async () => { await s?.close(); s = undefined as unknown as TestServer; });

/** Plays into a 1:1 and sends one turn: the NPC's answer. */
async function oneTurn(server: TestServer) {
  const cookie = await server.launch({ sub: 'p-1' });
  const v = await server.json<{ members: Array<{ id: string }> }>('/engine/sessions/p-1/view', { cookie });
  await server.json('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'G'])) } });
  const plan = await server.json<{ interactionId: string }>('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'planAction', action: 'f2f', memberIds: ['kent'] } });
  const t = await server.json<{ turn: { text: string } }>('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'sendTurn', interactionId: plan.interactionId, text: 'How are you doing this week?' } });
  const end = await server.json<{ outcome: { changes: unknown[] } }>('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'endInteraction', interactionId: plan.interactionId } });
  return { cookie, turn: t.turn, end };
}

describe('AI provider wiring', () => {
  it('uses the engine\'s stand ins by default, without loading ai/', async () => {
    let imported = false;
    const ai = await load({}, async () => { imported = true; return {}; });
    expect(imported).toBe(false);
    expect(ai.provider).toBe('mock');
    expect(ai.npc).toBe(mockPorts().npc);
    expect(ai.transcriber).not.toBeNull();
    expect((await load({ SPEECH_PROVIDER: 'off' })).transcriber).toBeNull();
    // An API key alone selects the real provider, as in the ai/ module's own mapping.
    expect(cfg({ ANTHROPIC_API_KEY: 'k' }).AI_PROVIDER).toBe('anthropic');
  });

  it('looks for ai/ at the repository root and stops with a clear error when it is missing', async () => {
    expect(aiCandidates({ AI_MODULE: undefined }).map(p => path.relative(REPO_ROOT, p))).toEqual(['ai/src/index.ts', 'ai/index.ts', 'ai/dist/index.js', 'ai/src/index.js']);
    await expect(load({ AI_PROVIDER: 'anthropic', AI_MODULE: 'no/such/module.ts' })).rejects.toThrow(AiConfigError);
    await expect(load({ AI_PROVIDER: 'anthropic', AI_MODULE: 'no/such/module.ts' })).rejects.toThrow(/not found.*AI_PROVIDER=mock/);
    await expect(load({ SPEECH_PROVIDER: 'http', SPEECH_URL: 'http://speech.test', AI_MODULE: 'no/such/module.ts' })).rejects.toThrow(/SPEECH_PROVIDER=http/);
    const broken = async () => ({ createNpcModel: () => ({}), createEvaluator: () => ({ evaluate() {} }), createAuthorDrafter: () => ({ turn() {}, draft() {} }) });
    await expect(load({ AI_PROVIDER: 'anthropic', AI_MODULE: FIXTURE }, broken)).rejects.toThrow(/createNpcModel has no reply\(\)/);
    const missing = async () => ({ createNpcModel: () => ({ reply() {} }) });
    await expect(load({ AI_PROVIDER: 'anthropic', AI_MODULE: FIXTURE }, missing)).rejects.toThrow(/does not export createEvaluator/);
  });

  it('loads the real ai/ module with its own env mapping (Anthropic objects are made without calling the network)', async () => {
    const ai = await load({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key-not-real', AI_MODEL_NPC: 'some-model-id' });
    expect(ai.provider).toBe('anthropic');
    expect((ai.npc as unknown as { provider: string }).provider).toBe('anthropic');
    expect(typeof (ai.npc as unknown as { stream: unknown }).stream).toBe('function');
    expect((ai.evaluator as unknown as { provider: string }).provider).toBe('anthropic');
    expect((ai.author as unknown as { provider: string }).provider).toBe('anthropic');
  });

  it('plays a conversation through the real ai/ module\'s objects (per role mock providers, no network)', async () => {
    const ai = await load({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', AI_PROVIDER_NPC: 'mock', AI_PROVIDER_EVALUATOR: 'mock', AI_PROVIDER_AUTHOR: 'mock', AI_PROVIDER_SYNTHETIC: 'mock' });
    expect((ai.npc as unknown as { provider: string }).provider).toBe('mock');
    // Synthetic players on the mock provider: the calibration keeps the engine's templates.
    expect(ai.synthetic).toBeUndefined();
    s = await testServer({ ai });
    const { turn, end } = await oneTurn(s);
    expect(turn.text.length).toBeGreaterThan(0);
    expect(end.outcome.changes.length).toBeGreaterThan(0);
    const author = await s.launch({ sub: 'au', roles: ['author'] });
    expect((await s.req('/genie/author/turn', { method: 'POST', cookie: author, json: { brief: {}, asked: [], answers: {} } })).status).toBe(200);
  });

  it('passes the module\'s env mapping and the server\'s logger to the factories', async () => {
    const ai = await load({ AI_PROVIDER: 'anthropic', AI_MODULE: FIXTURE, AI_MODEL_NPC: 'npc-model-id' });
    expect(await ai.npc.reply({} as never)).toEqual({ text: 'Fixture model line.' });
    expect(await ai.synthetic?.say({} as never)).toBe('Fixture player line.');
    const mod = await import('./fixtures/ai-module');
    expect(mod.seen).toContainEqual(expect.objectContaining({ provider: 'anthropic', model: { model: 'npc-model-id' }, logger: expect.anything() }));
    // A drafter that offers nothing: the routes say so (501) and the app uses its templates.
    s = await testServer({ ai });
    const author = await s.launch({ sub: 'au', roles: ['author'] });
    expect((await s.req('/genie/author/turn', { method: 'POST', cookie: author, json: { brief: {}, asked: [], answers: {} } })).status).toBe(501);
  });

  it('adapts a batch transcriber to the chunked contract', async () => {
    const ai = await load({ AI_PROVIDER: 'mock', SPEECH_PROVIDER: 'http', SPEECH_URL: 'http://speech.test', AI_MODULE: FIXTURE });
    s = await testServer({ ai });
    const cookie = await s.launch({ sub: 'p-1' });
    const { id } = await s.json<{ id: string }>('/speech/transcriptions', { method: 'POST', cookie, json: { mimeType: 'audio/webm;codecs=opus', mode: 'pushToTalk' } });
    expect(await s.json(`/speech/transcriptions/${id}/chunks?seq=0`, { method: 'POST', cookie, body: new Uint8Array(10), headers: { 'content-type': 'audio/webm' } })).toEqual({ results: [] });
    expect(await s.json(`/speech/transcriptions/${id}/chunks?seq=1`, { method: 'POST', cookie, body: new Uint8Array(5), headers: { 'content-type': 'audio/webm' } })).toEqual({ results: [] });
    expect(await s.json(`/speech/transcriptions/${id}/end`, { method: 'POST', cookie })).toEqual({ results: [{ kind: 'final', text: 'heard 15 bytes' }] });
  });

  it('proxies speech to an HTTP speech service through the ai/ module\'s transcriber', async () => {
    // A speech service that speaks the chunked contract (docs/AI.md section 7).
    const seenAuth: string[] = [];
    const svc = http.createServer((req, res) => {
      seenAuth.push(String(req.headers.authorization));
      req.resume();
      req.on('end', () => {
        res.writeHead(req.method === 'DELETE' ? 204 : 200, { 'content-type': 'application/json' });
        if (req.method === 'DELETE') return res.end();
        if (req.url === '/transcriptions') return res.end(JSON.stringify({ id: 'svc-1' }));
        if (req.url?.includes('/chunks')) return res.end(JSON.stringify({ results: [{ kind: 'partial', text: 'Hello' }] }));
        res.end(JSON.stringify({ results: [{ kind: 'final', text: 'Hello team.' }] }));
      });
    });
    await new Promise<void>(r => svc.listen(0, '127.0.0.1', () => r()));
    const url = `http://127.0.0.1:${(svc.address() as { port: number }).port}`;
    try {
      const ai = await load({ SPEECH_PROVIDER: 'http', SPEECH_URL: url, SPEECH_KEY: 'speech-key' });
      s = await testServer({ ai });
      const cookie = await s.launch({ sub: 'p-1' });
      const { id } = await s.json<{ id: string }>('/speech/transcriptions', { method: 'POST', cookie, json: { mimeType: 'audio/webm', mode: 'openMic' } });
      expect(await s.json(`/speech/transcriptions/${id}/chunks?seq=0`, { method: 'POST', cookie, body: new Uint8Array(8), headers: { 'content-type': 'audio/webm' } })).toEqual({ results: [{ kind: 'partial', text: 'Hello' }] });
      expect(await s.json(`/speech/transcriptions/${id}/end`, { method: 'POST', cookie })).toEqual({ results: [{ kind: 'final', text: 'Hello team.' }] });
      expect(seenAuth.every(a => a === 'Bearer speech-key')).toBe(true);
    } finally {
      await new Promise(r => svc.close(r));
    }
  });
});
