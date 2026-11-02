/**
 * The content file contract. Every piece of client content (rounds, consequences, characters,
 * squads, schedule) is loaded from /content and validated here, so no case content sits in code.
 */
import { z } from "zod";

export const OptionId = z.enum(["A", "B", "C"]);
export type OptionId = z.infer<typeof OptionId>;

export const TicketEffect = z.object({
  id: z.string().regex(/^T-\d{3}$/, "Ticket ids look like T-009"),
  status: z.enum(["critical", "added"]),
  round: z.number().int().min(1).max(9),
});

export const OptionEffects = z.object({
  points: z.union([z.literal(10), z.literal(5), z.literal(0)]),
  implementationSurvey: z.number().optional(),
  sixMonthSurvey: z.number().optional(),
  revenuePct: z.number().optional(),
  zeroPlan: z.boolean().optional(),
  tickets: z.array(TicketEffect).optional(),
  revenueDisputed: z.boolean().optional(),
  mandateLabel: z.string().optional(),
});
export type OptionEffects = z.infer<typeof OptionEffects>;

export const RoundOption = z.object({
  id: OptionId,
  label: z.string().min(1),
  text: z.string().min(1),
  effects: OptionEffects,
  keyMoment: z.string().optional(),
  breaking: z
    .object({ round: z.number().int().min(1).max(9), headline: z.string(), text: z.string() })
    .optional(),
});
export type RoundOption = z.infer<typeof RoundOption>;

export const Evidence = z.object({
  id: z.string(),
  kind: z.enum(["log", "system", "email", "report", "note"]),
  title: z.string(),
  text: z.string(),
  highlight: z.string().optional(),
  highlightLabel: z.string().optional(),
});
export type Evidence = z.infer<typeof Evidence>;

/** Input card shown at the point of need (F14): the five-line update, the 3R script and so on. */
export const InputCard = z.object({
  id: z.string(),
  title: z.string().min(1),
  lines: z.array(z.string()).min(1),
  /** The scene the card shows before. */
  showAt: z.enum(["briefing", "plan", "onair", "moment"]),
});
export type InputCard = z.infer<typeof InputCard>;

/**
 * Round moments: AI moments beyond the main conversation, run in the MOMENT phase in order.
 * - lift: each member gives a Lift brief (headline, number, risk, ask) to a Department Head, scored 1 to 10 each.
 * - faisal: the Head of Sales challenge, scored 0 to 5; gives way only to the evidence named in `givesWayTo`.
 * - replay: a replay of an earlier conversation, scored on the Trust Meter (Most Improved = replay minus original).
 * - boardroom: each role presents to the AI panel, which asks its questions in order and scores six criteria.
 */
export const LiftMoment = z.object({
  type: z.literal("lift"),
  id: z.string(),
  character: z.string(),
  minutes: z.number().positive().default(6),
  setup: z.string().min(1),
  fields: z.array(z.string()).length(4).default(["Headline", "Number", "Risk", "Ask"]),
});
export const FaisalMoment = z.object({
  type: z.literal("faisal"),
  id: z.string(),
  character: z.string(),
  minutes: z.number().positive().default(6),
  setup: z.string().min(1),
  givesWayTo: z.array(z.string()).min(1),
});
export const ReplayMoment = z.object({
  type: z.literal("replay"),
  id: z.string(),
  character: z.string(),
  minutes: z.number().positive().default(6),
  setup: z.string().min(1),
  replayOf: z.number().int().min(1).max(9),
});
export const BoardroomMoment = z.object({
  type: z.literal("boardroom"),
  id: z.string(),
  character: z.string(),
  minutes: z.number().positive().default(10),
  setup: z.string().min(1),
  /** The five-part review the squad presents. */
  parts: z.array(z.string()).min(1),
  criteria: z.array(z.object({ id: z.string(), label: z.string() })).length(6),
  questions: z.array(z.string()).length(4),
});
export const Moment = z.discriminatedUnion("type", [LiftMoment, FaisalMoment, ReplayMoment, BoardroomMoment]);
export type Moment = z.infer<typeof Moment>;
export type LiftMoment = z.infer<typeof LiftMoment>;
export type FaisalMoment = z.infer<typeof FaisalMoment>;
export type ReplayMoment = z.infer<typeof ReplayMoment>;
export type BoardroomMoment = z.infer<typeof BoardroomMoment>;

const RoundBase = z.object({
  round: z.number().int().min(1).max(9),
  matchday: z.number().int().min(1).max(3),
  title: z.string().min(1),
  leads: z.array(z.string()).min(1),
  planMinutes: z.number().positive(),
  character: z.string(),
});

export const LoadedRound = RoundBase.extend({
  loaded: z.literal(true),
  onAirMinutes: z.number().positive().default(6),
  scenario: z.string().min(1),
  evidence: z.array(Evidence).length(3),
  /** Carry forward: an earlier round's choice swaps this round's evidence. Keyed by round, then option. */
  evidenceByPriorChoice: z.record(z.string(), z.record(z.string(), z.array(Evidence).length(3))).default({}),
  deliverable: z.string(),
  prompt: z.string().min(1),
  planHeadings: z.array(z.string()).length(4),
  dueOptions: z.array(z.string()).min(1),
  inject: z.object({ headline: z.string(), text: z.string(), seed: z.boolean().optional() }),
  options: z.array(RoundOption).length(3),
  /** Carry forward: this round's action log is handed to a later round (Round 6 feeds Round 8). */
  actionLogFeeds: z.number().int().min(1).max(9).optional(),
  /** False skips the main conversation (for example the boardroom round, where the moment is the conversation). */
  onAir: z.boolean().default(true),
  moments: z.array(Moment).default([]),
  inputCards: z.array(InputCard).default([]),
  seedValues: z.boolean().optional(),
});
export type LoadedRound = z.infer<typeof LoadedRound>;

export const PendingRound = RoundBase.extend({ loaded: z.literal(false) });
export type PendingRound = z.infer<typeof PendingRound>;

export const Round = z.discriminatedUnion("loaded", [LoadedRound, PendingRound]);
export type Round = z.infer<typeof Round>;

const Meta = z.object({ source: z.string(), note: z.string().optional() }).passthrough();

export const RoundsFile = z
  .object({ meta: Meta, rounds: z.array(Round).length(9) })
  .refine((f) => f.rounds.every((r, i) => r.round === i + 1), "Rounds must be numbered 1 to 9 in order");

export const ConsequenceFile = z.object({
  meta: Meta,
  start: z.object({ implementationSurvey: z.number(), sixMonthSurvey: z.number(), revenuePct: z.number() }),
  caps: z.object({
    surveyMin: z.number(),
    surveyMax: z.number(),
    revenueMin: z.number(),
    revenueMax: z.number(),
  }),
  revenueCommitment: z.object({ currency: z.string(), amountMillions: z.number() }),
  pointsPerRound: z.object({ plan: z.number(), decision: z.number() }),
  leadershipBeforeRound1: z.number(),
  decisionDisplay: z.record(z.string(), z.string()),
});
export type ConsequenceFile = z.infer<typeof ConsequenceFile>;

export const LeagueCategoryId = z.enum([
  "plan",
  "trust",
  "boardroom",
  "decisions",
  "challenges",
  "trustChallenge",
  "missions",
  "kudos",
]);
export type LeagueCategoryId = z.infer<typeof LeagueCategoryId>;

export const LeagueFile = z
  .object({
    meta: Meta,
    categories: z.array(z.object({ id: LeagueCategoryId, label: z.string(), weight: z.number().min(0) })),
    tieBreak: z.literal("trust"),
  })
  .refine((f) => f.categories.reduce((s, c) => s + c.weight, 0) === 100, "League weights must sum to 100");
export type LeagueFile = z.infer<typeof LeagueFile>;

export const TrustMeterFile = z.object({
  meta: Meta,
  behaviors: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
  serviceReviewExtra: z.string().optional(),
});
export type TrustMeterFile = z.infer<typeof TrustMeterFile>;

export const RubricFile = z.object({
  meta: Meta.extend({ version: z.string() }),
  lines: z.array(z.object({ id: z.string(), label: z.string() })).length(4),
  lineMax: z.number(),
  tieBreakGap: z.number(),
  controlBypassZero: z.object({
    rule: z.string(),
    rounds: z.union([z.array(z.number().int()), z.literal("all")]),
    todo: z.string().optional(),
  }),
});
export type RubricFile = z.infer<typeof RubricFile>;

export const ScheduleFile = z.object({
  meta: Meta,
  matchdays: z
    .array(
      z.object({
        matchday: z.number().int(),
        title: z.string(),
        unlockAt: z.string().datetime({ offset: true }),
      }),
    )
    .length(3),
  /** The Trust Challenge opens at `unlockAt` and should be finished before Matchday 3 unlocks. */
  gapWeek: z.object({
    title: z.string(),
    loaded: z.boolean(),
    unlockAt: z.string().datetime({ offset: true }).optional(),
  }),
  /** League final and trophy reveal. */
  final: z.object({
    title: z.string(),
    loaded: z.boolean(),
    unlockAt: z.string().datetime({ offset: true }).optional(),
  }),
  timers: z.object({
    autoKickOffSeconds: z.number().positive(),
    countdownSeconds: z.number().positive().default(3),
    lockedInSeconds: z.number().positive(),
    injectSeconds: z.number().positive(),
    fullTimeSeconds: z.number().positive(),
    leagueSeconds: z.number().positive(),
    kudosSeconds: z.number().positive().default(90),
  }),
});
export type ScheduleFile = z.infer<typeof ScheduleFile>;

export const SquadColour = z.enum(["amber", "sky", "coral", "mint", "lilac", "sand"]);
export type SquadColour = z.infer<typeof SquadColour>;

export const RoundResultInput = z.object({
  decisionPoints: z.number(),
  planScore: z.number(),
  trust: z.number(),
});

export const SquadsFile = z.object({
  meta: Meta,
  roles: z.array(z.string()).min(4),
  squads: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        code: z.string().min(3),
        colour: SquadColour,
        bot: z.boolean(),
      }),
    )
    .min(1)
    .max(6),
  botResults: z.record(z.string(), z.record(z.string(), RoundResultInput)).default({}),
});
export type SquadsFile = z.infer<typeof SquadsFile>;

export const Character = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  organisation: z.string(),
  location: z.string(),
  briefLoaded: z.boolean(),
  speaks: z.string().optional(),
  wants: z.string().optional(),
  neverDoes: z.string().optional(),
  habits: z.string().optional(),
  note: z.string().optional(),
});
export type Character = z.infer<typeof Character>;

/** Trust Challenge (gap week): three one-to-one sittings with the AI client, scored on the trust equation. */
export const TrustChallengeFile = z.object({
  meta: Meta.extend({ approved: z.boolean().default(false) }),
  character: z.string(),
  dimensions: z.array(z.object({ id: z.string(), label: z.string(), help: z.string().optional() })).length(4),
  lineMax: z.number().default(5),
  sittings: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(1),
        scenario: z.string().min(1),
        opening: z.string().min(1),
        minutes: z.number().positive().default(8),
      }),
    )
    .length(3),
});
export type TrustChallengeFile = z.infer<typeof TrustChallengeFile>;

/** Kudos: what each squad can award to other squads after each matchday. */
export const KudosFile = z.object({
  meta: Meta,
  perMatchday: z.number().int().positive(),
  maxPerSquad: z.number().int().positive(),
});
export type KudosFile = z.infer<typeof KudosFile>;

export interface Content {
  rounds: z.infer<typeof RoundsFile>;
  consequence: ConsequenceFile;
  league: LeagueFile;
  trustMeter: TrustMeterFile;
  rubric: RubricFile;
  schedule: ScheduleFile;
  squads: SquadsFile;
  trustChallenge: TrustChallengeFile;
  kudos: KudosFile;
  characters: Record<string, Character>;
}

export interface ValidationReport {
  ok: boolean;
  lines: string[];
}

/** Every content file, keyed as in `validateContent`'s `raw` argument. */
export const CONTENT_FILES = {
  rounds: "rounds.json",
  consequence: "consequence.json",
  league: "league.json",
  trustMeter: "trust-meter.json",
  rubric: "rubric.json",
  schedule: "schedule.json",
  squads: "squads.json",
  trustChallenge: "trust-challenge.json",
  kudos: "kudos.json",
} as const;

/** Parses raw content into a typed Content, or returns the validation errors. */
export function parseContent(
  raw: Record<string, unknown>,
  characters: Record<string, unknown>,
): { ok: true; content: Content } | { ok: false; errors: string[] } {
  const report = validateContent(raw, characters);
  if (!report.ok) return { ok: false, errors: report.lines.filter((l) => l.startsWith("fail")) };
  const chars: Record<string, Character> = {};
  for (const c of Object.values(characters)) {
    const parsed = Character.parse(c);
    chars[parsed.id] = parsed;
  }
  return {
    ok: true,
    content: {
      rounds: RoundsFile.parse(raw.rounds),
      consequence: ConsequenceFile.parse(raw.consequence),
      league: LeagueFile.parse(raw.league),
      trustMeter: TrustMeterFile.parse(raw.trustMeter),
      rubric: RubricFile.parse(raw.rubric),
      schedule: ScheduleFile.parse(raw.schedule),
      squads: SquadsFile.parse(raw.squads),
      trustChallenge: TrustChallengeFile.parse(raw.trustChallenge),
      kudos: KudosFile.parse(raw.kudos),
      characters: chars,
    },
  };
}

/** Validates every content file and returns a readable report (used by the import and validate scripts). */
export function validateContent(
  raw: Record<string, unknown>,
  characters: Record<string, unknown>,
): ValidationReport {
  const lines: string[] = [];
  let ok = true;
  const check = (name: string, schema: z.ZodType, value: unknown) => {
    const r = schema.safeParse(value);
    if (r.success) lines.push(`ok    ${name}`);
    else {
      ok = false;
      for (const issue of r.error.issues)
        lines.push(`fail  ${name} ${issue.path.join(".")}: ${issue.message}`);
    }
    return r.success ? r.data : undefined;
  };
  const rounds = check("rounds.json", RoundsFile, raw.rounds) as Content["rounds"] | undefined;
  check("consequence.json", ConsequenceFile, raw.consequence);
  const league = check("league.json", LeagueFile, raw.league) as LeagueFile | undefined;
  check("trust-meter.json", TrustMeterFile, raw.trustMeter);
  check("rubric.json", RubricFile, raw.rubric);
  check("schedule.json", ScheduleFile, raw.schedule);
  check("squads.json", SquadsFile, raw.squads);
  const tc = check("trust-challenge.json", TrustChallengeFile, raw.trustChallenge) as
    TrustChallengeFile | undefined;
  check("kudos.json", KudosFile, raw.kudos);
  if (tc && !characters[tc.character]) {
    ok = false;
    lines.push(`fail  trust-challenge.json: character ${tc.character} has no file`);
  }
  if (tc && !tc.meta.approved)
    lines.push("warn  trust-challenge.json: scenarios not yet approved (open question 8)");
  for (const [id, c] of Object.entries(characters)) check(`characters/${id}.json`, Character, c);

  if (rounds) {
    const loaded = rounds.rounds.filter((r) => r.loaded);
    lines.push(
      `info  ${rounds.rounds.length} rounds, ${loaded.length} loaded (source: ${rounds.meta.source})`,
    );
    for (const r of loaded) {
      if (r.loaded) lines.push(`info  round ${r.round}: ${r.options.length} options`);
      if (r.loaded && !characters[r.character]) {
        ok = false;
        lines.push(`fail  round ${r.round}: character ${r.character} has no file`);
      }
      if (r.loaded)
        for (const m of r.moments)
          if (!characters[m.character]) {
            ok = false;
            lines.push(`fail  round ${r.round} moment ${m.id}: character ${m.character} has no file`);
          }
    }
  }
  if (league)
    lines.push(`info  league weights sum to ${league.categories.reduce((s, c) => s + c.weight, 0)}`);
  return { ok, lines };
}
