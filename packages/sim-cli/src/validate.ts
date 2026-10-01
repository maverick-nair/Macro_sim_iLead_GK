import {
  AREAS,
  type PublishIssue,
  SETTINGS_INVENTORY,
  type SimulationTemplate,
  TemplateSchema,
  collectStrings,
  copyIssues,
  issuesByArea,
  migrateRaw,
  publishableIssues,
  schemaHasPath,
} from "@gk/schema";

export interface ValidationReport {
  ok: boolean;
  lines: string[];
}

const fmt = (path: (string | number)[]) => "/" + path.join("/");

/** Structural, publishable and copy checks for one template. Pure: returns lines instead of printing. */
export function validateTemplate(label: string, raw: unknown): ValidationReport {
  const lines: string[] = [`Validating ${label}`];
  let migrated: unknown;
  try {
    migrated = migrateRaw(raw);
  } catch (e) {
    return { ok: false, lines: [...lines, `  Schema version: ${(e as Error).message}`] };
  }
  const parsed = TemplateSchema.safeParse(migrated);
  if (!parsed.success) {
    lines.push(`  Structure: ${parsed.error.issues.length} problems`);
    for (const i of parsed.error.issues.slice(0, 50))
      lines.push(`    ${fmt(i.path as (string | number)[])}: ${i.message}`);
    return { ok: false, lines };
  }
  const t: SimulationTemplate = parsed.data;
  lines.push("  Structure: valid");

  const issues = publishableIssues(t);
  const byArea = issuesByArea(issues);
  for (const a of AREAS) {
    const list: PublishIssue[] = byArea[a.key] ?? [];
    lines.push(`  ${a.label.padEnd(22)} ${list.length === 0 ? "ready" : `${list.length} to fix`}`);
    for (const i of list) lines.push(`    ${fmt(i.path)}: ${i.message}`);
  }

  const copy = collectStrings(t).flatMap((s) =>
    copyIssues(s.text, { words: true, names: /\s/.test(s.text) }).map(
      (i) => `${s.path}: ${i.message} ("${i.match}")`,
    ),
  );
  lines.push(`  Copy rules: ${copy.length === 0 ? "clean" : `${copy.length} to fix`}`);
  for (const c of copy) lines.push(`    ${c}`);

  const unresolved = SETTINGS_INVENTORY.flatMap((r) =>
    r.paths.filter((p) => !schemaHasPath(TemplateSchema, p)),
  );
  lines.push(
    `  Settings inventory: ${SETTINGS_INVENTORY.length} settings, ${unresolved.length === 0 ? "all resolve" : `${unresolved.length} unresolved`}`,
  );

  const team = t.cast.npcs.filter((n) => n.kind === "team_member");
  lines.push(
    `  Summary: ${t.process.stages.length} stages, ${team.length} team members, ${t.leadership.styles.length} styles, ${t.actions.catalogue.length} actions, ${t.events.deck.length} events, ${t.gamification.badges.length} badges`,
  );

  const ok = issues.length === 0 && copy.length === 0 && unresolved.length === 0;
  lines.push(ok ? "Publishable: yes" : "Publishable: no");
  return { ok, lines };
}
