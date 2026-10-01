import { z } from "zod";
import { HexColour, Id, Stat, StatDeltas, Text, obj } from "../primitives";

const Range = z.tuple([Stat, Stat]);

/** Config Spec: "Leadership model and scoring rules" (12 settings; style tags live on action options). */
export const LeadershipSchema = obj({
  framework: z.enum(["ilead", "situational_leadership", "coaching_styles", "client_upload"]),
  styles: z
    .array(
      obj({
        id: Id,
        name: Text.min(1),
        shortCode: z.string().min(1).max(3),
        definition: Text.min(1),
        colour: HexColour,
      }),
    )
    .min(3)
    .max(6),
  /** Readiness bands on current Skill and Morale, optionally Trust. Ranges are inclusive. */
  readinessBands: z
    .array(obj({ id: Id, label: Text.min(1), skill: Range, morale: Range, trust: Range.optional() }))
    .min(1)
    .max(24),
  /** Needed style per band (match or mismatch only; decisions review finding 1). */
  fitMatrix: z.record(Id, Id),
  /** Per member exceptions: a fixed needed style for a person and week. Also shown in the NPC Stats tab (C-08). */
  // TODO(decision): D-10 per member or global fit. Global bands plus these per member exceptions cover both.
  memberExceptions: z.array(obj({ npcId: Id, week: z.int().min(1).max(12), styleId: Id })).max(200),
  /** Role misfit penalty (A-22). */
  roleMisfit: obj({
    roleFitSkillBelow: Stat,
    strength: z.enum(["none", "moderate", "strong"]),
    appliesTo: z.enum(["moved_members", "all_members"]),
  }),
  deltaTable: obj({ match: StatDeltas, mismatch: StatDeltas }),
  teamFeedback: obj({
    below_half: z.array(Text.min(1)).min(1).max(5),
    half: z.array(Text.min(1)).min(1).max(5),
    majority: z.array(Text.min(1)).min(1).max(5),
    all: z.array(Text.min(1)).min(1).max(5),
  }),
  /** Behaviour indicators per style used by the evaluator to infer the style shown. */
  inferenceRules: z.array(obj({ styleId: Id, indicators: z.array(Text.min(1)).min(1).max(10) })).max(6),
  intentVsAction: obj({
    enabled: z.boolean(),
    gapWeeks: z.int().min(1).max(8),
    trustDelta: z.int().min(-50).max(0),
  }),
  /** Promise checks in week n+1 (A-04). */
  promises: obj({ keptTrustDelta: z.int().min(0).max(50), brokenTrustDelta: z.int().min(-50).max(0) }),
});
export type Leadership = z.infer<typeof LeadershipSchema>;
