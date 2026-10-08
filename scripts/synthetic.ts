/**
 * Synthetic players on the bundled storylines (D117, D149 to D151, docs/CALIBRATION-SYNTHETIC.md): the four
 * levels play each storyline, conversations included, with the strategy probes, and the calibration checks
 * are printed with each level's spread, its points by pillar and the evaluator's agreement.
 *
 *   npm run synthetic                              every storyline in src/engine/storylines, 10 runs a level
 *   npm run synthetic -- sales-elevator --runs 5   one storyline, 5 runs a level
 *   npm run synthetic -- --types                   also the four player types (Risk taker, Conservative, People first, Business first)
 *   npm run synthetic -- --check                   exit 1 when a check fails (warnings do not fail)
 *   npm run synthetic -- --json out.json           also write the results
 *   npm run synthetic -- --no-probes --seed 7
 *
 * Offline: the template players and the engine's keyword evaluator. Deterministic for a seed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NAMES } from '../src/author/calibrate/logic/aggregate';
import { describeProbe, probeGroups } from '../src/author/calibrate/logic/strategy';
import { CalibrationError, runCalibration } from '../src/author/calibrate/logic/run';
import { ARCHETYPE_KEYS, DEFAULT_RUNS, LEVEL_KEYS, type CalibrationResults } from '../src/author/calibrate/logic/schema';
import { wordEnglish } from '../src/i18n/engineCopyEn';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const check = flag('--check');
const runs = Number(value('--runs') ?? DEFAULT_RUNS);
const types = flag('--types');
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
  console.log('Player          Score range  SD   Average  Tier      Revenue  Skills rated  Fits level  Strong  Read as meant  Business People Leadership Streak');
  for (const p of r.personas) {
    const band = p.bands.strong + p.bands.adequate + p.bands.weak + p.bands.harmful;
    const pl = p.pillars;
    console.log([
      NAMES[p.persona].padEnd(15),
      `${Math.round(p.score.min)} to ${Math.round(p.score.max)}`.padEnd(12),
      String(Math.round(p.sd ?? 0)).padEnd(4),
      String(Math.round(p.score.mean)).padEnd(8),
      p.tier.name.padEnd(9),
      pct(p.share.mean).padEnd(8),
      p.level.name.padEnd(13),
      (p.agreement === null ? '' : pct(p.agreement)).padEnd(11),
      pct(p.bands.strong / Math.max(1, band)).padEnd(7),
      (p.styleRead === null || p.styleRead === undefined ? '' : pct(p.styleRead)).padEnd(14),
      pl ? `${Math.round(pl.business)}${pl.capped >= 0.5 ? ' (capped)' : ''}`.padEnd(9) + String(Math.round(pl.people)).padEnd(7) + String(Math.round(pl.leadership)).padEnd(11) + Math.round(pl.streak) : ''
    ].join(' '));
  }
  if (r.probes.length) {
    const best = (kinds: string[]) => probeGroups(r.probes, kinds).sort((a, b) => b.mean - a.mean)[0];
    console.log('\nBest probes:');
    for (const [label, kinds] of [['one style', ['style']], ['one action', ['action']], ['team energy and one style', ['energize']], ['as many actions as possible', ['busy']], ['a pair of actions', ['pair']], ['reading people, no action', ['idle']]] as const) {
      const b = best([...kinds]);
      if (b) console.log(`  ${label.padEnd(28)} ${String(Math.round(b.mean)).padStart(4)}  ${describeProbe(b.kind, b.key, { styles: r.lens.styles, actions: r.actions })}`);
    }
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
      const personas = Object.fromEntries([...LEVEL_KEYS, ...(types ? ARCHETYPE_KEYS : [])].map(k => [k, runs]));
      const { results } = await runCalibration(draft, { personas, seed, probes: !flag('--no-probes') }, { ranOn: 'cli', word: wordEnglish, yieldEvery: async () => undefined });
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
