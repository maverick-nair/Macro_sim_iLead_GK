import { z } from "zod";
import { Id, LongText, Text, obj } from "../primitives";

/** Config Spec: "Organisation, scenario and product context" (24 settings). */
export const OrganisationSchema = obj({
  mode: z.enum(["real", "fictional_twin", "fictional"]),
  name: Text.min(1),
  tagline: Text.optional(),
  industry: Text.min(1),
  subIndustry: Text.optional(),
  size: z.enum(["small", "medium", "large", "enterprise"]),
  structure: Text.optional(),
  ownership: Text.optional(),
  region: Text.min(1),
  city: Text.optional(),
  officeType: Text.optional(),
  values: z.array(obj({ name: Text.min(1), line: Text.optional() })).max(6),
  competitors: z.array(Text.min(1)).max(5),
  businessSituation: z.enum(["turnaround", "growth", "change", "crisis", "merger", "new_launch"]),
  situationNote: Text.optional(),
  glossary: z.array(obj({ term: Text.min(1), meaning: Text.min(1) })).max(200),
  policies: z
    .array(
      obj({
        kind: z.enum(["hr", "compliance", "sales_conduct", "other"]),
        text: LongText.optional(),
        assetId: z.string().min(1).optional(),
      }),
    )
    .max(20),
});

export const ProductSchema = obj({
  lines: z
    .array(obj({ id: Id, name: Text.min(1), description: Text }))
    .min(1)
    .max(5),
  focusLineId: Id,
  valueProposition: Text,
  weaknesses: Text,
  segments: z.array(obj({ id: Id, name: Text.min(1), description: Text.optional() })).max(4),
  unitOfValue: z.enum(["revenue", "units", "accounts", "nps", "cases_closed", "uptime"]),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use an ISO 4217 currency code"),
  numberLocale: z.string().min(2).max(20),
});

export const ScenarioSchema = obj({
  participantRoleTitle: Text.min(1),
  level: z.enum(["first_line", "mid", "senior"]),
  span: z.int().min(1).max(100),
  backstory: LongText,
  sponsorNpcId: Id,
  sponsorStyle: z.enum(["supportive", "demanding", "distant"]),
  welcomeMessage: LongText,
  tone: z.enum(["formal", "friendly", "high_pressure", "playful"]),
  realism: z.enum(["grounded", "slightly_dramatised", "high_drama"]),
});

export const ContextSchema = obj({
  organisation: OrganisationSchema,
  product: ProductSchema,
  scenario: ScenarioSchema,
});
export type Context = z.infer<typeof ContextSchema>;
