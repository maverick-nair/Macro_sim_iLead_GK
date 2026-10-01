import {
  type DraftDocument,
  type JsonPatchOp,
  JsonPatchOpSchema,
  type Lock,
  type SimulationTemplate,
  applyAuthorPatch,
  cloneJson,
  contentHash,
  createDraft,
  createVersionSnapshot,
  issuesByArea,
  markOpened,
  provenanceOf,
  publishableIssues,
  showsAiBadge,
  withPolicyLocks,
} from "@gk/schema";
import { describe, expect, it } from "vitest";
import { iLeadOriginal } from "../src/index";

const at = "2026-10-01T09:00:00.000Z";
const later = "2026-10-01T10:00:00.000Z";
const asha = { id: "u-asha", name: "Asha Rao" };
const admin = { id: "u-priya", name: "Priya Menon" };
const noLocks: Lock[] = [];

const aiDraft = (): DraftDocument => createDraft(iLeadOriginal, "ai", at, "generation");
const patch = (
  draft: DraftDocument,
  ops: JsonPatchOp[],
  locks: Lock[] = noLocks,
  extra: { expectedRevision?: number } = {},
) => applyAuthorPatch(draft, ops, { actor: asha, at: later, locks, ...extra });

describe("drafts and provenance", () => {
  it("starts with one root provenance entry and no reviewed areas", () => {
    const d = createDraft(iLeadOriginal, "seed", at);
    expect(d.fieldMeta).toEqual({ "": { source: "seed", at } });
    expect(Object.values(d.areaState).every((s) => !s.opened && !s.reviewed)).toBe(true);
    expect(d.revision).toBe(0);
  });

  it("clears the AI badge on the edited field only and marks the area reviewed", () => {
    const d = aiDraft();
    expect(showsAiBadge(d.fieldMeta, "/cast/npcs/@kent/persona/openingLines/0")).toBe(true);
    const r = patch(d, [
      { op: "replace", path: "/cast/npcs/0/persona/openingLines/0", value: "Morning. I'm Kent." },
    ]);
    if (!r.ok) throw new Error(r.error.message);
    const meta = r.value.fieldMeta;
    expect(provenanceOf(meta, "/cast/npcs/@kent/persona/openingLines/0")).toEqual({
      source: "author",
      via: "form",
      by: asha,
      at: later,
    });
    expect(showsAiBadge(meta, "/cast/npcs/@kent/persona/openingLines/0")).toBe(false);
    expect(showsAiBadge(meta, "/cast/npcs/@kent/persona/catchphrases")).toBe(true);
    expect(showsAiBadge(meta, "/cast/npcs/@beth/persona/openingLines/0")).toBe(true);
    expect(r.value.areaState.cast).toEqual({
      opened: true,
      reviewed: true,
      reviewedAt: later,
      reviewedBy: asha,
    });
    expect(r.value.areaState.actions.reviewed).toBe(false);
    expect(r.value.revision).toBe(1);
    expect(d.template.cast.npcs[0]?.persona.openingLines[0]).toBe("Hi, I'm Kent. How do you do?");
  });

  it("keeps provenance on the right person when another person is removed", () => {
    let d = aiDraft();
    const edit = patch(d, [
      { op: "replace", path: "/cast/npcs/1/profile/remarks", value: "Keen and fast to learn." },
    ]);
    if (!edit.ok) throw new Error(edit.error.message);
    d = edit.value;
    const removeKent = patch(d, [{ op: "remove", path: "/cast/npcs/0" }]);
    if (!removeKent.ok) throw new Error(removeKent.error.message);
    const after = removeKent.value;
    expect(after.template.cast.npcs[0]?.id).toBe("beth");
    expect(provenanceOf(after.fieldMeta, "/cast/npcs/@beth/profile/remarks")?.source).toBe("author");
    expect(Object.keys(after.fieldMeta).some((k) => k.includes("@kent"))).toBe(false);
    expect(publishableIssues(after.template).map((i) => i.message)).toContain(
      "Team size is 10 but the cast has 9 team members",
    );
  });

  it("records AI regeneration without marking areas reviewed", () => {
    const d = markOpened(createDraft(iLeadOriginal, "seed", at), "events");
    const r = applyAuthorPatch(
      d,
      [{ op: "replace", path: "/events/deck/0/title", value: "A new CRM goes live this week" }],
      {
        actor: asha,
        at: later,
        locks: noLocks,
        source: "ai",
        via: "regenerate",
      },
    );
    if (!r.ok) throw new Error(r.error.message);
    expect(showsAiBadge(r.value.fieldMeta, "/events/deck/@crm-rollout/title")).toBe(true);
    expect(r.value.areaState.events).toEqual({ opened: true, reviewed: false });
  });
});

describe("patch validation", () => {
  const d = aiDraft();

  it("accepts only add, replace and remove", () => {
    expect(JsonPatchOpSchema.safeParse({ op: "move", from: "/a", path: "/b" }).success).toBe(false);
    expect(JsonPatchOpSchema.safeParse({ op: "replace", path: "/time/weeks", value: 6 }).success).toBe(true);
  });

  it("rejects paths that do not exist", () => {
    const a = patch(d, [{ op: "replace", path: "/cast/nope/0", value: 1 }]);
    const b = patch(d, [{ op: "remove", path: "/cast/npcs/99" }]);
    const c = patch(d, [{ op: "replace", path: "cast", value: 1 }]);
    expect([a, b, c].map((r) => (r.ok ? "ok" : r.error.code))).toEqual([
      "INVALID_PATH",
      "INVALID_PATH",
      "INVALID_PATH",
    ]);
  });

  it("rejects writes to system owned fields", () => {
    const r1 = patch(d, [{ op: "replace", path: "/meta/templateId", value: "mine" }]);
    const r2 = patch(d, [{ op: "replace", path: "", value: {} }]);
    expect(r1.ok ? "ok" : r1.error.code).toBe("FORBIDDEN_PATH");
    expect(r2.ok ? "ok" : r2.error.code).toBe("FORBIDDEN_PATH");
    expect(patch(d, [{ op: "replace", path: "/meta/title", value: "Branch leadership" }]).ok).toBe(true);
  });

  it("rejects values the schema does not allow, with the field path", () => {
    const r = patch(d, [{ op: "replace", path: "/cast/npcs/0/stats/skill", value: 150 }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDATION");
    expect(r.error.issues?.map((i) => i.path)).toEqual(["/cast/npcs/0/stats/skill"]);
    const unknown = patch(d, [{ op: "add", path: "/time/overtime", value: true }]);
    expect(unknown.ok ? "ok" : unknown.error.code).toBe("VALIDATION");
  });

  it("applies all operations or none", () => {
    const r = patch(d, [
      { op: "replace", path: "/time/weeks", value: 6 },
      { op: "replace", path: "/time/daysPerWeek", value: 99 },
    ]);
    expect(r.ok).toBe(false);
    expect(d.template.time.weeks).toBe(8);
  });

  it("rejects a stale revision", () => {
    const r = patch(d, [{ op: "replace", path: "/time/weeks", value: 6 }], noLocks, { expectedRevision: 3 });
    expect(r.ok ? "ok" : r.error.code).toBe("REVISION_CONFLICT");
  });
});

describe("admin locks", () => {
  const colours: Lock = { path: "/branding/colours", lockedBy: admin, reason: "Client brand" };
  const kent: Lock = { path: "/cast/npcs/@kent", lockedBy: admin };
  const d = aiDraft();

  it("blocks the locked field, its children and its ancestors, naming the admin", () => {
    const child = patch(
      d,
      [{ op: "replace", path: "/branding/colours/light/primary", value: "#000000" }],
      [colours],
    );
    expect(child.ok).toBe(false);
    if (child.ok) return;
    expect(child.error).toMatchObject({
      code: "LOCKED_BY_ADMIN",
      message: "Locked by Priya Menon",
      lock: colours,
    });
    const parent = patch(d, [{ op: "replace", path: "/branding", value: d.template.branding }], [colours]);
    expect(parent.ok ? "ok" : parent.error.code).toBe("LOCKED_BY_ADMIN");
    expect(patch(d, [{ op: "replace", path: "/branding/media/uiSounds", value: "off" }], [colours]).ok).toBe(
      true,
    );
  });

  it("locks items by id, so moving them does not move the lock", () => {
    expect(patch(d, [{ op: "remove", path: "/cast/npcs/0" }], [kent]).ok).toBe(false);
    expect(patch(d, [{ op: "replace", path: "/cast/npcs/0/identity/name", value: "K" }], [kent]).ok).toBe(
      false,
    );
    expect(
      patch(d, [{ op: "replace", path: "/cast/npcs/1/identity/name", value: "Bethany Killiney" }], [kent]).ok,
    ).toBe(true);
    const newcomer = cloneJson(d.template.cast.npcs[1]);
    if (!newcomer) throw new Error("no npc");
    newcomer.id = "newcomer";
    const inserted = patch(d, [{ op: "add", path: "/cast/npcs/0", value: newcomer }], [kent]);
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    expect(inserted.value.template.cast.npcs[1]?.id).toBe("kent");
    expect(
      patch(inserted.value, [{ op: "replace", path: "/cast/npcs/1/identity/name", value: "K" }], [kent]).ok,
    ).toBe(false);
  });

  it("mirrors org policy locks into the build", () => {
    const t = withPolicyLocks(iLeadOriginal, { locks: [colours] });
    expect(t.governance.locks).toEqual([colours]);
    expect(iLeadOriginal.governance.locks).toEqual([]);
  });
});

describe("version snapshots", () => {
  it("freezes a publishable draft with a content hash", () => {
    const r = createVersionSnapshot(createDraft(iLeadOriginal, "seed", at), {
      versionName: "v1",
      changeNote: "First release",
      engineVersion: "0.1.0",
      publishedBy: asha,
      publishedAt: later,
    });
    if (!r.ok) throw new Error(r.issues.map((i) => i.message).join("; "));
    const s = r.snapshot;
    expect(s.contentHash).toBe(contentHash(s.template));
    expect(Object.isFrozen(s.template.cast.npcs[0]?.stats)).toBe(true);
    expect(() => {
      (s.template.meta as { title: string }).title = "Changed";
    }).toThrow(TypeError);
  });

  it("refuses a draft with publish issues", () => {
    const t = cloneJson(iLeadOriginal);
    t.cast.roster.teamSize = 9;
    const r = createVersionSnapshot(createDraft(t, "seed", at), {
      versionName: "v1",
      changeNote: "",
      engineVersion: "0.1.0",
      publishedBy: asha,
      publishedAt: later,
    });
    expect(r.ok).toBe(false);
  });
});

describe("publishable rules", () => {
  const cases: [string, (t: SimulationTemplate) => void, string][] = [
    ["duplicate NPC id", (t) => void (t.cast.npcs[1]!.id = "kent"), 'Duplicate NPC id "kent"'],
    [
      "missing role fit",
      (t) => void delete t.cast.npcs[0]!.stats!.roleFit["qualify"],
      'Kent Goldberg has no role fit for stage "qualify"',
    ],
    [
      "stage over capacity",
      (t) => void (t.cast.npcs[2]!.profile.roleId = "sales-lead"),
      'Stage "Sales lead" has 3 members; the maximum is 2',
    ],
    [
      "partial Trust",
      (t) => void delete t.cast.npcs[0]!.stats!.trust,
      "Starting Trust must be set for every team member or for none",
    ],
    [
      "throughput weights",
      (t) => void (t.process.throughput.weights.skill = 0.5),
      "Throughput weights must add up to 1",
    ],
    [
      "band gap",
      (t) => void (t.leadership.readinessBands[0]!.skill = [0, 40]),
      "Skill 41 and Morale 0 fall in 0 bands; each pair needs exactly one",
    ],
    [
      "unknown style in fit matrix",
      (t) => void (t.leadership.fitMatrix["low-skill-low-morale"] = "commanding"),
      'Unknown style "commanding"',
    ],
    [
      "one style tagged option",
      (t) => void t.actions.catalogue.find((a) => a.id === "coach-member")!.options.splice(1),
      "Coach member needs 2 to 4 style tagged options",
    ],
    [
      "team scope with targets",
      (t) => void (t.actions.catalogue.find((a) => a.id === "energize-the-team")!.limits.maxTargets = 1),
      "Team actions target the whole team, so maximum targets must be 0",
    ],
    [
      "live action without design",
      (t) => void delete t.actions.catalogue.find((a) => a.id === "coach-member")!.interaction,
      "Coach member is live and needs an interaction design",
    ],
    [
      "escalation without window",
      (t) => void delete t.events.deck.find((e) => e.id === "kent-personal")!.responseWindowDays,
      "An escalation needs a response window",
    ],
    ["event after the last week", (t) => void (t.time.weeks = 1), "Week 2 is after the last week"],
    ["score weights", (t) => void (t.gamification.weights.business = 10), "Score weights must add up to 100"],
    ["tiers not rising", (t) => void (t.gamification.tiers[2]!.min = 400), "Tier thresholds must rise"],
    ["missing report section", (t) => void t.report.sections.pop(), 'Missing section "methodology"'],
    [
      "too few observations",
      (t) => void (t.report.linkage["results-ownership"] = ["set-goals"]),
      '"Results ownership" is observed in 1 interactions; it needs at least 2',
    ],
    [
      "missing anchor",
      (t) => void delete t.report.anchors["giving-feedback"]!["novice"],
      '"Giving feedback" has no anchor for level "Novice"',
    ],
    [
      "duplicate lock",
      (t) =>
        void (t.governance.locks = [
          { path: "/branding", lockedBy: admin },
          { path: "/branding", lockedBy: admin },
        ]),
      'Duplicate lock path "/branding"',
    ],
  ];

  it.each(cases)("catches %s", (_name, mutate, message) => {
    const t = cloneJson(iLeadOriginal);
    mutate(t);
    expect(publishableIssues(t).map((i) => i.message)).toContain(message);
  });

  it("groups issues by area", () => {
    const t = cloneJson(iLeadOriginal);
    t.gamification.weights.business = 10;
    t.process.throughput.weights.skill = 0.5;
    expect(Object.keys(issuesByArea(publishableIssues(t))).sort()).toEqual(["gamification", "process"]);
  });
});
