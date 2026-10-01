import { cloneJson } from "./clone";
import { CURRENT_SCHEMA_VERSION, type SimulationTemplate, TemplateSchema } from "./template";

type RawDoc = Record<string, unknown>;

/** A pure step from one schema version to the next. */
export interface Migration {
  from: number;
  to: number;
  up: (doc: RawDoc) => RawDoc;
}

/** Registered migrations. Empty while the schema is at version 1. */
export const MIGRATIONS: readonly Migration[] = [];

const versionOf = (doc: RawDoc): number => {
  const meta = doc.meta as { schemaVersion?: unknown } | undefined;
  const v = meta?.schemaVersion;
  if (typeof v !== "number" || !Number.isInteger(v)) throw new Error("Template has no schemaVersion");
  return v;
};

/** Runs migrations step by step until the document reaches the target version. */
export function migrateRaw(
  raw: unknown,
  registry: readonly Migration[] = MIGRATIONS,
  target = CURRENT_SCHEMA_VERSION,
): RawDoc {
  let doc = cloneJson(raw) as RawDoc;
  let v = versionOf(doc);
  if (v > target) throw new Error(`Template schema ${v} is newer than this build (${target})`);
  while (v < target) {
    const step = registry.find((m) => m.from === v);
    if (!step || step.to !== v + 1) throw new Error(`No migration from schema ${v}`);
    doc = step.up(doc);
    const meta = (doc.meta ?? {}) as RawDoc;
    doc.meta = { ...meta, schemaVersion: step.to };
    v = step.to;
  }
  return doc;
}

/** Migrates a stored draft or template to the current schema and validates it. */
export function migrateTemplate(
  raw: unknown,
  registry: readonly Migration[] = MIGRATIONS,
): SimulationTemplate {
  return TemplateSchema.parse(migrateRaw(raw, registry));
}
