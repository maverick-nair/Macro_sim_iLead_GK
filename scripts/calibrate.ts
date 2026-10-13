/**
 * Calibrates a storyline so it is playable (docs/SIMULATION.md section 9).
 *
 *   npm run calibrate -- sales-elevator          tune, write the storyline and calibration/<id>.md
 *   npm run calibrate -- sales-elevator --check  only measure and report; exit 1 when a band fails
 *   npm run calibrate -- sales-elevator --check --lens six_styles   measure it played with the Six
 *                                                    Leadership Styles test lens (D104); check only
 *
 * The authored target stays as it is (it is the client's number). Calibration tunes:
 *   1. performanceThreshold, the Model doc's funnel buffer, until passive play earns about half of
 *      what good play earns (the compounding across stages is what makes or breaks playability);
 *   2. inputPerSubPeriod (leads entering the funnel), until good play lands around 110% of target.
 * Then it checks every band and the member mix, and reports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseStoryline, type StorylineConfig } from '../src/engine/config';
import { play, type Policy } from '../src/engine/sim/policies';
import { bestStyle, needOf } from '../src/engine/lens';
import { withSixStyles } from '../src/engine/storylines/sixStyles';

const root = path.resolve(import.meta.dirname, '..');
const id = process.argv[2] ?? 'sales-elevator';
const checkOnly = process.argv.includes('--check');
const file = path.join(root, 'src/engine/storylines', `${id}.json`);
const lensArg = process.argv.includes('--lens') ? process.argv[process.argv.indexOf('--lens') + 1] : undefined;
if (lensArg && lensArg !== 'six_styles') throw new Error(`Unknown --lens ${lensArg}: only six_styles has a test lens`);
if (lensArg && !checkOnly) throw new Error('--lens only measures: add --check');
const authored = JSON.parse(fs.readFileSync(file, 'utf8'));
const raw = lensArg ? withSixStyles(authored) as typeof authored : authored;

const DEFAULT_BANDS: Record<Policy, [number, number]> = { passive: [0.4, 0.65], random: [0.35, 0.65], good: [1.0, 1.25] };
/**
 * Bands a storyline defines for itself (D141). Client Trust has choice events: random play decides every one
 * (half the time well), while passive play leaves each to its default and meets every later event those defaults
 * bring. So random play sits higher above passive than in a storyline without choices: its band runs to 75%.
 */
const STORYLINE_BANDS: Record<string, Partial<Record<Policy, [number, number]>>> = { 'client-trust': { random: [0.35, 0.75] } };
const BANDS: Record<Policy, [number, number]> = { ...DEFAULT_BANDS, ...STORYLINE_BANDS[id] };
const GOOD_AIM = 1.1;
const RATIO_AIM = 0.5;
const RUNS = 120;

const parse = (r: unknown): StorylineConfig => {
  const p = parseStoryline(r);
  if (!p.ok) throw new Error(p.issues.join('\n'));
  return p.config;
};
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))];

async function values(config: StorylineConfig, policy: Policy, runs = RUNS, offset = 0) {
  const out: number[] = [];
  for (let i = 0; i < runs; i++) out.push((await play(config, policy, 1000 + offset + i)).view.money.value);
  return out;
}

/** Leadership Score, tier and stars per run (scoring-and-report.md 6). */
async function games(config: StorylineConfig, policy: Policy, runs = 60) {
  const out: Array<{ total: number; tier: string; stars: number }> = [];
  for (let i = 0; i < runs; i++) {
    const v = (await play(config, policy, 7000 + i)).view;
    out.push({ total: v.score.total, tier: v.score.tier?.name ?? '', stars: v.periods.reduce((a, p) => a + p.week.stars, 0) / Math.max(1, v.periods.length) });
  }
  return out;
}

async function ratioAt(threshold: number) {
  const c = parse({ ...raw, performanceThreshold: threshold });
  const [p, g] = await Promise.all([values(c, 'passive', 60), values(c, 'good', 60)]);
  return median(p) / median(g);
}

async function main() {
  let threshold = raw.performanceThreshold as number;
  let input = raw.money.inputPerSubPeriod as number[];
  if (!checkOnly) {
    // 1. Buffer: bisect so passive earns about half of good.
    let lo = 0, hi = 400;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if ((await ratioAt(mid)) < RATIO_AIM) lo = mid; else hi = mid;
    }
    threshold = Math.round((lo + hi) / 2);
    // 2. Lead input: value is linear in input, so scale it to put good play at 110% of target.
    const c = parse({ ...raw, performanceThreshold: threshold });
    const good = median(await values(c, 'good'));
    const scale = (raw.money.target * GOOD_AIM) / good;
    input = input.map(v => { const x = v * scale; return x >= 10 ? Math.round(x) : Math.max(0.5, Math.round(x * 2) / 2); });
  }

  const config = parse({ ...raw, performanceThreshold: threshold, money: { ...raw.money, inputPerSubPeriod: input } });
  const shares: Record<Policy, number[]> = { passive: [], random: [], good: [] };
  for (const p of ['passive', 'random', 'good'] as const) shares[p] = (await values(config, p, 200, 5000)).map(v => v / config.money.target);

  const rows = (['passive', 'random', 'good'] as const).map(p => {
    const [lo, hi] = BANDS[p];
    const m = median(shares[p]);
    const ok = p === 'good' ? shares.good.filter(s => s >= 1).length / shares.good.length >= 0.8 && m <= hi : m >= lo && m <= hi;
    return { p, lo, hi, p10: pct(shares[p], 0.1), m, p90: pct(shares[p], 0.9), ok };
  });

  // Game scores: good play should reach the top tiers and passive play should not (D62).
  const scored = Object.fromEntries(await Promise.all((['passive', 'random', 'good'] as const).map(async p => [p, await games(config, p)] as const))) as Record<Policy, Awaited<ReturnType<typeof games>>>;
  const tiers = config.gamification.tiers;
  const topTwo = new Set(tiers.slice(0, 2).map(t => t.name));
  const gameRows = (['passive', 'random', 'good'] as const).map(p => {
    const runs = scored[p];
    const spread = tiers.map(t => `${t.name} ${runs.filter(r => r.tier === t.name).length}`).join(', ');
    const ok = p === 'good' ? runs.filter(r => topTwo.has(r.tier)).length / runs.length >= 0.8 : runs.filter(r => topTwo.has(r.tier)).length / runs.length <= 0.1;
    return { p, total: median(runs.map(r => r.total)), stars: median(runs.map(r => r.stars)), spread, ok };
  });

  // Member mix (section 9, step 3): all four needs present, named by the style that fits each (the lens's fit table).
  const needs = new Set(config.members.map(m => needOf(m.start, config.thresholds.high)));
  const quadrants = new Set([...needs].map(n => bestStyle(config.lens, n)));
  const strugglers = config.members.filter(m => Math.min(m.start.skill, m.start.morale, m.start.result) < config.thresholds.low).length;
  const mixOk = needs.size === 4 && strugglers >= 2;

  const f = (x: number) => `${Math.round(x * 100)}%`;
  const money = new Intl.NumberFormat(config.money.locale, { style: 'currency', currency: config.money.currency, maximumFractionDigits: 0 });
  const report = `# Calibration: ${config.name}

Generated by \`npm run calibrate -- ${id}\`. Rules: docs/SIMULATION.md section 9. 200 runs per policy.

| Setting | Before | After |
|---|---|---|
| Funnel buffer (performanceThreshold) | ${raw.performanceThreshold} | ${threshold} |
| Leads entering per ${config.time.subPeriod.unit} | ${raw.money.inputPerSubPeriod.join(', ')} | ${input.join(', ')} |
| Target | ${money.format(raw.money.target)} | ${money.format(config.money.target)} (authored, unchanged) |

## Share of target reached

| Player | Required | 10th percentile | Median | 90th percentile | |
|---|---|---|---|---|---|
${rows.map(r => `| ${r.p} | ${f(r.lo)} to ${f(r.hi)}${r.p === 'good' ? ', 80% of runs at 100% or more' : ''} | ${f(r.p10)} | ${f(r.m)} | ${f(r.p90)} | ${r.ok ? 'pass' : 'OUT OF BAND'} |`).join('\n')}

## Game scores

Leadership Score 0 to ${config.gamification.scale}, 60 runs per policy. Good play needs ${[...topTwo].join(' or ')} in 80% of runs; passive and random play in at most 10%.

| Player | Median score | Median stars a ${config.time.period.unit} | Tiers | |
|---|---|---|---|---|
${gameRows.map(r => `| ${r.p} | ${r.total} | ${r.stars.toFixed(1)} | ${r.spread} | ${r.ok ? 'pass' : 'OUT OF BAND'} |`).join('\n')}

## Starting team

- Needed styles present at the start: ${[...quadrants].sort().join(', ')} (${needs.size === 4 ? 'all four' : 'missing some'})
- Members starting under ${config.thresholds.low} in some metric: ${strugglers} (need 2 or more)
- ${mixOk ? 'Mix is playable as authored; no member values were nudged.' : 'Mix needs attention.'}
`;
  console.log(report);
  const allOk = rows.every(r => r.ok) && gameRows.every(r => r.ok) && mixOk;
  // `--check` is a gate (D141): it fails when a band or the member mix does.
  if (checkOnly && !allOk) { console.error('A calibration band failed. See the report.'); process.exit(1); }
  if (!checkOnly) {
    fs.writeFileSync(file, JSON.stringify({ ...raw, performanceThreshold: threshold, money: { ...raw.money, inputPerSubPeriod: input }, calibrated: allOk }, null, 2) + '\n');
    fs.mkdirSync(path.join(root, 'calibration'), { recursive: true });
    fs.writeFileSync(path.join(root, 'calibration', `${id}.md`), report);
    if (!allOk) { console.error('Calibration did not reach every band. See the report.'); process.exit(1); }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
