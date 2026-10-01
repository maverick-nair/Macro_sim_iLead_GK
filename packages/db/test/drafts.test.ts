import { applyAuthorPatch, createVersionSnapshot } from "@gk/schema";
import { iLeadOriginal } from "@gk/seed-ilead";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Db, createPrisma } from "../src/client";
import { createProductWithDraft, loadDraft, publishVersion, saveDraft } from "../src/drafts";

const skip = process.env.GK_SKIP_DB_TESTS === "1";
const at = "2026-10-01T09:00:00.000Z";

describe.skipIf(skip)("draft repository (Postgres)", () => {
  let db: Db;
  let orgId: string;
  const author = { id: "", name: "Asha Rao" };

  beforeAll(async () => {
    db = createPrisma(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);
    const suffix = Math.random().toString(36).slice(2, 10);
    const org = await db.org.create({ data: { name: "KNOLSKAPE", slug: `test-${suffix}` } });
    orgId = org.id;
    const user = await db.user.create({ data: { email: `asha-${suffix}@example.com`, name: author.name } });
    author.id = user.id;
    await db.membership.create({ data: { orgId, userId: user.id, role: "author" } });
  });

  afterAll(async () => {
    await db.org.delete({ where: { id: orgId } });
    await db.user.delete({ where: { id: author.id } });
    await db.$disconnect();
  });

  const newProduct = () =>
    createProductWithDraft(db, {
      orgId,
      kind: "business_sim",
      format: "ilead",
      title: "Branch leadership",
      createdBy: author,
      template: iLeadOriginal,
      source: "seed",
      at,
    });

  it("round trips the seed through a draft", async () => {
    const { productId } = await newProduct();
    const draft = await loadDraft(db, productId);
    expect(draft?.template).toEqual(iLeadOriginal);
    expect(draft?.revision).toBe(0);
    expect(draft?.fieldMeta).toEqual({ "": { source: "seed", at } });
  });

  it("saves an author edit and rejects a stale save", async () => {
    const { productId } = await newProduct();
    const draft = await loadDraft(db, productId);
    if (!draft) throw new Error("no draft");
    const edit = applyAuthorPatch(draft, [{ op: "replace", path: "/time/weeks", value: 6 }], {
      actor: author,
      at,
      locks: [],
      expectedRevision: 0,
    });
    if (!edit.ok) throw new Error(edit.error.message);
    expect(await saveDraft(db, productId, edit.value, 0, author)).toEqual({ ok: true });
    expect(await saveDraft(db, productId, edit.value, 0, author)).toEqual({
      ok: false,
      code: "REVISION_CONFLICT",
    });
    const reloaded = await loadDraft(db, productId);
    expect(reloaded?.template.time.weeks).toBe(6);
    expect(reloaded?.revision).toBe(1);
    expect(reloaded?.areaState.time.reviewed).toBe(true);
  });

  it("publishes immutable numbered versions and sets the live version", async () => {
    const { productId } = await newProduct();
    const draft = await loadDraft(db, productId);
    if (!draft) throw new Error("no draft");
    const snap = createVersionSnapshot(draft, {
      versionName: "v1",
      changeNote: "First",
      engineVersion: "0.1.0",
      publishedBy: author,
      publishedAt: at,
    });
    if (!snap.ok) throw new Error("not publishable");
    const v1 = await publishVersion(db, productId, snap.snapshot);
    const v2 = await publishVersion(db, productId, snap.snapshot);
    expect([v1.versionNumber, v2.versionNumber]).toEqual([1, 2]);
    const product = await db.product.findUniqueOrThrow({
      where: { id: productId },
      include: { liveVersion: true },
    });
    expect(product.status).toBe("published");
    expect(product.liveVersion?.contentHash).toBe(snap.snapshot.contentHash);
    expect(product.liveVersion?.template).toEqual(snap.snapshot.template);
  });
});
