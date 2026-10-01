import { z } from 'zod';
import { sanitizeCopy } from '../i18n/copy';

/**
 * The engine contract. The simulation engine is authoritative and server side: the UI renders
 * these payloads and sends intents, and never computes outcomes, scores or state changes itself.
 * Every payload is parsed with these schemas at the boundary (real engine and mock alike).
 *
 * Skeleton from M1. Fields marked TODO wait on the Simulation Design and Teardown (docs/DECISIONS.md D19).
 */

/** Text from the engine or an AI model, made safe for the copy rules on the way in. */
export const Text = z.string().transform(sanitizeCopy);

export const MetricKey = z.enum(['skill', 'morale', 'result', 'trust']);
export const StyleKey = z.enum(['D', 'G', 'P', 'E']);
export const Mood = z.enum(['happy', 'neutral', 'thinking', 'concerned', 'frustrated']);
export const Score = z.number().min(0).max(100);

/** A quote behind a judgement. `judgedByAI` drives the "Read by AI" label. */
export const Evidence = z.object({
  quote: Text,
  by: Text,
  judgedByAI: z.boolean()
});

/** Why a number moved. Every metric change carries one (brief, rule 5). */
export const Reason = z.object({
  /** Short chip text, for example "1:1 went well". */
  label: Text,
  /** What happened. */
  cause: Text,
  /** The authored rule, in words. Never a raw model score. */
  rule: Text,
  evidence: z.array(Evidence)
});

export const MetricChange = z.object({
  subject: z.discriminatedUnion('type', [z.object({ type: z.literal('member'), id: z.string() }), z.object({ type: z.literal('team') })]),
  metric: MetricKey,
  from: z.number(),
  to: z.number(),
  delta: z.number(),
  reason: Reason
});

export const MemberState = z.object({
  id: z.string(),
  stage: z.number().int().min(0),
  skill: Score,
  morale: Score,
  result: Score,
  trust: Score,
  style: StyleKey,
  lastStyle: StyleKey,
  lastReaction: z.enum(['pos', 'neg']),
  mood: Mood,
  /** Hidden until the participant first opens the profile (spec, member card). */
  statsRevealed: z.boolean(),
  tags: z.array(Text),
  away: z.boolean(),
  unread: z.boolean(),
  promise: Text.nullable(),
  /** Concern surfaced in conversation, shown as "Shared: ...". Never shown before it surfaces. */
  shared: Text.nullable(),
  changes: z.array(MetricChange)
});

export const ActionAvailability = z.discriminatedUnion('state', [
  z.object({ state: z.literal('available') }),
  z.object({ state: z.literal('disabled'), why: Text }),
  z.object({ state: z.literal('locked'), why: Text }),
  z.object({ state: z.literal('cooldown'), why: Text, daysLeft: z.number() })
]);

export const ActionState = z.object({
  key: z.string(),
  scope: z.enum(['team', 'member']),
  kind: z.enum(['live', 'static', 'hybrid']),
  cost: z.number().min(0),
  availability: ActionAvailability,
  // TODO(D19): options, selection limits, prerequisites from the Simulation Design.
});

export const Outcome = z.object({
  id: z.string(),
  interactionId: z.string(),
  headline: Text,
  reply: Text,
  affected: z.array(z.string()),
  reactions: z.record(z.string(), Text),
  changes: z.array(MetricChange),
  ripple: Text.nullable(),
  /** Up to two lines of consequence. Never the rubric band name (spec, outcome panel). */
  changed: z.array(Text).max(2)
});

export const Clock = z.object({
  week: z.number().int().min(1),
  weeks: z.number().int().min(1),
  day: z.number().int().min(1),
  daysLeft: z.number().min(0),
  secondsLeft: z.number().min(0),
  paused: z.boolean()
});

/** Snapshot of everything the board renders. */
export const EngineState = z.object({
  clock: Clock,
  members: z.array(MemberState),
  actions: z.array(ActionState),
  outcome: Outcome.nullable(),
  leadershipScore: z.number(),
  streak: z.number().int().min(0),
  // TODO(D19): funnel, team pulse, sponsor confidence, inbox, events, week end, report.
});

/** Things the participant can ask for. The engine answers with a new EngineState. */
export const Intent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setStyle'), memberId: z.string(), style: StyleKey, rationale: z.string().optional() }),
  z.object({ type: z.literal('planAction'), action: z.string(), memberIds: z.array(z.string()), option: z.number().int().optional() }),
  z.object({ type: z.literal('openProfile'), memberId: z.string() }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('endWeek') })
]);

/** One chunk of a streamed AI reply. `done` closes the stream. */
export const StreamChunk = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), text: z.string() }),
  z.object({ type: z.literal('done'), turnId: z.string() }),
  z.object({ type: z.literal('error'), retryable: z.boolean() })
]);

export type Text = z.output<typeof Text>;
export type MetricKey = z.infer<typeof MetricKey>;
export type Evidence = z.infer<typeof Evidence>;
export type Reason = z.infer<typeof Reason>;
export type MetricChange = z.infer<typeof MetricChange>;
export type MemberState = z.infer<typeof MemberState>;
export type ActionState = z.infer<typeof ActionState>;
export type Outcome = z.infer<typeof Outcome>;
export type EngineState = z.infer<typeof EngineState>;
export type Intent = z.infer<typeof Intent>;
export type StreamChunk = z.infer<typeof StreamChunk>;
