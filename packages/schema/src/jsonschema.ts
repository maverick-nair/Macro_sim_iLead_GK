import { z } from "zod";
import { TemplateSchema } from "./template";

/** JSON Schema (draft 2020-12) for the SimulationTemplate, generated from the Zod schema. */
export function templateJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(TemplateSchema, {
    target: "draft-2020-12",
    unrepresentable: "throw",
  }) as Record<string, unknown>;
  return {
    $id: "https://geniekreator.knolskape.com/schemas/simulation-template.schema.json",
    title: "GenieKreator SimulationTemplate (iLead)",
    ...schema,
  };
}
