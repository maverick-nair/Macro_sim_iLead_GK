import { z } from "zod";
import { type Lock, LockSchema } from "./areas/governance";
import { pathsOverlap } from "./pointer";
import type { SimulationTemplate } from "./template";

/**
 * Org level policy set by a client admin (Config Spec: "Locked by admin"). Lock paths are stable paths
 * (see pointer.ts). Defaults per the Config Spec: brand colours and the skills framework.
 */
export const OrgPolicySchema = z.strictObject({ locks: z.array(LockSchema).max(200) });
export type OrgPolicy = z.infer<typeof OrgPolicySchema>;

export const DEFAULT_LOCK_PATHS = ["/branding/colours", "/report/skillsFramework"] as const;

/** The lock that blocks writing at this stable path: a lock on the path, an ancestor, or a descendant. */
export function findBlockingLock(locks: readonly Lock[], stablePath: string): Lock | undefined {
  return locks.find((l) => pathsOverlap(l.path, stablePath));
}

/** Copies org locks into the build's read only mirror (A-23). */
export function withPolicyLocks(template: SimulationTemplate, policy: OrgPolicy): SimulationTemplate {
  return { ...template, governance: { ...template.governance, locks: policy.locks.map((l) => ({ ...l })) } };
}
