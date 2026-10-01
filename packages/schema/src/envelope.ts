import { z } from "zod";
import { isPrefixPath, parsePointer } from "./pointer";
import {
  AREA_KEYS,
  type AreaKey,
  AreaKey as AreaKeySchema,
  type SimulationTemplate,
  TemplateSchema,
} from "./template";

/**
 * Where a field's value came from (Config Spec, "How each setting gets its value").
 * seed: the iLead original; ai: generated from the brief; author: edited by a person.
 */
export const ProvenanceSchema = z.strictObject({
  source: z.enum(["seed", "ai", "author"]),
  via: z.enum(["form", "copilot", "regenerate", "generation", "duplicate"]).optional(),
  generator: z
    .strictObject({ area: AreaKeySchema, promptId: z.string(), promptVersion: z.string(), runId: z.string() })
    .optional(),
  by: z.strictObject({ id: z.string(), name: z.string() }).optional(),
  at: z.iso.datetime(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** Stable path to provenance. The most specific ancestor entry applies to a field (see provenanceOf). */
export const FieldMetaSchema = z.record(z.string(), ProvenanceSchema);
export type FieldMeta = z.infer<typeof FieldMetaSchema>;

/** Reviewed and attention are stored separately (A-29). Attention reasons are computed, not stored. */
export const AreaStateSchema = z.strictObject({
  opened: z.boolean(),
  reviewed: z.boolean(),
  reviewedAt: z.iso.datetime().optional(),
  reviewedBy: z.strictObject({ id: z.string(), name: z.string() }).optional(),
});
export type AreaState = z.infer<typeof AreaStateSchema>;

export const DraftDocumentSchema = z.strictObject({
  template: TemplateSchema,
  fieldMeta: FieldMetaSchema,
  areaState: z.record(AreaKeySchema, AreaStateSchema),
  revision: z.int().min(0),
});
export type DraftDocument = z.infer<typeof DraftDocumentSchema>;

export interface Actor {
  id: string;
  name: string;
}

const emptyAreaState = (): Record<AreaKey, AreaState> =>
  Object.fromEntries(AREA_KEYS.map((k) => [k, { opened: false, reviewed: false }])) as Record<
    AreaKey,
    AreaState
  >;

/** Creates the working draft for a new build. One root provenance entry covers every field. */
export function createDraft(
  template: SimulationTemplate,
  source: Provenance["source"],
  at: string,
  via?: Provenance["via"],
): DraftDocument {
  return {
    template: TemplateSchema.parse(template),
    fieldMeta: { "": { source, at, ...(via ? { via } : {}) } },
    areaState: emptyAreaState(),
    revision: 0,
  };
}

/** Provenance that applies to a stable path: the entry for the path itself or its nearest ancestor. */
export function provenanceOf(meta: FieldMeta, stablePath: string): Provenance | undefined {
  let best: { len: number; p: Provenance } | undefined;
  for (const [path, p] of Object.entries(meta)) {
    if (isPrefixPath(path, stablePath)) {
      const len = parsePointer(path).length;
      if (!best || len > best.len) best = { len, p };
    }
  }
  return best?.p;
}

/** True when the field shows the AI badge (Screens doc: "fields show an AI badge until the author edits them"). */
export const showsAiBadge = (meta: FieldMeta, stablePath: string): boolean =>
  provenanceOf(meta, stablePath)?.source === "ai";

/** Records new provenance for a stable path, dropping entries underneath it that the write replaced. */
export function setProvenance(meta: FieldMeta, stablePath: string, p: Provenance): FieldMeta {
  const next: FieldMeta = {};
  for (const [path, v] of Object.entries(meta))
    if (!(isPrefixPath(stablePath, path) && path !== stablePath)) next[path] = v;
  next[stablePath] = p;
  return next;
}

/** Removes provenance for a deleted path and everything under it. */
export function clearProvenance(meta: FieldMeta, stablePath: string): FieldMeta {
  const next: FieldMeta = {};
  for (const [path, v] of Object.entries(meta)) if (!isPrefixPath(stablePath, path)) next[path] = v;
  return next;
}

/** The area a pointer belongs to, or undefined for meta and the root. */
export function areaOfPath(pointer: string): AreaKey | undefined {
  const first = parsePointer(pointer)[0];
  return (AREA_KEYS as readonly string[]).includes(first ?? "") ? (first as AreaKey) : undefined;
}

/** Screens doc: an area counts as reviewed once the author opens it and confirms it, or edits any field in it. */
export function markOpened(draft: DraftDocument, area: AreaKey): DraftDocument {
  const prev = draft.areaState[area] ?? { opened: false, reviewed: false };
  return { ...draft, areaState: { ...draft.areaState, [area]: { ...prev, opened: true } } };
}

export function markReviewed(draft: DraftDocument, area: AreaKey, actor: Actor, at: string): DraftDocument {
  return {
    ...draft,
    areaState: {
      ...draft.areaState,
      [area]: { opened: true, reviewed: true, reviewedAt: at, reviewedBy: actor },
    },
  };
}
