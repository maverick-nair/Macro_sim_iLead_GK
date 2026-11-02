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
  gapWeek: z.object({ title: z.string(), loaded: z.boolean() }),
  final: z.object({ title: z.string(), loaded: z.boolean() }),
  timers: z.object({
    autoKickOffSeconds: z.number().positive(),
    lockedInSeconds: z.number().positive(),
    injectSeconds: z.number().positive(),
    fullTimeSeconds: z.number().positive(),
    leagueSeconds: z.number().positive(),
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

export interface Content {
  rounds: z.infer<typeof RoundsFile>;
  consequence: ConsequenceFile;
  league: LeagueFile;
  trustMeter: TrustMeterFile;
  rubric: RubricFile;
  schedule: ScheduleFile;
  squads: SquadsFile;
  characters: Record<string, Character>;
}

export interface ValidationReport {
  ok: boolean;
  lines: string[];
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
    }
  }
  if (league)
    lines.push(`info  league weights sum to ${league.categories.reduce((s, c) => s + c.weight, 0)}`);
  return { ok, lines };
}
