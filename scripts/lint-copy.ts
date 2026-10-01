/**
 * Copy lint (CLAUDE.md "Copy rules"). Fails when:
 *   1. any text file outside docs/source contains an em or en dash;
 *   2. seed copy, UI strings (apps/web/src/i18n) or prompts use a hyphen as punctuation, say "competency",
 *      or misspell a product name;
 *   3. docs use a hyphen as punctuation in prose.
 * Usage: pnpm lint:copy
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { type CopyCheckOptions, collectStrings, copyIssues } from "@gk/schema";
import { iLeadOriginal } from "@gk/seed-ilead";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  ".turbo",
]);
const SKIP_PATHS = new Set(["docs/source", "pnpm-lock.yaml"]);
const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".prisma",
  ".sql",
  ".css",
  ".html",
  ".txt",
  ".example",
  "",
]);

const problems: string[] = [];
const report = (where: string, text: string, opts: CopyCheckOptions, rules?: readonly string[]) => {
  for (const i of copyIssues(text, opts))
    if (!rules || rules.includes(i.rule)) problems.push(`${where}: ${i.message} ("${i.match}")`);
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(ROOT, abs).split("\\").join("/");
    if (SKIP_DIRS.has(name) || SKIP_PATHS.has(rel)) continue;
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (TEXT_EXT.has(extname(name))) out.push(rel);
  }
  return out;
}

const files = walk(ROOT);

// 1. No em or en dashes anywhere we write.
for (const f of files)
  readFileSync(join(ROOT, f), "utf8")
    .split("\n")
    .forEach((line, i) => report(`${f}:${i + 1}`, line, {}, ["em_dash", "en_dash"]));

// 2a. Seed copy: every string in the iLead original.
for (const s of collectStrings(iLeadOriginal)) {
  const prose = /\s/.test(s.text);
  report(`seed-ilead${s.path}`, s.text, { words: true, names: prose }, [
    "spaced_hyphen",
    "skills_word",
    "product_name",
  ]);
}

// 2b. UI strings.
for (const f of files.filter((x) => x.startsWith("apps/web/src/i18n/") && x.endsWith(".json")))
  for (const s of collectStrings(JSON.parse(readFileSync(join(ROOT, f), "utf8")) as unknown))
    report(`${f}${s.path}`, s.text, { words: true, names: /\s/.test(s.text) }, [
      "spaced_hyphen",
      "skills_word",
      "product_name",
    ]);

// Markdown prose: skip fenced code, inline code, list bullets and table separator rows.
function proseLines(text: string): { n: number; line: string }[] {
  const out: { n: number; line: string }[] = [];
  let fenced = false;
  text.split("\n").forEach((raw, i) => {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced;
      return;
    }
    if (fenced || /^\s*\|?\s*:?-{3,}/.test(raw)) return;
    out.push({ n: i + 1, line: raw.replace(/`[^`]*`/g, "``").replace(/^\s*[-*+]\s+/, "") });
  });
  return out;
}

// 2c. Prompts (they are the source of generated copy). Prompts may quote the banned word to forbid it.
for (const f of files.filter((x) => x.startsWith("prompts/") && x.endsWith(".md")))
  for (const { n, line } of proseLines(readFileSync(join(ROOT, f), "utf8")))
    report(`${f}:${n}`, line, { names: true }, ["spaced_hyphen", "product_name"]);

// 3. Docs prose.
const docs = files.filter(
  (x) => (x.startsWith("docs/") && x.endsWith(".md")) || x === "CLAUDE.md" || x === "README.md",
);
for (const f of docs)
  for (const { n, line } of proseLines(readFileSync(join(ROOT, f), "utf8")))
    report(`${f}:${n}`, line, {}, ["spaced_hyphen"]);

if (problems.length > 0) {
  console.error(`Copy lint: ${problems.length} problems`);
  for (const p of problems) console.error(`  ${p}`);
  process.exitCode = 1;
} else console.log(`Copy lint: clean (${files.length} files, seed, UI strings, prompts, docs)`);
