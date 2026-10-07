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
const parsed = parseStoryline(salesElevator);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const config = parsed.config;

async function digest(policy: Policy, seed: number) {
  const { view } = await play(config, policy, seed);
  const { members, money, periods, score, badges } = view;
  // A log entry's `action` (D95) labels where it came from for the History filter; it decides nothing, so it is left out.
  const history = view.history.map(({ action: _action, ...entry }) => entry);
  const r = view.report!;
  const facts = { members, money, periods, score, history, badges, style: { ...r.style, fit: undefined }, intent: r.intent, moments: r.moments, people: r.people,
    skills: r.skills.map(s => ({ key: s.key, observations: s.observations, score: s.score, level: s.level, quotes: s.quotes })), summary: r.summary };
  // Portraits moved to WebP (D78), an asset change, not a decision: hashed as the PNGs they were recorded with.
  const json = JSON.stringify(wordAll(facts)).replace(/\/assets\/npc\/(\w+)\.webp/g, '/assets/npc/$1.png');
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

describe('seeded replay', () => {
  it('replays the default lens exactly as before the lens existed', async () => {
    const out: Record<string, string> = {};
    for (const policy of ['passive', 'random', 'good'] as const) for (const seed of [1, 2]) out[`${policy} ${seed}`] = await digest(policy, seed);
    // Recorded on the quadrant maths, before the lens (D70).
    expect(out).toEqual({
      'passive 1': '987792d6dc92fd16', 'passive 2': '151a653a6a32f26c',
      'random 1': '8cfdeaf23295bbd3', 'random 2': '4cdbaf1aca19d1c1',
      'good 1': '5cb17f5bf2693bff', 'good 2': '203390d28ec2f7d1'
    });
  });
});
