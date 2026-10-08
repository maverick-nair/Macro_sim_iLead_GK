import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../config';
import clientTrust from '../storylines/client-trust.json';
import { choiceBusiness, playSynthetic, type PersonaKey } from './synthetic';

/**
 * Synthetic players and choice events (D137, D140): Beginners leave choices to their default or take what is best
 * for business now; Experts weigh people, leadership and business, and follow through. Played on Client Trust.
 */
const p = parseStoryline(clientTrust);
if (!p.ok) throw new Error(p.issues.join('\n'));
const config = p.config;

async function choices(persona: PersonaKey, seeds: number[]) {
  const out: Array<{ event: string; option: string | null; by: string }> = [];
  for (const seed of seeds) out.push(...(await playSynthetic(config, persona, seed)).view.choices.map(c => ({ event: c.eventKey, option: c.option, by: c.by })));
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
