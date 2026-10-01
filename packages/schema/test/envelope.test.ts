import { describe, expect, it } from "vitest";
import {
  type FieldMeta,
  type Provenance,
  areaOfPath,
  clearProvenance,
  provenanceOf,
  setProvenance,
  showsAiBadge,
} from "../src/envelope";

const at = "2026-10-01T09:00:00.000Z";
const seed: Provenance = { source: "seed", at };
const ai: Provenance = { source: "ai", via: "generation", at };
const author: Provenance = { source: "author", via: "form", by: { id: "u1", name: "Asha" }, at };

describe("provenance", () => {
  const meta: FieldMeta = { "": seed, "/cast": ai, "/cast/npcs/@kent/persona": author };

  it("uses the nearest ancestor entry", () => {
    expect(provenanceOf(meta, "/branding/colours")?.source).toBe("seed");
    expect(provenanceOf(meta, "/cast/npcs/@beth/stats")?.source).toBe("ai");
    expect(provenanceOf(meta, "/cast/npcs/@kent/persona/openingLines/0")?.source).toBe("author");
  });

  it("shows the AI badge only on AI drafted fields", () => {
    expect(showsAiBadge(meta, "/cast/npcs/@kent/stats")).toBe(true);
    expect(showsAiBadge(meta, "/cast/npcs/@kent/persona")).toBe(false);
    expect(showsAiBadge(meta, "/time/weeks")).toBe(false);
  });

  it("drops entries under a path that is written again", () => {
    const next = setProvenance(meta, "/cast/npcs/@kent", ai);
    expect(next["/cast/npcs/@kent/persona"]).toBeUndefined();
    expect(next["/cast/npcs/@kent"]).toEqual(ai);
    expect(next["/cast"]).toEqual(ai);
  });

  it("clears a removed path and its children only", () => {
    const next = clearProvenance(meta, "/cast/npcs/@kent");
    expect(Object.keys(next).sort()).toEqual(["", "/cast"]);
  });

  it("maps paths to areas", () => {
    expect(areaOfPath("/cast/npcs/@kent")).toBe("cast");
    expect(areaOfPath("/meta/title")).toBeUndefined();
    expect(areaOfPath("")).toBeUndefined();
  });
});
