import { z } from "zod";

/** Strict object: unknown keys are rejected so typos and stray patches fail validation. */
export const obj = z.strictObject;

/** Stable identifier used for cross references (NPCs, stages, actions, events, skills). */
export const Id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "Use lower case letters, digits and hyphens");
export type Id = z.infer<typeof Id>;

/** Short single line copy. */
export const Text = z.string().max(500);
/** Longer copy (rich text is stored as Markdown). */
export const LongText = z.string().max(8000);
/** Expression in the engine's safe expression language (parsed and checked by the engine, M2). */
export const Expr = z.string().min(1).max(500);

/** Every dial is an integer from 0 to 100. */
export const Stat = z.int().min(0).max(100);
export type Stat = z.infer<typeof Stat>;

const Delta = z.int().min(-100).max(100);

/** The seven dials (docs/scoring-and-report.md section 2). */
export const DIALS = ["skill", "morale", "result", "trust", "engagement", "quality", "safety"] as const;
export const Dial = z.enum(DIALS);
export type Dial = z.infer<typeof Dial>;

/** Changes to dials. Integers; the engine clamps results to 0 to 100. */
export const StatDeltas = obj({
  skill: Delta.optional(),
  morale: Delta.optional(),
  result: Delta.optional(),
  trust: Delta.optional(),
  engagement: Delta.optional(),
  quality: Delta.optional(),
  safety: Delta.optional(),
});
export type StatDeltas = z.infer<typeof StatDeltas>;

/** Outcome bands for live interactions. */
export const BANDS = ["strong", "adequate", "weak", "harmful"] as const;
export const Band = z.enum(BANDS);
export type Band = z.infer<typeof Band>;

/** Builds a record schema with exactly one entry per band. */
export const perBand = <T extends z.ZodType>(value: T) =>
  obj({ strong: value, adequate: value, weak: value, harmful: value });

/** Any visual, audio or video asset. */
export const AssetRef = obj({
  source: z.enum(["upload", "stock", "generated", "builtin"]),
  assetId: z.string().min(1).max(200).optional(),
  alt: Text,
  prompt: Text.optional(),
});
export type AssetRef = z.infer<typeof AssetRef>;

export const HexColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six digit hex colour");

/** Reference to an NPC, a stage (role), the whole team or the sponsor. */
export const NpcSelector = z.discriminatedUnion("kind", [
  obj({ kind: z.literal("npc"), npcId: Id }),
  obj({ kind: z.literal("role"), stageId: Id }),
  obj({ kind: z.literal("any_team_member"), except: z.array(Id).max(16).optional() }),
  obj({ kind: z.literal("team") }),
]);
export type NpcSelector = z.infer<typeof NpcSelector>;
