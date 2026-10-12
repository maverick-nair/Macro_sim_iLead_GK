import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { scorm } from '../../../scripts/scorm';
import { buildPlayer } from '../../../scripts/player-build';
import { parseStoryline } from '../../../src/engine/config';
import { createEngine } from '../../../src/engine/sim/engine';
import { neededStyles } from '../../../src/engine/sim/policies';
import type { Intent } from '../../../src/engine/contract';
import { encodeSnapshot } from '../../../src/lms/snapshot';

/**
 * Fixtures for tests/e2e/scorm.spec.ts (D209), run with tsx: the player built into dist (skipped with
 * `SCORM_E2E_REUSE_PLAYER=1` when one is there), Sales Elevator packaged as SCORM 1.2 and SCORM 2004, and for
 * each a suspend data that stands for seven weeks already played: the mock's fast forward (the needed styles,
 * no actions), as the intent log a package keeps (D203). Writes `<out>/fixtures.json`.
 */
export const STORYLINE = 'src/engine/storylines/sales-elevator.json';

async function sevenWeeks(raw: unknown): Promise<Intent[]> {
  const parsed = parseStoryline(raw);
  if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
  const config = parsed.config;
  const engine = createEngine(config, { seed: 1 });
  const log: Intent[] = [];
  const send = async (i: Intent) => { await engine.dispatch(i); log.push(i); };
  while (engine.view().clock.period < config.time.period.count && engine.view().phase !== 'ended') {
    if (engine.view().phase === 'style') await send({ type: 'confirmStyles', styles: await neededStyles(engine, config.thresholds.high, config.lens) });
    await send({ type: 'endPeriod' });
    const v = engine.view();
    if (v.pendingReward) await send({ type: 'chooseReward', reward: v.pendingReward[0] });
    if (engine.view().phase === 'periodEnd') await send({ type: 'startNextPeriod' });
  }
  return log;
}

export async function buildFixtures(out: string) {
  fs.mkdirSync(out, { recursive: true });
  if (process.env.SCORM_E2E_REUSE_PLAYER !== '1' || !fs.existsSync('dist/player-manifest.json')) await buildPlayer('dist');
  const raw = JSON.parse(fs.readFileSync(STORYLINE, 'utf8')) as unknown;
  const log = await sevenWeeks(raw);
  const result: Record<string, { zip: string; suspend: string; hash: string; skills: number }> = {};
  // 1.2 passes on any score above 0; 2004 asks for a perfect score, so the same run fails it.
  for (const [version, pass] of [['scorm12', { kind: 'score', min: 1 }], ['scorm2004', { kind: 'score', min: 100 }]] as const) {
    const zip = path.join(out, `sales-elevator-${version}.zip`);
    const r = await scorm({ storyline: STORYLINE, out: zip, dist: 'dist', settings: { version, pass }, version: 3 });
    const config = parseStoryline(raw);
    result[version] = { zip, suspend: encodeSnapshot({ v: 1, h: r.info.hash, s: r.info.seed, i: log }), hash: r.info.hash, skills: config.ok ? config.config.report.skills.length : 0 };
  }
  fs.writeFileSync(path.join(out, 'fixtures.json'), JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildFixtures(process.argv[2] ?? 'test-results/scorm');
}
