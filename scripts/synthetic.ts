/**
 * Synthetic players on the bundled storylines (D117, docs/CALIBRATION-SYNTHETIC.md): the four personas
 * play each storyline, conversations included, and the calibration checks are printed.
 *
 *   npm run synthetic                              every storyline in src/engine/storylines, 5 runs a persona
 *   npm run synthetic -- sales-elevator --runs 10  one storyline, 10 runs a persona
 *   npm run synthetic -- --check                   exit 1 when a check fails (warnings do not fail)
 *   npm run synthetic -- --json out.json           also write the results
 *   npm run synthetic -- --no-probes --seed 7
 *
 * Offline: the template players and the engine's keyword evaluator. Deterministic for a seed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NAMES } from '../src/author/calibrate/logic/aggregate';
import { CalibrationError, runCalibration } from '../src/author/calibrate/logic/run';
import type { CalibrationResults } from '../src/author/calibrate/logic/schema';
import { wordEnglish } from '../src/i18n/engineCopyEn';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const check = flag('--check');
const runs = Number(value('--runs') ?? 5);
const seed = Number(value('--seed') ?? 1);
const out = value('--json');
const skip = new Set([value('--runs'), value('--seed'), value('--json')].filter(Boolean));
const dir = path.join(root, 'src/engine/storylines');
const ids = args.filter(a => !a.startsWith('--') && !skip.has(a));
const storylines = ids.length ? ids : fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();

const pct = (x: number) => `${Math.round(x * 100)}%`;
const mark = { pass: 'pass', warn: 'LOOK', fail: 'FAIL' } as const;

function print(r: CalibrationResults, ms: number) {
  console.log(`\n${r.storyline.name} (${r.storyline.id}), ${r.lens.title}: ${r.runs.length} playthroughs and ${r.probes.length} probes in ${(ms / 1000).toFixed(1)} s`);
  console.log(`Target tier: ${r.targetTier.name} (${r.targetTier.min} points)\n`);
  console.log('Player       Score range      Average  Tier       Revenue  Skills rated   Fits level  Conversations');
  for (const p of r.personas) {
    const band = p.bands.strong + p.bands.adequate + p.bands.weak + p.bands.harmful;
    console.log([
      NAMES[p.persona].padEnd(12),
      `${Math.round(p.score.min)} to ${Math.round(p.score.max)}`.padEnd(16),
      String(Math.round(p.score.mean)).padEnd(8),
      p.tier.name.padEnd(10),
      pct(p.share.mean).padEnd(8),
      p.level.name.padEnd(14),
      pct(p.agreement).padEnd(11),
      `${pct(p.bands.strong / Math.max(1, band))} Strong`
    ].join(' '));
  }
  console.log('');
  for (const c of r.checks) {
    console.log(`  ${mark[c.status]}  ${c.title}`);
    if (c.status !== 'pass' && c.fix) console.log(`        ${c.fix}`);
  }
}

async function main() {
  let failed = false;
  const all: CalibrationResults[] = [];
  for (const id of storylines) {
    const file = path.join(dir, `${id}.json`);
    const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
    const t = performance.now();
    try {
      const { results } = await runCalibration(draft, { personas: { beginner: runs, developing: runs, proficient: runs, expert: runs }, seed, probes: !flag('--no-probes') }, { ranOn: 'cli', word: wordEnglish, yieldEvery: async () => undefined });
      print(results, performance.now() - t);
      all.push(results);
      if (results.checks.some(c => c.status === 'fail')) failed = true;
    } catch (e) {
      if (!(e instanceof CalibrationError)) throw e;
      console.error(`${id}: ${e.message}\n  ${e.issues.join('\n  ')}`);
      failed = true;
    }
  }
  if (out) fs.writeFileSync(path.resolve(out), JSON.stringify(all.length === 1 ? all[0] : all, null, 2) + '\n');
  if (check && failed) { console.error('\nA synthetic player check failed. See the lines marked FAIL.'); process.exit(1); }
}

main().catch(e => { console.error(e); process.exit(1); });
