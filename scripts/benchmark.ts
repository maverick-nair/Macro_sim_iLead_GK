/**
 * The mock group report's benchmark (D77): 300 seeded runs per lens, played by the AI players and
 * summarized as the server would store it, cached in src/api/samples so /group opens quickly.
 *
 *   npm run benchmark             write src/api/samples/benchmark-<lens>.json
 *   npm run benchmark -- --check  fail when a cached benchmark no longer matches the engine
 */
import fs from 'node:fs';
import path from 'node:path';
import { playBenchmark } from '../src/api/mockGroup';

const root = path.resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
let stale = 0;
for (const lens of ['readiness_based', 'six_styles']) {
  const file = path.join(root, 'src/api/samples', `benchmark-${lens}.json`);
  const json = JSON.stringify(await playBenchmark(lens), null, 2) + '\n';
  if (check) {
    const same = fs.existsSync(file) && fs.readFileSync(file, 'utf8') === json;
    console.log(`${same ? 'up to date' : 'STALE'}  ${path.relative(root, file)}`);
    if (!same) stale++;
  } else {
    fs.writeFileSync(file, json);
    console.log(`wrote ${path.relative(root, file)}`);
  }
}
if (stale) {
  console.error('Run npm run benchmark to refresh the cached benchmark.');
  process.exit(1);
}
