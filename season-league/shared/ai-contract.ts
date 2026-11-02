/**
 * Contracts between the game and the AI proxy. Every AI output is strict JSON validated here.
 * AI judges and writes words; numbers that move the client dashboard come only from the
 * consequence matrix in the engine.
 */
import { z } from "zod";
import type { Character } from "./content-schema.ts";

export const PromiseItem = z.object({
  action: z.string(),
  owner: z.string(),
  due: z.string(),
});
export type PromiseItem = z.infer<typeof PromiseItem>;

export const Turn = z.object({
  who: z.enum(["squad", "character"]),
  speaker: z.string(),
  text: z.string(),
  at: z.string(),
});
export type Turn = z.infer<typeof Turn>;

export interface ChatRequest {
  character: Character;
  round: { number: number; title: string; scenario: string; prompt: string; inject: string };
  decision: { id: string; text: string } | null;
  clientMessage: string;
  promises: PromiseItem[];
  history: string[];
  transcript: Turn[];
}

export const ChatResponse = z.object({ reply: z.string().min(1), mode: z.enum(["live", "mock"]) });
export type ChatResponse = z.infer<typeof ChatResponse>;

export interface PlanScoreRequest {
  roundNumber: number;
  roundTitle: string;
  scenario: string;
  prompt: string;
  evidence: string[];
  lines: { id: string; label: string }[];
  lineMax: number;
  plan: {
    headings: { heading: string; text: string }[];
    actions: PromiseItem[];
    clientMessage: string;
    decision: { id: string; text: string } | null;
  };
  pass: number;
}

export const RubricLineScore = z.object({
  id: z.string(),
  score: z.number().int().min(0).max(5),
  reason: z.string().min(1),
});

export const RubricPass = z.object({
  lines: z.array(RubricLineScore).length(4),
  tryThis: z.string().min(1),
  releasesPaymentWithoutAuthorizers: z.boolean(),
});
export type RubricPass = z.infer<typeof RubricPass>;

export interface TrustScoreRequest {
  character: Character;
  behaviors: { id: string; label: string }[];
  promises: PromiseItem[];
  transcript: Turn[];
  roundTitle: string;
}

export const TrustScore = z.object({
  behaviors: z.array(z.object({ id: z.string(), score: z.number().int().min(0).max(10) })).min(1),
  verdict: z.string().min(1),
});
export type TrustScore = z.infer<typeof TrustScore>;

export const Health = z.object({ mode: z.enum(["live", "mock"]), demo: z.boolean() });
export type Health = z.infer<typeof Health>;

/** Pulls the first JSON object out of a model reply (tolerates code fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}
