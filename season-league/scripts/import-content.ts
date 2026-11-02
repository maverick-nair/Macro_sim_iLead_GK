/**
 * npm run import-content
 *
 * Parses content/Simulation_Workbook.xlsx (workbook v1.1) with SheetJS into /content/*.json and prints a
 * validation report: 9 rounds, 3 options each, valid ticket ids, league weights summing to 100.
 * With no workbook, it leaves the seed content as it is and says so.
 *
 * The column names below are best guesses until the real workbook is in hand. Each sheet is matched by
 * name, each column by any of its aliases (case and spacing ignored). Adjust COLUMNS if a header differs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { validateContent } from "../shared/content-schema.ts";
import { CONTENT_DIR, readContentFiles } from "./content-files.ts";

const WORKBOOK = join(CONTENT_DIR, "Simulation_Workbook.xlsx");

const SHEETS = {
  page: ["Page content"],
  consequence: ["Consequence model"],
  evidence: ["Evidence pack"],
  tickets: ["Ticket register"],
  revenue: ["Revenue bridge"],
  surveys: ["Surveys"],
  trust: ["Trust Meter"],
  league: ["League"],
} as const;

const COLUMNS = {
  round: ["round", "round no", "round number", "#"],
  title: ["title", "round title", "page title"],
  leads: ["lead roles", "leads", "lead role"],
  minutes: ["plan minutes", "minutes", "plan time"],
  scenario: ["scenario", "situation"],
  evidence1: ["evidence 1", "evidence1"],
  evidence2: ["evidence 2", "evidence2"],
  evidence3: ["evidence 3", "evidence3"],
  deliverable: ["deliverable"],
  prompt: ["prompt", "question"],
  optionA: ["option a", "decision a", "a"],
  optionB: ["option b", "decision b", "b"],
  optionC: ["option c", "decision c", "c"],
  option: ["option", "decision"],
  points: ["points", "decision points"],
  implementation: ["implementation survey", "impl survey", "implementation"],
  sixMonth: ["six-month survey", "six month survey", "6 month survey", "six-month"],
  revenue: ["revenue", "revenue %", "revenue change"],
  mandate: ["mandate label", "mandate"],
  ticket: ["ticket", "ticket id", "id"],
  behavior: ["behavior", "behaviour", "trust behavior"],
  category: ["category"],
  weight: ["weight", "weight %"],
  variant: ["variant", "after round 1", "prior choice"],
} as const;

type Row = Record<string, unknown>;
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9%#]+/g, " ")
    .trim();

function sheet(wb: XLSX.WorkBook, names: readonly string[]): Row[] | null {
  const found = wb.SheetNames.find((n) => names.some((x) => norm(x) === norm(n)));
  return found ? XLSX.utils.sheet_to_json<Row>(wb.Sheets[found]!, { defval: "" }) : null;
}

function col(row: Row, key: keyof typeof COLUMNS): string {
  const aliases = COLUMNS[key].map(norm);
  for (const [k, v] of Object.entries(row)) if (aliases.includes(norm(k))) return String(v).trim();
  return "";
}
const num = (s: string) => {
  const v = Number(s.replace(/[%+\s]/g, "").replace(/^minus/i, "-"));
  return Number.isFinite(v) ? v : 0;
};

function main() {
  if (!existsSync(WORKBOOK)) {
    console.log("No content/Simulation_Workbook.xlsx found. The seed content stays in place (Round 2 only).");
    const { raw, characters } = readContentFiles();
    const report = validateContent(raw, characters);
    console.log(report.lines.join("\n"));
    process.exit(report.ok ? 0 : 1);
  }

  const wb = XLSX.read(readFileSync(WORKBOOK));
  const warnings: string[] = [];
  const page = sheet(wb, SHEETS.page);
  const consequence = sheet(wb, SHEETS.consequence) ?? [];
  if (!page) throw new Error(`Sheet "Page content" not found. Sheets: ${wb.SheetNames.join(", ")}`);

  const existing = JSON.parse(readFileSync(join(CONTENT_DIR, "rounds.json"), "utf8")) as {
    rounds: {
      round: number;
      character: string;
      planHeadings?: string[];
      dueOptions?: string[];
      onAirMinutes?: number;
      inject?: unknown;
    }[];
  };
  const ticketIds = new Set((sheet(wb, SHEETS.tickets) ?? []).map((r) => col(r, "ticket")).filter(Boolean));

  const rounds = page
    .filter((r) => num(col(r, "round")) >= 1)
    .map((r) => {
      const n = num(col(r, "round"));
      const prev = existing.rounds.find((x) => x.round === n);
      const effectsFor = (id: string) => {
        const c = consequence.find(
          (x) => num(col(x, "round")) === n && col(x, "option").toUpperCase().startsWith(id),
        );
        if (!c) warnings.push(`Round ${n} option ${id}: no Consequence model row`);
        const effects: Record<string, unknown> = { points: c ? num(col(c, "points")) : 0 };
        if (c) {
          const impl = num(col(c, "implementation"));
          const six = num(col(c, "sixMonth"));
          const rev = num(col(c, "revenue"));
          if (impl) effects.implementationSurvey = impl;
          if (six) effects.sixMonthSurvey = six;
          if (rev) effects.revenuePct = rev;
          const mandate = col(c, "mandate");
          if (mandate) effects.mandateLabel = mandate;
        }
        // Carry-forward triggers named in workbook v1.1 (see the PRD).
        if (n === 2 && id === "B")
          Object.assign(effects, {
            zeroPlan: true,
            tickets: [{ id: "T-009", status: "critical", round: 5 }],
          });
        if (n === 4 && id === "B") effects.tickets = [{ id: "T-013", status: "added", round: 5 }];
        if (n === 7 && id === "B") effects.revenueDisputed = true;
        return effects;
      };
      const evidence = (["evidence1", "evidence2", "evidence3"] as const).map((k, i) => ({
        id: `r${n}-e${i + 1}`,
        kind: "note",
        title: `Evidence ${i + 1}`,
        text: col(r, k),
      }));
      return {
        round: n,
        matchday: Math.ceil(n / 3),
        title: col(r, "title"),
        leads: col(r, "leads")
          .split(/,| and /)
          .map((s) => s.trim())
          .filter(Boolean),
        planMinutes: num(col(r, "minutes")),
        onAirMinutes: prev?.onAirMinutes ?? 6,
        character: prev?.character ?? "nadia",
        loaded: true,
        scenario: col(r, "scenario"),
        evidence,
        evidenceByPriorChoice: {},
        deliverable: col(r, "deliverable"),
        prompt: col(r, "prompt"),
        planHeadings: prev?.planHeadings ?? [
          "Safe interim option",
          "Root-cause workstream",
          "Testing and sign-off gates",
          "Communication timetable",
        ],
        dueOptions: prev?.dueOptions ?? ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"],
        inject: prev?.inject ?? { headline: "Incoming call", text: "The client is on the line." },
        options: (["A", "B", "C"] as const).map((id) => ({
          id,
          label: `Play ${id}`,
          text: col(r, id === "A" ? "optionA" : id === "B" ? "optionB" : "optionC"),
          effects: effectsFor(id),
        })),
        ...(n === 6 ? { actionLogFeeds: 8 } : {}),
      };
    });

  for (const r of rounds)
    for (const o of r.options)
      for (const t of (o.effects.tickets as { id: string }[] | undefined) ?? [])
        if (ticketIds.size && !ticketIds.has(t.id))
          warnings.push(`Round ${r.round} option ${o.id}: ticket ${t.id} is not in the Ticket register`);

  writeFileSync(
    join(CONTENT_DIR, "rounds.json"),
    JSON.stringify(
      { meta: { source: "workbook", note: "Imported from Simulation_Workbook.xlsx" }, rounds },
      null,
      2,
    ),
  );

  const trust = sheet(wb, SHEETS.trust);
  if (trust) {
    const behaviors = trust
      .map((r) => col(r, "behavior"))
      .filter(Boolean)
      .map((label, i) => ({ id: `b${i + 1}`, label }));
    if (behaviors.length)
      writeFileSync(
        join(CONTENT_DIR, "trust-meter.json"),
        JSON.stringify({ meta: { source: "workbook" }, behaviors }, null, 2),
      );
  }

  const league = sheet(wb, SHEETS.league);
  if (league)
    warnings.push(
      "League sheet found: compare its weights with content/league.json by hand (category ids are fixed).",
    );

  // Sheets the prototype does not use yet are kept as raw JSON so nothing in the workbook is lost.
  mkdirSync(join(CONTENT_DIR, "raw"), { recursive: true });
  for (const [key, names] of Object.entries(SHEETS)) {
    const rows = sheet(wb, names);
    if (rows) writeFileSync(join(CONTENT_DIR, "raw", `${key}.json`), JSON.stringify(rows, null, 2));
    else warnings.push(`Sheet "${names[0]}" not found`);
  }

  const { raw, characters } = readContentFiles();
  const report = validateContent(raw, characters);
  console.log(report.lines.join("\n"));
  if (warnings.length) console.log(`\nWarnings:\n${warnings.map((w) => `warn  ${w}`).join("\n")}`);
  console.log(
    report.ok ? "\nImport complete and valid." : "\nImport finished with errors. Fix them before publishing.",
  );
  process.exit(report.ok ? 0 : 1);
}

main();
