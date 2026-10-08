import { z } from 'zod';
import { sanitizeCopy } from '../i18n/copy';
import { LENS_IDS, MAX_STYLES, MIN_STYLES, NEEDS } from './lens';
import { DEFAULT_LENS } from './lensLibrary';
import {
  DEFAULT_ACTION_COPY, DEFAULT_ASSESSMENT, DEFAULT_CONSISTENCY_ACTIONS, DEFAULT_DEVELOPMENT, DEFAULT_IMPACT, DEFAULT_LINKAGE, DEFAULT_METHODOLOGY, DEFAULT_NARRATIVES, DEFAULT_PATH,
  DEFAULT_PURPOSE_COPY, DEFAULT_RECOGNITION, DEFAULT_SCALE, DEFAULT_SKILL_DESCRIPTIONS, DEFAULT_SKILLS, DEFAULT_TAKEAWAYS, DEFAULT_THOUGHT
} from './report/defaults';

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
  ideal: z.number().int().min(0),
  /** What the stage does, for its info popover on the board and in Objectives (D97). */
  about: Copy.optional(),
  /** Which skills and strengths suit the stage (1.0's Module Scope). */
  suits: Copy.optional()
});

/** A team plays with 6 to 12 people. */
export const MIN_MEMBERS = 6;
export const MAX_MEMBERS = 12;

export const MIN_STAGES = 3;
export const MAX_STAGES = 6;

const Stats = z.object({ skill: Score, morale: Score, result: Score });

/** How long an NPC's replies run (D130). */
export const REPLY_LENGTHS = ['short', 'medium', 'long'] as const;
const NpcText = z.string().min(1).max(4000);

/**
 * How the person plays in conversation (D130), authored in GenieKreator's character editor. Never shown to
 * participants: the AI character reads it (ai/src/npc/prompt.ts) and the engine ignores it, so a storyline
 * without it plays exactly as before. `reactions` is keyed by lens style key; `speech` sliders run 0 to 100.
 */
export const NpcPersona = z.object({
  age: NpcText.optional(),
  motivatedBy: NpcText.optional(),
  /** Topics the person will not discuss; they deflect in role. */
  avoid: NpcText.optional(),
  /** How the person reacts when led in each style, by lens style key. */
  reactions: z.record(z.string(), NpcText).optional(),
  speech: z.object({
    language: z.string().max(400).optional(),
    accent: z.string().max(400).optional(),
    pace: Score.default(50),
    warmth: Score.default(50),
    formality: Score.default(50),
    replyLength: z.enum(REPLY_LENGTHS).default('medium')
  }).optional(),
  /** The author's own facts about the person (custom fields). */
  notes: z.array(z.object({ label: z.string().min(1).max(400), value: NpcText })).max(16).optional()
});

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
  /**
   * Profile facts. `attitude`, `awareness` and `responsibilities` are optional authored rows (1.0's profile
   * note, D97): shown only when the storyline gives them.
   */
  profile: z.object({
    previous: z.string(), tenure: z.string(), experience: z.string(), skills: z.string(), remarks: z.string(), relations: z.string().default(''),
    attitude: z.string().min(1).optional(), awareness: z.string().min(1).optional(), responsibilities: z.string().min(1).optional()
  }),
  hiddenConcern: Copy.optional(),
  /** What the person says, in their own words, when a conversation surfaces the concern. */
  concernLine: Copy.optional(),
  /** Revealed together with the hidden concern, once a conversation surfaces it (spec, profile). */
  careerGoal: Copy.optional(),
  /** Default portrait. `portraits` may override it per mood. */
  portrait: z.string().optional(),
  portraits: z.record(z.enum(['happy', 'neutral', 'thinking', 'concerned', 'frustrated']), z.string()).optional(),
  voice: z.string().optional(),
  /** How the AI character plays this person (D130). Optional; the engine never reads it. */
  npc: NpcPersona.optional()
});

/**
 * The world around the team (D130), authored in GenieKreator's Story and world tab. The AI characters
 * read it so small talk stays in the story (ai/src/npc/prompt.ts); the engine never reads it, and a
 * storyline without it plays as before.
 */
export const World = z.object({
  about: NpcText.optional(),
  headquarters: NpcText.optional(),
  /** The team the participant leads, in the company's words. */
  team: NpcText.optional(),
  product: z.object({ name: NpcText.optional(), line: NpcText.optional(), points: z.array(NpcText).max(8).optional() }).optional(),
  customers: NpcText.optional(),
  rivals: z.array(z.object({ name: NpcText, angle: NpcText.optional() })).max(6).optional(),
  /** How the sponsor sounds, for the sponsor's own lines. */
  sponsorVoice: NpcText.optional()
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
export const REPORT_SECTIONS = [
  'about', 'summary', 'skills', 'objectives', 'adaptability', 'styles', 'style', 'consistency', 'intent', 'actions', 'distribution',
  'moments', 'decisions', 'people', 'business', 'analytics', 'thought', 'takeaways', 'plan', 'progress', 'methodology'
] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
/** Why the storyline runs (D75): development reports never show verdicts; assessment reports do. */
export const PURPOSES = ['development', 'assessment'] as const;
export type Purpose = (typeof PURPOSES)[number];
/** The report's sections when the author leaves `report.sections` out: they differ by purpose (D76). */
export const DEFAULT_SECTIONS: Record<Purpose, ReportSection[]> = {
  development: ['about', 'summary', 'skills', 'objectives', 'adaptability', 'styles', 'style', 'consistency', 'intent', 'actions', 'distribution', 'moments', 'people', 'business', 'analytics', 'thought', 'takeaways', 'plan', 'progress', 'methodology'],
  assessment: ['about', 'summary', 'skills', 'objectives', 'adaptability', 'styles', 'consistency', 'actions', 'distribution', 'moments', 'people', 'business', 'analytics', 'plan', 'progress', 'methodology']
};

const Bands3 = z.object({ low: Copy, mid: Copy, high: Copy });
/** One purpose's narrative bank (D75, defaults in report/defaults.ts). */
const PurposeCopy = z.object({
  about: z.array(Copy).min(1).max(4),
  howToRead: z.array(Copy).min(1).max(6),
  confidentiality: Copy,
  /** By overall level, lowest first, read in proportion to the scale. Left out, `narratives.overall`. */
  overall: z.array(Copy).min(1).optional(),
  /** By skill level, lowest first, read in proportion to the scale. {skill} is the skill's name. */
  skill: z.array(Copy).min(1),
  skillNone: Copy,
  /** By share of target: under 60%, under 100%, reached. */
  objectives: z.object({ below: Copy, near: Copy, met: Copy }),
  /** By contextual capability: under 40%, under 70%, 70% and up. */
  adaptability: Bands3,
  /** Per style, by its accuracy (under 40%, under 70%, 70% and up), and whether people needed it more or less often than it was used. */
  style: z.object({ unused: Copy, low: Copy, mid: Copy, high: Copy, under: Copy, over: Copy }),
  preferred: Copy,
  /** By deviation: under 25%, under 50%, 50% and up. */
  consistency: z.object({ neededUsed: Bands3, intendedUsed: Bands3, neededIntended: Bands3 }),
  actions: z.object({ unused: Copy, none: Copy, veryLow: Copy, low: Copy, moderate: Copy, high: Copy })
});
const Prompts = z.array(Copy).max(4);
/** The group report's narrative bank (D77, defaults in report/groupDefaults.ts). Replaced as a whole. */
export const GroupCopy = z.object({
  about: z.array(Copy).min(1).max(4),
  howToRead: z.array(Copy).min(1).max(6),
  /** How to read the benchmark; shown only with one. {n} is its number of participants. */
  benchmark: Copy,
  confidentiality: z.object({ development: Copy, assessment: Copy }),
  withheld: Copy,
  completion: Copy,
  /** By group level, lowest first, read in proportion to the scale. */
  skill: z.array(Copy).min(1),
  skillNone: Copy,
  compare: z.object({ above: Copy, level: Copy, below: Copy }),
  business: z.object({ below: Copy, near: Copy, met: Copy }),
  adaptability: Bands3,
  preferred: Copy,
  style: z.object({ unused: Copy, low: Copy, mid: Copy, high: Copy, under: Copy, over: Copy }),
  consistency: z.object({ neededUsed: Bands3, intendedUsed: Bands3, neededIntended: Bands3 }),
  funnel: Copy,
  actions: Copy,
  /** When the most used action is also the one with the most impact. */
  actionsSame: Copy.optional(),
  attention: z.object({ top: Copy, average: Copy, bottom: Copy, even: Copy }),
  verdicts: Copy,
  prompts: z.object({ skills: Prompts, business: Prompts, styles: Prompts, funnel: Prompts, actions: Prompts, attention: Prompts }),
  takeaways: z.array(z.object({ key: Key, title: Copy, questions: z.array(Copy).min(1).max(6) })).max(8)
});
export const Report = z.object({
  /**
   * The primary lens's scoring dimensions are the skills (D70). `reportOnly` marks a secondary lens's
   * dimensions: scored from conversations and shown in the report, never in the Leadership Score,
   * badges or the summary.
   */
  skills: z.array(z.object({ key: Key, name: Copy, anchors: z.array(Copy).min(3).max(7), reportOnly: z.boolean().default(false), description: Copy.optional() })).min(2)
    .default(() => DEFAULT_SKILLS.map(s => ({ ...s, anchors: [...s.anchors], reportOnly: false, description: DEFAULT_SKILL_DESCRIPTIONS[s.key] }))),
  linkage: z.record(Key, z.array(Key).min(1).max(4)).default(DEFAULT_LINKAGE),
  scale: z.array(z.object({ name: Copy, min: Score })).min(3).max(7).default(DEFAULT_SCALE),
  minObservations: z.number().int().min(1).max(5).default(2),
  evidencePerSkill: z.number().int().min(0).max(4).default(2),
  /** Day count from the report date to the development plan's check in. */
  checkInDays: z.number().int().min(1).max(90).default(14),
  /** In the order shown. Left out, the purpose's default (`DEFAULT_SECTIONS`). */
  sections: z.array(z.enum(REPORT_SECTIONS)).min(1).optional(),
  narratives: z.object({
    overall: z.array(Copy).min(1),
    capability: z.object({ low: Copy, mid: Copy, high: Copy }),
    /** By dominant style, keyed by the lens's style keys. A style without a line adds none; lines for styles the lens does not have are never used. `{style}` is the style's name (D104). */
    dominant: z.record(z.string(), Copy)
  }).default(DEFAULT_NARRATIVES),
  development: z.record(Key, z.object({ practice: Copy, onTheJob: Copy })).default(DEFAULT_DEVELOPMENT),
  recognitionPhrases: z.array(z.string().min(2)).default(DEFAULT_RECOGNITION),
  methodology: z.array(Copy).min(1).default(DEFAULT_METHODOLOGY),
  /** Narrative banks for development and assessment reports (D75). */
  purposeCopy: z.object({ development: PurposeCopy, assessment: PurposeCopy }).default(DEFAULT_PURPOSE_COPY),
  /** What each action is for, by action key (the summary of actions). */
  actionCopy: z.record(Key, Copy).default(DEFAULT_ACTION_COPY),
  /** Food for thought: questions with a guiding line each. */
  thought: z.array(z.object({ question: Copy, guide: Copy })).max(8).default(DEFAULT_THOUGHT),
  takeaways: z.array(Copy).max(10).default(DEFAULT_TAKEAWAYS),
  /** The development plan's 30, 60 and 90 day path; {skills} names the skills to develop. */
  path: z.object({ day30: Copy, day60: Copy, day90: Copy }).default(DEFAULT_PATH),
  /** Impact bands for actions (D76): the mean net skill + morale + result change per person reached. */
  impact: z.object({ low: z.number(), moderate: z.number(), high: z.number() }).default(DEFAULT_IMPACT),
  /** Actions whose styles the consistency section compares (the 1.0 report's five). */
  consistencyActions: z.array(Key).default(DEFAULT_CONSISTENCY_ACTIONS),
  /** Assessment purpose: the bar (positions on the rating scale) and the verdict labels (D75). */
  assessment: z.object({
    bar: z.object({ overall: z.number().int().min(0), floor: z.number().int().min(0) }),
    labels: z.object({ exceeds: Copy, meets: Copy, approaching: Copy, below: Copy, insufficient: Copy }),
    skillLabels: z.object({ strength: Copy, meets: Copy, development: Copy })
  }).default(DEFAULT_ASSESSMENT),
  /**
   * The group report (D77): in development, aggregates are withheld below `minimumCohort` participants;
   * aggregates read runs completed to `completeAt`% or more; `copy` replaces the narrative bank (left out, the defaults).
   */
  group: z.object({ minimumCohort: z.number().int().min(1).max(100).default(5), completeAt: z.number().min(1).max(100).default(100), copy: GroupCopy.optional() })
    .default({ minimumCohort: 5, completeAt: 100 }),
  /** Reflection questions on the end screen. */
  reflection: z.array(Copy).min(0).max(3).default(['What did you learn about adapting your style to each person?', 'What will you do differently with your real team next week?'])
}).superRefine((r, ctx) => {
  const keys = new Set(r.skills.map(s => s.key));
  for (const [k, list] of Object.entries(r.linkage)) for (const sk of list) if (!keys.has(sk)) ctx.addIssue({ code: 'custom', path: ['linkage', k], message: `No skill called ${sk}` });
  if (r.skills.some(s => s.anchors.length !== r.scale.length)) ctx.addIssue({ code: 'custom', path: ['skills'], message: `Give one anchor per level (${r.scale.length})` });
  if (r.scale[0].min !== 0 || r.scale.some((l, i) => i > 0 && l.min <= r.scale[i - 1].min)) ctx.addIssue({ code: 'custom', path: ['scale'], message: 'Levels start at 0 and rise' });
  if (!(r.impact.low < r.impact.moderate && r.impact.moderate < r.impact.high)) ctx.addIssue({ code: 'custom', path: ['impact'], message: 'Impact bands must rise: low < moderate < high' });
  const { overall, floor } = r.assessment.bar;
  if (overall >= r.scale.length || floor > overall) ctx.addIssue({ code: 'custom', path: ['assessment', 'bar'], message: `The bar is a level from 0 to ${r.scale.length - 1}, with the floor at or below it` });
});

/** The lens's style count rule (D104), worded for the author. */
const STYLE_COUNT = `A lens has ${MIN_STYLES} or ${MAX_STYLES} styles`;

/** A lens style key: a short id such as "D" or "coach". */
export const StyleKey = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,15}$/, 'Use a short id: letters, digits and underscores');

const LensNeed = z.object({ label: Copy, short: Copy });
const FitValue = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const FitRow = z.record(z.string(), FitValue);

/**
 * The leadership lens (D70, docs/SIMULATION.md 2 and 4.4): its styles, the names of the four needs
 * (skill and morale quadrants), and the fit table, each style's difference for each need. Defaults to
 * Readiness Based Leadership, whose table is the quadrant rule, so storylines without a lens play as before.
 */
export const Lens = z.object({
  id: z.enum(LENS_IDS),
  title: Copy,
  /** Author facing. */
  description: z.string().min(1),
  /** Author only: the original source. Never rendered to participants. */
  basedOn: z.string().optional(),
  styles: z.array(z.object({
    key: StyleKey,
    letter: z.string().regex(/^\S{1,2}$/, 'One or two characters'),
    name: Copy,
    short: Copy,
    description: Copy
  })).min(MIN_STYLES, STYLE_COUNT).max(MAX_STYLES, STYLE_COUNT),
  needs: z.object({ lowSkill_lowMorale: LensNeed, lowSkill_highMorale: LensNeed, highSkill_lowMorale: LensNeed, highSkill_highMorale: LensNeed }),
  fit: z.object({ lowSkill_lowMorale: FitRow, lowSkill_highMorale: FitRow, highSkill_lowMorale: FitRow, highSkill_highMorale: FitRow }),
  /** Adds report only skills (D70); never game mechanics. */
  secondary: z.object({ id: z.enum(LENS_IDS), title: Copy }).optional(),
  /**
   * Worked examples for the Tutorial (D91): an archetypal person (never a team member), the style that
   * fits them and why. Left out, two are worded from the needs and the styles that fit them.
   */
  examples: z.array(z.object({ need: z.enum(NEEDS), person: Copy, style: StyleKey, why: Copy })).min(1).max(6).optional()
}).superRefine((l, ctx) => {
  const keys = l.styles.map(s => s.key);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['styles'], message: 'Style keys must be unique' });
  if (new Set(l.styles.map(s => s.letter.toUpperCase())).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['styles'], message: 'Style letters must be unique' });
  for (const need of NEEDS) {
    const row = l.fit[need];
    for (const k of keys) if (row[k] === undefined) ctx.addIssue({ code: 'custom', path: ['fit', need, k], message: `Give ${k} a fit for this need (0, 1 or 2)` });
    for (const k of Object.keys(row)) if (!keys.includes(k)) ctx.addIssue({ code: 'custom', path: ['fit', need, k], message: `No style called ${k}` });
    if (!keys.some(k => row[k] === 0)) ctx.addIssue({ code: 'custom', path: ['fit', need], message: 'At least one style must fit this need (0)' });
  }
  for (const [i, ex] of (l.examples ?? []).entries()) if (!keys.includes(ex.style)) ctx.addIssue({ code: 'custom', path: ['examples', i, 'style'], message: `No style called ${ex.style}` });
  if (l.secondary && l.secondary.id === l.id) ctx.addIssue({ code: 'custom', path: ['secondary', 'id'], message: 'The secondary lens must differ from the primary' });
});

/** Skill, morale and result change. */
const Effect = z.tuple([z.number().int(), z.number().int(), z.number().int()]);
/** Change for mismatch type 0, 1 and 2 (docs/SIMULATION.md 4.2). */
export const EffectTable = z.object({ m0: Effect, m1: Effect, m2: Effect.optional() });

// ---------------------------------------------------------------- business state (D136 to D139)

/**
 * People dynamics (D135, docs/SIMULATION.md 3.5): morale and trust act on output and attrition with a lag.
 * Left out, none of it applies and the storyline plays exactly as before. Every number has a default.
 */
export const Dynamics = z.object({
  /** Sub-periods in each person's rolling morale average: the lag between how people feel and what they deliver. */
  window: z.number().int().min(1).max(20).default(5),
  /** A person's result counts in the funnel in full while their rolling morale is at or above `full`, falling in a line to `floor` of it at morale 0. */
  output: z.object({ full: Score.default(50), floor: Ratio.default(0.5) }).default({ full: 50, floor: 0.5 }),
  /** Result gains scale the same way: someone who has felt low for a while improves more slowly. */
  growth: z.object({ full: Score.default(50), floor: Ratio.default(0.3) }).default({ full: 50, floor: 0.3 }),
  /** Below `full` trust, positive changes from your actions land at a share that falls in a line to `floor` at trust 0. */
  trust: z.object({ full: Score.default(50), floor: Ratio.default(0.5) }).default({ full: 50, floor: 0.5 }),
  /**
   * Attrition: at each period end, someone whose rolling morale is under `below` may be off sick for `sickDays`
   * sub-periods (probability `chance`, plus 1 point for every point under `below`); the `resignAfter`th time they resign,
   * unless they are the last person in their stage. Drawn on the run's own dynamics stream, so it replays exactly.
   */
  attrition: z.object({ below: Score.default(20), chance: Ratio.default(0.2), sickDays: z.number().int().min(1).max(10).default(2), resignAfter: z.number().int().min(1).max(5).default(2) })
    .default({ below: 20, chance: 0.2, sickDays: 2, resignAfter: 2 })
});
export type Dynamics = z.output<typeof Dynamics>;

/** How a business variable reads: money in the storyline's currency, a percentage, or points. */
export const VARIABLE_FORMATS = ['money', 'percent', 'points'] as const;
/** At most this many business variables per storyline (D136). */
export const MAX_VARIABLES = 6;

/**
 * A business variable the author names (D136): Budget, Customer satisfaction, Quality, Reputation. It starts at
 * `start`, stays in `min` to `max`, moves by `drift` at each period end, and is changed by actions, events and
 * choices. `shown` puts it on the participant's board; `weight` gives it a share of the Business pillar.
 */
export const Variable = z.object({
  key: Key,
  name: Copy,
  format: z.enum(VARIABLE_FORMATS).default('points'),
  start: z.number(),
  min: z.number().default(0),
  max: z.number().default(100),
  drift: z.number().default(0),
  shown: z.boolean().default(true),
  /** Share of the Business pillar, 0 to 1; revenue keeps the rest. All variables' weights add up to 0.8 at most. */
  weight: Ratio.default(0),
  /** For the score: true when more is better (Budget, Quality); false when less is (Complaints). */
  higherIsBetter: z.boolean().default(true),
  /** What it means, for the board's tooltip and the report. */
  about: Copy.optional()
}).superRefine((v, ctx) => {
  if (!(v.min < v.max)) ctx.addIssue({ code: 'custom', path: ['max'], message: 'The maximum must be above the minimum' });
  if (v.start < v.min || v.start > v.max) ctx.addIssue({ code: 'custom', path: ['start'], message: 'The start must be between the minimum and the maximum' });
});

/** Days and weeks before a follow up plays (D138): `days` sub-periods plus `weeks` periods. */
export const Delay = z.object({ days: z.number().int().min(0).max(50).default(0), weeks: z.number().int().min(0).max(10).default(0) });

/**
 * What a choice, an action or an event does to the business (D136 to D138): business variables (deltas by key),
 * a one off change to revenue, sponsor confidence, named flags set or cleared, counters moved, and later events
 * scheduled after a delay.
 */
export const Business = z.object({
  variables: z.record(Key, z.number()).default({}),
  revenue: z.number().default(0),
  sponsor: z.number().int().min(-50).max(50).default(0),
  set: z.array(Key).max(6).default([]),
  clear: z.array(Key).max(6).default([]),
  count: z.record(Key, z.number().int()).default({}),
  followUps: z.array(Delay.extend({ event: Key })).max(3).default([]),
  /** Stakeholder relationships moved (D161), by stakeholder key: trust and satisfaction, each −30 to 30. */
  stakeholders: z.record(Key, z.object({ trust: z.number().int().min(-30).max(30).default(0), satisfaction: z.number().int().min(-30).max(30).default(0) })).optional()
});
export type Business = z.output<typeof Business>;

/** Fit levels for an action's business effects: `always`, or only when the approach fitted (m0), partly missed (m1) or clearly missed (m2). */
export const BusinessByFit = z.object({ always: Business.optional(), m0: Business.optional(), m1: Business.optional(), m2: Business.optional() });

/** Metrics a condition can test (D138). Team values are the available team's means; `revenuePace` is revenue against the run's pace so far, in percent. */
export const CONDITION_METRICS = ['teamMorale', 'teamTrust', 'teamSkill', 'teamResult', 'revenuePace', 'sponsor'] as const;
const Compare = z.enum(['below', 'atLeast']);
/** One clause of a condition (D138): a flag set or not, a counter, a business variable or a metric against a value. */
export const Clause = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('flag'), flag: Key, is: z.boolean().default(true) }),
  z.object({ kind: z.literal('counter'), counter: Key, op: Compare, value: z.number() }),
  z.object({ kind: z.literal('variable'), variable: Key, op: Compare, value: z.number() }),
  z.object({ kind: z.literal('metric'), metric: z.enum(CONDITION_METRICS), op: Compare, value: z.number() }),
  /** A stakeholder's relationship (D163): their trust in you or their satisfaction, 0 to 100. */
  z.object({ kind: z.literal('stakeholder'), stakeholder: Key, measure: z.enum(['trust', 'satisfaction']), op: Compare, value: z.number() })
]);
export type Clause = z.output<typeof Clause>;

/** The leadership read of a choice (D137): which skills it shows, and how well, apart from its business outcome. */
export const Read = z.array(z.object({ skill: Key, band: z.enum(['strong', 'adequate', 'weak', 'harmful']) })).max(4);

/** One option of a choice event (D137). */
export const ChoiceOption = z.object({
  key: Key,
  label: Copy,
  /** One line more about it, shown under the label. */
  detail: Copy.optional(),
  /** What happened, shown after it is chosen and in the report. */
  outcome: Copy,
  /** Who the people part lands on: the event's target, the whole team, a stage (`stage:<key>`) or a member id. */
  who: z.string().regex(/^(target|team|stage:[a-z][a-z0-9_]*|[a-z][a-z0-9_]*)$/).default('target'),
  /** Skill, morale and result for those people. */
  people: Effect.default([0, 0, 0]),
  trust: z.number().int().min(-30).max(30).default(0),
  business: Business.default(() => Business.parse({})),
  read: Read.default([])
});
export type ChoiceOption = z.output<typeof ChoiceOption>;

/** A choice event (D137): 2 to 4 options, a deadline in sub-periods, and what happens when nobody chooses. */
export const Choice = z.object({
  /** What the participant knows, a line each. */
  known: z.array(Copy).max(4).default([]),
  options: z.array(ChoiceOption).min(2).max(4),
  within: z.number().int().min(1).max(10).default(2),
  /** The option that applies when nobody chooses in time. Left out, `ignored` applies (or nothing). */
  default: Key.optional(),
  ignored: ChoiceOption.omit({ key: true, label: true, detail: true }).partial({ outcome: true }).optional()
});

// ---------------------------------------------------------------- stakeholders (D160 to D165)

/** Who a stakeholder is to the participant (D160): the AI character and the board word it from this. */
export const STAKEHOLDER_KINDS = ['manager', 'peer', 'customer', 'executive', 'board', 'union', 'partner', 'other'] as const;
/** The ways to engage a stakeholder (D161). */
export const STAKEHOLDER_INTERACTIONS = ['meet', 'present', 'negotiate', 'email'] as const;
/** At most this many stakeholders per storyline (D160). */
export const MAX_STAKEHOLDERS = 8;
const RelationNeeds = z.object({ trust: Score.optional(), satisfaction: Score.optional() });

/** What a stakeholder interaction, a static option or a request does (D161), before the relationship scales it. */
const StakeholderEffectBase = z.object({
  /** The stakeholder's trust in you and their satisfaction, each −30 to 30. */
  trust: z.number().int().min(-30).max(30).default(0),
  satisfaction: z.number().int().min(-30).max(30).default(0),
  /** Business variables, revenue, sponsor confidence, flags, follow ups and other stakeholders. */
  business: Business.default(() => Business.parse({})),
  /** Skill, morale and result for team members (headcount won, a deadline moved): on `who`. */
  people: Effect.default([0, 0, 0]),
  who: z.string().regex(/^(team|stage:[a-z][a-z0-9_]*|[a-z][a-z0-9_]*)$/).default('team'),
  /** What happened, shown after it and in the report. */
  outcome: Copy.optional()
});
/**
 * A stakeholder effect (D161). `needs`: it lands only while the stakeholder's trust and satisfaction are at least
 * these values; otherwise `otherwise` applies (a negotiation that a strained relationship cannot carry).
 */
export const StakeholderEffect = StakeholderEffectBase.extend({ needs: RelationNeeds.optional(), otherwise: StakeholderEffectBase.optional() });
export type StakeholderEffect = z.output<typeof StakeholderEffect>;

/** One option of a static stakeholder decision (D161): its effect and its leadership read. */
export const StakeholderOption = z.object({ key: Key, label: Copy, detail: Copy.optional(), effect: StakeholderEffect.default(() => StakeholderEffect.parse({})), read: Read.default([]) });

/**
 * A way to engage one stakeholder (D161): a live conversation (meet, present, negotiate, or an email written once)
 * through the same AI character and evaluator as the team's, or a static decision with options. It costs days,
 * never the team's live cap, and each stakeholder can be engaged once a period.
 */
export const StakeholderInteraction = z.object({
  key: Key,
  type: z.enum(STAKEHOLDER_INTERACTIONS),
  /** The button's words. Left out, the type's ("Meet", "Present", "Negotiate", "Email"). */
  label: Copy.optional(),
  /** What the participant is there to do, shown before it starts. */
  goal: Copy.optional(),
  kind: z.enum(['live', 'static']).default('live'),
  cost: z.number().min(0).default(1),
  /** The first period it is offered. */
  from: z.number().int().min(1).default(1),
  /** Offered only while these hold (D163), for example once their trust is 60 or more. */
  if: z.array(Clause).min(1).max(3).optional(),
  /** The skills a live interaction rates. Left out, the type's defaults that the framework has. */
  skills: z.array(Key).max(4).optional(),
  rubric: z.array(z.object({ key: Key, label: Copy })).min(2).max(4).optional(),
  turnLimit: z.number().int().min(1).max(30).default(8),
  minutes: z.number().min(1).max(15).default(5),
  opening: z.enum(['npc', 'participant']).default('npc'),
  /** Live: what each band does. Left out, the defaults (`STAKEHOLDER_BANDS` in sim/stakeholders.ts). */
  consequences: z.object({ strong: StakeholderEffect, adequate: StakeholderEffect, weak: StakeholderEffect, harmful: StakeholderEffect }).partial().optional(),
  /** Static: the options, 2 to 4. */
  options: z.array(StakeholderOption).min(2).max(4).optional()
}).superRefine((x, ctx) => {
  if (x.kind === 'static' && !x.options) ctx.addIssue({ code: 'custom', path: ['options'], message: 'A static interaction needs 2 to 4 options' });
  if (x.kind === 'live' && x.options) ctx.addIssue({ code: 'custom', path: ['options'], message: 'A live interaction has no options: its consequences follow how the conversation went' });
  if (x.options && new Set(x.options.map(o => o.key)).size !== x.options.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option keys must be unique' });
});

/**
 * A stakeholder outside the team (D160): a manager, a peer, a customer, an executive, the board, a union, a partner.
 * Never in the work funnel and never a result: they act on the business through variables, sponsor confidence,
 * flags and events, and keep their own relationship with the participant (trust and satisfaction, 0 to 100).
 */
export const Stakeholder = z.object({
  key: Key,
  name: z.string().min(1),
  /** Their job title, as the board shows it: "Chief Financial Officer". */
  role: z.string().min(1),
  kind: z.enum(STAKEHOLDER_KINDS),
  pronoun: z.enum(['he', 'she', 'they']).default('they'),
  portrait: z.string().optional(),
  /** What the participant knows about them, on the board. */
  about: Copy.optional(),
  hiddenConcern: Copy.optional(),
  concernLine: Copy.optional(),
  /** How the AI character plays them (D130's persona fields). */
  npc: NpcPersona.optional(),
  start: z.object({ trust: Score.default(50), satisfaction: Score.default(50) }).default({ trust: 50, satisfaction: 50 }),
  /** What they lose at each period end in which you did not engage them (0 by default: no drift). */
  drift: z.object({ trust: z.number().int().min(-20).max(0).default(0), satisfaction: z.number().int().min(-20).max(0).default(0) }).default({ trust: 0, satisfaction: 0 }),
  interactions: z.array(StakeholderInteraction).max(4).default([])
}).superRefine((s, ctx) => {
  if (new Set(s.interactions.map(i => i.key)).size !== s.interactions.length) ctx.addIssue({ code: 'custom', path: ['interactions'], message: 'Interaction keys must be unique' });
});
export type Stakeholder = z.output<typeof Stakeholder>;

/**
 * A request from a stakeholder (D162): a message to answer in writing, or a meeting they ask for, by a deadline.
 * Answered in time, `onTime` applies; ignored, `ifIgnored` does (and the event's escalation, if any).
 */
export const StakeholderRequest = z.object({
  kind: z.enum(['message', 'meeting']).default('message'),
  /** A meeting request: the interaction of theirs that answers it. Left out, any of their interactions. */
  interaction: Key.optional(),
  within: z.number().int().min(1).max(10).default(2),
  onTime: StakeholderEffect.default(() => StakeholderEffect.parse({ trust: 3, satisfaction: 3 })),
  ifIgnored: StakeholderEffect.default(() => StakeholderEffect.parse({ trust: -6, satisfaction: -8 }))
});

/** How an action decides its mismatch type (docs/SIMULATION.md 4.3). */
export const ACTION_RULES = ['styleOption', 'weeklyStyle', 'trend', 'training', 'swap', 'assess', 'reward', 'fire', 'hire'] as const;
export const LIVE_FORMATS = ['meeting', 'email', 'roleplay', 'chat', 'plan', 'interview', 'sponsor'] as const;

export const ActionOption = z.object({
  key: Key,
  label: Copy,
  /** The leadership style this option expresses, for style based rules: a key of the lens's styles. */
  style: StyleKey.optional(),
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
  pickStage: z.boolean().default(false),
  /** What the option does to the business (D136): always, or by how well the approach fitted. */
  business: BusinessByFit.optional()
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
  hints: z.enum(['off', 'onRequest', 'afterWeak']).default('onRequest'),
  /** Interview: the structured questions to ask every candidate (D85). Left out, three general ones. */
  questions: z.array(Copy).min(1).max(6).optional()
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
  /**
   * Conditions on earlier choices (D138): all of these clauses must hold. On a fixed, random or follow up event
   * they are checked when it is due, and it is skipped when they do not hold; on an event with no other timing
   * they are checked at every sub-period, and it plays the first time they all hold.
   */
  if: z.array(Clause).min(1).max(3).optional(),
  impact: Effect.default([0, 0, 0]),
  /** What the event does to business variables, flags and revenue when it plays (D136). */
  business: Business.optional(),
  /** A choice the participant must make (D137). The event's card opens the decision. */
  choice: Choice.optional(),
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
  escalation: z.object({ event: Key.optional(), sponsor: z.boolean().default(true), delay: Delay.optional() }).optional(),
  /** The stakeholder the event comes from (D162): a chat or email is their message, a card shows them. */
  stakeholder: Key.optional(),
  /** What the stakeholder asks for, by when (D162). Needs `stakeholder`. */
  request: StakeholderRequest.optional()
}).superRefine((e, ctx) => {
  if (e.request && !e.stakeholder) ctx.addIssue({ code: 'custom', path: ['request'], message: 'A request comes from a stakeholder: name them' });
  if (e.request && e.response) ctx.addIssue({ code: 'custom', path: ['response'], message: 'A stakeholder request is answered by answering them: leave the expected response out' });
  if (e.request && e.choice) ctx.addIssue({ code: 'custom', path: ['request'], message: 'A decision is answered by choosing: leave the request out' });
  if (e.choice) {
    const keys = e.choice.options.map(o => o.key);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['choice', 'options'], message: 'Option keys must be unique' });
    if (e.choice.default && !keys.includes(e.choice.default)) ctx.addIssue({ code: 'custom', path: ['choice', 'default'], message: `No option called ${e.choice.default}` });
    if (e.delivery !== 'modal') ctx.addIssue({ code: 'custom', path: ['delivery'], message: 'A choice arrives as a card on the board, where the participant decides' });
    if (e.response) ctx.addIssue({ code: 'custom', path: ['response'], message: 'A choice is answered by choosing: leave the expected response out' });
  }
  const kinds = [e.period !== undefined, !!e.window, !!e.when].filter(Boolean).length;
  if (kinds > 1) ctx.addIssue({ code: 'custom', path: ['period'], message: 'Give a fixed period, a random window or a condition, not more than one' });
  if (e.window && e.window.from > e.window.to) ctx.addIssue({ code: 'custom', path: ['window'], message: 'The window must start before it ends' });
  if ((e.delivery === 'chat' || e.delivery === 'email') && e.target === 'team' && !e.stakeholder) ctx.addIssue({ code: 'custom', path: ['delivery'], message: 'A chat or email comes from one person: target a member' });
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
  /**
   * The language the storyline's authored copy is written in (events, emails, persona lines, report
   * narratives), as a BCP 47 tag (D83). The engine's own copy is sent as codes and worded in the
   * participant's language; authored copy stays as written. GenieKreator authors one storyline per language.
   */
  locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).default('en'),
  /** The sponsor's authored welcome letter (onboarding), drafted by the author chat (D74). Left out, onboarding words one from the storyline's facts. */
  intro: z.object({ welcome: z.array(Copy).min(1).max(4), product: z.array(Copy).min(1).max(4), targets: z.array(Copy).min(1).max(4) }).optional(),
  /** The company, product, market and sponsor's voice, for the AI characters (D130). */
  world: World.optional(),
  /** The leadership lens: styles, needs and fit (D70). Readiness Based Leadership when left out. */
  lens: Lens.default(() => structuredClone(DEFAULT_LENS)),
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
  members: z.array(Person).min(MIN_MEMBERS).max(MAX_MEMBERS),
  candidates: z.array(Person).default([]),
  thresholds: Thresholds.default({ high: 70, amber: 50, low: 30 }),
  gamification: Gamification.default(() => Gamification.parse({})),
  report: Report.default(() => Report.parse({})),
  /** Use declaration (Configuration Spec, Governance): development or selection. Selection turns the leaderboard off by default. Kept as an alias: selection reads as the assessment purpose. */
  use: z.enum(['development', 'selection']).default('development'),
  /** Why the storyline runs (D75). Left out, `use` decides: selection is assessment, otherwise development. */
  purpose: z.enum(PURPOSES).optional(),
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
  /**
   * The Week 0 practice conversation (spec, onboarding step 7; D16, D84): offered before week 1, never
   * scored, skippable. `with` is the team member to practise with (the first member when left out).
   */
  practice: z.object({
    enabled: z.boolean().default(true),
    with: z.string().optional(),
    format: z.enum(['roleplay', 'chat']).default('roleplay'),
    goal: Copy.optional(),
    turnLimit: z.number().int().min(1).max(12).default(4),
    minutes: z.number().min(1).max(10).default(3)
  }).default({ enabled: true, format: 'roleplay', turnLimit: 4, minutes: 3 }),
  /**
   * The sponsor's welcome video (onboarding, and Tutorial and video during play, D90): where it is, an
   * optional poster and captions track, and its transcript (also the Tutorial's Transcript tab).
   */
  video: z.object({ src: z.string().min(1).optional(), poster: z.string().optional(), captions: z.string().optional(), transcript: z.array(Copy).min(1).max(20) }).optional(),
  /**
   * The guided tour (D94): on by default; `steps` rewords any step by its key (title, body), so authors can
   * fit the tips to the storyline. Unknown keys are ignored.
   */
  tour: z.object({ enabled: z.boolean().default(true), steps: z.record(z.string(), z.object({ title: Copy.optional(), body: Copy.optional() })).default({}) })
    .default({ enabled: true, steps: {} }),
  /**
   * The demo round before the run (D92): unscored, on its own engine. `with` is the person the guided
   * action is taken with (the first member when left out); `action` the static action it teaches (the
   * first static member action when left out).
   */
  demo: z.object({ enabled: z.boolean().default(true), with: z.string().optional(), action: Key.optional() }).default({ enabled: true }),
  /**
   * Progress milestones (D93): a notification when revenue reaches these percentages of the target, and
   * when a stage's output so far reaches these percentages of its ideal for the whole run.
   */
  milestones: z.object({
    target: z.array(z.number().int().min(1).max(100)).max(6).default([25, 50, 75, 100]),
    stages: z.array(z.number().int().min(1).max(100)).max(4).default([50, 100])
  }).default({ target: [25, 50, 75, 100], stages: [50, 100] }),
  /** Role coverage (Teardown hidden rule 6, Configuration Spec eligibility): at most this many people per stage. */
  maxPerStage: z.number().int().min(1).default(2),
  /** Weekly drift (Configuration Spec, Targets and KPIs): what someone loses in a period nobody acted with them. */
  drift: z.object({ morale: z.number().min(0).default(3), result: z.number().min(0).default(0) }).default({ morale: 3, result: 0 }),
  /** People dynamics (D135): morale and trust act on output and attrition with a lag. Left out, off. */
  dynamics: Dynamics.optional(),
  /** Business variables (D136), 0 to 6. */
  variables: z.array(Variable).max(MAX_VARIABLES).default([]),
  /** Stakeholders outside the team (D160), 0 to 8. */
  stakeholders: z.array(Stakeholder).max(MAX_STAKEHOLDERS).default([]),
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
  c.actions.forEach((a, i) => {
    const seen = new Set<string>();
    a.options.forEach((o, j) => {
      if (seen.has(o.key)) ctx.addIssue({ code: 'custom', path: ['actions', i, 'options', j, 'key'], message: `Duplicate option ${o.key}` });
      seen.add(o.key);
    });
  });
  const eventKeys = new Set<string>();
  c.events.forEach((e, i) => {
    if (eventKeys.has(e.key)) ctx.addIssue({ code: 'custom', path: ['events', i, 'key'], message: `Duplicate event ${e.key}` });
    eventKeys.add(e.key);
  });
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
  // Style keys come from the lens (D70).
  const styleKeys = new Set(c.lens.styles.map(s => s.key));
  c.actions.forEach((a, i) => a.options.forEach((o, j) => {
    if (o.style !== undefined && !styleKeys.has(o.style)) ctx.addIssue({ code: 'custom', path: ['actions', i, 'options', j, 'style'], message: `No style called ${o.style} in the lens` });
  }));
  for (const [list, people] of [['members', c.members], ['candidates', c.candidates]] as const) {
    people.forEach((p, i) => {
      for (const k of Object.keys(p.npc?.reactions ?? {})) if (!styleKeys.has(k)) ctx.addIssue({ code: 'custom', path: [list, i, 'npc', 'reactions', k], message: `No style called ${k} in the lens` });
    });
  }
  if (c.demo.with && !memberIds.has(c.demo.with)) ctx.addIssue({ code: 'custom', path: ['demo', 'with'], message: `No team member called ${c.demo.with}` });
  if (c.demo.action) {
    const a = c.actions.find(x => x.key === c.demo.action);
    if (!a) ctx.addIssue({ code: 'custom', path: ['demo', 'action'], message: `Unknown action ${c.demo.action}` });
    else if (a.kind !== 'static' || a.scope !== 'member') ctx.addIssue({ code: 'custom', path: ['demo', 'action'], message: 'The demo teaches an instant action with one person: pick a static member action' });
  }
  if (c.practice.with && !memberIds.has(c.practice.with)) ctx.addIssue({ code: 'custom', path: ['practice', 'with'], message: `No team member called ${c.practice.with}` });
  if (!(c.thresholds.low < c.thresholds.amber && c.thresholds.amber < c.thresholds.high))
    ctx.addIssue({ code: 'custom', path: ['thresholds'], message: 'Thresholds must rise: low < amber < high' });

  // Business variables, flags and follow ups (D136 to D138): every reference names something that exists.
  const varKeys = new Set(c.variables.map(v => v.key));
  if (varKeys.size !== c.variables.length) ctx.addIssue({ code: 'custom', path: ['variables'], message: 'Variable keys must be unique' });
  const weights = c.variables.reduce((a, v) => a + v.weight, 0);
  if (weights > 0.8 + 1e-9) ctx.addIssue({ code: 'custom', path: ['variables'], message: `Variables' weights in the Business pillar add up to ${Math.round(weights * 100)}%: 80% is the most, so revenue keeps a share` });
  const skillKeys = new Set(c.report.skills.map(s => s.key));
  const checkBusiness = (b: Business | undefined, path: Array<string | number>) => {
    if (!b) return;
    for (const k of Object.keys(b.variables)) if (!varKeys.has(k)) ctx.addIssue({ code: 'custom', path: [...path, 'variables', k], message: `No variable called ${k}` });
    b.followUps.forEach((f, i) => { if (!eventKeys.has(f.event)) ctx.addIssue({ code: 'custom', path: [...path, 'followUps', i, 'event'], message: `No event called ${f.event}` }); });
  };
  const checkWho = (who: string, path: Array<string | number>) => {
    if (who.startsWith('stage:') && !stageKeys.has(who.slice(6))) ctx.addIssue({ code: 'custom', path, message: `No stage called ${who.slice(6)}` });
    else if (!['target', 'team'].includes(who) && !who.startsWith('stage:') && !memberIds.has(who)) ctx.addIssue({ code: 'custom', path, message: `No team member called ${who}` });
  };
  c.actions.forEach((a, i) => a.options.forEach((o, j) => {
    for (const k of ['always', 'm0', 'm1', 'm2'] as const) checkBusiness(o.business?.[k], ['actions', i, 'options', j, 'business', k]);
  }));
  c.events.forEach((e, i) => {
    checkBusiness(e.business, ['events', i, 'business']);
    e.choice?.options.forEach((o, j) => {
      checkBusiness(o.business, ['events', i, 'choice', 'options', j, 'business']);
      checkWho(o.who, ['events', i, 'choice', 'options', j, 'who']);
      o.read.forEach((r, k) => { if (!skillKeys.has(r.skill)) ctx.addIssue({ code: 'custom', path: ['events', i, 'choice', 'options', j, 'read', k, 'skill'], message: `No skill called ${r.skill}` }); });
    });
    if (e.choice?.ignored) { checkBusiness(e.choice.ignored.business, ['events', i, 'choice', 'ignored', 'business']); if (e.choice.ignored.who) checkWho(e.choice.ignored.who, ['events', i, 'choice', 'ignored', 'who']); }
    (e.if ?? []).forEach((cl, k) => { if (cl.kind === 'variable' && !varKeys.has(cl.variable)) ctx.addIssue({ code: 'custom', path: ['events', i, 'if', k, 'variable'], message: `No variable called ${cl.variable}` }); });
    if (e.escalation?.event === e.key) ctx.addIssue({ code: 'custom', path: ['events', i, 'escalation', 'event'], message: 'An event cannot follow itself' });
  });

  // Stakeholders (D160 to D165): their keys are their own, and every reference to one names one that exists.
  const shKeys = new Set(c.stakeholders.map(s => s.key));
  if (shKeys.size !== c.stakeholders.length) ctx.addIssue({ code: 'custom', path: ['stakeholders'], message: 'Stakeholder keys must be unique' });
  c.stakeholders.forEach((s, i) => {
    if (ids.has(s.key) || ['team', 'member', 'sponsor', 'news', 'you', 'target'].includes(s.key)) ctx.addIssue({ code: 'custom', path: ['stakeholders', i, 'key'], message: `${s.key} is already a person or a reserved name: give the stakeholder another key` });
    for (const k of Object.keys(s.npc?.reactions ?? {})) if (!styleKeys.has(k)) ctx.addIssue({ code: 'custom', path: ['stakeholders', i, 'npc', 'reactions', k], message: `No style called ${k} in the lens` });
    s.interactions.forEach((x, j) => {
      const at = ['stakeholders', i, 'interactions', j];
      if (x.from > c.time.period.count) ctx.addIssue({ code: 'custom', path: [...at, 'from'], message: 'Offered only after the last period' });
      if (Math.abs(x.cost / c.time.costStep - Math.round(x.cost / c.time.costStep)) > 1e-9) ctx.addIssue({ code: 'custom', path: [...at, 'cost'], message: `Cost must be a multiple of ${c.time.costStep}` });
      for (const k of x.skills ?? []) if (!skillKeys.has(k)) ctx.addIssue({ code: 'custom', path: [...at, 'skills'], message: `No skill called ${k}` });
      for (const [band, eff] of Object.entries(x.consequences ?? {})) checkEffect(eff, [...at, 'consequences', band]);
      x.options?.forEach((o, k) => {
        checkEffect(o.effect, [...at, 'options', k, 'effect']);
        o.read.forEach((r, n) => { if (!skillKeys.has(r.skill)) ctx.addIssue({ code: 'custom', path: [...at, 'options', k, 'read', n, 'skill'], message: `No skill called ${r.skill}` }); });
      });
      checkClauses(x.if, [...at, 'if']);
    });
  });
  function checkEffect(eff: StakeholderEffect | undefined, path: Array<string | number>) {
    if (!eff) return;
    for (const e of [eff, eff.otherwise]) {
      if (!e) continue;
      checkBusiness(e.business, [...path, 'business']);
      if (e.who !== 'team') checkWho(e.who, [...path, 'who']);
    }
  }
  function checkClauses(clauses: Clause[] | undefined, path: Array<string | number>) {
    (clauses ?? []).forEach((cl, k) => {
      if (cl.kind === 'variable' && !varKeys.has(cl.variable)) ctx.addIssue({ code: 'custom', path: [...path, k, 'variable'], message: `No variable called ${cl.variable}` });
      if (cl.kind === 'stakeholder' && !shKeys.has(cl.stakeholder)) ctx.addIssue({ code: 'custom', path: [...path, k, 'stakeholder'], message: `No stakeholder called ${cl.stakeholder}` });
    });
  }
  c.events.forEach((e, i) => {
    if (e.stakeholder && !shKeys.has(e.stakeholder)) ctx.addIssue({ code: 'custom', path: ['events', i, 'stakeholder'], message: `No stakeholder called ${e.stakeholder}` });
    (e.if ?? []).forEach((cl, k) => { if (cl.kind === 'stakeholder' && !shKeys.has(cl.stakeholder)) ctx.addIssue({ code: 'custom', path: ['events', i, 'if', k, 'stakeholder'], message: `No stakeholder called ${cl.stakeholder}` }); });
    if (e.request) {
      const sh = c.stakeholders.find(s => s.key === e.stakeholder);
      if (e.request.interaction && sh && !sh.interactions.some(x => x.key === e.request!.interaction)) ctx.addIssue({ code: 'custom', path: ['events', i, 'request', 'interaction'], message: `${sh.name} has no interaction called ${e.request.interaction}` });
      if (e.request.kind === 'meeting' && sh && !sh.interactions.length) ctx.addIssue({ code: 'custom', path: ['events', i, 'request', 'kind'], message: `${sh.name} asks to meet, but has no interaction to answer with` });
      checkEffect(e.request.onTime, ['events', i, 'request', 'onTime']);
      checkEffect(e.request.ifIgnored, ['events', i, 'request', 'ifIgnored']);
    }
  });
  // Every business effect that moves a stakeholder names one that exists.
  const businesses: Array<[Business | undefined, Array<string | number>]> = [];
  c.actions.forEach((a, i) => a.options.forEach((o, j) => { for (const k of ['always', 'm0', 'm1', 'm2'] as const) businesses.push([o.business?.[k], ['actions', i, 'options', j, 'business', k]]); }));
  c.events.forEach((e, i) => {
    businesses.push([e.business, ['events', i, 'business']]);
    e.choice?.options.forEach((o, j) => businesses.push([o.business, ['events', i, 'choice', 'options', j, 'business']]));
    if (e.choice?.ignored) businesses.push([e.choice.ignored.business, ['events', i, 'choice', 'ignored', 'business']]);
  });
  c.stakeholders.forEach((s, i) => s.interactions.forEach((x, j) => {
    for (const [band, eff] of Object.entries(x.consequences ?? {})) for (const e of [eff, eff?.otherwise]) businesses.push([e?.business, ['stakeholders', i, 'interactions', j, 'consequences', band, 'business']]);
    x.options?.forEach((o, k) => { for (const e of [o.effect, o.effect.otherwise]) businesses.push([e?.business, ['stakeholders', i, 'interactions', j, 'options', k, 'effect', 'business']]); });
  }));
  for (const [b, path] of businesses) for (const k of Object.keys(b?.stakeholders ?? {})) if (!shKeys.has(k)) ctx.addIssue({ code: 'custom', path: [...path, 'stakeholders', k], message: `No stakeholder called ${k}` });
});

export type StorylineConfig = z.output<typeof StorylineConfig>;
export type StorylineInput = z.input<typeof StorylineConfig>;

/** The storyline's purpose: `purpose` when authored, else `use: 'selection'` reads as assessment (D75). */
export function purposeOf(c: Pick<StorylineConfig, 'purpose' | 'use'>): Purpose {
  return c.purpose ?? (c.use === 'selection' ? 'assessment' : 'development');
}

/** Parses a storyline, returning readable issues instead of throwing. */
export function parseStoryline(input: unknown): { ok: true; config: StorylineConfig } | { ok: false; issues: string[] } {
  const r = StorylineConfig.safeParse(input);
  if (r.success) return { ok: true, config: r.data };
  return { ok: false, issues: r.error.issues.map(i => `${i.path.join('.') || 'storyline'}: ${i.message}`) };
}

export { moneyFormatter } from './money';
