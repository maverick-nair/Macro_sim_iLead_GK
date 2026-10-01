import { cloneJson } from "@gk/schema";
import { iLeadOriginal } from "@gk/seed-ilead";
import { describe, expect, it } from "vitest";
import { validateTemplate } from "../src/validate";

describe("sim validate", () => {
  it("passes the iLead seed", () => {
    const r = validateTemplate("seed:ilead", iLeadOriginal);
    expect(r.ok).toBe(true);
    expect(r.lines.at(-1)).toBe("Publishable: yes");
  });

  it("reports publish issues by area", () => {
    const t = cloneJson(iLeadOriginal);
    t.gamification.weights.business = 10;
    const r = validateTemplate("broken", t);
    expect(r.ok).toBe(false);
    expect(r.lines).toContain("  Gamification           1 to fix");
    expect(r.lines).toContain("    /gamification/weights: Score weights must add up to 100");
  });

  it("reports structural problems with their paths", () => {
    const t = cloneJson(iLeadOriginal) as unknown as { time: { weeks: number } };
    t.time.weeks = 0;
    const r = validateTemplate("broken", t);
    expect(r.ok).toBe(false);
    expect(r.lines.some((l) => l.startsWith("    /time/weeks:"))).toBe(true);
  });

  it("reports copy rule breaks", () => {
    const t = cloneJson(iLeadOriginal);
    t.context.organisation.tagline = "Banking \u2014 simply";
    const r = validateTemplate("broken", t);
    expect(r.ok).toBe(false);
    expect(r.lines).toContain("  Copy rules: 1 to fix");
  });

  it("refuses templates from a newer schema", () => {
    const t = cloneJson(iLeadOriginal);
    t.meta.schemaVersion = 99;
    expect(validateTemplate("future", t).ok).toBe(false);
  });
});
