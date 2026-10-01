import { describe, expect, it } from "vitest";
import {
  formatPointer,
  fromStablePath,
  getAt,
  isPrefixPath,
  parsePointer,
  pathsOverlap,
  toStablePath,
} from "../src/pointer";

const doc = {
  cast: {
    npcs: [
      { id: "kent", stats: { skill: 30 } },
      { id: "beth", stats: { skill: 25 } },
    ],
  },
  tags: ["a", "b"],
  "a/b": { "c~d": 1 },
};

describe("JSON Pointer", () => {
  it("parses and formats with escapes", () => {
    expect(parsePointer("")).toEqual([]);
    expect(parsePointer("/a~1b/c~0d")).toEqual(["a/b", "c~d"]);
    expect(formatPointer(["a/b", "c~d"])).toBe("/a~1b/c~0d");
    expect(getAt(doc, "/a~1b/c~0d")).toBe(1);
    expect(() => parsePointer("cast")).toThrow();
  });

  it("reads values and returns undefined for missing paths", () => {
    expect(getAt(doc, "/cast/npcs/1/stats/skill")).toBe(25);
    expect(getAt(doc, "/cast/npcs/5")).toBeUndefined();
    expect(getAt(doc, "/cast/missing")).toBeUndefined();
  });
});

describe("stable paths", () => {
  it("replaces array indexes with item ids", () => {
    expect(toStablePath(doc, "/cast/npcs/1/stats")).toBe("/cast/npcs/@beth/stats");
    expect(toStablePath(doc, "/tags/1")).toBe("/tags/1");
  });

  it("resolves back after items move", () => {
    const moved = { ...doc, cast: { npcs: [doc.cast.npcs[1], doc.cast.npcs[0]] } };
    expect(fromStablePath(moved, "/cast/npcs/@beth/stats")).toBe("/cast/npcs/0/stats");
    expect(fromStablePath(moved, "/cast/npcs/@nobody")).toBeUndefined();
  });

  it("compares paths by segment, not by string prefix", () => {
    expect(isPrefixPath("/cast/npcs", "/cast/npcs/@kent")).toBe(true);
    expect(isPrefixPath("/cast/npc", "/cast/npcs")).toBe(false);
    expect(isPrefixPath("", "/anything")).toBe(true);
    expect(pathsOverlap("/branding/colours/light", "/branding/colours")).toBe(true);
    expect(pathsOverlap("/branding/colours", "/branding/fonts")).toBe(false);
  });
});
