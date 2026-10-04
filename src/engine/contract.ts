import { z } from 'zod';
import { sanitizeCopy } from '../i18n/copy';

/**
 * The engine contract: the payloads the engine sends and the intents it accepts. The engine is
 * authoritative and server side; the UI renders these and never computes outcomes, scores or
 * state changes itself (brief, rule 1). Every payload is parsed here at the boundary, for the real
 * engine and the mock alike, which also applies the copy rules to all engine and AI text.
 */

/** Text from the engine or an AI model, made safe for the copy rules on the way in. */
export const Text = z.string().transform(sanitizeCopy);
const Id = z.string().min(1);
const Num = z.number().finite();

export const MetricKey = z.enum(['skill', 'morale', 'result', 'trust']);
export const StyleKey = z.enum(['D', 'G', 'P', 'E']);
export const Mood = z.enum(['happy', 'neutral', 'thinking', 'concerned', 'frustrated']);
export const Score = z.number().min(0).max(100);
export const PeriodUnit = z.enum(['year', 'month', 'week', 'day']);
export const SubPeriodUnit = z.enum(['quarter', 'month', 'week', 'day', 'hour']);

/** A quote behind a judgement. `judgedByAI` drives the "Read by AI" label. */
export const Evidence = z.object({ quote: Text, by: Text, judgedByAI: z.boolean() });

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
  /** Member id, 'team' or 'sponsor'. */
  subject: Id,
  metric: z.union([MetricKey, z.literal('confidence')]),
  from: Num,
  to: Num,
  delta: Num,
  reason: Reason
});

export const Outcome = z.object({
  id: Id,
  actionKey: Id,
  /** Who the reply is from: a member id or 'sponsor'. */
  speaker: Id,
  headline: Text,
  reply: Text,
  affected: z.array(Id),
  reactions: z.record(Id, Text),
  changes: z.array(MetricChange),
  ripple: Text.nullable(),
  /** Up to two lines of consequence. Never the rubric band name (spec, outcome panel). */
  changed: z.array(Text).max(2)
});

export const MemberView = z.object({
  id: Id, name: Text, title: Text, pronoun: z.enum(['he', 'she', 'they']), stage: Id,
  /** Null until the profile has been opened (D39). */
  skill: Score.nullable(), morale: Score.nullable(), result: Score.nullable(), trust: Score.nullable(),
  style: StyleKey.nullable(), lastStyle: StyleKey.nullable(), lastReaction: z.enum(['pos', 'neg']).nullable(),
  mood: Mood, img: z.string().nullable(), away: z.number().int().min(0), awayReason: z.enum(['training', 'leave']).nullable(),
  /** Stats are hidden in the UI until the profile is first opened (spec). */
  statsRevealed: z.boolean(),
  /** A hidden concern, only once it surfaced in conversation (spec). */
  shared: Text.nullable(),
  /** Career goal, once a conversation has surfaced it. */
  careerGoal: Text.nullable(),
  /** Stages this person has been assessed for (the swap prerequisite). */
  assessedStages: z.array(Id),
  /** Role fit found by Assess, per stage. */
  assessments: z.record(Id, z.object({ skill: Score, morale: Score, result: Score })),
  unread: z.boolean(),
  promise: Text.nullable(),
  profile: z.object({ previous: Text, tenure: Text, experience: Text, skills: Text, remarks: Text, relations: Text })
});

export const Clock = z.object({
  period: z.number().int().min(1), periods: z.number().int().min(1).max(10), periodUnit: PeriodUnit,
  subPeriod: z.number().int().min(1), subPeriodUnit: SubPeriodUnit,
  capacity: Num, capacityLeft: Num, costStep: Num, runShare: z.number().min(0).max(1)
});

/** Why an action is unavailable. The UI words it from the catalog. */
export const Block = z.discriminatedUnion('reason', [
  z.object({ reason: z.literal('locked'), period: z.number().int() }),
  z.object({ reason: z.literal('capacity'), need: Num, have: Num }),
  z.object({ reason: z.literal('cooldown'), in: z.number().int().min(1) }),
  z.object({ reason: z.literal('away'), kind: z.enum(['training', 'leave']), for: z.number().int().min(1) }),
  z.object({ reason: z.literal('rewarded'), in: z.number().int().min(1) }),
  z.object({ reason: z.literal('gone') }),
  z.object({ reason: z.literal('lastInStage'), stage: Id }),
  z.object({ reason: z.literal('noCover'), stage: Id }),
  z.object({ reason: z.literal('teamFull') }),
  z.object({ reason: z.literal('liveCap'), cap: z.number().int().min(1) }),
  z.object({ reason: z.literal('stageFull'), stage: Id })
]);

const Who = z.object({ id: Id, name: Text, img: z.string().nullable() });

/** The open live interaction (spec, Live interaction screens). */
export const LiveView = z.object({
  id: Id, format: z.enum(['roleplay', 'email', 'meeting', 'sponsor', 'chat', 'interview', 'plan']),
  actionKey: Id, actionName: Text.nullable(), optionLabel: Text.nullable(),
  /** Email and written plan are submitted once; the others are conversations. */
  oneShot: z.boolean(),
  people: z.array(Who), speaker: Who,
  brief: z.object({ goal: Text.nullable(), known: z.array(Text), mood: Mood.nullable(), promises: z.array(Text), declaredStyle: StyleKey.nullable() }),
  /** `aiGenerated` marks NPC turns for the AI label (brief, rule 7). */
  turns: z.array(z.object({ id: Id, by: Id, text: Text, voice: z.boolean(), interrupted: z.boolean(), aiGenerated: z.boolean() })),
  turnLimit: z.number().int().min(1), turnsLeft: z.number().int().min(0), minutes: Num,
  closed: z.boolean(),
  hint: z.object({ mode: z.enum(['off', 'onRequest']), text: Text.nullable() }),
  candidates: z.array(Who.extend({ title: Text, cv: z.object({ previous: Text, experience: Text, skills: Text, remarks: Text }) })).nullable(),
  candidate: z.number().int().min(0).nullable(),
  replyTo: Id.nullable()
});

export const ActionView = z.object({
  key: Id, rule: Id, name: Text, description: Text, scope: z.enum(['team', 'member']), kind: z.enum(['live', 'static', 'hybrid']),
  format: z.string().nullable(), cost: Num, targets: z.tuple([z.number(), z.number()]), prerequisite: Id.nullable(),
  options: z.array(z.object({
    key: Id, label: Text, blocked: Block.nullable(),
    /** Cost of this option, when it differs from the action's. */
    cost: Num,
    /** Sub-periods the person is away afterwards (training). */
    away: z.number().int().min(0),
    /** Overrides the action's people to pick. */
    targets: z.tuple([z.number(), z.number()]).nullable(),
    distinctStages: z.boolean(), pickStage: z.boolean(),
    /** For options where you pick a stage: each stage and why it cannot take someone, if so. */
    stages: z.array(z.object({ key: Id, blocked: Block.nullable() })).nullable()
  })),
  /** Why a team action is unavailable, or null. */
  blocked: Block.nullable(),
  /** Why a member action is unavailable for each member, or null. */
  blockedFor: z.record(Id, Block.nullable())
});

export const LogEntry = z.object({
  id: Id, period: z.number().int(), sub: z.number().int(), kind: z.enum(['style', 'action', 'interaction', 'event', 'trigger', 'periodEnd']),
  title: Text, memberIds: z.array(Id), changes: z.array(MetricChange), quote: Text.optional()
});

export const SponsorLevel = z.enum(['low', 'wavering', 'steady', 'confident', 'champion']);
export const CardKind = z.enum(['impact', 'signal', 'capacity', 'diagnostic', 'opportunity', 'crisis']);

/** How a period went (scoring-and-report.md 6): the week score behind the stars, and what changed. */
export const PeriodSummary = z.object({
  period: z.number().int(),
  /** The week end banner's headline and sentence, worded by the engine. */
  headline: Text, line: Text,
  week: z.object({
    score: Num, stars: z.number().int().min(0).max(3),
    styleFit: z.object({ correct: z.number().int(), total: z.number().int(), pct: Num }),
    live: z.object({ count: z.number().int(), mean: Num }).nullable(),
    funnel: z.object({ output: Num, ideal: Num, pct: Num })
  }),
  kpis: z.record(MetricKey, z.object({ start: Num, end: Num })),
  valueThisPeriod: Num, valueIdeal: Num, cumulativeValue: Num, pace: Num,
  /** `next`: periods still needed for the next bonus, null once the cap is reached. */
  streak: z.object({ count: z.number().int(), bonus: Num, total: Num, next: z.number().int().nullable() }),
  newBadges: z.array(z.object({ key: Id, reason: Text })),
  sponsor: z.object({ from: Num, to: Num, fromLevel: SponsorLevel, toLevel: SponsorLevel }),
  pulse: z.object({ from: Num, to: Num }),
  funnel: z.array(z.object({ stage: Id, throughput: Num, ideal: Num, cumulative: Num, cumulativeIdeal: Num })),
  bottleneck: Id.nullable(),
  unlockOffer: z.array(Id).nullable(),
  /** Sponsor confidence fell below the check in line: next period has a day less. */
  checkIn: z.boolean(),
  /** Bulletins for the next period. `impact` is what See impact says. */
  news: z.array(z.object({ key: Id, card: CardKind, title: Text, body: Text, impact: Text.nullable() }))
});

/** Everything the participant may see. Never includes a member's needed style. */
export const EngineView = z.object({
  phase: z.enum(['style', 'board', 'periodEnd', 'ended']),
  /** The storyline's name and the organisation the participant joins, for onboarding. */
  storyline: z.object({ name: Text, organisation: Text.nullable() }),
  clock: Clock,
  money: z.object({ currency: z.string(), locale: z.string(), display: z.enum(['symbol', 'narrowSymbol', 'code']), target: Num, value: Num, valueThisPeriod: Num }),
  members: z.array(MemberView),
  kpis: z.array(z.object({ metric: MetricKey, value: Num, start: Num, trend: z.enum(['up', 'down', 'flat']) })),
  /** Team Pulse (scoring-and-report.md 6): the mean of team morale and trust, its trend this period, and the mood counts. */
  pulse: z.object({ value: Num, start: Num, trend: z.enum(['up', 'down', 'flat']), upbeat: z.number().int(), steady: z.number().int(), struggling: z.number().int() }),
  /** Role coverage: at most this many people per stage. */
  maxPerStage: z.number().int().min(1),
  funnel: z.array(z.object({ key: Id, name: Text, members: z.number().int(), ideal: z.number().int(), throughput: Num, idealThroughput: Num, bottleneck: z.boolean() })),
  actions: z.array(ActionView),
  promises: z.array(z.object({ id: Id, memberId: Id, text: Text, state: z.enum(['open', 'kept', 'broken']), dueInSubPeriods: z.number().int().min(0) })),
  /** `briefing`: a scheduled sponsor briefing, opened with `openConversation` kind `sponsor`; other messages are replies. News needs no answer. */
  inbox: z.array(z.object({ id: Id, from: Id, kind: z.enum(['chat', 'email', 'sponsor', 'news']), title: Text, body: Text, urgent: z.boolean(), state: z.string(), briefing: z.boolean(), dueInSubPeriods: z.number().int().nullable() })),
  /** Event cards. `sponsorCall` rings before it shows; `messageId` is the message to answer, if any. */
  cards: z.array(z.object({ id: Id, key: Id, card: CardKind, delivery: z.enum(['modal', 'sponsorCall']), title: Text, body: Text, memberId: Id.nullable(), changes: z.array(MetricChange), label: Text.nullable(), messageId: Id.nullable() })),
  /** `from` resolves the speaker for display: a member, a departed member, a candidate or the sponsor. */
  outcome: Outcome.extend({ from: z.object({ id: Id, name: Text, img: z.string().nullable() }) }).nullable(),
  /**
   * Leadership Score, 0 to `max` (scoring-and-report.md 6): the three pillars 0 to 100, contextual
   * capability %, the mean live band score (null with no live interaction), and the streak bonus.
   * The tier shows once the run has ended.
   */
  score: z.object({ total: Num, max: Num, business: Num, people: Num, leadership: Num, capability: Num, live: Num.nullable(), bonus: Num, tier: z.object({ key: Id, name: Text }).nullable() }),
  streak: z.number().int().min(0),
  /** The authored rules behind stars, streaks and tiers, so the UI can explain them. */
  gamification: z.object({
    weights: z.object({ business: Num, people: Num, leadership: Num }),
    stars: z.tuple([Num, Num, Num]),
    streak: z.object({ length: z.number().int(), minStars: z.number().int(), bonus: Num, cap: Num }),
    tiers: z.array(z.object({ key: Id, name: Text, min: Num }))
  }),
  periods: z.array(PeriodSummary),
  badges: z.array(z.object({ key: Id, rule: Id, name: Text, description: Text, earned: z.boolean(), period: z.number().int().nullable(), reason: Text.nullable() })),
  /** The sponsor meter may show its value (Configuration Spec, CEO meter 0 to 100). */
  sponsor: z.object({ name: Text, title: Text, img: z.string().nullable(), styleLine: Text, value: Num, unlockAt: Num, checkInBelow: Num, level: SponsorLevel, causes: z.array(z.object({ text: Text, delta: Num })) }),
  /** Unlock rewards on offer: `bonus_day`, `hire_budget`, `team_activity`. */
  pendingReward: z.array(Id).nullable(),
  /** Unlock rewards in hand, not yet used. */
  perks: z.object({ bonusDay: z.boolean(), hireBudget: z.boolean(), teamActivity: z.boolean(), checkIn: z.boolean() }),
  history: z.array(LogEntry),
  live: LiveView.nullable(),
  liveCap: z.object({ cap: z.number().int(), used: z.number().int() })
});

/** What the participant asks for. The engine answers with a new view. */
export const Intent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('confirmStyles'), styles: z.record(Id, StyleKey), notes: z.record(Id, z.string()).optional() }),
  z.object({ type: z.literal('openProfile'), memberId: Id }),
  z.object({ type: z.literal('planAction'), action: Id, option: Id.optional(), memberIds: z.array(Id), stage: Id.optional() }),
  z.object({ type: z.literal('openConversation'), kind: z.enum(['reply', 'sponsor']), messageId: Id.optional() }),
  z.object({ type: z.literal('submitInteraction'), interactionId: Id, text: z.string().min(1), usedVoice: z.boolean().optional(), npcReply: z.string().optional() }),
  z.object({ type: z.literal('sendTurn'), interactionId: Id, text: z.string().min(1), usedVoice: z.boolean().optional() }),
  z.object({ type: z.literal('interruptTurn'), interactionId: Id, turnId: Id, shownChars: z.number().int().min(0) }),
  z.object({ type: z.literal('requestHint'), interactionId: Id }),
  z.object({ type: z.literal('nextCandidate'), interactionId: Id }),
  z.object({ type: z.literal('chooseCandidate'), interactionId: Id, candidateId: Id.nullable() }),
  z.object({ type: z.literal('endInteraction'), interactionId: Id }),
  z.object({ type: z.literal('abandonInteraction'), interactionId: Id }),
  z.object({ type: z.literal('dismissCard'), cardId: Id }),
  z.object({ type: z.literal('clearOutcome') }),
  z.object({ type: z.literal('endPeriod') }),
  z.object({ type: z.literal('chooseReward'), reward: Id }),
  z.object({ type: z.literal('startNextPeriod') })
]);

export const IntentResult = z.object({
  view: EngineView,
  changes: z.array(MetricChange),
  outcome: Outcome.optional(),
  interactionId: Id.optional(),
  summary: PeriodSummary.optional(),
  turn: z.object({ id: Id, by: Id, text: Text }).optional(),
  hint: Text.optional()
});

/** One chunk of a streamed AI reply. `done` closes the stream. */
export const StreamChunk = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), text: z.string() }),
  z.object({ type: z.literal('done'), turnId: Id }),
  z.object({ type: z.literal('error'), retryable: z.boolean() })
]);

export type MetricChange = z.output<typeof MetricChange>;
export type Reason = z.output<typeof Reason>;
export type Outcome = z.output<typeof Outcome>;
export type EngineView = z.output<typeof EngineView>;
export type MemberView = z.output<typeof MemberView>;
export type Block = z.output<typeof Block>;
export type LiveView = z.output<typeof LiveView>;
export type ActionView = z.output<typeof ActionView>;
export type Intent = z.input<typeof Intent>;
export type IntentResult = z.output<typeof IntentResult>;
export type StreamChunk = z.output<typeof StreamChunk>;
export type MetricKey = z.output<typeof MetricKey>;
export type StyleKey = z.output<typeof StyleKey>;
export type Mood = z.output<typeof Mood>;
