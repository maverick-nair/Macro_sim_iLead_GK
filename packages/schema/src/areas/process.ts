import { z } from "zod";
import { DIALS, Id, Stat, Text, obj } from "../primitives";

export const StageSchema = obj({
  id: Id,
  name: Text.min(1),
  icon: Text.min(1),
  tooltip: Text,
  idealPerWeek: z.number().min(0).max(1000),
  maxMembers: z.int().min(1).max(4),
  /** Parallel or branching stages: the stage this one splits from (Config Spec, default linear). */
  branchOf: Id.optional(),
});

/** Config Spec: "Team structure, process, targets and KPIs" (15 settings). */
export const ProcessSchema = obj({
  type: z.enum(["sales_funnel", "service_flow", "operations_line", "project_delivery", "custom"]),
  stages: z.array(StageSchema).min(3).max(7),
  workUnit: z.enum(["lead", "order", "ticket", "patient", "case", "task"]),
  // TODO(decision): D-11 funnel conversion formula. Weights and reference productivity are editable; seed uses A-25.
  throughput: obj({
    weights: obj({
      skill: z.number().min(0).max(1),
      morale: z.number().min(0).max(1),
      result: z.number().min(0).max(1),
    }),
    referenceProductivity: z.number().min(0.05).max(1),
  }),
  bottleneck: obj({ stageCapacity: z.boolean(), carryOver: z.boolean() }),
  branching: obj({ enabled: z.boolean() }),
  targets: obj({
    primary: obj({
      kind: z.enum(["revenue", "units", "sla_pct", "nps", "cases_resolved"]),
      value: z.number().min(0),
    }),
    valuePerUnit: z.number().min(0),
    secondary: z.array(z.enum(["team_skill", "morale", "performance", "attrition", "quality"])).max(3),
    kpiDials: z.array(z.enum(DIALS)).min(3).max(5),
    kpiLabels: obj({
      skill: Text.optional(),
      morale: Text.optional(),
      result: Text.optional(),
      trust: Text.optional(),
      engagement: Text.optional(),
      quality: Text.optional(),
      safety: Text.optional(),
    }),
    weeklyDrift: obj({ morale: z.int().min(0).max(20), result: z.int().min(0).max(20) }),
    winCondition: obj({
      kind: z.enum(["hit_target", "target_and_morale", "best_score"]),
      moraleFloor: Stat.optional(),
    }),
  }),
});
export type Process = z.infer<typeof ProcessSchema>;
