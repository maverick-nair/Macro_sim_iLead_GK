/**
 * iLead AI layer (docs/AI.md). Server side only: nothing here may be imported by the participant app.
 *
 *   createNpcModel(config)        NPC persona replies, streamed (the engine's NpcModel)
 *   createEvaluator(config)       rubric bands, style, quotes, flags (the engine's Evaluator)
 *   createAuthorDrafter(config)   GenieKreator's author chat: turn and draft
 *   createTranscriber(config)     speech to text from audio chunks
 */

export { createAuthorDrafter, createEvaluator, createNpcModel, createTranscriber } from './factories';
export { configFromEnv, type AiEnvConfig } from './env';
export {
  DEFAULTS, consoleLogger, silentLogger, settingsFor,
  type AnthropicSettings, type AuthorDrafterConfig, type Effort, type EvaluatorConfig, type HttpSpeechSettings, type ModelSettings, type NpcModelConfig, type TranscriberConfig
} from './config';
export type * from './types';

export { createMockNpcModel, createAnthropicNpcModel } from './npc/models';
export { createMockEvaluator, createAnthropicEvaluator } from './evaluator/models';
export { createMockAuthorDrafter, createAnthropicAuthorDrafter } from './author/models';
export { createMockTranscriber, createHttpTranscriber, TranscriberError } from './speech/transcriber';
export { createAnthropicTransport, type AnthropicClientLike } from './llm/anthropic';
export { createFakeTransport, type FakeReply, type FakeTransport } from './llm/fake';
export type { LlmRequest, LlmResult, LlmStreamEvent, LlmTransport } from './llm/transport';
export { EvaluationSchema } from './evaluator/schema';
export { evaluatorPromptVersion } from './evaluator/prompt';
export { npcPromptVersion } from './npc/prompt';
export { findVerbatim, verifyQuotes } from './guards/quotes';
export { checkReply } from './guards/npc';
export { historyFromTurns, sceneFromStoryline } from './scene';
