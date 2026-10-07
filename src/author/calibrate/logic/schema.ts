import { z } from 'zod';

/**
 * The calibration's shapes (D110 to D115), shared by the browser runner, the server's job endpoint
 * (`POST /genie/calibrations`) and the author's screen. JSON Schemas: docs/schemas/calibration-*.json.
 */

export const PERSONA_KEYS = ['beginner', 'developing', 'proficient', 'expert'] as const;
export const PersonaKey = z.enum(PERSONA_KEYS);
export type PersonaKey = z.infer<typeof PersonaKey>;

/** At most this many playthroughs per persona, and in one calibration. */
export const MAX_RUNS_PER_PERSONA = 25;
export const MAX_RUNS = 100;

const Runs = z.number().int().min(0).max(MAX_RUNS_PER_PERSONA);

/** What to run: playthroughs per persona, the first seed, whether to probe for dominant strategies. */
export const CalibrationSettings = z.object({
  personas: z.object({ beginner: Runs, developing: Runs, proficient: Runs, expert: Runs }).partial()
    .default({ beginner: 5, developing: 5, proficient: 5, expert: 5 })
    .refine(p => Object.values(p).reduce((a, b) => a + (b ?? 0), 0) >= 1, 'Include at least one playthrough')
    .refine(p => Object.values(p).reduce((a, b) => a + (b ?? 0), 0) <= MAX_RUNS, `At most ${MAX_RUNS} playthroughs in one run`),
  /** The first seed; playthrough i of a persona plays seed + i, so a calibration replays exactly. */
  seed: z.number().int().min(0).max(2 ** 31 - 1).default(1),
  /** Also play the one style and one action probes (D112). */
  probes: z.boolean().default(true),
  /** The tier Experts should reach and Beginners should not, by key. Left out, the second tier from the top. */
  targetTier: z.string().regex(/^[a-z][a-z0-9_]*$/).optional(),
  /** How each persona plays, in the author's words: read by AI players only. */
  describe: z.object({ beginner: z.string().max(600), developing: z.string().max(600), proficient: z.string().max(600), expert: z.string().max(600) }).partial().optional()
});
export type CalibrationSettings = z.output<typeof CalibrationSettings>;
export type CalibrationSettingsInput = z.input<typeof CalibrationSettings>;

/** The server's request: the draft storyline and the settings. */
export const CalibrationRequest = CalibrationSettings.extend({ storyline: z.record(z.string(), z.unknown()) });
export type CalibrationRequest = z.input<typeof CalibrationRequest>;

const Band = z.enum(['strong', 'adequate', 'weak', 'harmful']);
const Num = z.number();
const Int = z.number().int();

/** One playthrough's numbers, as the aggregation reads them. */
export const RunResult = z.object({
  persona: PersonaKey,
  index: Int.min(0),
  seed: Int,
  /** Set for a dominant strategy probe: the style or the action it leaned on. */
  probe: z.object({ kind: z.enum(['style', 'action']), key: z.string() }).nullable(),
  score: Num,
  max: Num,
  tier: z.object({ key: z.string(), name: z.string(), index: Int.min(0) }),
  /** Revenue as a share of the target, 1 is the target. */
  share: Num,
  /** The overall skill level (index on the rating scale), or null without enough evidence. */
  level: Int.min(0).nullable(),
  skills: z.array(z.object({ key: z.string(), level: Int.min(0).nullable(), score: Num.nullable() })),
  /** Share of style choices that fit the need, 0 to 100. */
  adaptability: Num,
  bands: z.object({ strong: Int, adequate: Int, weak: Int, harmful: Int }),
  /** People whose hidden concern surfaced in this playthrough. */
  concerns: z.array(z.string()),
  /** Times each action was taken. */
  actions: z.record(z.string(), Int),
  events: z.object({ expected: Int, handled: Int })
});
export type RunResult = z.infer<typeof RunResult>;

export const CheckStatus = z.enum(['pass', 'warn', 'fail']);
export type CheckStatus = z.infer<typeof CheckStatus>;
export const Check = z.object({
  key: z.enum(['ordered', 'expertTier', 'beginnerTier', 'skills', 'conversations', 'separation', 'dominant', 'unused', 'events']),
  status: CheckStatus,
  /** One plain sentence, what the author reads in the list. */
  title: z.string(),
  /** More detail, and what to change. */
  detail: z.string().nullable(),
  fix: z.string().nullable()
});
export type Check = z.infer<typeof Check>;

const Range = z.object({ min: Num, max: Num, mean: Num, median: Num });

export const PersonaStats = z.object({
  persona: PersonaKey,
  runs: Int.min(0),
  score: Range,
  /** The tier of the median playthrough, and how many playthroughs ended in each tier (highest first). */
  tier: z.object({ key: z.string(), name: z.string() }),
  tiers: z.array(z.object({ key: z.string(), name: z.string(), count: Int })),
  reachedTarget: Int,
  share: Range,
  beatTarget: Int,
  /** The most common overall skill level and its name, and the share of playthroughs whose level fits the persona. */
  level: z.object({ index: Int.nullable(), name: z.string() }),
  agreement: Num,
  adaptability: Num,
  /** Mean conversation band, 0 harmful to 3 strong, and the count of each band. */
  bandScore: Num,
  bands: z.object({ strong: Int, adequate: Int, weak: Int, harmful: Int }),
  concerns: Num
});
export type PersonaStats = z.infer<typeof PersonaStats>;

export const CalibrationResults = z.object({
  version: z.literal(1),
  storyline: z.object({ id: z.string(), name: z.string() }),
  /** A hash of the draft that was played, so a later edit shows the results are out of date. */
  configHash: z.string(),
  lens: z.object({ title: z.string(), styles: z.array(z.object({ key: z.string(), name: z.string() })) }),
  scale: z.array(z.string()),
  /** How the storyline shows money, for revenue in the playthrough view. */
  money: z.object({ currency: z.string(), locale: z.string() }),
  scoreMax: Num,
  tiers: z.array(z.object({ key: z.string(), name: z.string(), min: Num })),
  targetTier: z.object({ key: z.string(), name: z.string(), min: Num }),
  personas: z.array(PersonaStats),
  checks: z.array(Check),
  runs: z.array(RunResult),
  probes: z.array(RunResult),
  /** People whose hidden concern surfaced, per persona: in how many of its playthroughs. */
  concernsByPerson: z.record(z.string(), z.record(z.string(), Int)),
  /** Action keys and names, in storyline order. */
  actions: z.array(z.object({ key: z.string(), name: z.string() })),
  settings: z.object({ seed: Int, probes: z.boolean(), personas: z.record(z.string(), Int) }),
  /** Where it ran and with which players: the in browser engine, or the server; the offline templates, or AI players. */
  ranOn: z.enum(['browser', 'server', 'cli']),
  players: z.enum(['templates', 'ai']),
  createdAt: z.string(),
  durationMs: Num
});
export type CalibrationResults = z.infer<typeof CalibrationResults>;

/** One playthrough, week by week and conversation by conversation, for the author to watch. */
export const Playthrough = z.object({
  persona: PersonaKey,
  index: Int.min(0),
  seed: Int,
  score: Num,
  tier: z.string(),
  share: Num,
  adaptability: Num,
  weeks: z.array(z.object({
    period: Int,
    styleFit: z.object({ correct: Int, total: Int }).nullable(),
    actions: z.array(z.string()),
    events: z.array(z.object({ title: z.string(), expected: z.boolean(), handled: z.boolean() })),
    revenue: Num,
    score: Num.nullable()
  })),
  conversations: z.array(z.object({
    id: z.string(),
    period: Int,
    title: z.string(),
    format: z.string(),
    memberIds: z.array(z.string()),
    names: z.array(z.string()),
    band: Band.nullable(),
    intended: z.string().nullable(),
    shown: z.string().nullable(),
    fit: z.boolean().nullable(),
    turns: z.array(z.object({ by: z.enum(['player', 'other']), name: z.string(), text: z.string() })),
    dimensions: z.array(z.object({ key: z.string(), band: Band })),
    why: z.string()
  }))
});
export type Playthrough = z.infer<typeof Playthrough>;

/** A job on the server (`GET /genie/calibrations/{id}`). */
export const CalibrationJob = z.object({
  id: z.string(),
  status: z.enum(['queued', 'running', 'done', 'failed', 'cancelled']),
  progress: z.object({ done: Int, total: Int }),
  /** Ready when done. */
  results: CalibrationResults.nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable()
});
export type CalibrationJob = z.infer<typeof CalibrationJob>;
