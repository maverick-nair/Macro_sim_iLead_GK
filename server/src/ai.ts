import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Config } from './config';
import type { Logger } from './log';
import { mockPorts, type AiFactoryConfig, type AiModule, type AiPorts, type AuthorDrafter, type Evaluator, type NpcModel, type Transcriber } from './ports';

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
 * The AI ports for the configured provider. `mock` (the default): the engine's own stand ins, no network.
 * `anthropic`: the `ai/` module's factories, loaded dynamically; a missing module, a missing factory or a
 * missing API key stops the server at startup with a clear error rather than failing a participant later.
 */
export async function loadAi(config: Config, log: Logger, importer: (spec: string) => Promise<unknown> = spec => import(spec)): Promise<AiPorts> {
  const mock = mockPorts();
  const speechOff = config.SPEECH_PROVIDER === 'off';
  if (config.AI_PROVIDER === 'mock') {
    log.info('ai: mock provider (engine stand ins, scripted transcription)');
    return { ...mock, transcriber: speechOff ? null : mock.transcriber };
  }
  const found = aiCandidates(config).find(p => fs.existsSync(p));
  if (!found) {
    throw new AiConfigError(`AI_PROVIDER=${config.AI_PROVIDER} but the ai module was not found. Looked for: ${aiCandidates(config).map(p => path.relative(REPO_ROOT, p)).join(', ')}. Set AI_PROVIDER=mock, or AI_MODULE to the module's entry file.`);
  }
  if (!config.ANTHROPIC_API_KEY) throw new AiConfigError(`AI_PROVIDER=${config.AI_PROVIDER} needs ANTHROPIC_API_KEY.`);
  let mod: Partial<AiModule>;
  try {
    mod = (await importer(pathToFileURL(found).href)) as Partial<AiModule>;
  } catch (e) {
    throw new AiConfigError(`Could not load the ai module at ${found}: ${(e as Error).message}`);
  }
  for (const f of ['createNpcModel', 'createEvaluator', 'createAuthorDrafter'] as const) {
    if (!isFn(mod[f])) throw new AiConfigError(`The ai module at ${found} does not export ${f}(config).`);
  }
  const factoryConfig: AiFactoryConfig = {
    provider: config.AI_PROVIDER,
    apiKey: config.ANTHROPIC_API_KEY,
    models: { default: config.AI_MODEL, npc: config.AI_NPC_MODEL, evaluator: config.AI_EVALUATOR_MODEL, author: config.AI_AUTHOR_MODEL },
    timeoutMs: config.AI_TIMEOUT_MS,
    logger: log.child({ component: 'ai' }),
    env: { ...process.env }
  };
  const npc = check<NpcModel>('createNpcModel', await mod.createNpcModel!(factoryConfig), ['reply']);
  const evaluator = check<Evaluator>('createEvaluator', await mod.createEvaluator!(factoryConfig), ['evaluate']);
  const author = check<AuthorDrafter>('createAuthorDrafter', await mod.createAuthorDrafter!(factoryConfig), ['turn', 'draft']);
  let transcriber: Transcriber | null = mock.transcriber;
  if (speechOff) transcriber = null;
  else if (config.SPEECH_PROVIDER === 'ai') {
    if (!isFn(mod.createTranscriber)) throw new AiConfigError(`SPEECH_PROVIDER=ai but the ai module at ${found} does not export createTranscriber(config).`);
    const t = await mod.createTranscriber(factoryConfig);
    if (t && !isFn((t as { open?: unknown }).open) && !isFn((t as { transcribe?: unknown }).transcribe)) throw new AiConfigError('ai/: createTranscriber returned an object with neither open() nor transcribe()');
    transcriber = t;
  }
  log.info('ai: provider loaded', { provider: config.AI_PROVIDER, module: path.relative(REPO_ROOT, found), speech: speechOff ? 'off' : config.SPEECH_PROVIDER });
  return { provider: config.AI_PROVIDER, npc, evaluator, author, transcriber };
}
