import { describe, expect, it } from 'vitest';
import { wordAll as en } from '../../i18n/engineCopy';
import { parseStoryline, type StorylineConfig, type StorylineInput } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine, IntentError, type Engine } from './engine';
import { heuristicEvaluator, type Evaluator } from './evaluator';
import { neededStyles } from './policies';
import { parseReport } from '../reportContract';
import { relationScale } from './stakeholderState';
import type { Band } from './types';

/**
 * Stakeholders outside the team (D160 to D165, docs/SIMULATION.md 6.9), on Sales Elevator with a stakeholder block
 * added: their relationship state, the interactions (live and static), requests they make and ignoring them, and
 * conditions on the relationship. Each test names the rule.
 */

const base = salesElevator as unknown as StorylineInput;
type EventIn = NonNullable<StorylineInput['events']>[number];
type ShIn = NonNullable<StorylineInput['stakeholders']>[number];

const CSAT = { key: 'csat', name: 'Customer satisfaction', format: 'percent' as const, start: 60, min: 0, max: 100 };
const HEADCOUNT_TEAM: [number, number, number] = [0, 4, 2];

/** A CFO who can be met, presented to and negotiated with (a static decision with a strained relationship fallback). */
const CFO: ShIn = {
  key: 'cfo', name: 'Grace Okoro', role: 'Chief Financial Officer', kind: 'executive', pronoun: 'she', about: 'Watches every cost line.',
  hiddenConcern: 'The board wants a 10% cut and she has not told anyone.', concernLine: 'Honestly, the board is pushing me for cuts I have not announced.',
  start: { trust: 50, satisfaction: 50 }, drift: { trust: 0, satisfaction: -3 },
  interactions: [
    { key: 'meet', type: 'meet', consequences: { strong: { trust: 6, satisfaction: 6, business: { variables: { csat: 4 } } } } },
    { key: 'present', type: 'present', cost: 1 },
    { key: 'headcount', type: 'negotiate', kind: 'static', label: 'Ask for two contractors', options: [
      { key: 'ask', label: 'Ask for two contractors for a month', effect: { trust: 2, satisfaction: -4, people: HEADCOUNT_TEAM, who: 'team', outcome: 'She agrees.', needs: { trust: 55 }, otherwise: { satisfaction: -6, outcome: 'She says no: not this quarter.' } }, read: [{ skill: 'results_ownership', band: 'strong' }] },
      { key: 'drop', label: 'Drop the ask', effect: { satisfaction: 2 }, read: [{ skill: 'results_ownership', band: 'weak' }] }
    ] }
  ]
};
/** A client lead who writes and asks to meet. */
const CLIENT: ShIn = {
  key: 'client_lead', name: 'Sam Patel', role: 'Head of Procurement, Acme', kind: 'customer', start: { trust: 60, satisfaction: 55 },
  interactions: [{ key: 'meet', type: 'meet' }, { key: 'email', type: 'email', cost: 1 }]
};

const MEETING_REQUEST: EventIn = {
  key: 'client_asks', title: 'Sam asks to meet about the delays', body: { he: 'Can we meet this week about the delays?', she: 'Can we meet this week about the delays?' },
  card: 'signal', period: 1, subPeriod: 1, target: 'team', delivery: 'email', stakeholder: 'client_lead',
  request: { kind: 'meeting', interaction: 'meet', within: 2, onTime: { trust: 4, satisfaction: 4, business: { variables: { csat: 3 } } }, ifIgnored: { trust: -6, satisfaction: -10, business: { variables: { csat: -8 } } } },
  escalation: { sponsor: true }
};
const MESSAGE_REQUEST: EventIn = {
  key: 'cfo_note', title: 'Grace wants your forecast', body: { he: 'Send me your forecast by Wednesday.', she: 'Send me your forecast by Wednesday.' },
  card: 'signal', period: 1, subPeriod: 1, target: 'team', delivery: 'email', stakeholder: 'cfo', request: { kind: 'message', within: 3 }
};

function storyline(extra: Partial<StorylineInput>): StorylineConfig {
  const p = parseStoryline({ ...structuredClone(base), events: [], triggers: [], variables: [CSAT], stakeholders: [CFO, CLIENT], ...extra });
  if (!p.ok) throw new Error(p.issues.join('\n'));
  return p.config;
}

/** An evaluator that returns one band, so the consequences under test are the band's. */
const always = (band: Band): Evaluator => ({
  async evaluate(input) { const e = await heuristicEvaluator.evaluate(input); return { ...e, band, skills: (input.skills ?? []).map(key => ({ key, band, evidence: [] })) }; }
});

async function toBoard(e: Engine) {
  if (e.view().phase === 'style') await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
}
async function day(e: Engine) {
  const v = e.view();
  const m = v.members.find(x => !v.actions.find(a => a.key === 'assess')!.blockedFor[x.id])!;
  await e.dispatch({ type: 'planAction', action: 'assess', memberIds: [m.id], stage: v.funnel.find(st => st.key !== m.stage)!.key });
}
async function nextWeek(e: Engine) {
  await e.dispatch({ type: 'endPeriod' });
  const v = e.view();
  if (v.pendingReward) await e.dispatch({ type: 'chooseReward', reward: v.pendingReward[0] });
  if (e.view().phase === 'periodEnd') await e.dispatch({ type: 'startNextPeriod' });
  await toBoard(e);
}
const sh = (e: Engine, key: string) => e.view().stakeholders.find(s => s.key === key)!;
async function talk(e: Engine, stakeholder: string, interaction: string, words = 'Thank you for making time. What do you need from my team this week? I will send the plan by Friday.') {
  const r = await e.dispatch({ type: 'engageStakeholder', stakeholder, interaction });
  expect(r.interactionId).toBeTruthy();
  if (e.view().live!.oneShot) return e.dispatch({ type: 'submitInteraction', interactionId: r.interactionId!, text: words });
  await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: words });
  return e.dispatch({ type: 'endInteraction', interactionId: r.interactionId! });
}

describe('stakeholder relationship state (D160)', () => {
  it('starts where authored, is shown on the board with the interactions on offer, and is never in the funnel', async () => {
    const e = createEngine(storyline({}), { seed: 1 });
    const v = e.view();
    expect(v.stakeholders.map(s => [s.key, s.trust, s.satisfaction, s.level])).toEqual([['cfo', 50, 50, 'steady'], ['client_lead', 60, 55, 'steady']]);
    expect(sh(e, 'cfo').interactions.map(x => [x.key, x.type, x.kind])).toEqual([['meet', 'meet', 'live'], ['present', 'present', 'live'], ['headcount', 'negotiate', 'static']]);
    expect(v.members.some(m => m.id === 'cfo')).toBe(false);
    expect(v.funnel.reduce((a, st) => a + st.members, 0)).toBe(v.members.length);
  });

  it('drifts at each period end only for a stakeholder nobody engaged, and the week end lists each relationship', async () => {
    const e = createEngine(storyline({}), { seed: 1 });
    await toBoard(e);
    await nextWeek(e);
    expect(sh(e, 'cfo').satisfaction).toBe(47);
    expect(sh(e, 'client_lead').satisfaction).toBe(55);
    expect(e.view().periods[0].stakeholders).toEqual([
      { key: 'cfo', name: 'Grace Okoro', trust: { start: 50, end: 50 }, satisfaction: { start: 50, end: 47 } },
      { key: 'client_lead', name: 'Sam Patel', trust: { start: 60, end: 60 }, satisfaction: { start: 55, end: 55 } }
    ]);
    await talk(e, 'cfo', 'meet');
    const before = sh(e, 'cfo').satisfaction;
    await nextWeek(e);
    expect(sh(e, 'cfo').satisfaction).toBe(before);
  });

  it('a storyline without stakeholders plays as before: no stakeholders on the board, none in the week end', async () => {
    const p = parseStoryline({ ...structuredClone(base), events: [], triggers: [] });
    if (!p.ok) throw new Error(p.issues.join());
    const e = createEngine(p.config, { seed: 1 });
    await toBoard(e);
    await nextWeek(e);
    expect(e.view().stakeholders).toEqual([]);
    expect(e.view().periods[0]).not.toHaveProperty('stakeholders');
  });
});

describe('stakeholder interactions (D161)', () => {
  it('a meeting is a live conversation with the stakeholder\'s AI character; its band moves the relationship and the business', async () => {
    const e = createEngine(storyline({}), { seed: 1, evaluator: always('strong') });
    await toBoard(e);
    const left = e.view().clock.capacityLeft;
    const r = await e.dispatch({ type: 'engageStakeholder', stakeholder: 'cfo', interaction: 'meet' });
    const live = e.view().live!;
    expect(live.stakeholder).toEqual({ key: 'cfo', role: 'Chief Financial Officer', kind: 'executive', type: 'meet' });
    expect(live.speaker.name).toBe('Grace Okoro');
    expect(live.turns[0].by).toBe('cfo');
    expect(e.view().clock.capacityLeft).toBe(left - 1);
    // Not the team's live cap.
    expect(e.view().liveCap.used).toBe(0);
    await e.dispatch({ type: 'sendTurn', interactionId: r.interactionId!, text: 'Thanks for your time. What do you need from us this quarter?' });
    const out = await e.dispatch({ type: 'endInteraction', interactionId: r.interactionId! });
    expect(out.outcome!.speaker).toBe('cfo');
    expect(sh(e, 'cfo').trust).toBe(56);
    expect(sh(e, 'cfo').satisfaction).toBe(56);
    expect(e.view().variables.find(v => v.key === 'csat')!.value).toBe(64);
    expect(en(out.outcome!.changed[0])).toBe('Grace: trust +6, satisfaction +6');
  });

  it('counts toward the Leadership pillar and the skills like any conversation, rated on the type\'s skills', async () => {
    const e = createEngine(storyline({}), { seed: 1, evaluator: always('harmful') });
    await toBoard(e);
    expect(e.view().score.live).toBeNull();
    await talk(e, 'client_lead', 'meet');
    expect(e.view().score.live).toBe(0);
    const recs = e.records();
    expect(recs.at(-1)).toMatchObject({ stakeholder: 'client_lead', memberIds: [], band: 'harmful' });
    expect(recs.at(-1)!.skills!.map(s => s.key)).toEqual(['difficult_conversations', 'results_ownership']);
  });

  it('defaults by band when the author left them out, scaled by the relationship', async () => {
    expect(relationScale(50)).toEqual({ gain: 1, loss: 1 });
    expect(relationScale(0)).toEqual({ gain: 0.5, loss: 1.5 });
    expect(relationScale(100)).toEqual({ gain: 1.25, loss: 1 });
    const warm = createEngine(storyline({}), { seed: 1, evaluator: always('strong') });
    const cold = createEngine(storyline({ stakeholders: [{ ...CFO, start: { trust: 10, satisfaction: 50 } }, CLIENT] }), { seed: 1, evaluator: always('strong') });
    for (const e of [warm, cold]) { await toBoard(e); await talk(e, 'cfo', 'present'); }
    // Strong: trust +8, satisfaction +8 at trust 50; at trust 10 they land at 60%.
    expect([sh(warm, 'cfo').trust, sh(warm, 'cfo').satisfaction]).toEqual([58, 58]);
    expect([sh(cold, 'cfo').trust, sh(cold, 'cfo').satisfaction]).toEqual([15, 55]);
  });

  it('can be engaged once a period, and costs days: none left, no interaction', async () => {
    const e = createEngine(storyline({}), { seed: 1 });
    await toBoard(e);
    await talk(e, 'cfo', 'meet');
    expect(sh(e, 'cfo').engaged).toBe(true);
    expect(sh(e, 'cfo').interactions[1].blocked).toMatchObject({ reason: 'cooldown' });
    await expect(e.dispatch({ type: 'engageStakeholder', stakeholder: 'cfo', interaction: 'present' })).rejects.toThrow(IntentError);
    while (e.view().clock.capacityLeft >= 1) await day(e);
    expect(sh(e, 'client_lead').interactions[0].blocked).toMatchObject({ reason: 'capacity' });
  });

  it('a static negotiation lands only when the relationship can carry it, moves the team when it does, and counts its read', async () => {
    const lo = createEngine(storyline({}), { seed: 2 });
    const hi = createEngine(storyline({ stakeholders: [{ ...CFO, start: { trust: 70, satisfaction: 50 } }, CLIENT] }), { seed: 2 });
    for (const e of [lo, hi]) { await toBoard(e); await e.dispatch({ type: 'engageStakeholder', stakeholder: 'cfo', interaction: 'headcount', option: 'ask' }); }
    // Trust 50 is under the 55 it needs: she says no, and the team gets nothing.
    expect(en(lo.view().outcome!.changed[1])).toBe('She says no: not this quarter.');
    expect(sh(lo, 'cfo').satisfaction).toBe(44);
    expect(lo.view().outcome!.changes).toEqual([]);
    // Trust 70: she agrees, and the team's morale and result rise.
    expect(en(hi.view().outcome!.changed[1])).toBe('She agrees.');
    expect(hi.view().outcome!.changes.filter(c => c.metric === 'morale').length).toBeGreaterThan(0);
    expect(hi.view().score.live).toBe(100);
  });
});

describe('stakeholder requests (D162)', () => {
  it('a meeting request arrives as their message; meeting them in time answers it', async () => {
    const e = createEngine(storyline({ events: [MEETING_REQUEST] }), { seed: 1, evaluator: always('adequate') });
    await toBoard(e);
    await day(e);
    const msg = e.view().inbox.find(m => m.from === 'client_lead')!;
    expect(msg).toMatchObject({ kind: 'email', urgent: true });
    expect(sh(e, 'client_lead').request).toMatchObject({ kind: 'meeting', interaction: 'meet' });
    // Opening the message opens the meeting they asked for.
    const o = await e.dispatch({ type: 'openConversation', kind: 'reply', messageId: msg.id });
    expect(e.view().live!.stakeholder!.type).toBe('meet');
    await e.dispatch({ type: 'sendTurn', interactionId: o.interactionId!, text: 'I am sorry about the delays. What would help most?' });
    await e.dispatch({ type: 'endInteraction', interactionId: o.interactionId! });
    // Adequate +3/+3, then on time +4/+4, each at the trust it lands on (gains a little fuller above 50).
    expect(sh(e, 'client_lead').request).toBeNull();
    expect([sh(e, 'client_lead').trust, sh(e, 'client_lead').satisfaction]).toEqual([67, 62]);
    expect(e.view().variables[0].value).toBe(63);
    expect(e.view().inbox.some(m => m.id === msg.id)).toBe(false);
  });

  it('ignored past its deadline, it hurts the relationship and the business, and escalates to the sponsor', async () => {
    const e = createEngine(storyline({ events: [MEETING_REQUEST] }), { seed: 1 });
    await toBoard(e);
    const sponsor = e.view().sponsor.value;
    for (let i = 0; i < 4; i++) await day(e);
    expect(sh(e, 'client_lead').request).toBeNull();
    expect(sh(e, 'client_lead').trust).toBe(54);
    expect(sh(e, 'client_lead').satisfaction).toBe(45);
    expect(e.view().variables[0].value).toBe(52);
    expect(e.view().sponsor.value).toBe(sponsor - 10);
    expect(en(e.view().history).some(l => l.title === 'You did not answer Sam in time: Sam asks to meet about the delays.')).toBe(true);
  });

  it('a message request is answered by a reply in writing, which costs no days', async () => {
    const e = createEngine(storyline({ events: [MESSAGE_REQUEST] }), { seed: 1, evaluator: always('strong') });
    await toBoard(e);
    await day(e);
    const left = e.view().clock.capacityLeft;
    const msg = e.view().inbox.find(m => m.from === 'cfo')!;
    const o = await e.dispatch({ type: 'openConversation', kind: 'reply', messageId: msg.id });
    expect(e.view().live).toMatchObject({ format: 'chat', stakeholder: { key: 'cfo', type: 'reply' } });
    await e.dispatch({ type: 'sendTurn', interactionId: o.interactionId!, text: 'Here is the forecast: 92% of target, the risk is the proposal stage.' });
    await e.dispatch({ type: 'endInteraction', interactionId: o.interactionId! });
    expect(e.view().clock.capacityLeft).toBe(left);
    // A reply moves half a meeting's strong band (+4/+4) plus the default on time (+3/+3).
    expect([sh(e, 'cfo').trust, sh(e, 'cfo').satisfaction]).toEqual([57, 57]);
    expect(sh(e, 'cfo').engaged).toBe(true);
  });
});

describe('conditions on a stakeholder relationship (D163)', () => {
  const CHECK_IN: EventIn = {
    key: 'cfo_cuts', title: 'Grace cuts your budget', body: { he: 'Finance cuts your discretionary budget.', she: 'Finance cuts your discretionary budget.' },
    card: 'impact', period: 2, subPeriod: 1, target: 'team', impact: [0, -3, 0], stakeholder: 'cfo',
    if: [{ kind: 'stakeholder', stakeholder: 'cfo', measure: 'satisfaction', op: 'below', value: 48 }]
  };
  it('an event plays when the stakeholder\'s satisfaction is low enough, and is skipped when it is not', async () => {
    const ignored = createEngine(storyline({ events: [CHECK_IN] }), { seed: 1 });
    const engaged = createEngine(storyline({ events: [CHECK_IN] }), { seed: 1, evaluator: always('adequate') });
    for (const e of [ignored, engaged]) await toBoard(e);
    await talk(engaged, 'cfo', 'meet');
    for (const e of [ignored, engaged]) { await nextWeek(e); await day(e); }
    expect(ignored.view().cards.some(c => c.key === 'cfo_cuts' && c.stakeholder === 'cfo')).toBe(true);
    expect(engaged.view().cards.some(c => c.key === 'cfo_cuts')).toBe(false);
  });

  it('an interaction can be offered only while a condition on the relationship holds', async () => {
    const gated = { ...CLIENT, interactions: [...CLIENT.interactions!, { key: 'renewal', type: 'negotiate' as const, if: [{ kind: 'stakeholder' as const, stakeholder: 'client_lead', measure: 'trust' as const, op: 'atLeast' as const, value: 65 }] }] };
    const e = createEngine(storyline({ stakeholders: [CFO, gated] }), { seed: 1, evaluator: always('strong') });
    await toBoard(e);
    expect(sh(e, 'client_lead').interactions.map(x => x.key)).toEqual(['meet', 'email']);
    await talk(e, 'client_lead', 'meet');
    expect(sh(e, 'client_lead').interactions.map(x => x.key)).toEqual(['meet', 'email', 'renewal']);
  });

  it('a choice can move a stakeholder, through its business effect', async () => {
    const choice: EventIn = {
      key: 'cut', title: 'Cut costs', body: { he: 'Pick one.', she: 'Pick one.' }, card: 'diagnostic', period: 1, subPeriod: 1, target: 'team',
      choice: { within: 2, options: [
        { key: 'cut', label: 'Cut', outcome: 'Done.', business: { stakeholders: { cfo: { trust: 5, satisfaction: 10 } } } },
        { key: 'keep', label: 'Keep', outcome: 'Kept.', business: { stakeholders: { cfo: { satisfaction: -10 } } } }
      ] }
    };
    const e = createEngine(storyline({ events: [choice] }), { seed: 1 });
    await toBoard(e);
    await day(e);
    await e.dispatch({ type: 'decide', choiceId: e.view().openChoices[0].id, option: 'cut' });
    expect([sh(e, 'cfo').trust, sh(e, 'cfo').satisfaction]).toEqual([55, 60]);
    expect(en(sh(e, 'cfo').causes[0].text)).toBe('You chose "Cut" for Cut costs.');
  });
});

describe('the schema checks every stakeholder reference (D160 to D163)', () => {
  const issues = (extra: Partial<StorylineInput>) => {
    const p = parseStoryline({ ...structuredClone(base), events: [], triggers: [], variables: [CSAT], stakeholders: [CFO, CLIENT], ...extra });
    return p.ok ? [] : p.issues;
  };
  it('refuses a missing stakeholder in an event, a condition, a request\'s interaction, a business effect, or a key taken by a person', () => {
    expect(issues({ events: [{ ...MEETING_REQUEST, stakeholder: 'nobody' }] }).join()).toMatch(/No stakeholder called nobody/);
    expect(issues({ events: [{ ...MEETING_REQUEST, request: { kind: 'meeting', interaction: 'golf' } }] }).join()).toMatch(/has no interaction called golf/);
    expect(issues({ events: [{ ...MEETING_REQUEST, stakeholder: undefined }] }).join()).toMatch(/A request comes from a stakeholder/);
    expect(issues({ stakeholders: [{ ...CFO, key: 'kent' }, CLIENT] }).join()).toMatch(/kent is already a person/);
    expect(issues({ stakeholders: [{ ...CFO, interactions: [{ key: 'x', type: 'meet', consequences: { strong: { business: { stakeholders: { ghost: { trust: 1 } } } } } }] }, CLIENT] }).join()).toMatch(/No stakeholder called ghost/);
    expect(issues({ stakeholders: [{ ...CFO, interactions: [{ key: 'x', type: 'negotiate', kind: 'static' }] }, CLIENT] }).join()).toMatch(/A static interaction needs 2 to 4 options/);
    expect(issues({})).toEqual([]);
  });
});

describe('the report reads stakeholder conversations (D164)', () => {
  it('rates their skills with the conversations, quotes included', async () => {
    const e = createEngine(storyline({}), { seed: 3, evaluator: always('strong') });
    await toBoard(e);
    await talk(e, 'cfo', 'meet', 'I own the forecast, and the risk is the proposal stage. What do you need from me?');
    await nextWeek(e);
    await talk(e, 'cfo', 'present', 'We are at 92% of target and I own the gap. The risk is proposals; I need one contractor.');
    while (e.view().phase !== 'ended') { await e.dispatch({ type: 'endPeriod' }); if (e.view().phase === 'periodEnd') { if (e.view().pendingReward) await e.dispatch({ type: 'chooseReward', reward: e.view().pendingReward![0] }); await e.dispatch({ type: 'startNextPeriod' }); await toBoard(e); } }
    const r = parseReport(e.view().report);
    const own = r.skills.find(s => s.key === 'results_ownership')!;
    expect(own.observations).toBeGreaterThanOrEqual(2);
  });
});

describe('stakeholder formats in the stand in evaluator (D161)', () => {
  it('rates a negotiation on interests, options and agreement, a meeting on influence, a presentation like a briefing', async () => {
    const n = await heuristicEvaluator.evaluate({ format: 'negotiate', text: 'What matters most to you this quarter? We could move the date, or if you can fund one contractor, we will commit to the release. Agreed, I will confirm by Friday.' });
    expect(n.dimensions.map(d => [d.key, d.band])).toEqual([['interests', 'strong'], ['options', 'strong'], ['agreement', 'strong']]);
    expect((await heuristicEvaluator.evaluate({ format: 'stakeholder', text: 'Fine.' })).dimensions.map(d => d.key)).toEqual(['listening', 'clarity', 'influence']);
    expect((await heuristicEvaluator.evaluate({ format: 'present', text: 'We are at 92%.' })).dimensions.map(d => d.key)).toEqual(['ownership', 'honesty', 'plan']);
  });
});
