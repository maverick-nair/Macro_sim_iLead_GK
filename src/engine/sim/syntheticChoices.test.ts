import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../config';
import clientTrust from '../storylines/client-trust.json';
import { ARCHETYPES, choiceBusiness, playSynthetic, type PlayerKey } from './synthetic';
import { choiceLead, choicePeople, choiceSize, type ChoiceOption } from './syntheticChoices';

/**
 * Synthetic players and choice events (D137, D140): Beginners leave choices to their default or take what is best
 * for business now; Experts weigh people, leadership and business, and follow through. Played on Client Trust.
 */
const p = parseStoryline(clientTrust);
if (!p.ok) throw new Error(p.issues.join('\n'));
const config = p.config;

async function choices(persona: PlayerKey, seeds: number[], probe?: Parameters<typeof playSynthetic>[3]) {
  const out: Array<{ event: string; option: string | null; by: string }> = [];
  for (const seed of seeds) out.push(...(await playSynthetic(config, persona, seed, probe)).view.choices.map(c => ({ event: c.eventKey, option: c.option, by: c.by })));
  return out;
}

describe('synthetic players decide choice events by level', () => {
  it('rates an option for business now from revenue, the variables, sponsor confidence and result', () => {
    const discount = config.events.find(e => e.key === 'discount_deal')!.choice!.options;
    const [take, hold] = [discount.find(o => o.key === 'discount')!, discount.find(o => o.key === 'value')!];
    expect(choiceBusiness(config, take)).toBeGreaterThan(choiceBusiness(config, hold));
  });

  it('Beginners leave about half to the default and otherwise take the short term option; Experts decide every one, weighing people', async () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const beginner = await choices('beginner', seeds), expert = await choices('expert', seeds);
    expect(expert.every(c => c.by === 'you')).toBe(true);
    expect(beginner.filter(c => c.by === 'default').length).toBeGreaterThan(beginner.length / 4);
    const short = (cs: typeof beginner) => cs.filter(c => c.by === 'you' && ['discount', 'weekend', 'cut', 'silent'].includes(c.option ?? '')).length / Math.max(1, cs.filter(c => c.by === 'you').length);
    expect(short(beginner)).toBeGreaterThan(0.6);
    expect(short(expert)).toBeLessThan(0.2);
  });

  it('the same seed makes the same decisions, whatever the conversations were rated', async () => {
    expect(await choices('proficient', [9])).toEqual(await choices('proficient', [9]));
  });
});

describe('player types decide by their nature, and probes leave every choice to its default (D152)', () => {
  const events = config.events.filter(e => e.choice);
  // The best by the type's measure; ties go to the stronger leadership read, then to the earlier option.
  const top = (f: (o: ChoiceOption) => number) => {
    const g = (o: ChoiceOption) => f(o) + choiceLead(o) / 1000;
    return Object.fromEntries(events.map(e => [e.key, e.choice!.options.reduce((b, o) => (g(o) > g(b) ? o : b)).key]));
  };

  it('risk taker the boldest, conservative the default, people first the best for people, business first the best for business', async () => {
    const expected: Record<(typeof ARCHETYPES)[number], Record<string, string>> = {
      riskTaker: top(o => choiceSize(config, o)),
      conservative: Object.fromEntries(events.map(e => [e.key, e.choice!.default!])),
      peopleFirst: top(choicePeople),
      businessFirst: top(o => choiceBusiness(config, o))
    };
    for (const k of ARCHETYPES) {
      const made = await choices(k, [1, 2]);
      expect(made.length, k).toBeGreaterThan(0);
      for (const c of made) {
        expect(c.by, `${k} ${c.event}`).toBe('you');
        expect(c.option, `${k} ${c.event}`).toBe(expected[k][c.event]);
      }
    }
    // The natures differ on Client Trust: people first and business first part on the release crunch.
    expect(expected.peopleFirst.release_crunch).toBe('move');
    expect(expected.businessFirst.release_crunch).toBe('weekend');
  });

  it('a probe decides nothing', async () => {
    const made = await choices('expert', [1], { probe: { kind: 'idle' } });
    expect(made.length).toBeGreaterThan(0);
    expect(made.every(c => c.by === 'default')).toBe(true);
  });
});
