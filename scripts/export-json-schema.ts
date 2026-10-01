/**
 * Writes the SimulationTemplate JSON Schema (draft 2020-12) to packages/schema/generated.
 * Run after any schema change: `pnpm schema:export`. A test fails while the committed file is stale.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { templateJsonSchema } from "@gk/schema";

const out = fileURLToPath(
  new URL("../packages/schema/generated/simulation-template.schema.json", import.meta.url),
);
writeFileSync(out, JSON.stringify(templateJsonSchema(), null, 2) + "\n");
console.log(`Wrote ${out}`);
