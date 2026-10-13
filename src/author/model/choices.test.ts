import { describe, expect, it } from 'vitest';
import { Brief } from '../../api/author';
import { clearLeadsTo, leadsTo, leadsToText } from './choices';
import type { EventDraft } from './draft';
import { emptyChat, seedDraft } from './seed';

/**
 * What leads to a follow up event (D166): an ignored event's follow up, a stakeholder request left unanswered, and a
 * decision option's follow up, as Client Trust's "The client signs at full price" follows "Hold the price".
 */
const draft = () => seedDraft({ ...emptyChat(), brief: Brief.parse({ industry: 'Banking and financial services' }) }, 'workspace');
const followup = (key: string, title: string): EventDraft => ({
  key, title, kind: 'opportunity', week: null, day: 1, timing: 'followup', who: 'team', arrives: 'modal', body: 'The client signs.',
  skill: 0, morale: 2, result: 2, leadFlow: 0, respondWith: [], within: 2, onTime: [0, 2, 0], ifIgnored: { sponsor: false, followUp: null }, conditions: [], origin: 'yours'
});

describe('what leads to an event (D166)', () => {
  it('counts a decision option\'s follow up, not only an ignored event\'s', () => {
    const d = draft();
    d.events.push(followup('client_signs', 'The client signs at full price'));
    expect(leadsToText(d, 'client_signs')).toBe('No event leads to this one yet. Pick it as the follow up of another event or of a decision\'s option, or give it a week.');
    const discount = d.events.find(e => e.key === 'discount_decision')!;
    discount.choice!.options.find(o => o.key === 'value')!.followUp = { event: 'client_signs', days: 0, weeks: 1 };
    expect(leadsTo(d, 'client_signs').map(w => [w.kind, w.event.key])).toEqual([['decision', 'discount_decision']]);
    expect(leadsToText(d, 'client_signs')).toBe('Follows "A discount to close this week" when "Hold the price and help them build the case" is chosen.');
  });

  it('names an ignored event and a stakeholder request left unanswered too, and removing the event clears them all', () => {
    const d = draft();
    d.events.push(followup('client_signs', 'The client signs at full price'));
    const [a, b] = d.events.filter(e => !e.choice && e.timing === 'fixed');
    a.ifIgnored = { sponsor: false, followUp: 'client_signs' };
    b.ifIgnored = { sponsor: true, followUp: 'client_signs' };
    b.stakeholder = 'priya';
    b.request = { kind: 'message', interaction: null, within: 2, onTime: { trust: 3, satisfaction: 3 }, ifIgnored: { trust: -6, satisfaction: -8 } };
    d.events.find(e => e.key === 'discount_decision')!.choice!.options[1].followUp = { event: 'client_signs', days: 0, weeks: 1 };
    expect(leadsTo(d, 'client_signs').map(w => w.kind)).toEqual(['ignored', 'request', 'decision']);
    expect(leadsToText(d, 'client_signs')).toMatch(/^Follows ".+" when it is ignored, ".+" when the request goes unanswered or "A discount to close this week" when ".+" is chosen\.$/);
    clearLeadsTo(d, 'client_signs');
    expect(leadsTo(d, 'client_signs')).toEqual([]);
  });
});
