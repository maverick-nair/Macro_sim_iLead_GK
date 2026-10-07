import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Config } from './config';
import type { Logger } from './log';
import type { SyntheticSpeaker } from '../../src/engine/sim/syntheticSpeech';
import { mockPorts, type AiModule, type AiPorts, type AiRoleConfigs, type AuthorDrafter, type Evaluator, type NpcModel, type Transcriber, type TranscriptionSession } from './ports';

/** The repository root (server/src/ai.ts is two folders down). */
export const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

/** Where the `ai/` module may live, in order. `AI_MODULE` wins when set. */
export function aiCandidates(config: Pick<Config, 'AI_MODULE'>, root = REPO_ROOT): string[] {
  if (config.AI_MODULE) return [path.resolve(root, config.AI_MODULE)];
  return ['ai/src/index.ts', 'ai/index.ts', 'ai/dist/index.js', 'ai/src/index.js'].map(p => path.join(root, p));
}

export class AiConfigError extends Error {}

const isFn = (v: unknown): v is (...a: unknown[]) => unknown => typeof v === 'function';

function check<T>(what: string, value: unknown, methods: string[]): T {
  if (!value || typeof value !== 'object') throw new AiConfigError(`ai/: ${what} returned ${value === null ? 'null' : typeof value}, expected an object with ${methods.join(', ')}`);
  for (const m of methods) if (!isFn((value as Record<string, unknown>)[m])) throw new AiConfigError(`ai/: ${what} has no ${m}() method`);
  return value as T;
}

/**
 * The `ai/` module's transcriber (`open` gives a session with `push`, `end`, `abort`) behind the server's
 * port (`chunk`, `end`, `cancel`). A batch transcriber (`transcribe`) is adapted in routes/speech.ts.
 */
export function adaptTranscriber(t: unknown): Transcriber {
  const x = t as { open?: (o: unknown) => Promise<{ push(a: Uint8Array, seq: number): Promise<unknown>; end(): Promise<unknown>; abort(): Promise<void> }>; transcribe?: unknown };
  if (isFn(x.transcribe)) return t as Transcriber;
  if (!isFn(x.open)) throw new AiConfigError('ai/: createTranscriber returned an object with neither open() nor transcribe()');
  return {
    async open(options) {
      const s = await x.open!(options);
      if (isFn((s as { chunk?: unknown }).chunk)) return s as unknown as TranscriptionSession;
      return {
        chunk: (audio, seq) => s.push(audio, seq) as Promise<never>,
        end: () => s.end() as Promise<never>,
        cancel: () => s.abort()
      };
    }
  };
}

/** The role configs: the module's own `configFromEnv(env)` when it has one (docs/AI.md section 8), else the provider alone. */
function roleConfigs(mod: Partial<AiModule>, config: Config, env: Record<string, string | undefined>, log: Logger): AiRoleConfigs {
  const logger = log.child({ component: 'ai' });
  const provider = config.AI_PROVIDER;
  const base = isFn(mod.configFromEnv) ? mod.configFromEnv({ ...env, AI_PROVIDER: provider }) : null;
  const audit = (a: { provider?: string; model?: string | null; fallback?: boolean; repaired?: boolean; latencyMs?: number; promptVersion?: string; error?: string }) =>
    // Never the participant's words: only how the evaluation went.
    logger.info('evaluation', { provider: a.provider, model: a.model, promptVersion: a.promptVersion, fallback: a.fallback, repaired: a.repaired, latencyMs: a.latencyMs, error: a.error });
  return {
    npc: { provider, ...base?.npc, logger },
    evaluator: { provider, ...base?.evaluator, logger, onAudit: audit },
    author: { provider, ...base?.author, logger },
    transcriber: { provider: 'mock', ...(config.SPEECH_URL ? { http: { url: config.SPEECH_URL, key: env.SPEECH_KEY || undefined } } : {}), ...base?.transcriber, logger },
    synthetic: { provider, ...base?.synthetic, logger }
  };
}

/**
 * The AI ports for the configured provider. `mock` (the default without ANTHROPIC_API_KEY): the engine's
 * own stand ins, no network, and the module is not needed. `anthropic`: the `ai/` module's factories,
 * loaded dynamically with the environment mapped by its `configFromEnv`. A missing module or factory
 * stops the server at startup with a clear error rather than failing a participant later. Speech over
 * HTTP (`SPEECH_PROVIDER=http`, or `SPEECH_URL` set) also comes from the module, whatever the AI provider.
 */
export async function loadAi(config: Config, log: Logger, importer: (spec: string) => Promise<unknown> = spec => import(spec), env: Record<string, string | undefined> = process.env): Promise<AiPorts> {
  const mock = mockPorts();
  const speech = config.SPEECH_PROVIDER ?? (config.SPEECH_URL ? 'http' : 'mock');
  const needModule = config.AI_PROVIDER === 'anthropic' || speech === 'http';
  if (!needModule) {
    log.info('ai: mock provider (engine stand ins, scripted transcription)', { speech });
    return { ...mock, transcriber: speech === 'off' ? null : mock.transcriber };
  }
  const found = aiCandidates(config).find(p => fs.existsSync(p));
  const why = config.AI_PROVIDER === 'anthropic' ? `AI_PROVIDER=${config.AI_PROVIDER}` : 'SPEECH_PROVIDER=http';
  if (!found) {
    throw new AiConfigError(`${why} but the ai module was not found. Looked for: ${aiCandidates(config).map(p => path.relative(REPO_ROOT, p)).join(', ')}. Set AI_PROVIDER=mock and SPEECH_PROVIDER=mock, or AI_MODULE to the module's entry file.`);
  }
  let mod: Partial<AiModule>;
  try {
    mod = (await importer(pathToFileURL(found).href)) as Partial<AiModule>;
  } catch (e) {
    throw new AiConfigError(`Could not load the ai module at ${found}: ${(e as Error).message}`);
  }
  const roles = roleConfigs(mod, config, env, log);
  let { npc, evaluator, author } = mock as { npc: NpcModel; evaluator: Evaluator; author: AuthorDrafter };
  let synthetic: SyntheticSpeaker | undefined;
  if (config.AI_PROVIDER === 'anthropic') {
    for (const f of ['createNpcModel', 'createEvaluator', 'createAuthorDrafter'] as const) {
      if (!isFn(mod[f])) throw new AiConfigError(`The ai module at ${found} does not export ${f}(config).`);
    }
    if (!config.ANTHROPIC_API_KEY) log.warn('ai: ANTHROPIC_API_KEY is not set; the SDK will look for its default credentials');
    npc = check<NpcModel>('createNpcModel', await mod.createNpcModel!(roles.npc), ['reply']);
    evaluator = check<Evaluator>('createEvaluator', await mod.createEvaluator!(roles.evaluator), ['evaluate']);
    author = check<AuthorDrafter>('createAuthorDrafter', await mod.createAuthorDrafter!(roles.author), ['turn', 'draft']);
    // Synthetic players with AI are optional: a module without the factory keeps the offline templates.
    if (isFn(mod.createSyntheticPlayer) && roles.synthetic.provider === 'anthropic') synthetic = check<SyntheticSpeaker>('createSyntheticPlayer', await mod.createSyntheticPlayer(roles.synthetic), ['say']);
  }
  let transcriber: Transcriber | null = speech === 'off' ? null : mock.transcriber;
  if (speech === 'http') {
    if (!isFn(mod.createTranscriber)) throw new AiConfigError(`SPEECH_PROVIDER=http but the ai module at ${found} does not export createTranscriber(config).`);
    if (!config.SPEECH_URL) throw new AiConfigError('SPEECH_PROVIDER=http needs SPEECH_URL.');
    const t = await mod.createTranscriber({ ...roles.transcriber, provider: 'http' } as AiRoleConfigs['transcriber']);
    transcriber = t ? adaptTranscriber(t) : null;
  }
  log.info('ai: provider loaded', { provider: config.AI_PROVIDER, module: path.relative(REPO_ROOT, found), speech });
  const scene = config.AI_PROVIDER === 'anthropic' && isFn(mod.sceneFromStoryline) ? (st: Parameters<NonNullable<AiModule['sceneFromStoryline']>>[0]) => mod.sceneFromStoryline!(st) : undefined;
  return { provider: config.AI_PROVIDER, npc, evaluator, author, transcriber, scene, ...(synthetic ? { synthetic } : {}) };
}
