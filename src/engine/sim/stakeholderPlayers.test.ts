import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../config';
import clientTrust from '../storylines/client-trust.json';
import salesElevator from '../storylines/sales-elevator.json';
import { play } from './policies';
import { playSynthetic, type PlayerKey } from './synthetic';

/**
 * Automated players and stakeholders (D165), played on Client Trust: the synthetic personas engage stakeholders by
 * level (Beginners neglect them, Experts manage up and across before anyone asks), and the calibration's good player
 * answers every request.
 */
const p = parseStoryline(clientTrust);
if (!p.ok) throw new Error(p.issues.join('\n'));
const config = p.config;

async function stakeholderPlay(persona: PlayerKey, seeds: number[], opts: Parameters<typeof playSynthetic>[3] = {}) {
  let conversations = 0, requests = 0, answered = 0, relation = 0;
  for (const seed of seeds) {
    const run = await playSynthetic(config, persona, seed, opts);
    conversations += run.conversations.filter(c => c.actionKey.startsWith('stakeholder:') || (c.actionKey === 'reply' && c.memberIds.length === 0 && c.names.length === 1)).length;
    const asked = run.weeks.flatMap(w => w.events).filter(e => e.key.startsWith('request:'));
    requests += asked.length;
    answered += asked.filter(e => e.handled).length;
    relation += run.view.stakeholders.reduce((a, s) => a + s.trust + s.satisfaction, 0) / (2 * run.view.stakeholders.length);
  }
  return { conversations, requests, answered, relation: relation / seeds.length };
}

describe('synthetic players engage stakeholders by level (D165)', () => {
  it('Experts answer more requests, engage more often and end with better relationships than Beginners', async () => {
    const seeds = [1, 2, 3, 4];
    const beginner = await stakeholderPlay('beginner', seeds), expert = await stakeholderPlay('expert', seeds);
    expect(expert.requests).toBeGreaterThan(0);
    expect(expert.answered / expert.requests).toBeGreaterThan(0.6);
    expect(beginner.answered / Math.max(1, beginner.requests)).toBeLessThan(expert.answered / expert.requests);
    expect(expert.conversations).toBeGreaterThan(beginner.conversations * 2);
    expect(expert.relation).toBeGreaterThan(beginner.relation + 10);
  });

  it('plays a storyline without stakeholders exactly as before: no stakeholder conversation, the same run for a seed', async () => {
    const se = parseStoryline(salesElevator);
    if (!se.ok) throw new Error(se.issues.join());
    const a = await playSynthetic(se.config, 'expert', 3), b = await playSynthetic(se.config, 'expert', 3);
    expect(a.conversations.some(c => c.actionKey.startsWith('stakeholder:'))).toBe(false);
    expect(a.summary).toEqual(b.summary);
  });

  it('the calibration\'s good player answers stakeholders and ends with better relationships than passive play', async () => {
    const good = await play(config, 'good', 11), passive = await play(config, 'passive', 11);
    const mean = (v: typeof good.view) => v.stakeholders.reduce((a, s) => a + s.trust + s.satisfaction, 0) / (2 * v.stakeholders.length);
    expect(mean(good.view)).toBeGreaterThan(mean(passive.view) + 10);
    expect(passive.view.history.some(l => typeof l.title === 'object' && 'code' in l.title && l.title.code === 'engine.stakeholder.ignored')).toBe(true);
  });
});

describe('player types and probes with stakeholders (D152, D166)', () => {
  it('each type by its nature: the conservative answers every request, the risk taker goes to them most, business first answers all', async () => {
    const seeds = [1, 2, 3, 4];
    const [risk, careful, people, business] = await Promise.all((['riskTaker', 'conservative', 'peopleFirst', 'businessFirst'] as const).map(k => stakeholderPlay(k, seeds)));
    expect(careful.answered).toBe(careful.requests);
    expect(business.answered).toBe(business.requests);
    expect(risk.answered).toBeLessThan(risk.requests);
    expect(people.answered).toBeLessThan(people.requests);
    expect(risk.conversations).toBeGreaterThan(careful.conversations);
    expect(business.relation).toBeGreaterThan(people.relation);
  });

  it('a probe leaves every stakeholder alone', async () => {
    const probe = await stakeholderPlay('expert', [1, 2], { probe: { kind: 'idle' } });
    expect(probe.conversations).toBe(0);
    expect(probe.answered).toBe(0);
  });
});
