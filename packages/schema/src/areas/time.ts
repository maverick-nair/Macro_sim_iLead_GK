import { z } from "zod";
import { Text, obj } from "../primitives";

/** Config Spec: "Time, pacing and play modes" (12 settings). */
export const TimeSchema = obj({
  // TODO(decision): D-05 default session model (Full, Standard or Lite; sittings). Seed follows the Config Spec.
  playMode: z.enum(["full", "standard", "lite", "custom"]),
  weeks: z.int().min(2).max(12),
  daysPerWeek: z.int().min(3).max(7),
  timeUnitLabel: Text.min(1),
  // TODO(decision): D-06 live cap 2 per week or author defined. Editable here; seed 2 per week.
  liveCap: obj({
    perWeek: z.int().min(0).max(10),
    perRun: z.int().min(0).max(80).optional(),
    excludeSponsorBriefings: z.boolean(),
  }),
  realTimeLimit: obj({
    kind: z.enum(["off", "total", "per_week"]),
    minutes: z.int().min(1).max(600).optional(),
  }),
  clockPauses: z.array(z.enum(["live", "modals", "reports"])).max(3),
  saveResume: obj({ enabled: z.boolean(), windowDays: z.int().min(1).max(365).optional() }),
  sittings: obj({ count: z.int().min(1).max(4), breakAfterWeeks: z.array(z.int().min(1).max(12)).max(3) }),
  delivery: z.enum(["self_paced", "facilitated", "cohort_sync"]),
  facilitatorControls: z
    .array(z.enum(["pause_cohort", "inject_event", "extend_time", "reset_participant"]))
    .max(4),
  practiceWeek: z.enum(["none", "guided_tour", "week0"]),
});
export type Time = z.infer<typeof TimeSchema>;
