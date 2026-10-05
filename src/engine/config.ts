import { z } from 'zod';
import { sanitizeCopy } from '../i18n/copy';
import { DEFAULT_DEVELOPMENT, DEFAULT_LINKAGE, DEFAULT_METHODOLOGY, DEFAULT_NARRATIVES, DEFAULT_RECOGNITION, DEFAULT_SCALE, DEFAULT_SKILLS } from './report/defaults';

/**
 * Storyline configuration authored in GenieKreator. The engine only runs on a config that passes
 * this schema; the authoring tool shows the issues it reports. Rules: docs/SIMULATION.md section 1.
 */

const Score = z.number().int().min(0).max(100);
/** Participant facing text authored in GenieKreator, made safe for the copy rules on the way in. */
const Copy = z.string().min(1).transform(sanitizeCopy);
const Key = z.string().regex(/^[a-z][a-z0-9_]*$/);
const Ratio = z.number().min(0).max(1);

/** ISO 4217 code known to the runtime, for example USD, GBP, JPY, SGD, INR, MYR, AED. */
const KNOWN_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));
const CurrencyCode = z.string().regex(/^[A-Z]{3}$/, 'Use a three letter ISO 4217 code').refine(code => KNOWN_CURRENCIES.has(code), 'Unknown currency code');

const Locale = z.string().min(2).refine(l => {
  try {
    return Intl.NumberFormat.supportedLocalesOf([l]).length > 0;
  } catch {
    return false;
  }
}, 'Unsupported locale');

/** Currencies offered in the authoring tool. Any valid ISO 4217 code is accepted. */
export const SUGGESTED_CURRENCIES = ['USD', 'GBP', 'EUR', 'JPY', 'SGD', 'INR', 'MYR', 'AED', 'IDR', 'THB', 'PHP', 'VND', 'AUD', 'CNY', 'SAR'] as const;

export const Money = z.object({
  currency: CurrencyCode,
  locale: Locale,
  display: z.enum(['symbol', 'narrowSymbol', 'code']).default('symbol'),
  target: z.number().positive(),
  valuePerConversion: z.number().positive(),
  /** New leads entering the first stage each sub-period, one value per period. */
  inputPerSubPeriod: z.array(z.number().nonnegative()).min(1)
});

export const PERIOD_UNITS = ['year', 'month', 'week', 'day'] as const;
export const SUB_PERIOD_UNITS = ['quarter', 'month', 'week', 'day', 'hour'] as const;

/** Default sub-period unit and count for each period unit. */
export const SUB_PERIOD_DEFAULTS: Record<(typeof PERIOD_UNITS)[number], { unit: (typeof SUB_PERIOD_UNITS)[number]; perPeriod: number }> = {
  year: { unit: 'quarter', perPeriod: 4 },
  month: { unit: 'week', perPeriod: 4 },
  week: { unit: 'day', perPeriod: 5 },
  day: { unit: 'hour', perPeriod: 8 }
};

export const MAX_PERIODS = 10;

export const Time = z.object({
  period: z.object({ unit: z.enum(PERIOD_UNITS), count: z.number().int().min(1).max(MAX_PERIODS) }),
  subPeriod: z.object({ unit: z.enum(SUB_PERIOD_UNITS), perPeriod: z.number().int().min(2).max(12) }).optional(),
  /** Smallest action cost, in sub-periods. Whole days by default (DECISIONS D32). */
  costStep: z.union([z.literal(0.5), z.literal(1)]).default(1),
  /** Live interactions per period (Configuration Spec, Time and pacing). Replies and sponsor briefings do not count. */
  liveCap: z.number().int().min(1).max(10).default(2)
}).transform(t => ({ ...t, subPeriod: t.subPeriod ?? SUB_PERIOD_DEFAULTS[t.period.unit] }));

export const Stage = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  conversionRatio: Ratio,
  ideal: z.number().int().min(0)
});

export const MIN_STAGES = 3;
export const MAX_STAGES = 6;

const Stats = z.object({ skill: Score, morale: Score, result: Score });

export const Person = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  title: z.string().min(1),
  pronoun: z.enum(['he', 'she', 'they']),
  homeStage: z.string(),
  /** Trust is optional: it defaults to `trustRules.start` (50), lower for wary archetypes (Configuration Spec). */
  start: Stats.extend({ trust: Score.optional() }),
  /** Values in every stage, used by swap and assess (docs/SIMULATION.md 4.3). */
  byStage: z.record(z.string(), Stats),
  profile: z.object({ previous: z.string(), tenure: z.string(), experience: z.string(), skills: z.string(), remarks: z.string(), relations: z.string().default('') }),
  hiddenConcern: Copy.optional(),
  /** What the person says, in their own words, when a conversation surfaces the concern. */
  concernLine: Copy.optional(),
  /** Revealed together with the hidden concern, once a conversation surfaces it (spec, profile). */
  careerGoal: Copy.optional(),
  /** Default portrait. `portraits` may override it per mood. */
  portrait: z.string().optional(),
  portraits: z.record(z.enum(['happy', 'neutral', 'thinking', 'concerned', 'frustrated']), z.string()).optional(),
  voice: z.string().optional()
});

export const Thresholds = z.object({
  high: Score.default(70),
  amber: Score.default(50),
  low: Score.default(30)
});

/** Band scores for live interactions (scoring-and-report.md 4.3). */
const BandScores = z.object({ strong: Score, adequate: Score, weak: Score, harmful: Score });

/** Badge rules the engine knows (scoring-and-report.md 6.1). Authors pick a rule and name the badge. */
export const BADGE_RULES = ['first_close', 'read_the_room', 'flex_master', 'concern_uncovered', 'promise_keeper', 'fair_hand', 'turnaround', 'change_champion', 'steady_hand', 'target_crusher'] as const;
export const Badge = z.object({
  key: Key,
  rule: z.enum(BADGE_RULES),
  name: Copy,
  /** What earns it, shown on the shelf before it is earned. */
  description: Copy
});

/** Rewards offered when sponsor confidence crosses its unlock line (Configuration Spec, Unlock rewards). */
export const UNLOCK_KINDS = ['bonus_day', 'hire_budget', 'team_activity'] as const;

const DEFAULT_BADGES: Array<z.input<typeof Badge>> = [
  { key: 'first_close', rule: 'first_close', name: 'First Close', description: 'Your team converts its first deal.' },
  { key: 'read_the_room', rule: 'read_the_room', name: 'Read the Room', description: 'Give at least 9 in 10 people the style they need in one week.' },
  { key: 'flex_master', rule: 'flex_master', name: 'Flex Master', description: 'Use every style correctly at least twice.' },
  { key: 'concern_uncovered', rule: 'concern_uncovered', name: 'Concern Uncovered', description: 'Help five people open up about what is bothering them.' },
  { key: 'promise_keeper', rule: 'promise_keeper', name: 'Promise Keeper', description: 'Make three promises and break none.' },
  { key: 'fair_hand', rule: 'fair_hand', name: 'Fair Hand', description: 'Recognize people three times without anyone feeling passed over.' },
  { key: 'turnaround', rule: 'turnaround', name: 'Turnaround', description: 'Bring someone from morale below 30 to above 60.' },
  { key: 'change_champion', rule: 'change_champion', name: 'Change Champion', description: 'Explain a change really well twice.' },
  { key: 'steady_hand', rule: 'steady_hand', name: 'Steady Hand', description: 'Finish the run without a conversation going badly.' },
  { key: 'target_crusher', rule: 'target_crusher', name: 'Target Crusher', description: 'Reach the revenue target.' }
];

/**
 * Game scores (scoring-and-report.md 6, Configuration Spec, Gamification settings). Formulas are engine
 * behaviour; the numbers here are the authored inputs, with the iLead 2.0 defaults.
 */
export const Gamification = z.object({
  /** Leadership Score weights for Business, People and Leadership. They must sum to 1. */
  weights: z.object({ business: Ratio, people: Ratio, leadership: Ratio }).default({ business: 0.3, people: 0.3, leadership: 0.4 }),
  /** Top of the Leadership Score scale; the streak cap is part of it (1000 = 900 from the pillars + 100 streak). */
  scale: z.number().int().min(100).max(10000).default(1000),
  liveBandScores: BandScores.default({ strong: 100, adequate: 70, weak: 35, harmful: 0 }),
  /** Week score needed for 1, 2 and 3 stars. */
  stars: z.tuple([Score, Score, Score]).default([50, 70, 85]),
  streak: z.object({
    /** Periods in a row at `minStars` or more before the first bonus. */
    length: z.number().int().min(2).max(10).default(3),
    minStars: z.number().int().min(1).max(3).default(2),
    bonus: z.number().int().min(0).default(25),
    cap: z.number().int().min(0).default(100)
  }).default({ length: 3, minStars: 2, bonus: 25, cap: 100 }),
  /** Highest first. Each tier starts at `min` points. 2 to 5 tiers. */
  tiers: z.array(z.object({ key: Key, name: Copy, min: z.number().int().min(0) })).min(2).max(5).default([
    { key: 'platinum', name: 'Platinum', min: 850 }, { key: 'gold', name: 'Gold', min: 700 },
    { key: 'silver', name: 'Silver', min: 500 }, { key: 'bronze', name: 'Bronze', min: 0 }
  ]),
  sponsor: z.object({
    start: Score.default(50),
    briefing: BandScores.extend({ weak: z.number().int(), harmful: z.number().int() }).default({ strong: 20, adequate: 5, weak: -10, harmful: -25 }),
    /** Each period: revenue at or above the period's share of the target, or below it. */
    periodPace: z.object({ met: z.number().int(), missed: z.number().int() }).default({ met: 5, missed: -5 }),
    /** An ignored event or message that escalates to the sponsor. */
    escalation: z.number().int().max(0).default(-10),
    /** Crossing this upward offers one unlock. */
    unlockAt: Score.default(70),
    /** Dropping below this schedules a CEO check in that costs one day next period. */
    checkInBelow: Score.default(30)
  }).default({ start: 50, briefing: { strong: 20, adequate: 5, weak: -10, harmful: -25 }, periodPace: { met: 5, missed: -5 }, escalation: -10, unlockAt: 70, checkInBelow: 30 }),
  unlocks: z.array(z.enum(UNLOCK_KINDS)).min(1).max(3).default(['bonus_day', 'hire_budget', 'team_activity']),
  /**
   * Leaderboard (scoring-and-report.md 6; Configuration Spec, Leaderboard): ranked by Leadership Score,
   * ties by conversions then contextual capability %. Left unset, it is on for development use and off
   * for selection use.
   */
  leaderboard: z.object({
    enabled: z.boolean().optional(),
    scope: z.enum(['cohort', 'unit', 'global']).default('cohort'),
    size: z.number().int().min(3).max(50).default(10),
    anonymous: z.boolean().default(false)
  }).default({ scope: 'cohort', size: 10, anonymous: false }),
  /** How much the game celebrates (stars, badges, the week end banner): none, subtle or full. */
  celebration: z.enum(['none', 'subtle', 'full']).default('subtle'),
  badges: z.array(Badge).default(DEFAULT_BADGES)
}).superRefine((g, ctx) => {
  const sum = g.weights.business + g.weights.people + g.weights.leadership;
  if (Math.abs(sum - 1) > 0.001) ctx.addIssue({ code: 'custom', path: ['weights'], message: `Weights must add up to 100% (they add up to ${Math.round(sum * 100)}%)` });
  if (!(g.stars[0] < g.stars[1] && g.stars[1] < g.stars[2])) ctx.addIssue({ code: 'custom', path: ['stars'], message: 'Star thresholds must rise' });
  if (g.streak.cap >= g.scale) ctx.addIssue({ code: 'custom', path: ['streak', 'cap'], message: 'The streak cap must be below the score scale' });
  const mins = g.tiers.map(t => t.min);
  if (mins.some((m, i) => i > 0 && m >= mins[i - 1])) ctx.addIssue({ code: 'custom', path: ['tiers'], message: 'List tiers from highest to lowest, each starting below the one before' });
  if (mins[mins.length - 1] !== 0) ctx.addIssue({ code: 'custom', path: ['tiers'], message: 'The lowest tier must start at 0' });
  if (new Set(g.badges.map(b => b.key)).size !== g.badges.length) ctx.addIssue({ code: 'custom', path: ['badges'], message: 'Badge keys must be unique' });
});

/**
 * Report 2.0 settings (scoring-and-report.md 5 and 7; Configuration Spec, Report settings): the skills
 * framework with its anchors, which interactions rate which skills, the rating scale, and the authored
 * copy the report is worded from. Defaults are the iLead 2.0 framework.
 */
export const REPORT_SECTIONS = ['summary', 'style', 'intent', 'skills', 'moments', 'people', 'business', 'analytics', 'plan', 'methodology'] as const;
export const Report = z.object({
  skills: z.array(z.object({ key: Key, name: Copy, anchors: z.array(Copy).min(3).max(7) })).min(2).default(() => DEFAULT_SKILLS.map(s => ({ ...s, anchors: [...s.anchors] }))),
  linkage: z.record(Key, z.array(Key).min(1).max(4)).default(DEFAULT_LINKAGE),
  scale: z.array(z.object({ name: Copy, min: Score })).min(3).max(7).default(DEFAULT_SCALE),
  minObservations: z.number().int().min(1).max(5).default(2),
  evidencePerSkill: z.number().int().min(0).max(4).default(2),
  /** Day count from the report date to the development plan's check in. */
  checkInDays: z.number().int().min(1).max(90).default(14),
  sections: z.array(z.enum(REPORT_SECTIONS)).min(1).default([...REPORT_SECTIONS]),
  narratives: z.object({
    overall: z.array(Copy).min(1),
    capability: z.object({ low: Copy, mid: Copy, high: Copy }),
    dominant: z.object({ D: Copy, G: Copy, P: Copy, E: Copy })
  }).default(DEFAULT_NARRATIVES),
  development: z.record(Key, z.object({ practice: Copy, onTheJob: Copy })).default(DEFAULT_DEVELOPMENT),
  recognitionPhrases: z.array(z.string().min(2)).default(DEFAULT_RECOGNITION),
  methodology: z.array(Copy).min(1).default(DEFAULT_METHODOLOGY),
  /** Reflection questions on the end screen. */
  reflection: z.array(Copy).min(0).max(3).default(['What did you learn about adapting your style to each person?', 'What will you do differently with your real team next week?'])
}).superRefine((r, ctx) => {
  const keys = new Set(r.skills.map(s => s.key));
  for (const [k, list] of Object.entries(r.linkage)) for (const sk of list) if (!keys.has(sk)) ctx.addIssue({ code: 'custom', path: ['linkage', k], message: `No skill called ${sk}` });
  if (r.skills.some(s => s.anchors.length !== r.scale.length)) ctx.addIssue({ code: 'custom', path: ['skills'], message: `Give one anchor per level (${r.scale.length})` });
  if (r.scale[0].min !== 0 || r.scale.some((l, i) => i > 0 && l.min <= r.scale[i - 1].min)) ctx.addIssue({ code: 'custom', path: ['scale'], message: 'Levels start at 0 and rise' });
});

export const STYLES = ['D', 'G', 'P', 'E'] as const;

/** Skill, morale and result change. */
const Effect = z.tuple([z.number().int(), z.number().int(), z.number().int()]);
/** Change for mismatch type 0, 1 and 2 (docs/SIMULATION.md 4.2). */
export const EffectTable = z.object({ m0: Effect, m1: Effect, m2: Effect.optional() });

/** How an action decides its mismatch type (docs/SIMULATION.md 4.3). */
export const ACTION_RULES = ['styleOption', 'weeklyStyle', 'trend', 'training', 'swap', 'assess', 'reward', 'fire', 'hire'] as const;
export const LIVE_FORMATS = ['meeting', 'email', 'roleplay', 'chat', 'plan', 'interview', 'sponsor'] as const;

export const ActionOption = z.object({
  key: Key,
  label: Copy,
  /** The leadership style this option expresses, for style based rules. */
  style: z.enum(STYLES).optional(),
  effects: EffectTable,
  /** Sub-periods the member is away (training). */
  away: z.number().int().min(0).default(0),
  /** For email: what the message does. */
  intent: z.enum(['congratulate', 'warn']).optional(),
  /** Overrides the action's repeat limit for this option (Model doc: team lunch 20 days, team building 8). */
  cooldownDays: z.number().int().min(0).optional(),
  /** Overrides the action's cost for this option (team building takes 2 days, team lunch 1). */
  cost: z.number().min(0).optional(),
  /** Overrides the action's people to pick for this option (swap two people, reassign one). */
  targets: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
  /** The people picked must be in different stages (swap roles). */
  distinctStages: z.boolean().default(false),
  /** The participant picks a stage to move the person to (reassign role). */
  pickStage: z.boolean().default(false)
});

/** Band names in engine order. Participants never see them (spec, outcome panel). */
export const BANDS = ['strong', 'adequate', 'weak', 'harmful'] as const;
const BandDeltas = z.object({
  /** Skill, morale, result, trust for the person (or people) the interaction is with. */
  target: z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()]),
  /** Ripple on everyone else present. */
  bystanders: z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()]).optional(),
  sponsor: z.number().int().default(0)
});

/** The interaction record of a live or hybrid action (Configuration Spec, Per live interaction). */
export const LiveSettings = z.object({
  /** What the participant sees before starting. */
  goal: Copy.optional(),
  /** 2 to 4 rubric dimensions; the evaluator returns a band for each. Defaults per format. */
  rubric: z.array(z.object({ key: Key, label: Copy })).min(2).max(4).optional(),
  /** Deltas per band. Without it, 1.0's mismatch maths generates the consequences (D35). */
  consequences: z.object({ strong: BandDeltas, adequate: BandDeltas, weak: BandDeltas, harmful: BandDeltas }).optional(),
  turnLimit: z.number().int().min(1).max(30).default(12),
  minutes: z.number().min(1).max(15).default(5),
  opening: z.enum(['npc', 'participant']).default('npc'),
  hints: z.enum(['off', 'onRequest', 'afterWeak']).default('onRequest')
});

export const Action = z.object({
  key: Key,
  name: Copy,
  description: Copy,
  scope: z.enum(['team', 'member']),
  kind: z.enum(['live', 'static', 'hybrid']),
  format: z.enum(LIVE_FORMATS).optional(),
  rule: z.enum(ACTION_RULES),
  cost: z.number().min(0),
  cooldownDays: z.number().int().min(0).default(0),
  unlockPeriod: z.number().int().min(1).default(1),
  /** People to pick on the board. [0, 0] means the whole team. */
  targets: z.tuple([z.number().int().min(0), z.number().int().min(0)]).default([0, 0]),
  /** Soft prerequisite: the drawer nudges, the penalty still applies (spec). */
  prerequisite: Key.optional(),
  /** Live and hybrid actions: the interaction record. */
  live: LiveSettings.default({ turnLimit: 12, minutes: 5, opening: 'npc', hints: 'onRequest' }),
  options: z.array(ActionOption).min(1)
});

const Gendered = z.object({ he: Copy, she: Copy, they: Copy.optional() });

export const EVENT_CARDS = ['impact', 'signal', 'capacity', 'diagnostic', 'opportunity', 'crisis'] as const;
/**
 * How an event reaches the participant (Configuration Spec, Delivery): a modal card on the board, a
 * news bulletin in the week end before it lands, a chat or email from the person it is about, or a
 * call from the sponsor.
 */
export const EVENT_DELIVERY = ['modal', 'bulletin', 'chat', 'email', 'sponsorCall'] as const;
export const EVENT_CONDITIONS = ['teamMoraleBelow', 'teamTrustBelow', 'memberMoraleBelow', 'behindPace'] as const;

export const GeneralEvent = z.object({
  key: Key,
  title: Copy,
  body: Gendered,
  card: z.enum(EVENT_CARDS),
  /** Fixed timing: this period and sub-period. Random and conditional events leave it out. */
  period: z.number().int().min(1).optional(),
  subPeriod: z.number().int().min(1).default(1),
  /** Random timing: some sub-period in these periods, with this chance (0 to 100). Drawn once per run from the seed. */
  window: z.object({ from: z.number().int().min(1), to: z.number().int().min(1), probability: z.number().int().min(0).max(100).default(100) }).optional(),
  /** Conditional: checked at each period start, fires the first time it holds for `periods` period ends in a row. */
  when: z.object({ condition: z.enum(EVENT_CONDITIONS), value: z.number().min(0).max(100).default(30), periods: z.number().int().min(1).max(4).default(1) }).optional(),
  impact: Effect,
  /** Sub-periods the target is away (capacity loss). */
  away: z.number().int().min(0).max(10).default(0),
  /** `team`; `member` (the engine picks); `sponsor`; `stage:<key>` for everyone in a stage; or a member id. */
  target: z.string().regex(/^(team|member|sponsor|stage:[a-z][a-z0-9_]*|[a-z][a-z0-9_]*)$/).default('team'),
  delivery: z.enum(EVENT_DELIVERY).default('modal'),
  /** What a bulletin's See impact says. */
  impactText: Copy.optional(),
  /** A label on the card, such as "No impact on result". Hidden unless authored (labels can mislead). */
  label: Copy.optional(),
  /**
   * The response the engine rewards: any of these actions with the target (`reply` answers the
   * message), within this many sub-periods. Answered in time, `onTime` applies to the target.
   */
  response: z.object({ actions: z.array(Key).min(1), within: z.number().int().min(1).max(5).default(2), onTime: Effect.default([0, 2, 0]) }).optional(),
  /** If the response does not come in time: a follow up event, and whether it reaches the sponsor. */
  escalation: z.object({ event: Key.optional(), sponsor: z.boolean().default(true) }).optional()
}).superRefine((e, ctx) => {
  const kinds = [e.period !== undefined, !!e.window, !!e.when].filter(Boolean).length;
  if (kinds > 1) ctx.addIssue({ code: 'custom', path: ['period'], message: 'Give a fixed period, a random window or a condition, not more than one' });
  if (e.window && e.window.from > e.window.to) ctx.addIssue({ code: 'custom', path: ['window'], message: 'The window must start before it ends' });
  if ((e.delivery === 'chat' || e.delivery === 'email') && e.target === 'team') ctx.addIssue({ code: 'custom', path: ['delivery'], message: 'A chat or email comes from one person: target a member' });
});

export const TRIGGER_KINDS = ['casualLeave', 'medicalLeave', 'clueless', 'demoralized', 'lackOfTraining', 'moraleDrops', 'resignation', 'roleChangeRequest', 'complains', 'trainingRequest'] as const;

export const Trigger = z.object({
  kind: z.enum(TRIGGER_KINDS),
  message: Gendered,
  impact: Effect.default([0, 0, 0]),
  maxTimes: z.number().int().min(1).default(1),
  /** Kind specific numbers (thresholds, durations, run fractions). Engine defaults fill the rest. */
  params: z.record(z.string(), z.number()).default({})
});

export const StorylineConfig = z.object({
  id: z.string(),
  name: z.string(),
  /** The organisation the participant joins (Configuration Spec, Organisation name), as the sponsor and consent screens name it. */
  organisation: z.string().min(1).optional(),
  money: Money,
  time: Time,
  stages: z.array(Stage).min(MIN_STAGES).max(MAX_STAGES),
  /** The participant's sponsor: sends notes, takes briefings, holds confidence. */
  sponsor: z.object({
    name: z.string().min(1), title: z.string().min(1), portrait: z.string().optional(),
    /** Periods with a sponsor briefing. Default: the mid point and the last period (Design doc: weeks 4 and 8 of 8). */
    briefings: z.array(z.number().int().min(1)).optional(),
    /** The one line prompt over weekly style setting (spec). */
    styleLine: Copy.default('To each their own. Your people need different things from you this week.')
  }),
  members: z.array(Person).min(6).max(12),
  candidates: z.array(Person).default([]),
  thresholds: Thresholds.default({ high: 70, amber: 50, low: 30 }),
  gamification: Gamification.default(() => Gamification.parse({})),
  report: Report.default(() => Report.parse({})),
  /** Use declaration (Configuration Spec, Governance): development or selection. Selection turns the leaderboard off by default. */
  use: z.enum(['development', 'selection']).default('development'),
  actions: z.array(Action).min(1),
  /** Weekly style setting effect per period (docs/SIMULATION.md 4.4). */
  weeklyStyle: EffectTable,
  events: z.array(GeneralEvent).default([]),
  triggers: z.array(Trigger).default([]),
  /**
   * Trust rules (D30), configurable defaults. GenieKreator sets the start (50) and the intent vs
   * action gap; the rest were designed for 2.0 and kept on your call (D49).
   */
  trustRules: z.object({
    start: Score.default(50),
    /** Changing someone's style when their needs did not change. */
    erraticStyleChange: z.number().int().max(0).default(-2),
    /** Declared style and shown style differ for one person two periods running (Design doc, Consistency). */
    intentGap: z.number().int().max(0).default(-4),
    /** Positive changes scale from `min` at trust 0 to `max` at trust 100. 1 and 1 switch it off. */
    multiplier: z.object({ min: z.number().min(0.5).max(1), max: z.number().min(1).max(1.5) }).default({ min: 0.8, max: 1.2 }),
    /** Below this trust, a partial style miss shows more often. */
    lowTrust: z.object({ below: Score, chance: z.number().min(0).max(1) }).default({ below: 30, chance: 0.75 }),
    /** Largest net trust move per sub-period. */
    capPerSubPeriod: z.number().int().min(1).default(12)
  }).default({ start: 50, erraticStyleChange: -2, intentGap: -4, multiplier: { min: 0.8, max: 1.2 }, lowTrust: { below: 30, chance: 0.75 }, capPerSubPeriod: 12 }),
  /** Role coverage (Teardown hidden rule 6, Configuration Spec eligibility): at most this many people per stage. */
  maxPerStage: z.number().int().min(1).default(2),
  /** Weekly drift (Configuration Spec, Targets and KPIs): what someone loses in a period nobody acted with them. */
  drift: z.object({ morale: z.number().min(0).default(3), result: z.number().min(0).default(0) }).default({ morale: 3, result: 0 }),
  /** Funnel buffer from the Model doc, set by calibration. */
  performanceThreshold: z.number().min(-50).max(400),
  calibrated: z.boolean().default(false)
}).superRefine((c, ctx) => {
  const stageKeys = new Set(c.stages.map(s => s.key));
  if (stageKeys.size !== c.stages.length) ctx.addIssue({ code: 'custom', path: ['stages'], message: 'Stage keys must be unique' });
  if (c.money.inputPerSubPeriod.length !== 1 && c.money.inputPerSubPeriod.length !== c.time.period.count)
    ctx.addIssue({ code: 'custom', path: ['money', 'inputPerSubPeriod'], message: `Give one value, or one per period (${c.time.period.count})` });
  const ids = new Set<string>();
  for (const [list, people] of [['members', c.members], ['candidates', c.candidates]] as const) {
    people.forEach((p, i) => {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', path: [list, i, 'id'], message: `Duplicate person id ${p.id}` });
      ids.add(p.id);
      if (!stageKeys.has(p.homeStage)) ctx.addIssue({ code: 'custom', path: [list, i, 'homeStage'], message: `Unknown stage ${p.homeStage}` });
      for (const s of stageKeys) if (!p.byStage[s]) ctx.addIssue({ code: 'custom', path: [list, i, 'byStage', s], message: `Missing values for stage ${s}` });
    });
  }
  const actionKeys = new Set<string>();
  c.actions.forEach((a, i) => {
    if (actionKeys.has(a.key)) ctx.addIssue({ code: 'custom', path: ['actions', i, 'key'], message: `Duplicate action ${a.key}` });
    actionKeys.add(a.key);
    if (Math.abs(a.cost / c.time.costStep - Math.round(a.cost / c.time.costStep)) > 1e-9)
      ctx.addIssue({ code: 'custom', path: ['actions', i, 'cost'], message: `Cost must be a multiple of ${c.time.costStep}` });
    if (a.kind !== 'static' && !a.format) ctx.addIssue({ code: 'custom', path: ['actions', i, 'format'], message: 'Live and hybrid actions need a format' });
    if (a.targets[0] > a.targets[1]) ctx.addIssue({ code: 'custom', path: ['actions', i, 'targets'], message: 'Minimum targets above maximum' });
    if (a.unlockPeriod > c.time.period.count) ctx.addIssue({ code: 'custom', path: ['actions', i, 'unlockPeriod'], message: 'Unlocks after the last period' });
  });
  c.actions.forEach((a, i) => { if (a.prerequisite && !actionKeys.has(a.prerequisite)) ctx.addIssue({ code: 'custom', path: ['actions', i, 'prerequisite'], message: `Unknown action ${a.prerequisite}` }); });
  const eventKeys = new Set(c.events.map(e => e.key));
  const memberIds = new Set(c.members.map(m => m.id));
  c.events.forEach((e, i) => {
    const last = c.time.period.count;
    if (e.period !== undefined && e.period > last) ctx.addIssue({ code: 'custom', path: ['events', i, 'period'], message: `Period ${e.period} is after the last period (${last})` });
    if (e.window && e.window.to > last) ctx.addIssue({ code: 'custom', path: ['events', i, 'window'], message: `The window ends after the last period (${last})` });
    if (e.escalation?.event && !eventKeys.has(e.escalation.event)) ctx.addIssue({ code: 'custom', path: ['events', i, 'escalation', 'event'], message: `No event called ${e.escalation.event}` });
    const t = e.target;
    if (t.startsWith('stage:') && !stageKeys.has(t.slice(6))) ctx.addIssue({ code: 'custom', path: ['events', i, 'target'], message: `No stage called ${t.slice(6)}` });
    if (!['team', 'member', 'sponsor'].includes(t) && !t.startsWith('stage:') && !memberIds.has(t)) ctx.addIssue({ code: 'custom', path: ['events', i, 'target'], message: `No team member called ${t}` });
    if (c.time.subPeriod && e.subPeriod > c.time.subPeriod.perPeriod) ctx.addIssue({ code: 'custom', path: ['events', i, 'subPeriod'], message: 'Sub-period out of range' });
  });
  if (!(c.thresholds.low < c.thresholds.amber && c.thresholds.amber < c.thresholds.high))
    ctx.addIssue({ code: 'custom', path: ['thresholds'], message: 'Thresholds must rise: low < amber < high' });
});

export type StorylineConfig = z.output<typeof StorylineConfig>;
export type StorylineInput = z.input<typeof StorylineConfig>;

/** Parses a storyline, returning readable issues instead of throwing. */
export function parseStoryline(input: unknown): { ok: true; config: StorylineConfig } | { ok: false; issues: string[] } {
  const r = StorylineConfig.safeParse(input);
  if (r.success) return { ok: true, config: r.data };
  return { ok: false, issues: r.error.issues.map(i => `${i.path.join('.') || 'storyline'}: ${i.message}`) };
}

export { moneyFormatter } from './money';
