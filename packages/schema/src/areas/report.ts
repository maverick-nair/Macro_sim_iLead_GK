import { z } from "zod";
import { HexColour, Id, Stat, Text, LongText, obj, perBand } from "../primitives";

/** The 10 Report 2.0 sections (iLead 2.0 Design, participant report structure). */
export const REPORT_SECTIONS = [
  "executive_summary",
  "style_flexibility",
  "intent_vs_action",
  "skills_profile",
  "key_moments",
  "people_outcomes",
  "business_outcomes",
  "conversation_analytics",
  "development_plan",
  "methodology",
] as const;
export const ReportSection = z.enum(REPORT_SECTIONS);

const NarrativeKey = z.discriminatedUnion("kind", [
  obj({ kind: z.literal("overall_level"), levelId: Id }),
  obj({ kind: z.literal("capability_band"), band: z.enum(["low", "mid", "high"]) }),
  obj({ kind: z.literal("dominant_style"), styleId: Id }),
  obj({ kind: z.literal("skill_level"), skillId: Id, levelId: Id }),
  obj({ kind: z.literal("business_line") }),
  obj({ kind: z.literal("methodology") }),
  obj({ kind: z.literal("not_enough_evidence") }),
]);

/** Config Spec: "Report settings" (12 settings). Rules: docs/scoring-and-report.md sections 5 and 7. */
export const ReportSchema = obj({
  sections: z.array(obj({ id: ReportSection, enabled: z.boolean() })).length(10),
  skillsFramework: obj({
    // TODO(decision): D-08 default framework (iLead default or KNOLSKAPE Skills Ontology).
    source: z.enum(["ilead_default", "knolskape_ontology", "client_upload"]),
    skills: z
      .array(obj({ id: Id, name: Text.min(1), definition: Text.min(1), bandAnchors: perBand(Text.min(1)) }))
      .min(1)
      .max(12),
  }),
  /** Skill id to the action ids whose live interactions observe it. */
  linkage: z.record(Id, z.array(Id).max(20)),
  minObservations: z.int().min(1).max(10),
  ratingScale: z
    .array(obj({ id: Id, label: Text.min(1), colour: HexColour, minScore: Stat }))
    .min(3)
    .max(7),
  /** A Harmful observation caps the skill at this level (docs/scoring-and-report.md 5.4). */
  harmfulCapLevelId: Id,
  anchors: z.record(Id, z.record(Id, Text.min(1))),
  capabilityBands: obj({ midFrom: Stat, highFrom: Stat }),
  narrativeBank: z.array(obj({ id: Id, section: ReportSection, key: NarrativeKey, text: LongText })).max(400),
  evidence: obj({ perSkill: z.int().min(0).max(5), redactNames: z.boolean() }),
  developmentPlan: obj({
    priorities: z.int().min(1).max(5),
    items: z
      .array(
        obj({
          skillId: Id,
          practiceActivity: Text.min(1),
          onTheJobAction: Text.min(1),
          checkInDays: z.int().min(1).max(180),
        }),
      )
      .max(24),
  }),
  audiences: z
    .array(z.enum(["participant", "manager", "ld_admin", "cohort"]))
    .min(1)
    .max(4),
  delivery: z
    .array(z.enum(["in_app", "pdf", "email", "lms_record"]))
    .min(1)
    .max(4),
  branding: z.enum(["same", "report_specific"]),
  // TODO(decision): D-07 positioning; the tier setting exists per the Config Spec, default sample audit.
  humanReview: z.enum(["off", "sample_audit", "full_review"]),
  auditSample: obj({ rate: z.number().min(0).max(1), minPerInteraction: z.int().min(0).max(100) }),
  /** Phrases counted as recognition statements in conversation analytics (descriptive only). */
  recognitionPhrases: z.array(Text.min(1)).max(50),
  methodologyCopy: LongText,
});
export type Report = z.infer<typeof ReportSchema>;
