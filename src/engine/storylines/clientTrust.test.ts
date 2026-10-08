import { describe, expect, it } from 'vitest';
import { parseStoryline } from '../config';
import clientTrust from './client-trust.json';

/**
 * The Client Trust demo storyline (D141): people dynamics, business variables, four choice events across the
 * four dilemmas, and follow ups that depend on earlier choices. Its calibration is checked by
 * `npm run calibrate -- client-trust --check` and `npm run synthetic -- --check`.
 */
const p = parseStoryline(clientTrust);
if (!p.ok) throw new Error(p.issues.join('\n'));
const c = p.config;
const event = (key: string) => c.events.find(e => e.key === key)!;

describe('Client Trust', () => {
  it('plays with people dynamics and three to four business variables, one hidden and two in the Business pillar', () => {
    expect(c.dynamics).toBeDefined();
    expect(c.variables.map(v => v.key)).toEqual(['budget', 'customer_trust', 'quality', 'reputation']);
    expect(c.variables.filter(v => !v.shown).map(v => v.key)).toEqual(['reputation']);
    expect(c.variables.filter(v => v.weight > 0).map(v => v.key)).toEqual(['customer_trust', 'quality']);
    expect(c.calibrated).toBe(true);
  });

  it('has four choice events: revenue against customer trust, wellbeing against delivery, cost against capability, transparency against confidentiality', () => {
    const choices = c.events.filter(e => e.choice);
    expect(choices.map(e => e.key)).toEqual(['discount_deal', 'release_crunch', 'training_or_hire', 'reorg_rumour']);
    // Each has a default and options with different consequences and leadership reads.
    for (const e of choices) {
      expect(e.choice!.default).toBeTruthy();
      expect(new Set(e.choice!.options.map(o => JSON.stringify([o.people, o.trust, o.business]))).size).toBe(e.choice!.options.length);
      expect(new Set(e.choice!.options.map(o => JSON.stringify(o.read))).size).toBeGreaterThan(1);
    }
    // No option is best on every count: the option best for business now never has the best leadership read.
    const discount = event('discount_deal').choice!.options;
    expect(discount.find(o => o.key === 'discount')!.business.revenue).toBeGreaterThan(0);
    expect(discount.find(o => o.key === 'discount')!.read.some(r => r.band === 'weak')).toBe(true);
  });

  it('carries choices forward: flags, conditions and delayed follow ups', () => {
    expect(event('training_ask').if).toEqual([{ kind: 'flag', flag: 'budget_cut', is: true }, { kind: 'metric', metric: 'teamMorale', op: 'below', value: 60 }]);
    expect(event('discount_comes_back').if).toEqual([{ kind: 'flag', flag: 'discounted', is: true }]);
    expect(event('reference_call').if?.[0]).toMatchObject({ kind: 'variable', variable: 'reputation' });
    expect(event('reorg_rumour').choice!.options.find(o => o.key === 'silent')!.business.followUps).toEqual([{ event: 'news_leaks', days: 0, weeks: 1 }]);
    expect(event('discount_deal').choice!.options.find(o => o.key === 'value')!.business.followUps).toEqual([{ event: 'client_signs', days: 0, weeks: 1 }]);
  });

  it('has three stakeholders outside the team, with requests, a negotiation, and choices that move them (D165)', () => {
    expect(c.stakeholders.map(s => [s.key, s.kind])).toEqual([['client_lead', 'customer'], ['cfo', 'executive'], ['delivery_lead', 'peer']]);
    // At least one stakeholder initiated request, and one negotiation.
    const requests = c.events.filter(e => e.request);
    expect(requests.map(e => [e.stakeholder, e.request!.kind])).toEqual([['client_lead', 'meeting'], ['delivery_lead', 'meeting'], ['cfo', 'message']]);
    expect(c.stakeholders.flatMap(s => s.interactions.filter(x => x.type === 'negotiate').map(x => `${s.key}.${x.key}.${x.kind}`))).toEqual(['client_lead.scope.live', 'cfo.contractor.static', 'delivery_lead.priorities.live']);
    // The negotiation for budget lands only when the CFO trusts you enough.
    expect(c.stakeholders[1].interactions[1].options![0].effect.needs).toEqual({ trust: 55 });
    // Wired into the choice events and the variables.
    expect(event('discount_deal').choice!.options.find(o => o.key === 'value')!.business.stakeholders).toEqual({ client_lead: { trust: 5, satisfaction: 2 } });
    expect(event('training_or_hire').choice!.options.find(o => o.key === 'fund')!.business.stakeholders).toEqual({ cfo: { trust: -4, satisfaction: -8 } });
    expect(event('client_escalates').if).toEqual([{ kind: 'stakeholder', stakeholder: 'client_lead', measure: 'satisfaction', op: 'below', value: 40 }]);
    expect(event('client_renews').business!.revenue).toBeGreaterThan(0);
  });
});
