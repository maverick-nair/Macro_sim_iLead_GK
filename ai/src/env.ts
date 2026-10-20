import type { AnthropicSettings, AuthorDrafterConfig, Effort, EvaluatorConfig, ModelSettings, NpcModelConfig, TranscriberConfig } from './config';
import type { SyntheticPlayerConfig } from './synthetic/player';
import type { Provider } from './types';

/**
 * The recommended mapping from environment variables to the factory configs (docs/AI.md has the full
 * table). The AI layer never reads the environment on its own; the server calls this, or builds the
 * configs any other way. Unset variables keep the defaults.
 */

type Env = Record<string, string | undefined>;

const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const num = (v: string | undefined) => (v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const bool = (v: string | undefined) => (v === undefined || v.trim() === '' ? undefined : /^(1|true|yes|on)$/i.test(v.trim()));
const provider = (v: string | undefined, fallback: Provider): Provider => (v === 'mock' || v === 'anthropic' ? v : fallback);

function model(env: Env, role: 'NPC' | 'EVALUATOR' | 'AUTHOR' | 'SYNTHETIC'): Partial<ModelSettings> {
  const effort = env[`AI_EFFORT_${role}`] as Effort | undefined;
  return {
    model: env[`AI_MODEL_${role}`] || undefined,
    maxTokens: num(env[`AI_MAX_TOKENS_${role}`]),
    effort: effort && EFFORTS.includes(effort) ? effort : undefined,
    temperature: num(env[`AI_TEMPERATURE_${role}`]),
    timeoutMs: num(env[`AI_TIMEOUT_MS_${role}`]),
    maxRetries: num(env[`AI_MAX_RETRIES_${role}`] ?? env.AI_MAX_RETRIES)
  };
}

export interface AiEnvConfig {
  npc: NpcModelConfig;
  evaluator: EvaluatorConfig;
  author: AuthorDrafterConfig;
  transcriber: TranscriberConfig;
  synthetic: SyntheticPlayerConfig;
}

export function configFromEnv(env: Env): AiEnvConfig {
  const anthropic: AnthropicSettings = {
    apiKey: env.ANTHROPIC_API_KEY || undefined,
    baseURL: env.ANTHROPIC_BASE_URL || undefined,
    refusalFallback: bool(env.AI_REFUSAL_FALLBACK),
    promptCaching: bool(env.AI_PROMPT_CACHE),
    cacheTtl: env.AI_CACHE_TTL === '1h' ? '1h' : env.AI_CACHE_TTL === '5m' ? '5m' : undefined
  };
  const base = provider(env.AI_PROVIDER, env.ANTHROPIC_API_KEY ? 'anthropic' : 'mock');
  const repairRetries = num(env.AI_REPAIR_RETRIES);
  const speechUrl = env.SPEECH_URL || undefined;
  const speech = env.SPEECH_PROVIDER === 'mock' || env.SPEECH_PROVIDER === 'http' ? env.SPEECH_PROVIDER : speechUrl ? 'http' : 'mock';
  return {
    npc: { provider: provider(env.AI_PROVIDER_NPC, base), anthropic, model: model(env, 'NPC'), holdBack: env.AI_NPC_HOLD_BACK === 'none' ? 'none' : env.AI_NPC_HOLD_BACK === 'sentence' ? 'sentence' : undefined },
    evaluator: { provider: provider(env.AI_PROVIDER_EVALUATOR, base), anthropic, model: model(env, 'EVALUATOR'), repairRetries },
    author: { provider: provider(env.AI_PROVIDER_AUTHOR, base), anthropic, model: model(env, 'AUTHOR'), repairRetries },
    synthetic: { provider: provider(env.AI_PROVIDER_SYNTHETIC, base), anthropic, model: model(env, 'SYNTHETIC') },
    transcriber: speech === 'http' && speechUrl
      ? { provider: 'http', http: { url: speechUrl, key: env.SPEECH_KEY || undefined, authHeader: env.SPEECH_AUTH_HEADER || undefined, authScheme: env.SPEECH_AUTH_SCHEME, timeoutMs: num(env.SPEECH_TIMEOUT_MS) } }
      : { provider: 'mock' }
  };
}
