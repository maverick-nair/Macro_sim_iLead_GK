import { z } from "zod";
import { AssetRef, Expr, Id, LongText, NpcSelector, Stat, StatDeltas, Text, obj } from "../primitives";

export const ARCHETYPES = [
  "top_performer",
  "low_performer",
  "complainer",
  "role_seeker",
  "rival_hire",
  "quiet_expert",
  "new_joiner",
  "near_retirement",
] as const;
export const Archetype = z.enum(ARCHETYPES);

export const MOODS = ["neutral", "happy", "concerned", "frustrated", "thinking"] as const;

const RoleFitCell = obj({ skill: Stat, motivation: Stat, performance: Stat });

const Likert = z.int().min(1).max(5);
const Slider = z.number().min(-1).max(1);

export const NpcStatsSchema = obj({
  skill: Stat,
  morale: Stat,
  result: Stat,
  /** Optional per Config Spec ("Not used" by default); the iLead seed sets 50 (your answer to Q2). */
  trust: Stat.optional(),
  /** Optional authored start; engine derives it when absent (docs/scoring-and-report.md 2.1). */
  engagement: Stat.optional(),
  /** Hidden from learners; keyed by stage id. Assess reveals one cell. */
  roleFit: z.record(Id, RoleFitCell),
  /** Multipliers on deltas from actions and events tagged with that category (A-22). */
  sensitivity: obj({
    recognition: z.number().min(0).max(3),
    criticism: z.number().min(0).max(3),
    change: z.number().min(0).max(3),
    workload: z.number().min(0).max(3),
  }),
  influence: Stat,
});

export const NpcSchema = obj({
  id: Id,
  kind: z.enum(["team_member", "sponsor", "candidate", "customer", "peer", "hr"]),
  identity: obj({ name: Text.min(1), pronouns: Text.min(1), ageBand: Text.min(1) }),
  look: obj({
    portrait: AssetRef,
    attire: Text,
    setting: Text,
    accessories: Text.optional(),
    expressions: obj({
      neutral: AssetRef.optional(),
      happy: AssetRef.optional(),
      concerned: AssetRef.optional(),
      frustrated: AssetRef.optional(),
      thinking: AssetRef.optional(),
    }),
    avatarMode: z.enum(["static", "animated", "video"]),
  }),
  profile: obj({
    /** Stage id for team members, or a support role such as "sponsor". */
    roleId: Id,
    jobTitle: Text,
    previousCompany: Text.optional(),
    tenureMonths: z.int().min(0).max(600).optional(),
    experienceYears: z.int().min(0).max(60).optional(),
    skills: z.array(Text.min(1)).min(1).max(4),
    remarks: Text,
    hiddenConcern: obj({
      text: Text,
      linkedEventIds: z.array(Id).max(10),
      linkedActionIds: z.array(Id).max(10),
    }),
    careerGoal: Text,
    archetype: Archetype.optional(),
  }),
  stats: NpcStatsSchema.optional(),
  persona: obj({
    personality: obj({
      openness: Likert,
      assertiveness: Likert,
      warmth: Likert,
      resilience: Likert,
      candour: Likert,
    }),
    communicationStyle: z.enum(["direct", "polite", "verbose", "terse", "emotional", "formal"]),
    attitudeToLeader: z.enum(["supportive", "neutral", "sceptical", "hostile"]),
    pressureResponse: z.enum(["withdraws", "argues", "over_promises", "escalates"]),
    openingLines: z.array(Text.min(1)).min(1).max(10),
    catchphrases: z.array(Text.min(1)).max(10),
    knowledgeScope: obj({
      areas: z.array(z.enum(["own_work", "team_gossip", "customer_details", "policy"])).max(4),
      notes: Text.optional(),
    }),
    offLimitsTopics: z.array(Text.min(1)).max(20),
    memoryDepth: z.union([z.literal(3), z.literal(5), z.literal("all")]),
  }),
  voice: obj({
    source: z.enum(["library", "licensed", "none"]),
    voiceId: z.string().min(1).optional(),
    language: z.string().min(2).max(20),
    accent: Text.optional(),
    pitch: Slider,
    pace: Slider,
    warmth: Slider,
    emotionalRange: z.enum(["flat", "moderate", "expressive"]),
    moodLinked: z.boolean(),
    pronunciation: z.array(obj({ word: Text.min(1), phonetic: Text.min(1) })).max(100),
    /** Required for licensed or cloned voices (publishable rule). */
    consentRecordId: z.string().min(1).optional(),
  }),
  /** Candidates only: the true profile revealed over the weeks after a hire. */
  candidate: obj({
    trueStats: obj({ skill: Stat, morale: Stat, result: Stat }),
    interviewPersona: LongText,
  }).optional(),
});
export type Npc = z.infer<typeof NpcSchema>;

export const RippleRuleSchema = obj({
  id: Id,
  trigger: z.enum(["rewarded", "criticised", "moved", "fired", "recognised"]),
  source: NpcSelector,
  affected: z.discriminatedUnion("kind", [
    obj({ kind: z.literal("npc"), npcId: Id }),
    obj({ kind: z.literal("role"), stageId: Id }),
    obj({
      kind: z.literal("related"),
      relationship: z.enum(["allies", "rivals", "mentor", "friends", "conflict"]),
    }),
    obj({ kind: z.literal("peers_outperforming_source") }),
    obj({ kind: z.literal("team") }),
  ]),
  /** Optional extra condition in the engine expression language, e.g. "affected.result > source.result". */
  condition: Expr.optional(),
  deltas: StatDeltas,
  description: Text,
});

/** Config Spec: "NPCs" (40 settings). UI label "Cast" (decisions C-02). */
export const CastSchema = obj({
  roster: obj({
    teamSize: z.int().min(4).max(16),
    membersPerRole: obj({
      default: z.int().min(1).max(4),
      perStage: z.record(Id, z.int().min(1).max(4)),
    }),
    supportingCast: z
      .array(z.enum(["sponsor", "hr_partner", "peer_manager", "customers", "candidates"]))
      .max(5),
    archetypeMix: z.array(Archetype).max(8),
    diversity: obj({ mode: z.enum(["mixed", "mirror_workforce"]), notes: Text.optional() }),
    hiringPool: obj({ count: z.int().min(0).max(6), visibleToLearner: z.boolean() }),
  }),
  npcs: z.array(NpcSchema).min(1).max(40),
  relationships: z
    .array(obj({ id: Id, a: Id, b: Id, type: z.enum(["allies", "rivals", "mentor", "friends", "conflict"]) }))
    .max(60),
  rippleRules: z.array(RippleRuleSchema).max(60),
});
export type Cast = z.infer<typeof CastSchema>;
