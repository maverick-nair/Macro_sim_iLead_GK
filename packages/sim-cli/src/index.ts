#!/usr/bin/env node
/**
 * GenieKreator simulation CLI. M1: `validate`. M2 adds `run` (full scripted or random policy runs).
 *   pnpm sim validate seed:ilead
 *   pnpm sim validate path/to/template.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { iLeadOriginal } from "@gk/seed-ilead";
import { validateTemplate } from "./validate";

const SEEDS: Record<string, unknown> = { "seed:ilead": iLeadOriginal };

const USAGE = `Usage:
  sim validate <seed:ilead | file.json>   Check structure, publish rules and copy rules`;

function load(target: string): unknown {
  if (target in SEEDS) return SEEDS[target];
  return JSON.parse(readFileSync(resolve(process.cwd(), target), "utf8")) as unknown;
}

function main(argv: string[]): number {
  const [command, target] = argv;
  if (command === "validate" && target) {
    let raw: unknown;
    try {
      raw = load(target);
    } catch (e) {
      console.error(`Could not read ${target}: ${(e as Error).message}`);
      return 2;
    }
    const report = validateTemplate(target, raw);
    for (const line of report.lines) console.log(line);
    return report.ok ? 0 : 1;
  }
  console.log(USAGE);
  return command === undefined || command === "help" || command === "--help" ? 0 : 2;
}

process.exitCode = main(process.argv.slice(2));
