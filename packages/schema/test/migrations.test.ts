import { describe, expect, it } from "vitest";
import { type Migration, MIGRATIONS, migrateRaw } from "../src/migrations";

const v1 = { meta: { schemaVersion: 1, title: "Old" }, cast: { npcs: [{ id: "kent", mood: 22 }] } };

// A fake history: v2 renames npc "mood" to "morale"; v3 adds a field with a default.
const registry: Migration[] = [
  {
    from: 1,
    to: 2,
    up: (d) => {
      const cast = d.cast as { npcs: { id: string; mood?: number; morale?: number }[] };
      return { ...d, cast: { npcs: cast.npcs.map(({ mood, ...rest }) => ({ ...rest, morale: mood })) } };
    },
  },
  { from: 2, to: 3, up: (d) => ({ ...d, gamification: { celebrations: "subtle" } }) },
];

describe("schema migrations", () => {
  it("runs each step in order and stamps the version", () => {
    const out = migrateRaw(v1, registry, 3);
    expect(out).toEqual({
      meta: { schemaVersion: 3, title: "Old" },
      cast: { npcs: [{ id: "kent", morale: 22 }] },
      gamification: { celebrations: "subtle" },
    });
  });

  it("does not mutate the input", () => {
    const input = structuredClone(v1);
    migrateRaw(input, registry, 3);
    expect(input).toEqual(v1);
  });

  it("is a no op at the current version", () => {
    expect(migrateRaw(v1, MIGRATIONS, 1)).toEqual(v1);
  });

  it("refuses newer documents, gaps and missing versions", () => {
    expect(() => migrateRaw({ meta: { schemaVersion: 4 } }, registry, 3)).toThrow(/newer/);
    expect(() => migrateRaw(v1, [registry[1] as Migration], 3)).toThrow(/No migration from schema 1/);
    expect(() => migrateRaw({ meta: {} }, registry, 3)).toThrow(/schemaVersion/);
  });
});
