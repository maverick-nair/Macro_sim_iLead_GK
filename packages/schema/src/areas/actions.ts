import { z } from "zod";
import { Id, LongText, NpcSelector, StatDeltas, Text, obj, perBand } from "../primitives";

/**
 * Locked effect kinds the engine knows how to apply. Authors compose actions from these;
 * they cannot add new kinds (Config Spec: authors can rename, hide, clone or create actions).
 */
export const EffectSchema = z.discriminatedUnion("kind", [
  obj({ kind: z.literal("swap_roles") }),
  obj({ kind: z.literal("reassign_role") }),
  obj({
    kind: z.literal("make_unavailable"),
    days: z.int().min(1).max(30),
    status: z.enum(["training", "leave"]),
  }),
  obj({ kind: z.literal("delayed_delta"), afterDays: z.int().min(1).max(30), deltas: StatDeltas }),
  obj({ kind: z.literal("reveal_role_fit") }),
  obj({ kind: z.literal("hire_candidate") }),
  obj({ kind: z.literal("remove_member") }),
  obj({ kind: z.literal("team_delta"), deltas: StatDeltas, excludeUnavailable: z.boolean() }),
  obj({ kind: z.literal("schedule_event"), eventId: Id, afterDays: z.int().min(0).max(60) }),
]);
export type Effect = z.infer<typeof EffectSchema>;

/** Named, parameterised eligibility predicates (Teardown hidden rule 6). */
export const EligibilityRuleSchema = z.discriminatedUnion("kind", [
  obj({ kind: z.literal("available_only") }),
  obj({ kind: z.literal("max_per_role"), max: z.int().min(1).max(4) }),
  obj({ kind: z.literal("min_left_in_role"), min: z.int().min(0).max(4) }),
  obj({ kind: z.literal("peer_covers_role") }),
  obj({ kind: z.literal("team_not_full") }),
  obj({ kind: z.literal("team_members_only") }),
]);

const Outcomes = <T extends z.ZodType>(value: T) =>
  obj({ match: value.optional(), mismatch: value.optional(), any: value.optional() });

export const ActionOptionSchema = obj({
  id: Id,
  label: Text.min(1),
  description: Text,
  /** Style tag used to score the option against the needed style (Teardown hidden rule 2). */
  styleTag: Id.optional(),
  dayCost: z.int().min(0).max(3).optional(),
  effects: z.array(EffectSchema).max(8),
  consequences: Outcomes(StatDeltas),
  quotes: Outcomes(z.array(Text.min(1)).min(1).max(8)),
});

export const TriggerSchema = z.discriminatedUnion("kind", [
  obj({ kind: z.literal("follow_up_event"), eventId: Id, afterDays: z.int().min(0).max(60) }),
  obj({ kind: z.literal("log_promise") }),
  obj({ kind: z.literal("resolve_concern") }),
  obj({ kind: z.literal("escalate"), eventId: Id }),
]);

export const INTERACTION_FORMATS = [
  "email",
  "chat",
  "roleplay_1to1",
  "team_meeting",
  "sponsor_briefing",
  "interview",
  "written_plan",
] as const;

/** Config Spec: "Per live interaction" (19 settings). */
export const LiveInteractionSchema = obj({
  /** True when the live part can be skipped (Energize toast). */
  optional: z.boolean(),
  format: z.enum(INTERACTION_FORMATS),
  inputModes: z.enum(["text", "audio", "both"]),
  timeLimit: obj({ minutes: z.number().min(0.5).max(20), stop: z.enum(["soft", "hard"]) }),
  turnLimit: z.int().min(1).max(40),
  /** Whether the evaluator's style shown counts as a style tagged choice (one target member only). */
  evaluatesStyle: z.boolean(),
  participantBrief: obj({ goal: Text.min(1), context: LongText, showNpcCard: z.boolean() }),
  npcBrief: obj({ wants: Text, fears: Text, hides: Text, willAccept: Text }),
  difficulty: z.enum(["easy", "standard", "tough"]),
  opening: obj({ speaker: z.enum(["npc", "participant"]), line: Text.optional() }),
  rubric: obj({
    /** 2 to 4 skills from the linkage matrix; anchors default to the skill's band anchors in the Report area. */
    dimensions: z
      .array(obj({ skillId: Id, anchors: perBand(Text.min(1)).optional() }))
      .min(2)
      .max(4),
    concernDetection: obj({ phrases: z.array(Text.min(1)).max(20) }),
    redFlags: z.array(obj({ id: Id, label: Text.min(1), description: Text })).max(10),
    aggregation: z.literal("median_lower"),
  }),
  bandNames: perBand(Text.min(1)),
  consequences: perBand(
    obj({
      target: StatDeltas,
      bystanders: z.array(obj({ selector: NpcSelector, deltas: StatDeltas })).max(10),
      sponsor: z.int().min(-50).max(50),
    }),
  ),
  triggers: perBand(z.array(TriggerSchema).max(6)),
  hints: obj({ policy: z.enum(["off", "on_request", "after_weak"]), tips: z.array(Text.min(1)).max(5) }),
  /** 6 to 12 labelled samples are required by the rubric calibration quality gate (M8), not by the schema. */
  calibrationSet: z
    .array(
      obj({
        id: Id,
        text: LongText,
        kind: z.enum(["text", "audio_transcript"]),
        authorBand: z.enum(["strong", "adequate", "weak", "harmful"]).optional(),
        note: Text.optional(),
        source: z.enum(["ai", "pilot", "author"]),
      }),
    )
    .max(12),
  email: obj({
    recipientsAllowed: z.enum(["one", "team_members", "anyone"]),
    cc: z.boolean(),
    bcc: z.boolean(),
    attachments: z.boolean(),
    replyAllReactions: z.boolean(),
  }).optional(),
  meeting: obj({
    attendees: z.enum(["whole_team", "selected"]),
    agendaRequired: z.boolean(),
    npcToNpc: z.boolean(),
  }).optional(),
  interview: obj({
    candidates: z.int().min(1).max(6),
    questionBank: z.boolean(),
    hiddenTrueProfile: z.boolean(),
  }).optional(),
});
export type LiveInteraction = z.infer<typeof LiveInteractionSchema>;

/** Config Spec: "Per action" (12 settings) plus the live interaction record. */
export const ActionSchema = obj({
  id: Id,
  name: Text.min(1),
  icon: Text.min(1),
  description: Text,
  group: z.enum(["team", "individual"]),
  hidden: z.boolean(),
  scope: z.enum(["team", "individual", "multi_select"]),
  // TODO(decision): D-09 pilot scope (which actions convert to live first). Mode is per action; seed follows the Design doc table.
  mode: z.enum(["static", "hybrid", "live"]),
  dayCost: z.int().min(0).max(3),
  cooldownDays: z.int().min(0).max(60),
  limits: obj({
    minTargets: z.int().min(0).max(16),
    maxTargets: z.int().min(0).max(16),
    maxUsesPerWeek: z.int().min(1).max(20).optional(),
    maxUsesPerRun: z.int().min(1).max(100).optional(),
  }),
  eligibility: z.array(EligibilityRuleSchema).max(10),
  prerequisites: z
    .array(
      obj({
        actionId: Id,
        match: z.enum(["same_target", "same_target_and_role"]),
        penalty: StatDeltas,
        nudge: z.boolean(),
        /** What the affected member says when the prerequisite was skipped. */
        missQuote: Text.optional(),
      }),
    )
    .max(5),
  effects: z.array(EffectSchema).max(8),
  options: z.array(ActionOptionSchema).max(4),
  baseConsequences: obj({
    target: StatDeltas,
    rippleTrigger: z.enum(["rewarded", "criticised", "moved", "fired", "recognised"]).optional(),
  }),
  /** "npc_message" and "scheduled" serve the two new live actions (A-31). */
  unlock: z.discriminatedUnion("kind", [
    obj({ kind: z.literal("always") }),
    obj({ kind: z.literal("from_week"), week: z.int().min(1).max(12) }),
    obj({ kind: z.literal("after_event"), eventId: Id }),
    obj({ kind: z.literal("sponsor_unlock"), rewardId: Id }),
    obj({ kind: z.literal("npc_message") }),
    obj({ kind: z.literal("scheduled"), weeks: z.array(z.int().min(1).max(12)).min(1).max(12) }),
  ]),
  /** Counts toward the weekly live cap unless false (sponsor briefings, A-13). */
  countsTowardLiveCap: z.boolean(),
  interaction: LiveInteractionSchema.optional(),
});
export type Action = z.infer<typeof ActionSchema>;

export const ActionsSchema = obj({ catalogue: z.array(ActionSchema).min(1).max(40) });
export type Actions = z.infer<typeof ActionsSchema>;
