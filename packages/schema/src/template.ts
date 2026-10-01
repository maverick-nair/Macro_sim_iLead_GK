import { z } from "zod";
import { AccessSchema } from "./areas/access";
import { ActionsSchema } from "./areas/actions";
import { BrandingSchema } from "./areas/branding";
import { CastSchema } from "./areas/cast";
import { ContextSchema } from "./areas/context";
import { EventsSchema } from "./areas/events";
import { GamificationSchema } from "./areas/gamification";
import { GovernanceSchema } from "./areas/governance";
import { LeadershipSchema } from "./areas/leadership";
import { ProcessSchema } from "./areas/process";
import { ReportSchema } from "./areas/report";
import { TimeSchema } from "./areas/time";
import { Id, Text, obj } from "./primitives";

/** Current SimulationTemplate schema version. Bump with a migration in migrations.ts. */
export const CURRENT_SCHEMA_VERSION = 1;

export const AREA_KEYS = [
  "context",
  "branding",
  "cast",
  "process",
  "leadership",
  "actions",
  "events",
  "time",
  "gamification",
  "report",
  "access",
  "governance",
] as const;
export const AreaKey = z.enum(AREA_KEYS);
export type AreaKey = z.infer<typeof AreaKey>;

export type AreaGroup = "world" | "rules" | "experience";

export interface AreaMeta {
  key: AreaKey;
  /** UI label from the Screens doc. */
  label: string;
  group: AreaGroup;
  /** Position in the area rail (Screens doc). */
  railOrder: number;
  /** Position in AI generation (Config Spec order plus A-01). */
  generationOrder: number;
}

export const AREAS: readonly AreaMeta[] = [
  { key: "context", label: "Context", group: "world", railOrder: 1, generationOrder: 1 },
  { key: "branding", label: "Branding and media", group: "world", railOrder: 2, generationOrder: 3 },
  { key: "cast", label: "Cast", group: "world", railOrder: 3, generationOrder: 4 },
  { key: "process", label: "Process and targets", group: "world", railOrder: 4, generationOrder: 2 },
  { key: "leadership", label: "Leadership model", group: "rules", railOrder: 5, generationOrder: 6 },
  { key: "actions", label: "Actions", group: "rules", railOrder: 6, generationOrder: 7 },
  { key: "events", label: "Events", group: "rules", railOrder: 7, generationOrder: 8 },
  { key: "time", label: "Time and pacing", group: "rules", railOrder: 8, generationOrder: 5 },
  { key: "gamification", label: "Gamification", group: "experience", railOrder: 9, generationOrder: 9 },
  { key: "report", label: "Report", group: "experience", railOrder: 10, generationOrder: 10 },
  { key: "access", label: "Language and access", group: "experience", railOrder: 11, generationOrder: 11 },
  { key: "governance", label: "Governance", group: "experience", railOrder: 12, generationOrder: 12 },
];

export const AREA_GROUP_LABELS: Record<AreaGroup, string> = {
  world: "World",
  rules: "Rules",
  experience: "Experience and output",
};

export const generationOrder = (): AreaKey[] =>
  [...AREAS].sort((a, b) => a.generationOrder - b.generationOrder).map((a) => a.key);

export const TemplateMetaSchema = obj({
  templateId: Id,
  schemaVersion: z.int().min(1),
  format: z.literal("ilead"),
  /** Engine version the template was last checked against (semver). */
  engineVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** Working title of the build, as shown in Products. */
  title: Text.min(1),
  client: Text.optional(),
  sourceTemplateId: Id.optional(),
});

/** The one configuration object every part of the system reads (CLAUDE.md rule 1). */
export const TemplateSchema = obj({
  meta: TemplateMetaSchema,
  context: ContextSchema,
  branding: BrandingSchema,
  cast: CastSchema,
  process: ProcessSchema,
  leadership: LeadershipSchema,
  actions: ActionsSchema,
  events: EventsSchema,
  time: TimeSchema,
  gamification: GamificationSchema,
  report: ReportSchema,
  access: AccessSchema,
  governance: GovernanceSchema,
});
export type SimulationTemplate = z.infer<typeof TemplateSchema>;
