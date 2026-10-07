/**
 * Writes the JSON Schemas of every payload the server and GenieKreator exchange with the app to
 * docs/schemas/, generated from the Zod schemas the app parses with (Zod 4 `toJSONSchema`), so the
 * handoff (docs/HANDOFF.md) never drifts from the code.
 *   npm run schemas            rewrite docs/schemas
 *   npm run schemas -- --check fail when docs/schemas is stale (a unit test runs this too)
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { AuthorDraftRequest, AuthorDraftResponse, AuthorTurnRequest, AuthorTurnResponse } from '../src/api/author';
import { CalibrationJob, CalibrationRequest, Playthrough } from '../src/author/calibrate/logic/schema';
import { StorylineConfig } from '../src/engine/config';
import { EngineView, Intent, IntentResult, StreamChunk } from '../src/engine/contract';
import { BenchmarkSummary, GroupReport, GroupReportRequest } from '../src/engine/groupContract';
import { History, ReportView, RunSummary } from '../src/engine/reportContract';
import { ThemeConfigSchema } from '../src/theme/schema';

/** File name, schema, and whether it describes what the server sends (output) or receives (input). */
export const SCHEMAS: Array<[string, z.ZodType, 'input' | 'output']> = [
  ['engine-view', EngineView, 'input'],
  ['engine-intent', Intent, 'input'],
  ['engine-intent-result', IntentResult, 'input'],
  ['engine-stream-chunk', StreamChunk, 'input'],
  ['storyline-config', StorylineConfig, 'input'],
  ['theme-config', ThemeConfigSchema, 'input'],
  ['report-view', ReportView, 'input'],
  ['run-summary', RunSummary, 'input'],
  ['history', History, 'input'],
  ['group-report', GroupReport, 'input'],
  ['group-report-request', GroupReportRequest, 'input'],
  ['benchmark-summary', BenchmarkSummary, 'input'],
  ['author-turn-request', AuthorTurnRequest, 'input'],
  ['author-turn-response', AuthorTurnResponse, 'input'],
  ['author-draft-request', AuthorDraftRequest, 'input'],
  ['author-draft-response', AuthorDraftResponse, 'input'],
  ['calibration-request', CalibrationRequest, 'input'],
  ['calibration-job', CalibrationJob, 'input'],
  ['calibration-playthrough', Playthrough, 'input']
];

/** The schema files as text, keyed by file name. Transforms and refinements become plain types and notes. */
export function renderSchemas(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, schema, io] of SCHEMAS) {
    const json = z.toJSONSchema(schema, { io, unrepresentable: 'any', target: 'draft-2020-12' });
    out[`${name}.json`] = JSON.stringify({ title: name, ...json }, null, 2) + '\n';
  }
  return out;
}

const dir = path.resolve(import.meta.dirname, '../docs/schemas');
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const files = renderSchemas();
  if (process.argv.includes('--check')) {
    const stale = Object.entries(files).filter(([f, text]) => !fs.existsSync(path.join(dir, f)) || fs.readFileSync(path.join(dir, f), 'utf8') !== text).map(([f]) => f);
    if (stale.length) {
      console.error(`docs/schemas is stale (${stale.join(', ')}). Run npm run schemas.`);
      process.exit(1);
    }
    console.log(`${Object.keys(files).length} schemas up to date.`);
  } else {
    fs.mkdirSync(dir, { recursive: true });
    for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), text);
    console.log(`Wrote ${Object.keys(files).length} schemas to docs/schemas.`);
  }
}
