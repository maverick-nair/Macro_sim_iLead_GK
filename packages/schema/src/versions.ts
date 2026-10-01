import { cloneJson } from "./clone";
import type { Actor, DraftDocument } from "./envelope";
import { type PublishIssue, publishableIssues } from "./publishable";
import type { SimulationTemplate } from "./template";

/** JSON with object keys sorted, so equal content always serialises identically. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** 53 bit content fingerprint (cyrb53) for change detection. Not a security hash. */
export function contentHash(value: unknown): string {
  const str = canonicalJson(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/** An immutable published version (Screens P4: "previous versions stay available"). */
export interface VersionSnapshot {
  template: Readonly<SimulationTemplate>;
  schemaVersion: number;
  engineVersion: string;
  versionName: string;
  changeNote: string;
  publishedBy: Actor;
  publishedAt: string;
  contentHash: string;
}

export type SnapshotResult = { ok: true; snapshot: VersionSnapshot } | { ok: false; issues: PublishIssue[] };

/** Freezes the draft's template as a version. Refuses when publishable rules fail. */
export function createVersionSnapshot(
  draft: DraftDocument,
  input: {
    versionName: string;
    changeNote: string;
    engineVersion: string;
    publishedBy: Actor;
    publishedAt: string;
  },
): SnapshotResult {
  const issues = publishableIssues(draft.template);
  if (issues.length > 0) return { ok: false, issues };
  const template = cloneJson(draft.template);
  template.meta.engineVersion = input.engineVersion;
  return {
    ok: true,
    snapshot: deepFreeze({
      template,
      schemaVersion: template.meta.schemaVersion,
      engineVersion: input.engineVersion,
      versionName: input.versionName,
      changeNote: input.changeNote,
      publishedBy: input.publishedBy,
      publishedAt: input.publishedAt,
      contentHash: contentHash(template),
    }),
  };
}
