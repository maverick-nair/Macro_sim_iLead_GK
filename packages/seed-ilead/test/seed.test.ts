import {
  PublishableTemplateSchema,
  TemplateSchema,
  collectStrings,
  copyIssues,
  fromStablePath,
  getAt,
  publishableIssues,
  schemaHasPath,
} from "@gk/schema";
import { describe, expect, it } from "vitest";
import { SEED_BASIS, iLeadOriginal } from "../src/index";

/** Gameplay Teardown roster: name, stage, starting Skill, Morale, Result. */
const TEARDOWN_ROSTER = [
  ["Kent Goldberg", "sales-lead", 30, 22, 49],
  ["Beth Killiney", "sales-lead", 25, 73, 45],
  ["Justin Keel", "qualify", 22, 40, 52],
  ["Derick Kaynes", "qualify", 70, 71, 62],
  ["Green Bell", "proposal", 89, 56, 69],
  ["Lowe Rex", "proposal", 80, 45, 67],
  ["Jack Holt", "negotiate", 92, 85, 95],
  ["Peter Higgins", "negotiate", 10, 15, 16],
  ["Ruth Ether", "conversion", 80, 50, 65],
  ["Mandy Lobert", "conversion", 60, 80, 71],
] as const;

describe("iLead original seed", () => {
  it("parses with TemplateSchema", () => {
    const r = TemplateSchema.safeParse(iLeadOriginal);
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });

  it("parses with PublishableTemplateSchema (no publish issues)", () => {
    expect(publishableIssues(iLeadOriginal)).toEqual([]);
    expect(PublishableTemplateSchema.safeParse(iLeadOriginal).success).toBe(true);
  });

  it("has the Teardown roster exactly", () => {
    const team = iLeadOriginal.cast.npcs.filter((n) => n.kind === "team_member");
    expect(
      team.map((n) => [n.identity.name, n.profile.roleId, n.stats?.skill, n.stats?.morale, n.stats?.result]),
    ).toEqual(TEARDOWN_ROSTER.map((r) => [...r]));
    expect(iLeadOriginal.cast.roster.teamSize).toBe(10);
  });

  it("gives each member a home stage role fit equal to their starting stats", () => {
    for (const n of iLeadOriginal.cast.npcs.filter((x) => x.kind === "team_member")) {
      const s = n.stats;
      expect(s?.roleFit[n.profile.roleId], n.id).toEqual({
        skill: s?.skill,
        motivation: s?.morale,
        performance: s?.result,
      });
    }
  });

  it("follows the Teardown process and targets", () => {
    const p = iLeadOriginal.process;
    expect(p.stages.map((s) => [s.name, s.idealPerWeek, s.maxMembers])).toEqual([
      ["Sales lead", 3, 2],
      ["Qualify", 2, 2],
      ["Proposal", 1, 2],
      ["Negotiate", 1, 2],
      ["Conversion", 1, 2],
    ]);
    expect(p.targets.primary).toEqual({ kind: "revenue", value: 240000 });
    expect(p.targets.valuePerUnit).toBe(30000);
    expect(iLeadOriginal.time.weeks).toBe(8);
  });

  it("has the four styles, 15 actions, 10 badges and all 10 report sections", () => {
    expect(iLeadOriginal.leadership.styles.map((s) => s.name)).toEqual([
      "Directing",
      "Guiding",
      "Partnering",
      "Entrusting",
    ]);
    expect(iLeadOriginal.actions.catalogue).toHaveLength(15);
    expect(iLeadOriginal.gamification.badges).toHaveLength(10);
    expect(iLeadOriginal.report.sections).toHaveLength(10);
  });

  it("documents a basis for values that are derived or assumed, at paths that exist", () => {
    const missing = SEED_BASIS.filter((b) => {
      const p = fromStablePath(iLeadOriginal, b.path);
      return p === undefined || getAt(iLeadOriginal, p) === undefined;
    }).map((b) => b.path);
    expect(missing).toEqual([]);
    for (const b of SEED_BASIS)
      expect(schemaHasPath(TemplateSchema, b.path.replace(/@[^/]+/g, "*")), b.path).toBe(true);
  });

  it("follows the copy rules in every string", () => {
    const issues = collectStrings(iLeadOriginal).flatMap((s) =>
      copyIssues(s.text, { words: true, names: /\s/.test(s.text) }).map(
        (i) => `${s.path}: ${i.message} (${i.match})`,
      ),
    );
    expect(issues).toEqual([]);
  });

  it("carries no model ids or secrets", () => {
    const text = JSON.stringify(iLeadOriginal);
    expect(text).not.toMatch(/claude-|sk-ant|api[_-]?key/i);
  });
});
