import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../config';
import { wordAll } from '../../i18n/engineCopy';
import salesElevator from '../storylines/sales-elevator.json';
import { play, type Policy } from './policies';

/**
 * Replay guard (D70): the lens drives style fit through a table, and the Readiness Based default must
 * replay every seeded run exactly as the quadrant maths did. The hashes cover what the run decides
 * (people, money, periods, score, log, badges and the report's run facts), not text added later.
 * Engine copy is message codes since D83: the hash reads it worded in English, which must be the very
 * text the engine wrote before, so the codes and the English catalog are checked here too.
 */
// Recorded before people dynamics (D135): Sales Elevator as it was then, without dynamics and with the funnel
// numbers calibrated for it (buffer 79, 24 leads a day). The guard is the lens's maths, which dynamics leave alone.
const parsed = parseStoryline({ ...salesElevator, dynamics: undefined, realism: undefined, performanceThreshold: 79, money: { ...salesElevator.money, inputPerSubPeriod: [24] } });
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config = parsed.config;

async function digest(policy: Policy, seed: number) {
  const { view } = await play(config, policy, seed);
  const { members, money, periods, score, badges } = view;
  // A log entry's `action` (D95) labels where it came from for the History filter; it decides nothing, so it is left out.
  const history = view.history.map(({ action: _action, ...entry }) => entry);
  const r = view.report!;
  // The sales unit (D227) is copy the view carries, not a decision: left out, as it was before it existed.
  const facts = { members, money: { ...money, unit: undefined }, periods, score, history, badges, style: { ...r.style, fit: undefined }, intent: r.intent, moments: r.moments, people: r.people,
    skills: r.skills.map(s => ({ key: s.key, observations: s.observations, score: s.score, level: s.level, quotes: s.quotes })), summary: r.summary };
  // Portraits moved to WebP (D78), an asset change, not a decision: hashed as the PNGs they were recorded with.
  const json = JSON.stringify(wordAll(facts)).replace(/\/assets\/npc\/(\w+)\.webp/g, '/assets/npc/$1.png');
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

describe('seeded replay', () => {
  it('replays the default lens exactly as before the lens existed', async () => {
    const out: Record<string, string> = {};
    for (const policy of ['passive', 'random', 'good'] as const) for (const seed of [1, 2]) out[`${policy} ${seed}`] = await digest(policy, seed);
    // Recorded on the quadrant maths, before the lens (D70). Re-recorded at D143 to D145, where the report's
    // summary (headline, lines, drivers, the guarded level line), the moments' impact lines (net per person
    // and metric) and the reconciled skill ratings changed by design: the same runs hashed without those
    // fields matched the earlier code for all five players on seeds 1 to 3, so what the runs decide is unchanged.
    // Re-recorded at D168 to D170, where the summary's overall level is capped by the outcomes (with the line that
    // says why) and a harmful conversation holds a skill's score: hashed without the summary and the skills' scores
    // and levels, passive, random and good on seeds 1 to 3 matched the D167 code.
    expect(out).toEqual({
      'passive 1': '97a812923c5d349a', 'passive 2': '97046b741bf8874c',
      'random 1': '0a386e5a05bad675', 'random 2': '50152dcd411ff73a',
      'good 1': 'f2afd87ba0a4c5c4', 'good 2': 'e99a663a1405dd0e'
    });
  });
});
