/**
 * A stand in for an `ai/` module in tests, with the factory shapes server/src/ports.ts documents. The
 * transcriber is the batch kind (`transcribe`), to prove the server adapts it.
 */
import { heuristicEvaluator } from '../../../src/engine/sim/evaluator';
import type { AiRoleConfigs } from '../../src/ports';

export const seen: unknown[] = [];

export function configFromEnv(env: Record<string, string | undefined>) {
  return { npc: { model: { model: env.AI_MODEL_NPC } } };
}
export function createNpcModel(config: AiRoleConfigs['npc']) {
  seen.push(config);
  return { reply: async () => ({ text: 'Fixture model line.' }) };
}
export function createEvaluator() {
  return heuristicEvaluator;
}
export async function createAuthorDrafter() {
  return { turn: async () => null, draft: async () => null };
}
export function createTranscriber() {
  return { transcribe: async ({ audio }: { audio: Uint8Array }) => ({ text: `heard ${audio.byteLength} bytes` }) };
}
