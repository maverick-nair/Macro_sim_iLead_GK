/**
 * Rubric calibration gate: `npm run ai:calibrate [-- <storyline>] [--provider mock|anthropic|all] [--out report.json]`.
 * Scores the storyline's authored sample answers (ai/calibration/<storyline>.json) with the evaluator
 * and fails when any rubric agrees with the authors' labels on fewer than 85% of its samples. The mock
 * always runs; the Anthropic evaluator runs when ANTHROPIC_API_KEY is set.
 */
import { readFileSync } from 'node:fs';
import { createEvaluator } from '../src/factories';
import { silentLogger } from '../src/config';
import { CalibrationSet, formatCalibration, runCalibration, type CalibrationReport } from '../src/quality/calibrate';
import { args, env, loadStoryline, providers, ROOT, save } from './shared';

const a = args();
const config = loadStoryline(a.storyline);
const set = CalibrationSet.parse(JSON.parse(readFileSync(`${ROOT}ai/calibration/${a.storyline}.json`, 'utf8')));
const reports: CalibrationReport[] = [];
let ok = true;
for (const provider of providers(a.provider)) {
  const evaluator = createEvaluator({ ...env().evaluator, provider, logger: a.verbose ? undefined : silentLogger });
  const report = await runCalibration(evaluator, set, config);
  console.log(`${formatCalibration(report)}\n`);
  reports.push(report);
  ok &&= report.pass;
}
save(a.out, reports);
process.exit(ok ? 0 : 1);
