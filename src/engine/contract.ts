import { z } from 'zod';
import { sanitizeCopy } from '../i18n/copy';
import { wordCopy } from '../i18n/engineCopy';
import type { Copy, Param as CopyParam } from './copy';
import type { ReportViewInput } from './reportContract';

// Zod compiles a fast path for each object schema on its first parse. The views are parsed a few times
// per minute, so the compile cost is never paid back: on a slow CPU it was most of the first load's
// long task (D78). The plain path is used instead.
z.config({ jitless: true });

/**
 * The engine contract: the payloads the engine sends and the intents it accepts. The engine is
 * authoritative and server side; the UI renders these and never computes outcomes, scores or
 * state changes itself (brief, rule 1). Every payload is parsed here at the boundary, for the real
 * engine and the mock alike, which also applies the copy rules to all engine and AI text.
 */

/**
 * Engine copy (D60, D83): the engine sends a message code with parameters, worded on the client from the
 * ICU catalog in the participant's language. Codes are `engine.*` keys only. Parameters may nest:
 * messages, lists, money (formatted in the participant's locale) and authored templates.
 */
const Param: z.ZodType<CopyParam> = z.lazy(() => z.union([z.string(), z.number(), CopyMsg, CopyTemplate, CopyMoney, CopyList]));
const CopyMsg = z.object({ code: z.string().regex(/^engine\.[A-Za-z0-9_.]+$/), params: z.record(z.string(), Param).optional() }).meta({ id: 'EngineCopyMessage', description: 'An engine.* catalog code with parameters, worded on the client (D83).' });
const CopyTemplate = z.object({ template: z.string(), params: z.record(z.string(), Param) }).meta({ id: 'EngineCopyTemplate', description: 'Authored copy with {placeholders} filled on the client.' });
const CopyMoney = z.object({ money: z.number().finite(), currency: z.string().length(3), locale: z.string().min(2), display: z.enum(['symbol', 'narrowSymbol', 'code']) }).meta({ id: 'EngineCopyMoney' });
const CopyList = z.object({ list: z.array(Param), conj: z.enum(['and', 'or', 'comma']) }).meta({ id: 'EngineCopyList' });
/**
 * Text the participant reads: authored or AI written strings, or engine copy as a code with parameters,
 * worded in the participant's language and made safe for the copy rules on the way in.
 */
export const Text = z.union([z.string(), CopyMsg, CopyTemplate]).meta({ id: 'Text' }).transform(v => sanitizeCopy(typeof v === 'string' ? v : wordCopy(v as Copy)));
const Id = z.string().min(1);
const Num = z.number().finite();

export const MetricKey = z.enum(['skill', 'morale', 'result', 'trust']);
/** A style key of the storyline's lens (D70), for example "D". Names and letters come with the view's `lens`. */
export const StyleKey = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,15}$/);
export const NeedKey = z.enum(['lowSkill_lowMorale', 'lowSkill_highMorale', 'highSkill_lowMorale', 'highSkill_highMorale']);
/**
 * The leadership lens as the participant sees it (D70, D104): 4 or 5 styles and the names of the four needs,
 * in the grid's order. The UI never hard codes style names. The fit table and the source stay on the server.
 */
export const LensView = z.object({
  id: Id, title: Text,
  styles: z.array(z.object({ key: StyleKey, letter: z.string().min(1).max(2), name: Text, short: Text, description: Text })).min(2).max(6),
  needs: z.array(z.object({ key: NeedKey, label: Text, short: Text })).length(4),
  /** The Tutorial's worked examples (D91): an archetypal person (never a team member), the style that fits and why. */
  examples: z.array(z.object({ need: NeedKey, style: StyleKey, person: Text, why: Text })).default([])
});
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
  /** `attitude`, `awareness` and `responsibilities` come only when the storyline authors them (D97). */
  profile: z.object({ previous: Text, tenure: Text, experience: Text, skills: Text, remarks: Text, relations: Text, attitude: Text.optional(), awareness: Text.optional(), responsibilities: Text.optional() })
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
  people: z.array(Who), speaker: Who, raisedHands: z.array(Id),
  brief: z.object({ goal: Text.nullable(), known: z.array(Text), mood: Mood.nullable(), promises: z.array(Text), declaredStyle: StyleKey.nullable() }),
  /** `aiGenerated` marks NPC turns for the AI label (brief, rule 7). */
  turns: z.array(z.object({ id: Id, by: Id, text: Text, voice: z.boolean(), interrupted: z.boolean(), aiGenerated: z.boolean() })),
  turnLimit: z.number().int().min(1), turnsLeft: z.number().int().min(0), minutes: Num,
  closed: z.boolean(),
  hint: z.object({ mode: z.enum(['off', 'onRequest']), text: Text.nullable() }),
  candidates: z.array(Who.extend({ title: Text, cv: z.object({ previous: Text, experience: Text, skills: Text, remarks: Text }) })).nullable(),
  candidate: z.number().int().min(0).nullable(),
  replyTo: Id.nullable(),
  /** The Week 0 practice (D84): not scored; ending it gives a tip, not an outcome. */
  practice: z.boolean().default(false)
});

export const ActionView = z.object({
  key: Id, rule: Id, name: Text, description: Text, scope: z.enum(['team', 'member']), kind: z.enum(['live', 'static', 'hybrid']),
  /** `cost` is what it costs now (0 on the extra hire budget). `perk` names an unlock reward that applies to it. */
  format: z.string().nullable(), cost: Num, perk: z.enum(['hireBudget', 'noCooldown']).nullable(), targets: z.tuple([z.number(), z.number()]), prerequisite: Id.nullable(),
  options: z.array(z.object({
    key: Id, label: Text, blocked: Block.nullable(),
    /** Cost of this option, when it differs from the action's. */
    cost: Num,
    /** Sub-periods the person is away afterwards (training). */
    away: z.number().int().min(0),
    /** Sub-periods before this option can be taken again (D97). */
    cooldown: z.number().int().min(0).default(0),
    /** Overrides the action's people to pick. */
    targets: z.tuple([z.number(), z.number()]).nullable(),
    distinctStages: z.boolean(), pickStage: z.boolean(),
    /** For options where you pick a stage: each stage and why it cannot take someone, if so. */
    stages: z.array(z.object({ key: Id, blocked: Block.nullable() })).nullable()
  })),
  /** Sub-periods before it can be taken again, and the period it unlocks in (D97: the list of every action). */
  cooldown: z.number().int().min(0).default(0), unlockPeriod: z.number().int().min(1).default(1),
  /** Why a team action is unavailable, or null. */
  blocked: Block.nullable(),
  /** Why a member action is unavailable for each member, or null. */
  blockedFor: z.record(Id, Block.nullable())
});

export const LogEntry = z.object({
  id: Id, period: z.number().int(), sub: z.number().int(), kind: z.enum(['style', 'action', 'interaction', 'event', 'trigger', 'periodEnd']),
  title: Text, memberIds: z.array(Id), changes: z.array(MetricChange), quote: Text.optional(),
  /** The action or conversation it came from, for the History filter (D95). */
  action: Id.optional()
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
  news: z.array(z.object({ key: Id, card: CardKind, title: Text, body: Text, impact: Text.nullable() })),
  /** Shown business variables at the period's start and end (D136); left out when the storyline has none. */
  variables: z.array(z.object({ key: Id, start: Num, end: Num })).optional(),
  /** Choices made, or left to their default, this period (D137). */
  choices: z.array(z.object({ id: Id, title: Text, label: Text.nullable(), by: z.enum(['you', 'default']) })).optional(),
  /** People off sick or gone because their morale stayed low (D135). */
  attrition: z.array(z.object({ memberId: Id, name: Text, kind: z.enum(['sick', 'resigned']) })).optional()
});

/** How a business variable reads (D136): money in the storyline's currency, a percentage or points. */
export const VariableFormat = z.enum(['money', 'percent', 'points']);
/** A business variable the participant is shown (D136). */
export const VariableView = z.object({
  key: Id, name: Text, format: VariableFormat, value: Num, start: Num, min: Num, max: Num, higherIsBetter: z.boolean(), about: Text.nullable(),
  causes: z.array(z.object({ text: Text, delta: Num }))
});
/** A choice waiting for the participant (D137): what is known and the options, never their consequences. */
export const OpenChoice = z.object({
  id: Id, eventKey: Id, card: z.enum(['impact', 'signal', 'capacity', 'diagnostic', 'opportunity', 'crisis']), title: Text, body: Text, memberId: Id.nullable(), known: z.array(Text),
  options: z.array(z.object({ key: Id, label: Text, detail: Text.nullable() })).min(2).max(4), dueInSubPeriods: z.number().int().min(0)
});
/** A choice made, or left to its default (D137), and what it changed. */
export const ChoiceView = z.object({
  id: Id, eventKey: Id, title: Text, option: Id.nullable(), label: Text.nullable(), outcome: Text.nullable(), by: z.enum(['you', 'default']), period: z.number().int(), sub: z.number().int(),
  changes: z.array(MetricChange), variables: z.array(z.object({ key: Id, name: Text, delta: Num })), revenue: Num,
  triggered: z.array(z.object({ key: Id, title: Text, period: z.number().int() }))
});

/** Everything the participant may see. Never includes a member's needed style. */
export const EngineView = z.object({
  phase: z.enum(['style', 'board', 'periodEnd', 'ended']),
  /** The storyline's name, the organisation the participant joins and the authored welcome letter, for onboarding. */
  storyline: z.object({ name: Text, organisation: Text.nullable(), locale: z.string().default('en'), intro: z.object({ welcome: z.array(Text), product: z.array(Text), targets: z.array(Text) }).nullish(),
    /** The welcome video, replayable from Tutorial and video (D90): its file, poster, captions track and transcript. */
    video: z.object({ src: z.string().optional(), poster: z.string().optional(), captions: z.string().optional(), transcript: z.array(Text) }).nullish() }),
  lens: LensView,
  clock: Clock,
  money: z.object({ currency: z.string(), locale: z.string(), display: z.enum(['symbol', 'narrowSymbol', 'code']), target: Num, value: Num, valueThisPeriod: Num }),
  members: z.array(MemberView),
  kpis: z.array(z.object({ metric: MetricKey, value: Num, start: Num, trend: z.enum(['up', 'down', 'flat']) })),
  /** Team Pulse (scoring-and-report.md 6): the mean of team morale and trust, its trend this period, and the mood counts. */
  pulse: z.object({ value: Num, start: Num, trend: z.enum(['up', 'down', 'flat']), upbeat: z.number().int(), steady: z.number().int(), struggling: z.number().int() }),
  /** Role coverage: at most this many people per stage. */
  maxPerStage: z.number().int().min(1),
  funnel: z.array(z.object({ key: Id, name: Text, members: z.number().int(), ideal: z.number().int(), throughput: Num, idealThroughput: Num, bottleneck: z.boolean(),
    /** What the stage does and which skills suit it, when authored (D97). */
    about: Text.nullable().default(null), suits: Text.nullable().default(null) })),
  actions: z.array(ActionView),
  promises: z.array(z.object({ id: Id, memberId: Id, text: Text, state: z.enum(['open', 'kept', 'broken']), dueInSubPeriods: z.number().int().min(0) })),
  /** `briefing`: a scheduled sponsor briefing, opened with `openConversation` kind `sponsor`; other messages are replies. News needs no answer. */
  inbox: z.array(z.object({ id: Id, from: Id, kind: z.enum(['chat', 'email', 'sponsor', 'news']), title: Text, body: Text, urgent: z.boolean(), state: z.string(), briefing: z.boolean(), dueInSubPeriods: z.number().int().nullable() })),
  /** Event cards. `sponsorCall` rings before it shows; `messageId` is the message to answer, if any. */
  cards: z.array(z.object({ id: Id, key: Id, card: CardKind, delivery: z.enum(['modal', 'sponsorCall']), title: Text, body: Text, memberId: Id.nullable(), changes: z.array(MetricChange), label: Text.nullable(), messageId: Id.nullable(),
    /** The choice the card opens, when the event is a choice (D137). */
    choiceId: Id.optional() })),
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
    tiers: z.array(z.object({ key: Id, name: Text, min: Num })),
    /** Ranks come from the cohort API (`getLeaderboard`), not the engine: they need other participants. */
    leaderboard: z.object({ enabled: z.boolean(), scope: z.enum(['cohort', 'unit', 'global']), size: z.number().int(), anonymous: z.boolean() }),
    celebration: z.enum(['none', 'subtle', 'full'])
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
  /**
   * Each revealed person's result at the start of every period so far, then now (D96): the profile's trend
   * and the result overview. A null is a period they were not on the team yet.
   */
  trends: z.record(Id, z.array(Num.nullable())).default({}),
  /** Progress milestones reached, in order (D93): revenue against the target, or a stage against its run ideal. */
  milestones: z.array(z.object({ key: Id, kind: z.enum(['target', 'stage']), stage: Id.nullable(), pct: Num, period: z.number().int(), sub: z.number().int() })).default([]),
  /** The guided tour (D94) and the demo round (D92), as the storyline sets them. */
  guide: z.object({
    tour: z.object({ enabled: z.boolean(), steps: z.record(z.string(), z.object({ title: Text.optional(), body: Text.optional() })) }),
    demo: z.object({ enabled: z.boolean(), with: Id.nullable(), action: Id.nullable() })
  }).default({ tour: { enabled: true, steps: {} }, demo: { enabled: false, with: null, action: null } }),
  live: LiveView.nullable(),
  /** The Week 0 practice conversation (D16, D84): on offer before week 1 begins, with this team member. */
  practice: z.object({ available: z.boolean(), partner: Id.nullable() }).default({ available: false, partner: null }),
  liveCap: z.object({ cap: z.number().int(), used: z.number().int() }),
  /** Business variables the participant is shown (D136). */
  variables: z.array(VariableView).default([]),
  /** Choices waiting for the participant, and choices made (D137). */
  openChoices: z.array(OpenChoice).default([]),
  choices: z.array(ChoiceView).default([]),
  /**
   * The report, once the run has ended. Its schema is `ReportView` in `./reportContract`, which the end
   * screen and the report (both loaded on demand) parse with `parseReport`; the first load only checks
   * that it is an object, so the report's schema stays out of it (D76).
   */
  report: z.custom<ReportViewInput>(v => typeof v === 'object' && v !== null, 'The report must be an object').nullable()
});

/** What the participant asks for. The engine answers with a new view. */
export const Intent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('confirmStyles'), styles: z.record(Id, StyleKey), notes: z.record(Id, z.string()).optional() }),
  z.object({ type: z.literal('openProfile'), memberId: Id }),
  z.object({ type: z.literal('planAction'), action: Id, option: Id.optional(), memberIds: z.array(Id), stage: Id.optional() }),
  z.object({ type: z.literal('openConversation'), kind: z.enum(['reply', 'sponsor']), messageId: Id.optional() }),
  z.object({ type: z.literal('submitInteraction'), interactionId: Id, text: z.string().min(1), usedVoice: z.boolean().optional(), npcReply: z.string().optional() }),
  z.object({ type: z.literal('sendTurn'), interactionId: Id, text: z.string().min(1), usedVoice: z.boolean().optional() }),
  /** A written plan, submitted once with its fields (D85); the NPC answers with a check in, `endInteraction` evaluates the fields. */
  z.object({ type: z.literal('submitPlan'), interactionId: Id, text: z.string().min(1),
    plan: z.object({ goals: z.string().max(2000), measures: z.string().max(2000), owner: z.string().max(200), due: z.number().int().min(1).nullable(), support: z.string().max(2000) }), usedVoice: z.boolean().optional() }),
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
  /** End screen: reflection answers (text or transcribed voice, up to 3) and the 1 to 5 experience rating. */
  z.object({ type: z.literal('submitReflection'), answers: z.array(z.string().max(2000)).max(3), rating: z.number().int().min(1).max(5).nullable() }),
  z.object({ type: z.literal('startNextPeriod') }),
  /** The Week 0 practice (D84): open it, or skip it. `endInteraction` and `abandonInteraction` close it. */
  z.object({ type: z.literal('startPractice') }),
  z.object({ type: z.literal('skipPractice') }),
  /** A choice event's option (D137). Costs no time. */
  z.object({ type: z.literal('decide'), choiceId: Id, option: Id })
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
export type LensView = z.output<typeof LensView>;
export type Mood = z.output<typeof Mood>;
export type VariableView = z.output<typeof VariableView>;
export type OpenChoice = z.output<typeof OpenChoice>;
export type ChoiceView = z.output<typeof ChoiceView>;
