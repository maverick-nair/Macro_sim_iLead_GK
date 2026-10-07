import { z } from 'zod';
import { BANDS } from '../../../src/engine/config';
import type { Evaluation } from '../../../src/engine/sim/types';
import { js } from '../llm/transport';

/**
 * Schemas for the evaluator: what the model answers (`ModelEvaluation`, with its JSON Schema for
 * structured output) and what the engine receives (`EvaluationSchema`, the exact `Evaluation` shape).
 */

export const RED_FLAG_KINDS = ['abuse', 'blame', 'discrimination', 'policyBreach'] as const;
export const EMAIL_INTENTS = ['congratulate', 'warn', 'neutral'] as const;

const Band = z.enum(BANDS);
const Quotes = z.array(z.string()).max(6);

export const ModelEvaluation = z.object({
  dimensions: z.array(z.object({ key: z.string(), band: Band, reason: z.string(), quotes: Quotes })),
  skills: z.array(z.object({ key: z.string(), band: Band, quotes: Quotes })),
  style: z.object({ key: z.string(), confidence: z.number().min(0).max(1) }),
  flags: z.object({
    openQuestions: z.number().int().min(0),
    acknowledged: z.boolean(),
    invitedContribution: z.boolean(),
    specificNextStep: z.boolean(),
    concernSurfaced: z.boolean()
  }),
  redFlags: z.array(z.object({ kind: z.enum(RED_FLAG_KINDS), quote: z.string() })),
  promise: z.object({ quote: z.string(), dueInSubPeriods: z.number().int().min(1).max(5), fulfilledBy: z.array(z.string()) }).nullable(),
  emailIntent: z.enum(EMAIL_INTENTS).nullable()
});
export type ModelEvaluation = z.infer<typeof ModelEvaluation>;

/** JSON Schema of `ModelEvaluation` for structured output, with the request's keys as enums. */
export function modelEvaluationJsonSchema(o: { dimensions: string[]; skills: string[]; styles: string[]; actions: string[] }): Record<string, unknown> {
  const band = js.enum(BANDS);
  const quotes = js.arr(js.str('Copied exactly from the participant\'s words'));
  return js.obj({
    dimensions: js.arr(js.obj({ key: js.enum(o.dimensions), band, reason: js.str('One short reason, in the run\'s language'), quotes }), 'One entry per rubric dimension'),
    skills: js.arr(js.obj({ key: o.skills.length ? js.enum(o.skills) : js.str(), band, quotes }), 'One entry per listed skill'),
    style: js.obj({ key: js.enum(o.styles), confidence: js.num('0 to 1') }),
    flags: js.obj({ openQuestions: js.int(), acknowledged: js.bool(), invitedContribution: js.bool(), specificNextStep: js.bool(), concernSurfaced: js.bool() }),
    redFlags: js.arr(js.obj({ kind: js.enum(RED_FLAG_KINDS), quote: js.str() })),
    promise: js.nullable(js.obj({ quote: js.str(), dueInSubPeriods: js.int('1 to 5'), fulfilledBy: js.arr(o.actions.length ? js.enum(o.actions) : js.str()) })),
    emailIntent: js.nullable(js.enum(EMAIL_INTENTS))
  });
}

const Observation = z.object({ key: z.string(), band: Band, evidence: z.array(z.string()) });

/** The engine's `Evaluation`, as a schema: every evaluator's output is checked against it in tests. */
export const EvaluationSchema = z.object({
  styleUsed: z.string().min(1),
  confidence: z.number().min(0).max(1),
  band: Band,
  evidence: z.array(z.string()),
  flags: z.object({
    openQuestions: z.number().int().min(0),
    acknowledged: z.boolean(),
    invitedContribution: z.boolean(),
    specificNextStep: z.boolean(),
    concernSurfaced: z.boolean(),
    abusive: z.boolean(),
    promise: z.object({ text: z.string().min(1), dueInSubPeriods: z.number().int().min(1), fulfilledBy: z.array(z.string()).min(1) }).optional()
  }),
  emailIntent: z.enum(EMAIL_INTENTS).optional(),
  usedVoice: z.boolean().optional(),
  dimensions: z.array(Observation),
  redFlags: z.array(z.string()),
  skills: z.array(Observation).optional()
}).strict();

// The schema and the engine type must stay the same shape.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const evaluationShapeMatches: Same<z.infer<typeof EvaluationSchema>, Evaluation> = true;
