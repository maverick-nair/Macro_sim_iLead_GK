import type { Prisma, ProductKind } from "@prisma/client";
import {
  type Actor,
  type DraftDocument,
  DraftDocumentSchema,
  type Provenance,
  type SimulationTemplate,
  type VersionSnapshot,
  createDraft,
  migrateTemplate,
} from "@gk/schema";
import type { Db } from "./client";

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export interface NewProductInput {
  orgId: string;
  kind: ProductKind;
  format?: string;
  title: string;
  client?: string;
  createdBy: Actor;
  template: SimulationTemplate;
  /** Provenance for every field: "seed" for Start from the iLead original, "ai" after generation. */
  source: Provenance["source"];
  at: string;
}

/** Creates a product with its working draft (Screens E5 "Start building"). */
export async function createProductWithDraft(
  db: Db,
  input: NewProductInput,
): Promise<{ productId: string; draftId: string }> {
  const draft = createDraft(input.template, input.source, input.at);
  const product = await db.product.create({
    data: {
      orgId: input.orgId,
      kind: input.kind,
      format: input.format ?? null,
      title: input.title,
      client: input.client ?? null,
      createdById: input.createdBy.id,
      draft: {
        create: {
          template: json(draft.template),
          fieldMeta: json(draft.fieldMeta),
          areaState: json(draft.areaState),
          revision: draft.revision,
          schemaVersion: draft.template.meta.schemaVersion,
          updatedById: input.createdBy.id,
        },
      },
    },
    include: { draft: { select: { id: true } } },
  });
  if (!product.draft) throw new Error("Draft was not created");
  return { productId: product.id, draftId: product.draft.id };
}

/** Loads a draft, migrating the template to the current schema version on read (plan 4.2). */
export async function loadDraft(db: Db, productId: string): Promise<DraftDocument | null> {
  const row = await db.draft.findUnique({ where: { productId } });
  if (!row) return null;
  return DraftDocumentSchema.parse({
    template: migrateTemplate(row.template),
    fieldMeta: row.fieldMeta,
    areaState: row.areaState,
    revision: row.revision,
  });
}

export type SaveResult = { ok: true } | { ok: false; code: "REVISION_CONFLICT" | "NOT_FOUND" };

/** Saves a draft only if nobody saved since `expectedRevision` (optimistic concurrency). */
export async function saveDraft(
  db: Db,
  productId: string,
  next: DraftDocument,
  expectedRevision: number,
  by: Actor,
): Promise<SaveResult> {
  const doc = DraftDocumentSchema.parse(next);
  const res = await db.draft.updateMany({
    where: { productId, revision: expectedRevision },
    data: {
      template: json(doc.template),
      fieldMeta: json(doc.fieldMeta),
      areaState: json(doc.areaState),
      revision: doc.revision,
      schemaVersion: doc.template.meta.schemaVersion,
      updatedById: by.id,
    },
  });
  if (res.count === 1) return { ok: true };
  const exists = await db.draft.count({ where: { productId } });
  return { ok: false, code: exists === 0 ? "NOT_FOUND" : "REVISION_CONFLICT" };
}

/** Stores an immutable version and makes it live (Screens P4). */
export async function publishVersion(
  db: Db,
  productId: string,
  snapshot: VersionSnapshot,
): Promise<{ versionId: string; versionNumber: number }> {
  return db.$transaction(async (tx) => {
    const last = await tx.templateVersion.aggregate({ where: { productId }, _max: { versionNumber: true } });
    const versionNumber = (last._max.versionNumber ?? 0) + 1;
    const v = await tx.templateVersion.create({
      data: {
        productId,
        versionNumber,
        versionName: snapshot.versionName,
        changeNote: snapshot.changeNote,
        template: json(snapshot.template),
        schemaVersion: snapshot.schemaVersion,
        engineVersion: snapshot.engineVersion,
        contentHash: snapshot.contentHash,
        publishedById: snapshot.publishedBy.id,
        publishedAt: new Date(snapshot.publishedAt),
      },
    });
    await tx.product.update({ where: { id: productId }, data: { liveVersionId: v.id, status: "published" } });
    return { versionId: v.id, versionNumber };
  });
}
