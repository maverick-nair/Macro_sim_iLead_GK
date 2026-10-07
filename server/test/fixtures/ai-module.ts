/**
 * A stand in for the top level `ai/` module in tests: the four factories with the shapes server/src/ports.ts
 * documents. The transcriber is the batch kind (`transcribe`), to prove the server adapts it.
 */
import { heuristicEvaluator } from '../../../src/engine/sim/evaluator';
import type { AiFactoryConfig } from '../../src/ports';

export const seen: AiFactoryConfig[] = [];

export function createNpcModel(config: AiFactoryConfig) {
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
