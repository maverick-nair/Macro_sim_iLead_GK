import { z } from "zod";
import { Text, obj } from "../primitives";

export const ROLES = ["admin", "author", "reviewer", "facilitator", "viewer"] as const;
export const Role = z.enum(ROLES);

/** JSON Pointer into the SimulationTemplate, e.g. "/branding/colours". */
export const Pointer = z.string().regex(/^(\/[^/]*)*$/, "Use a JSON Pointer such as /branding/colours");

export const LockSchema = obj({
  path: Pointer,
  lockedBy: obj({ id: z.string().min(1), name: Text.min(1) }),
  reason: Text.optional(),
});
export type Lock = z.infer<typeof LockSchema>;

/** Config Spec: "Governance" (6 settings). */
export const GovernanceSchema = obj({
  /** Which roles take part in this build ("All roles" by default); people are assigned per build in the database. */
  roles: z.array(Role).min(1).max(5),
  /** Read only mirror of org policy locks for this build (A-23). */
  locks: z.array(LockSchema).max(200),
  approval: obj({
    enabled: z.boolean(),
    // TODO(decision): D-04 who may approve the Report area.
    reportApprover: z.enum(["any_reviewer", "ld_lead"]),
    // TODO(decision): D-13 whether playtest sign off blocks publish.
    requirePlaytestSignOff: z.boolean(),
  }),
  versioning: obj({ enabled: z.boolean() }),
  templates: obj({ enabled: z.boolean() }),
  useDeclaration: z.enum(["development", "selection"]),
});
export type Governance = z.infer<typeof GovernanceSchema>;
