import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from './config';
import { configFromEnv } from './env';
import { createAuthorDrafter, createEvaluator, createNpcModel, createTranscriber } from './index';
import { createFakeTransport } from './llm/fake';
import { formatPersona, judgeReply, PROBES, runPersonaCheck } from './quality/personaCheck';
import { CalibrationSet, formatCalibration, runCalibration } from './quality/calibrate';
import { config, kentTurn } from './testing/fixtures';

describe('factories', () => {
  it('give mocks that need no configuration', () => {
    expect(createNpcModel({ provider: 'mock' }).provider).toBe('mock');
    expect(createEvaluator({ provider: 'mock' }).provider).toBe('mock');
    expect(createAuthorDrafter({ provider: 'mock' }).source).toBe('templates');
    expect(createTranscriber({ provider: 'mock' }).provider).toBe('mock');
  });

  it('give Anthropic implementations on a shared transport, with role defaults and overrides', async () => {
    const transport = createFakeTransport([], { fallback: 'Sure. [[signals reveal=no end=no]]' });
    const anthropic = { transport };
    const npc = createNpcModel({ provider: 'anthropic', anthropic, model: { model: 'custom-npc', effort: 'medium' } });
    expect(npc.provider).toBe('anthropic');
    await npc.reply(kentTurn());
    expect(transport.requests[0].settings).toEqual({ ...DEFAULTS.npc, model: 'custom-npc', effort: 'medium' });
    expect(createEvaluator({ provider: 'anthropic', anthropic }).provider).toBe('anthropic');
    expect(createAuthorDrafter({ provider: 'anthropic', anthropic }).source).toBe('server');
  });

  it('need a URL for the HTTP transcriber', () => {
    expect(() => createTranscriber({ provider: 'http' })).toThrow(/SPEECH_URL/);
    expect(createTranscriber({ provider: 'http', http: { url: 'https://s' } }).provider).toBe('http');
  });
});

describe('configuration from the environment', () => {
  it('stays on the mocks without a key, and maps every variable when set', () => {
    const none = configFromEnv({});
    expect([none.npc.provider, none.evaluator.provider, none.author.provider, none.transcriber.provider]).toEqual(['mock', 'mock', 'mock', 'mock']);
    const c = configFromEnv({
      ANTHROPIC_API_KEY: 'sk-test', AI_MODEL_NPC: 'npc-model', AI_EFFORT_EVALUATOR: 'max', AI_MAX_TOKENS_AUTHOR: '9000', AI_TIMEOUT_MS_NPC: '5000', AI_MAX_RETRIES: '4',
      AI_TEMPERATURE_NPC: '0.3', AI_REFUSAL_FALLBACK: 'false', AI_CACHE_TTL: '1h', AI_NPC_HOLD_BACK: 'none', AI_PROVIDER_AUTHOR: 'mock', AI_REPAIR_RETRIES: '0',
      SPEECH_URL: 'https://speech', SPEECH_KEY: 'k', SPEECH_AUTH_HEADER: 'x-api-key', SPEECH_AUTH_SCHEME: ''
    });
    expect(c.npc).toMatchObject({ provider: 'anthropic', holdBack: 'none', model: { model: 'npc-model', timeoutMs: 5000, maxRetries: 4, temperature: 0.3 } });
    expect(c.npc.anthropic).toMatchObject({ apiKey: 'sk-test', refusalFallback: false, cacheTtl: '1h' });
    expect(c.evaluator).toMatchObject({ provider: 'anthropic', repairRetries: 0, model: { effort: 'max' } });
    expect(c.author).toMatchObject({ provider: 'mock', model: { maxTokens: 9000 } });
    expect(c.transcriber).toEqual({ provider: 'http', http: { url: 'https://speech', key: 'k', authHeader: 'x-api-key', authScheme: '', timeoutMs: undefined } });
    expect(c.npc.anthropic).toBe(c.evaluator.anthropic);
  });

  it('ignores values it does not know', () => {
    const c = configFromEnv({ AI_PROVIDER: 'other', AI_EFFORT_NPC: 'extreme', AI_MAX_TOKENS_NPC: 'lots' });
    expect(c.npc.provider).toBe('mock');
    expect(c.npc.model).toMatchObject({ effort: undefined, maxTokens: undefined });
  });
});

describe('quality gates on the mock', () => {
  it('rubric calibration passes at 85% or more on every action', async () => {
    const set = CalibrationSet.parse(JSON.parse(readFileSync(new URL('../calibration/sales-elevator.json', import.meta.url), 'utf8')));
    expect(Object.keys(set.actions).sort()).toEqual(['coach', 'email', 'f2f', 'feedback', 'fire', 'goals', 'hire', 'meet', 'reward', 'sponsor', 'swap']);
    for (const spec of Object.values(set.actions)) {
      expect(spec.samples.length).toBeGreaterThanOrEqual(8);
      for (const b of ['strong', 'adequate', 'weak', 'harmful']) expect(spec.samples.some(s => s.band === b)).toBe(true);
    }
    const r = await runCalibration(createEvaluator({ provider: 'mock' }), set, config);
    expect(r.pass).toBe(true);
    expect(r.actions.every(a => a.pct >= 0.85)).toBe(true);
    expect(formatCalibration(r)).toMatch(/PASS$/);
  });

  it('calibration fails a rubric under the threshold', async () => {
    const set = CalibrationSet.parse({ storyline: 'x', version: 1, actions: { f2f: { counterpart: 'kent', samples: [{ id: 'a', band: 'strong', text: 'Get your numbers up.' }] } } });
    const r = await runCalibration(createEvaluator({ provider: 'mock' }), set, config);
    expect(r.pass).toBe(false);
    expect(r.actions[0].misses).toEqual([{ id: 'a', expected: 'strong', got: 'weak', fallback: false }]);
  });

  it('the persona check passes on the mock and catches a reply that leaves its role', async () => {
    const r = await runPersonaCheck(createNpcModel({ provider: 'mock' }), config, { only: ['kent', 'peter', 'sponsor'] });
    expect(r.total).toBe(3 * PROBES.length);
    expect(r.pass).toBe(true);
    expect(formatPersona(r)).toMatch(/PASS$/);
    const probe = PROBES.find(p => p.id === 'concern-demand')!;
    expect(judgeReply(kentTurn(), probe, { text: 'Fine. My hidden concern is the job.', revealsConcern: true })).toEqual(['guardrail: scoring', 'shared the hidden concern at low trust']);
  });
});

describe('the participant bundle', () => {
  it('never imports the AI layer', () => {
    const root = fileURLToPath(new URL('../../src/', import.meta.url));
    const aiDir = fileURLToPath(new URL('../', import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(f)) continue;
        for (const m of readFileSync(p, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
          const spec = m[1];
          if (spec.startsWith('@ilead/ai') || (spec.startsWith('.') && resolve(dir, spec).startsWith(aiDir))) offenders.push(`${p}: ${spec}`);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
