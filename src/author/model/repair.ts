import type { z } from 'zod';
import { AuthorDraft } from './draft';

/**
 * Keeps the author's work when the stored draft no longer parses (D120). A field over its limit is
 * cut to the limit, a list over its limit loses its tail, and anything else that fails puts that one
 * top level section back to its default, so one bad value never costs the whole draft. `clampDraft`
 * does only the cutting, in place, and runs on every edit so the draft always saves in a shape that
 * reads back.
 */

type Path = ReadonlyArray<PropertyKey>;

function parentOf(root: unknown, path: Path): Record<PropertyKey, unknown> | null {
  let at: unknown = root;
  for (const k of path.slice(0, -1)) {
    if (at === null || typeof at !== 'object') return null;
    at = (at as Record<PropertyKey, unknown>)[k];
  }
  return at !== null && typeof at === 'object' ? (at as Record<PropertyKey, unknown>) : null;
}

/** Cuts a string or list over its maximum at `issue.path`. True when it changed something. */
function cut(root: unknown, issue: z.core.$ZodIssue): boolean {
  if (issue.code !== 'too_big' || issue.path.length === 0) return false;
  const parent = parentOf(root, issue.path);
  const key = issue.path[issue.path.length - 1];
  if (!parent) return false;
  const v = parent[key];
  const max = Number(issue.maximum);
  if (!Number.isFinite(max)) return false;
  if (typeof v === 'string' && v.length > max) { parent[key] = v.slice(0, max); return true; }
  if (Array.isArray(v) && v.length > max) { parent[key] = v.slice(0, max); return true; }
  return false;
}

/** Cuts every string and list over its limit, in place. Cheap when the draft already parses. */
export function clampDraft(d: AuthorDraft): AuthorDraft {
  for (let i = 0; i < 4; i++) {
    const r = AuthorDraft.safeParse(d);
    if (r.success) return d;
    if (!r.error.issues.map(x => cut(d, x)).some(Boolean)) return d;
  }
  return d;
}

/**
 * Repairs a stored value that fails the schema: cuts what is too long and puts each section that
 * still fails back to `fallback`'s. Null when the value is not a draft at all (not an object, or a
 * different version).
 */
export function repairDraft(raw: unknown, fallback: () => AuthorDraft): AuthorDraft | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw) || (raw as { v?: unknown }).v !== 1) return null;
  const v = structuredClone(raw) as Record<string, unknown>;
  let fresh: AuthorDraft | null = null;
  for (let i = 0; i < 8; i++) {
    const r = AuthorDraft.safeParse(v);
    if (r.success) return r.data;
    for (const issue of r.error.issues) {
      if (cut(v, issue)) continue;
      const section = issue.path[0];
      if (typeof section !== 'string' || !(section in AuthorDraft.shape)) return null;
      fresh ??= fallback();
      v[section] = structuredClone(fresh[section as keyof AuthorDraft]);
    }
  }
  return null;
}
