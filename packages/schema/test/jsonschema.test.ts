import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { templateJsonSchema } from "../src/jsonschema";

const generated = fileURLToPath(new URL("../generated/simulation-template.schema.json", import.meta.url));

describe("JSON Schema export", () => {
  it("matches the committed file (run pnpm schema:export after changing the schema)", () => {
    const committed = JSON.parse(readFileSync(generated, "utf8")) as unknown;
    expect(templateJsonSchema()).toEqual(committed);
  });

  it("is draft 2020-12 with every area required", () => {
    const s = templateJsonSchema() as { $schema: string; required: string[]; additionalProperties: boolean };
    expect(s.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(s.required).toEqual(expect.arrayContaining(["meta", "context", "cast", "report", "governance"]));
    expect(s.additionalProperties).toBe(false);
  });
});
