import { describe, expect, it } from "vitest";
import { SETTINGS_INVENTORY } from "../src/inventory";
import { schemaHasPath } from "../src/introspect";
import { AREA_KEYS, TemplateSchema } from "../src/template";

const EXPECTED_COUNTS = {
  context: 24,
  branding: 19,
  cast: 40,
  process: 15,
  leadership: 12,
  actions: 31,
  events: 14,
  time: 12,
  gamification: 11,
  report: 12,
  access: 9,
  governance: 6,
};

describe("settings inventory", () => {
  it("has all 205 Config Spec settings, numbered in order", () => {
    expect(SETTINGS_INVENTORY).toHaveLength(205);
    expect(SETTINGS_INVENTORY.map((r) => r.n)).toEqual(Array.from({ length: 205 }, (_, i) => i + 1));
  });

  it("matches the per area counts", () => {
    const counts = Object.fromEntries(
      AREA_KEYS.map((a) => [a, SETTINGS_INVENTORY.filter((r) => r.area === a).length]),
    );
    expect(counts).toEqual(EXPECTED_COUNTS);
  });

  it("resolves every row to schema paths, crossing areas only where listed", () => {
    const unresolved = SETTINGS_INVENTORY.flatMap((r) =>
      r.paths.length === 0
        ? [`${r.n} ${r.setting}: no paths`]
        : r.paths.filter((p) => !schemaHasPath(TemplateSchema, p)).map((p) => `${r.n} ${r.setting}: ${p}`),
    );
    expect(unresolved).toEqual([]);
    // A few settings are listed under one Config Spec area but stored where the data lives (for example
    // portraits under Branding are fields of each NPC, C-08 keeps the style override in Leadership).
    const crossArea = SETTINGS_INVENTORY.flatMap((r) =>
      r.paths.filter((p) => !p.startsWith(`/${r.area}/`) && p !== `/${r.area}`).map((p) => `${r.n}: ${p}`),
    );
    expect(crossArea).toEqual([
      "34: /cast/npcs/*/look/portrait",
      "36: /events/deck/*/image",
      "37: /actions/catalogue/*/icon",
      "37: /process/stages/*/icon",
      "65: /leadership/memberExceptions",
      "108: /actions/catalogue/*/options/*/styleTag",
    ]);
  });

  it("rejects paths the schema does not have", () => {
    expect(schemaHasPath(TemplateSchema, "/cast/npcs/*/stats/skill")).toBe(true);
    expect(schemaHasPath(TemplateSchema, "/cast/npcs/*/stats/charisma")).toBe(false);
    expect(schemaHasPath(TemplateSchema, "/nowhere")).toBe(false);
  });
});
