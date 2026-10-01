import { z } from "zod";
import { AssetRef, Expr, Id, LongText, StatDeltas, Text, obj } from "../primitives";

export const EventSchema = obj({
  id: Id,
  type: z.enum(["impact", "signal", "capacity", "diagnostic", "opportunity", "crisis"]),
  theme: z.enum([
    "change",
    "competitor",
    "reputation",
    "personal",
    "attrition",
    "compliance",
    "customer",
    "market",
  ]),
  trigger: z.discriminatedUnion("kind", [
    obj({ kind: z.literal("fixed"), week: z.int().min(1).max(12), day: z.int().min(1).max(7).optional() }),
    obj({
      kind: z.literal("random"),
      weeks: z.tuple([z.int().min(1).max(12), z.int().min(1).max(12)]),
      probability: z.number().min(0).max(1),
    }),
    obj({ kind: z.literal("conditional"), condition: Expr, sustainWeeks: z.int().min(1).max(8).optional() }),
    obj({
      kind: z.literal("action"),
      actionId: Id,
      band: z.enum(["strong", "adequate", "weak", "harmful"]).optional(),
    }),
    /** Fired only by another rule: an escalation, a band trigger or an action effect. */
    obj({ kind: z.literal("follow_up") }),
  ]),
  target: z.discriminatedUnion("kind", [
    obj({ kind: z.literal("team") }),
    obj({ kind: z.literal("role"), stageId: Id }),
    obj({ kind: z.literal("npc"), npcId: Id }),
    obj({ kind: z.literal("sponsor") }),
    /** The NPC from the action, interaction or event that fired this one (generic follow ups). */
    obj({ kind: z.literal("trigger_target") }),
  ]),
  delivery: z.enum(["bulletin", "modal", "npc_chat", "email", "sponsor_call"]),
  title: Text.min(1),
  body: LongText,
  image: AssetRef.optional(),
  impact: obj({
    deltas: StatDeltas,
    capacityLossDays: z.int().min(0).max(30).optional(),
    funnelChange: obj({ stageId: Id, delta: z.int().min(-100).max(100) }).optional(),
    sponsor: z.int().min(-50).max(50).optional(),
  }),
  expectedResponse: obj({
    actionIds: z.array(Id).min(1).max(10),
    withinDays: z.int().min(1).max(30),
    reward: StatDeltas,
  }).optional(),
  /** Days before an ignored event escalates. */
  responseWindowDays: z.int().min(1).max(30).optional(),
  escalation: obj({ followUpEventId: Id }).optional(),
  repeat: obj({
    kind: z.enum(["once", "recurring", "cooldown"]),
    cooldownWeeks: z.int().min(1).max(12).optional(),
  }),
  showImpactLabel: z.boolean(),
});
export type GameEvent = z.infer<typeof EventSchema>;

/** Config Spec: "Events and NPC initiated moments" (14 settings). */
export const EventsSchema = obj({
  deck: z.array(EventSchema).max(80),
  pacing: obj({
    perWeek: z.tuple([z.int().min(0).max(10), z.int().min(0).max(10)]),
    intensityCurve: z.array(z.number().min(0).max(10)).max(12),
  }),
});
export type Events = z.infer<typeof EventsSchema>;
