import { cloneJson } from "./clone";
import { z } from "zod";
import type { Lock } from "./areas/governance";
import {
  type Actor,
  type DraftDocument,
  type Provenance,
  areaOfPath,
  clearProvenance,
  setProvenance,
} from "./envelope";
import { findBlockingLock } from "./locks";
import { formatPointer, getAt, isPrefixPath, parsePointer, toStablePath } from "./pointer";
import { type AreaKey, TemplateSchema } from "./template";

/** RFC 6902 subset used by autosave, copilot proposals and regeneration. */
export const JsonPatchOpSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("add"), path: z.string(), value: z.unknown() }),
  z.strictObject({ op: z.literal("replace"), path: z.string(), value: z.unknown() }),
  z.strictObject({ op: z.literal("remove"), path: z.string() }),
]);
export type JsonPatchOp = z.infer<typeof JsonPatchOpSchema>;

export type PatchErrorCode =
  "INVALID_PATH" | "FORBIDDEN_PATH" | "LOCKED_BY_ADMIN" | "VALIDATION" | "REVISION_CONFLICT";

export interface PatchError {
  code: PatchErrorCode;
  message: string;
  path?: string;
  lock?: Lock;
  issues?: { path: string; message: string }[];
}

export type PatchResult<T> = { ok: true; value: T } | { ok: false; error: PatchError };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Applies JSON Patch operations to a copy of the document. The input is never mutated. */
export function applyJsonPatch<T>(doc: T, ops: readonly JsonPatchOp[]): PatchResult<T> {
  const out = cloneJson(doc) as unknown;
  for (const op of ops) {
    let segs: string[];
    try {
      segs = parsePointer(op.path);
    } catch {
      return {
        ok: false,
        error: { code: "INVALID_PATH", message: `Invalid path "${op.path}"`, path: op.path },
      };
    }
    if (segs.length === 0)
      return {
        ok: false,
        error: { code: "FORBIDDEN_PATH", message: "The whole document cannot be replaced", path: op.path },
      };
    const parent = getAt(out, formatPointer(segs.slice(0, -1)));
    const last = segs[segs.length - 1] as string;
    const fail = (message: string): PatchResult<T> => ({
      ok: false,
      error: { code: "INVALID_PATH", message, path: op.path },
    });

    if (Array.isArray(parent)) {
      if (op.op === "add") {
        const i = last === "-" ? parent.length : Number(last);
        if (!Number.isInteger(i) || i < 0 || i > parent.length)
          return fail(`Index "${last}" is out of range`);
        parent.splice(i, 0, cloneJson(op.value));
      } else {
        const i = Number(last);
        if (!Number.isInteger(i) || i < 0 || i >= parent.length)
          return fail(`Index "${last}" is out of range`);
        if (op.op === "replace") parent[i] = cloneJson(op.value);
        else parent.splice(i, 1);
      }
    } else if (isRecord(parent)) {
      const exists = Object.prototype.hasOwnProperty.call(parent, last);
      if (op.op === "add") parent[last] = cloneJson(op.value);
      else if (!exists) return fail(`Nothing at "${op.path}" to ${op.op}`);
      else if (op.op === "replace") parent[last] = cloneJson(op.value);
      else delete parent[last];
    } else return fail(`The parent of "${op.path}" does not exist`);
  }
  return { ok: true, value: out as T };
}

/** Meta fields an author may edit; the rest are owned by the system. */
const EDITABLE_META = new Set(["/meta/title", "/meta/client"]);

export interface AuthorPatchOptions {
  actor: Actor;
  at: string;
  via?: NonNullable<Provenance["via"]>;
  /** Org policy locks (stable paths). */
  locks: readonly Lock[];
  /** Optimistic concurrency: the revision the client edited. */
  expectedRevision?: number;
  /** Provenance source to record. Defaults to author; generators pass "ai". */
  source?: Provenance["source"];
}

/**
 * Applies an author's edit to a draft: checks revision and admin locks, applies the patch, validates the whole
 * template, flips provenance on the touched fields, marks touched areas reviewed and bumps the revision.
 */
export function applyAuthorPatch(
  draft: DraftDocument,
  ops: readonly JsonPatchOp[],
  opts: AuthorPatchOptions,
): PatchResult<DraftDocument> {
  if (opts.expectedRevision !== undefined && opts.expectedRevision !== draft.revision)
    return {
      ok: false,
      error: {
        code: "REVISION_CONFLICT",
        message: `Draft is at revision ${draft.revision}, not ${opts.expectedRevision}`,
      },
    };

  const touched: { op: JsonPatchOp["op"]; stableBefore: string }[] = [];
  let working: unknown = draft.template;
  for (const op of ops) {
    try {
      parsePointer(op.path);
    } catch {
      return {
        ok: false,
        error: { code: "INVALID_PATH", message: `Invalid path "${op.path}"`, path: op.path },
      };
    }
    if (op.path === "")
      return {
        ok: false,
        error: { code: "FORBIDDEN_PATH", message: "The whole document cannot be replaced", path: op.path },
      };
    if (parsePointer(op.path)[0] === "meta" && !EDITABLE_META.has(op.path))
      return {
        ok: false,
        error: { code: "FORBIDDEN_PATH", message: `"${op.path}" is managed by GenieKreator`, path: op.path },
      };
    const locked = (lock: Lock): PatchResult<DraftDocument> => ({
      ok: false,
      error: { code: "LOCKED_BY_ADMIN", message: `Locked by ${lock.lockedBy.name}`, path: op.path, lock },
    });
    if (op.op === "add") {
      // Adding is blocked by a lock on the parent or above; a lock on a sibling item does not block it.
      const parentStable = toStablePath(working, formatPointer(parsePointer(op.path).slice(0, -1)));
      const above = opts.locks.find((l) => isPrefixPath(l.path, parentStable));
      if (above) return locked(above);
    } else {
      const lock = findBlockingLock(opts.locks, toStablePath(working, op.path));
      if (lock) return locked(lock);
    }
    const stableBefore = toStablePath(working, op.path);
    const step = applyJsonPatch(working, [op]);
    if (!step.ok) return step;
    working = step.value;
    const stable = op.op === "add" ? toStablePath(working, op.path) : stableBefore;
    if (op.op === "add") {
      const lock = findBlockingLock(opts.locks, stable);
      if (lock) return locked(lock);
    }
    touched.push({ op: op.op, stableBefore: stable });
  }

  const parsed = TemplateSchema.safeParse(working);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "The change does not fit the template",
        issues: parsed.error.issues.map((i) => ({
          path: formatPointer(i.path.map((p) => String(p))),
          message: i.message,
        })),
      },
    };

  const provenance: Provenance = {
    source: opts.source ?? "author",
    via: opts.via ?? "form",
    by: opts.actor,
    at: opts.at,
  };
  let meta = draft.fieldMeta;
  const areas = new Set<AreaKey>();
  for (const t of touched) {
    meta =
      t.op === "remove"
        ? clearProvenance(meta, t.stableBefore)
        : setProvenance(meta, t.stableBefore, provenance);
    const area = areaOfPath(t.stableBefore);
    if (area) areas.add(area);
  }

  const areaState = { ...draft.areaState };
  if ((opts.source ?? "author") === "author")
    for (const a of areas)
      areaState[a] = { opened: true, reviewed: true, reviewedAt: opts.at, reviewedBy: opts.actor };

  return {
    ok: true,
    value: { template: parsed.data, fieldMeta: meta, areaState, revision: draft.revision + 1 },
  };
}
