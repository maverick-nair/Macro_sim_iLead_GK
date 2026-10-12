import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseStoryline } from '../../../src/engine/config';
import type { Intent } from '../../../src/engine/contract';
import { createEngine } from '../../../src/engine/sim/engine';
import { neededStyles } from '../../../src/engine/sim/policies';
import { decodeSnapshot, encodeSnapshot } from '../../../src/lms/snapshot';

/**
 * For tests/e2e/lifecycle.spec.ts (D224), run with tsx: `<storyline.json> <suspend file> <out file>`. Takes the
 * suspend data a package left in the LMS after the participant's own first week, replays it on the storyline the
 * package carries (its image paths do not change the run), and plays on (the needed styles, no actions, as
 * scorm-build.ts does) into the last week, so later sessions stand for the weeks between. Writes the extended
 * suspend data.
 */
export async function forward(storylinePath: string, suspend: string): Promise<string> {
  const snap = decodeSnapshot(suspend);
  if (!snap) throw new Error('No suspend data to extend');
  const parsed = parseStoryline(JSON.parse(fs.readFileSync(storylinePath, 'utf8')) as unknown);
  if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
  const config = parsed.config;
  const engine = createEngine(config, { seed: snap.s });
  const log: Intent[] = [];
  const send = async (i: Intent) => { await engine.dispatch(i); log.push(i); };
  for (const i of snap.i) await send(i);
  while (engine.view().clock.period < config.time.period.count && engine.view().phase !== 'ended') {
    if (engine.view().phase === 'style') await send({ type: 'confirmStyles', styles: await neededStyles(engine, config.thresholds.high, config.lens) });
    if (engine.view().phase === 'periodEnd') { await send({ type: 'startNextPeriod' }); continue; }
    await send({ type: 'endPeriod' });
    const v = engine.view();
    if (v.pendingReward) await send({ type: 'chooseReward', reward: v.pendingReward[0] });
    if (engine.view().phase === 'periodEnd') await send({ type: 'startNextPeriod' });
  }
  return encodeSnapshot({ v: 1, h: snap.h, s: snap.s, i: log });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [storyline, suspendFile, out] = process.argv.slice(2);
  fs.writeFileSync(out, await forward(storyline, fs.readFileSync(suspendFile, 'utf8')));
}
