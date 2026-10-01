import { describe, expect, it } from "vitest";
import { collectStrings, copyIssues } from "../src/copy";

const rules = (text: string) => copyIssues(text, { words: true, names: true }).map((i) => i.rule);

describe("copy rules", () => {
  it("flags em and en dashes", () => {
    expect(rules("Plan \u2014 then act")).toEqual(["em_dash"]);
    expect(rules("Weeks 1\u20134")).toEqual(["en_dash"]);
  });

  it("flags hyphens used as punctuation but not minus signs or compound words", () => {
    expect(rules("Plan - then act")).toEqual(["spaced_hyphen"]);
    expect(rules("Plan -- then act")).toEqual(["spaced_hyphen"]);
    expect(rules("P = 50 + (57 - 54)")).toEqual([]);
    expect(rules("A well-run team")).toEqual([]);
  });

  it("says skills, never competency", () => {
    expect(rules("Core competencies")).toEqual(["skills_word"]);
    expect(copyIssues("Core competencies", { words: false })).toEqual([]);
  });

  it("checks product names", () => {
    expect(rules("Genie Kreator and Ilead and AI Roleplay and Dilo")).toEqual([
      "product_name",
      "product_name",
      "product_name",
      "product_name",
    ]);
    expect(rules("GenieKreator builds iLead, AI RolePlay and DILO")).toEqual([]);
    expect(rules("AI RolePlays")).toEqual([]);
  });

  it("collects every string with its pointer", () => {
    expect(collectStrings({ a: ["x", { "b/c": "y" }], n: 1 })).toEqual([
      { path: "/a/0", text: "x" },
      { path: "/a/1/b~1c", text: "y" },
    ]);
  });
});
