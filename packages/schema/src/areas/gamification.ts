import { z } from "zod";
import { Expr, Id, Stat, Text, obj, perBand } from "../primitives";

/** Engine events a badge rule can listen to (docs/scoring-and-report.md 6.1). */
export const BADGE_EVENTS = ["conversion", "week_end", "interaction_end", "run_end"] as const;

export const BadgeSchema = obj({
  id: Id,
  name: Text.min(1),
  icon: Text.min(1),
  copy: Text.min(1),
  lockedHint: Text.min(1),
  event: z.enum(BADGE_EVENTS),
  condition: Expr,
  count: z.int().min(1).max(100).optional(),
  repeatable: z.boolean(),
  /** The behaviour the badge reinforces (iLead 2.0 Design badge table). */
  reinforces: Text.min(1),
});

/** Config Spec: "Gamification settings" (11 settings). Formulas are locked; inputs here are configurable. */
export const GamificationSchema = obj({
  elements: obj({
    score: z.boolean(),
    stars: z.boolean(),
    streaks: z.boolean(),
    badges: z.boolean(),
    sponsorMeter: z.boolean(),
    unlocks: z.boolean(),
    teamPulse: z.boolean(),
    leaderboard: z.boolean(),
    tiers: z.boolean(),
  }),
  weights: obj({ business: Stat, people: Stat, leadership: Stat }),
  scale: obj({ kind: z.enum(["0_100", "0_1000", "custom"]), max: z.int().min(10).max(100000) }),
  liveBandScores: perBand(Stat),
  stars: z.tuple([Stat, Stat, Stat]),
  streak: obj({
    minStars: z.int().min(1).max(3),
    startWeeks: z.int().min(1).max(12),
    bonusPerWeek: z.int().min(0).max(1000),
    cap: z.int().min(0).max(1000),
  }),
  badges: z.array(BadgeSchema).max(40),
  sponsorMeter: obj({
    start: Stat,
    briefing: perBand(z.int().min(-100).max(100)),
    weekRevenue: obj({ above: z.int().min(-50).max(50), below: z.int().min(-50).max(50) }),
    escalation: z.int().min(-50).max(0),
  }),
  unlocks: obj({
    threshold: Stat,
    lowThreshold: Stat,
    lowPenaltyDays: z.int().min(0).max(3),
    rewards: z
      .array(
        obj({
          id: Id,
          kind: z.enum(["bonus_day", "hire_budget", "team_activity", "custom"]),
          label: Text.min(1),
        }),
      )
      .max(6),
  }),
  tiers: z
    .array(obj({ id: Id, name: Text.min(1), min: z.int().min(0).max(100000) }))
    .min(2)
    .max(5),
  leaderboard: obj({
    scope: z.enum(["cohort", "business_unit", "global"]),
    size: z.int().min(3).max(100),
    anonymous: z.boolean(),
    window: z.enum(["cohort_window", "all_time"]),
  }),
  celebrations: z.enum(["none", "subtle", "full"]),
});
export type Gamification = z.infer<typeof GamificationSchema>;
