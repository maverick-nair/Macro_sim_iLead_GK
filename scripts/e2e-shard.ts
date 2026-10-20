/**
 * Runs one shard of the end to end suite: `npx tsx scripts/e2e-shard.ts <shard> <of> [playwright args]`.
 *
 * Playwright 1.56 shards in contiguous chunks of the test list, so the slow specs at the start of the
 * alphabet (a11y, board, ...) all land in shard 1. This splits by weight instead: tests that share a
 * source line (a loop over themes or widths) are one unit, units go to the lightest shard first, and
 * each shard runs its units by `file:line`.
 */
import { spawnSync } from 'node:child_process';

const [shard, of, ...rest] = process.argv.slice(2);
if (!(Number(shard) >= 1 && Number(of) >= Number(shard))) { console.error('usage: e2e-shard.mjs <shard> <of> [playwright args]'); process.exit(2); }

const list = spawnSync('npx', ['playwright', 'test', '--list', '--reporter=json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (list.status !== 0) { process.stderr.write(list.stderr); process.exit(list.status ?? 1); }

const weight = new Map<string, number>();
type Suite = { specs?: { file: string; line: number; tests: unknown[] }[]; suites?: Suite[] };
const walk = (suite: Suite, dir: string): void => {
  for (const spec of suite.specs ?? []) {
    const key = `${dir}/${spec.file}:${spec.line}`;
    weight.set(key, (weight.get(key) ?? 0) + spec.tests.length);
  }
  for (const child of suite.suites ?? []) walk(child, dir);
};
const report = JSON.parse(list.stdout);
if (report.errors?.length) { for (const e of report.errors) console.error(e.message); process.exit(1); }
for (const s of report.suites) walk(s, report.config.rootDir.replace(`${process.cwd()}/`, ''));

const units = [...weight].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
const load = Array.from({ length: Number(of) }, () => ({ w: 0, keys: [] as string[] }));
for (const [key, w] of units) {
  const lightest = load.reduce((m, s) => (s.w < m.w ? s : m));
  lightest.w += w;
  lightest.keys.push(key);
}
const mine = load[Number(shard) - 1];
console.log(`shard ${shard}/${of}: ${mine.keys.length} units, ${mine.w} tests of ${[...weight.values()].reduce((a, b) => a + b, 0)}`);
if (!mine.keys.length) process.exit(0);
const run = spawnSync('npx', ['playwright', 'test', ...rest, ...mine.keys], { stdio: 'inherit' });
process.exit(run.status ?? 1);
