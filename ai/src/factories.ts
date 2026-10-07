import { createAnthropicAuthorDrafter, createMockAuthorDrafter } from './author/models';
import { consoleLogger, settingsFor, type AnthropicSettings, type AuthorDrafterConfig, type EvaluatorConfig, type NpcModelConfig, type TranscriberConfig } from './config';
import { createAnthropicEvaluator, createMockEvaluator } from './evaluator/models';
import { createAnthropicTransport } from './llm/anthropic';
import type { LlmTransport } from './llm/transport';
import { createAnthropicNpcModel, createMockNpcModel } from './npc/models';
import { createHttpTranscriber, createMockTranscriber } from './speech/transcriber';
import type { AuthorDrafter, Evaluator, NpcModel, Transcriber } from './types';

/**
 * The factories the server loads. Each takes a config object (docs/AI.md lists every field and the
 * environment variable we recommend for it) and returns an object that satisfies the engine's
 * interface. `provider: 'mock'` needs nothing else; `provider: 'anthropic'` needs `anthropic.apiKey`
 * (or the SDK's default credentials).
 */

const transports = new WeakMap<AnthropicSettings, LlmTransport>();
/** One SDK client per settings object, shared by the roles that use it. */
function transportFor(s: AnthropicSettings = {}): LlmTransport {
  if (s.transport) return s.transport;
  let t = transports.get(s);
  if (!t) { t = createAnthropicTransport(s); transports.set(s, t); }
  return t;
}

export function createNpcModel(config: NpcModelConfig): NpcModel {
  if (config.provider === 'mock') return createMockNpcModel();
  return createAnthropicNpcModel({ transport: transportFor(config.anthropic), settings: settingsFor('npc', config.model), holdBack: config.holdBack, logger: config.logger ?? consoleLogger });
}

export function createEvaluator(config: EvaluatorConfig): Evaluator {
  if (config.provider === 'mock') return createMockEvaluator({ onAudit: config.onAudit });
  return createAnthropicEvaluator({ transport: transportFor(config.anthropic), settings: settingsFor('evaluator', config.model), logger: config.logger ?? consoleLogger, repairRetries: config.repairRetries, onAudit: config.onAudit });
}

export function createAuthorDrafter(config: AuthorDrafterConfig): AuthorDrafter {
  if (config.provider === 'mock') return createMockAuthorDrafter();
  return createAnthropicAuthorDrafter({ transport: transportFor(config.anthropic), settings: settingsFor('author', config.model), logger: config.logger ?? consoleLogger, repairRetries: config.repairRetries });
}

export function createTranscriber(config: TranscriberConfig): Transcriber {
  if (config.provider === 'mock') return createMockTranscriber(config.mock?.script, config.mock?.wordsPerChunk);
  if (!config.http?.url) throw new Error('createTranscriber: provider "http" needs http.url (SPEECH_URL)');
  return createHttpTranscriber(config.http, config.logger ?? consoleLogger);
}
