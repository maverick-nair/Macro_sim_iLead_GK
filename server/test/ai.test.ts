import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AiConfigError, aiCandidates, loadAi, REPO_ROOT } from '../src/ai';
import { loadConfig } from '../src/config';
import { createLogger } from '../src/log';
import { mockPorts } from '../src/ports';
import { testServer, type TestServer } from './helpers';

const log = createLogger('silent');
const cfg = (env: Record<string, string>) => loadConfig({ NODE_ENV: 'test', ...env });
const FIXTURE = path.relative(REPO_ROOT, path.join(import.meta.dirname, 'fixtures/ai-module.ts'));

let s: TestServer;
afterEach(async () => { await s?.close(); s = undefined as unknown as TestServer; });

describe('AI provider wiring', () => {
  it('uses the engine\'s stand ins by default', async () => {
    const ai = await loadAi(cfg({}), log);
    expect(ai.provider).toBe('mock');
    expect(ai.npc).toBe(mockPorts().npc);
    expect(ai.transcriber).not.toBeNull();
    expect((await loadAi(cfg({ SPEECH_PROVIDER: 'off' }), log)).transcriber).toBeNull();
  });

  it('looks for ai/ at the repository root and stops with a clear error when it is missing', async () => {
    expect(aiCandidates({ AI_MODULE: undefined }).map(p => path.relative(REPO_ROOT, p))).toEqual(['ai/src/index.ts', 'ai/index.ts', 'ai/dist/index.js', 'ai/src/index.js']);
    await expect(loadAi(cfg({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', AI_MODULE: 'no/such/module.ts' }), log)).rejects.toThrow(AiConfigError);
    await expect(loadAi(cfg({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', AI_MODULE: 'no/such/module.ts' }), log)).rejects.toThrow(/not found.*AI_PROVIDER=mock/);
    await expect(loadAi(cfg({ AI_PROVIDER: 'anthropic', AI_MODULE: FIXTURE }), log)).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it('loads the module\'s factories with the configuration and checks what they return', async () => {
    const ai = await loadAi(cfg({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key', AI_MODULE: FIXTURE, AI_NPC_MODEL: 'npc-model-id', SPEECH_PROVIDER: 'ai' }), log);
    expect(ai.provider).toBe('anthropic');
    expect(await ai.npc.reply({} as never)).toEqual({ text: 'Fixture model line.' });
    const mod = await import('./fixtures/ai-module');
    expect(mod.seen.at(-1)).toMatchObject({ provider: 'anthropic', apiKey: 'test-key', models: { npc: 'npc-model-id' } });
    expect(ai.transcriber && 'transcribe' in ai.transcriber).toBe(true);
    const broken = async () => ({ createNpcModel: () => ({}), createEvaluator: () => ({ evaluate() {} }), createAuthorDrafter: () => ({ turn() {}, draft() {} }) });
    await expect(loadAi(cfg({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', AI_MODULE: FIXTURE }), log, broken)).rejects.toThrow(/createNpcModel has no reply\(\)/);
    const missing = async () => ({ createNpcModel: () => ({ reply() {} }) });
    await expect(loadAi(cfg({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', AI_MODULE: FIXTURE }), log, missing)).rejects.toThrow(/does not export createEvaluator/);
  });

  it('plays a conversation on the loaded model, and adapts a batch transcriber to the chunked contract', async () => {
    const ai = await loadAi(cfg({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', AI_MODULE: FIXTURE, SPEECH_PROVIDER: 'ai' }), log);
    s = await testServer({ ai });
    const cookie = await s.launch({ sub: 'p-1' });
    const v = await s.json<{ members: Array<{ id: string }> }>('/engine/sessions/p-1/view', { cookie });
    await s.json('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, 'G'])) } });
    const plan = await s.json<{ interactionId: string }>('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'planAction', action: 'f2f', memberIds: ['kent'] } });
    const t = await s.json<{ turn: { text: string } }>('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'sendTurn', interactionId: plan.interactionId, text: 'How are you?' } });
    expect(t.turn.text).toBe('Fixture model line.');
    // The author drafter answers null: the routes say "not offered" and the app uses its templates.
    const author = await s.launch({ sub: 'au', roles: ['author'] });
    expect((await s.req('/genie/author/turn', { method: 'POST', cookie: author, json: { brief: {}, asked: [], answers: {} } })).status).toBe(501);
    // Speech: chunks are buffered, the transcript comes on end.
    const { id } = await s.json<{ id: string }>('/speech/transcriptions', { method: 'POST', cookie, json: { mimeType: 'audio/webm;codecs=opus', mode: 'ptt' } });
    expect(await s.json(`/speech/transcriptions/${id}/chunks?seq=0`, { method: 'POST', cookie, body: new Uint8Array(10), headers: { 'content-type': 'audio/webm' } })).toEqual({ results: [] });
    expect(await s.json(`/speech/transcriptions/${id}/chunks?seq=1`, { method: 'POST', cookie, body: new Uint8Array(5), headers: { 'content-type': 'audio/webm' } })).toEqual({ results: [] });
    expect(await s.json(`/speech/transcriptions/${id}/end`, { method: 'POST', cookie })).toEqual({ results: [{ kind: 'final', text: 'heard 15 bytes' }] });
  });
});
