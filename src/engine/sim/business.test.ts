import { describe, expect, it } from 'vitest';
import { wordAll as en } from '../../i18n/engineCopy';
import { parseStoryline, type StorylineConfig, type StorylineInput } from '../config';
import salesElevator from '../storylines/sales-elevator.json';
import { createEngine, IntentError, type Engine } from './engine';
import { neededStyles } from './policies';

/**
 * Business variables, choice events, flags and conditions, and delayed follow ups (D136 to D138,
 * docs/SIMULATION.md 6.5 to 6.7), on Sales Elevator with the new blocks added. Each test names the rule.
 */

const base = salesElevator as unknown as StorylineInput;
type EventIn = NonNullable<StorylineInput['events']>[number];
type ChoiceIn = NonNullable<EventIn['choice']>;
function storyline(extra: Partial<StorylineInput>): StorylineConfig {
  const p = parseStoryline({ ...structuredClone(base), events: [], triggers: [], ...extra });
  if (!p.ok) throw new Error(p.issues.join('\n'));
  return p.config;
}

const BUDGET = { key: 'budget', name: 'Budget', format: 'money' as const, start: 50000, min: 0, max: 100000 };
const CSAT = { key: 'csat', name: 'Customer satisfaction', format: 'percent' as const, start: 70, min: 0, max: 100, drift: -2, weight: 0.2 };

/** The example the brief asks for: cutting the training budget in week 2 comes back in week 4 when morale is low. */
const TRAINING_CUT: EventIn & { choice: ChoiceIn } = {
  key: 'training_budget', title: 'The training budget', body: { he: 'Finance asks you to cut a cost line this quarter.', she: 'Finance asks you to cut a cost line this quarter.' },
  card: 'diagnostic' as const, period: 2, subPeriod: 1, target: 'team',
  choice: {
    known: ['Training is booked for three people next month.'],
    within: 2, default: 'travel',
    options: [
      { key: 'cut', label: 'Cut the training budget', outcome: 'Finance is happy. The three people hear their courses are off.', people: [0, -3, 0] as [number, number, number], who: 'team', business: { variables: { budget: -10000 }, set: ['budget_cut'] }, read: [{ skill: 'results_ownership', band: 'adequate' as const }] },
      { key: 'travel', label: 'Cut travel instead', outcome: 'Fewer client visits this quarter, training goes ahead.', business: { variables: { budget: -8000, csat: -5 } }, read: [{ skill: 'coaching_for_growth', band: 'strong' as const }] }
    ]
  }
};
const TRAINING_ASK: EventIn & { if: NonNullable<EventIn['if']> } = {
  key: 'training_ask', title: 'Two people ask for the training you cut', body: { he: 'Two of your team ask when the training will be back.', she: 'Two of your team ask when the training will be back.' },
  card: 'signal' as const, period: 4, subPeriod: 1, target: 'team', impact: [0, -4, 0] as [number, number, number],
  if: [{ kind: 'flag' as const, flag: 'budget_cut' }, { kind: 'metric' as const, metric: 'teamMorale' as const, op: 'below' as const, value: 60 }]
};

async function toBoard(e: Engine) {
  if (e.view().phase === 'style') await e.dispatch({ type: 'confirmStyles', styles: await neededStyles(e) });
}
/** Spends a day on Assess (no effect on anyone), so the next sub-period runs: events on it play. */
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

describe('business variables (D136)', () => {
  it('start where authored, show on the board, drift at each period end and stay in range', async () => {
    const c = storyline({ variables: [BUDGET, CSAT, { key: 'hidden', name: 'Hidden', start: 5, shown: false }] });
    const e = createEngine(c, { seed: 1 });
    expect(e.view().variables.map(v => [v.key, v.value])).toEqual([['budget', 50000], ['csat', 70]]);
    await toBoard(e);
    await nextWeek(e);
    const v = en(e.view());
    expect(v.variables.find(x => x.key === 'csat')!.value).toBe(68);
    expect(v.periods[0].variables).toEqual([{ key: 'budget', start: 50000, end: 50000 }, { key: 'csat', start: 70, end: 68 }]);
    expect(v.variables.find(x => x.key === 'csat')!.causes[0].delta).toBe(-2);
  });

  it('take a share of the Business pillar by weight, revenue keeping the rest', async () => {
    const c = storyline({ variables: [{ ...CSAT, drift: 0, start: 100, weight: 0.5 }] });
    const plain = storyline({});
    const a = createEngine(c, { seed: 2 }), b = createEngine(plain, { seed: 2 });
    for (const e of [a, b]) { await toBoard(e); await nextWeek(e); }
    const ra = a.view().score.business, rb = b.view().score.business;
    // Revenue alone is rb; half of it plus half of a full variable (100) is the weighted pillar.
    expect(ra).toBeCloseTo(0.5 * rb + 50, 0);
  });

  it('refuse a reference to a variable that does not exist, and weights over 80%', () => {
    expect(parseStoryline({ ...structuredClone(base), variables: [BUDGET], events: [{ ...TRAINING_CUT, choice: { ...TRAINING_CUT.choice, options: [{ ...TRAINING_CUT.choice.options[0], business: { variables: { nope: 1 } } }, TRAINING_CUT.choice.options[1]] } }] }))
      .toMatchObject({ ok: false });
    expect(parseStoryline({ ...structuredClone(base), variables: [{ ...BUDGET, weight: 0.5 }, { ...CSAT, weight: 0.5 }] })).toMatchObject({ ok: false });
  });

  it('move with an action option, always or by how well the approach fitted', async () => {
    const opts = (base.actions.find(a => a.key === 'energize')!.options).map(o => ({ ...o, business: { always: { variables: { budget: -1000 } }, m0: { variables: { csat: 3 } } } }));
    const c = storyline({ variables: [BUDGET, { ...CSAT, drift: 0 }], actions: base.actions.map(a => (a.key === 'energize' ? { ...a, options: opts } : a)) });
    const e = createEngine(c, { seed: 3 });
    await toBoard(e);
    await e.dispatch({ type: 'planAction', action: 'energize', option: 'team_lunch', memberIds: [] });
    const v = e.view();
    expect(v.variables.find(x => x.key === 'budget')!.value).toBe(49000);
    // The weekly styles fitted, so most people met the team lunch well: the fit level's effect applies too.
    expect(v.variables.find(x => x.key === 'csat')!.value).toBe(73);
  });
});

describe('choice events (D137)', () => {
  const c = storyline({ variables: [BUDGET, { ...CSAT, drift: 0 }], events: [TRAINING_CUT, TRAINING_ASK] });

  it('open a decision on a card with the options and what is known, never the consequences', async () => {
    const e = createEngine(c, { seed: 4 });
    await toBoard(e);
    await nextWeek(e);
    await day(e);
    const v = en(e.view());
    const card = v.cards.find(x => x.key === 'training_budget')!;
    expect(card.choiceId).toBeTruthy();
    expect(v.openChoices).toHaveLength(1);
    expect(v.openChoices[0]).toMatchObject({ id: card.choiceId, known: ['Training is booked for three people next month.'], dueInSubPeriods: 2 });
    expect(v.openChoices[0].options.map(o => o.key)).toEqual(['cut', 'travel']);
    expect(JSON.stringify(v.openChoices)).not.toContain('budget_cut');
  });

  it('apply the option chosen: people, business variables, flags; costs no time; logged for the report', async () => {
    const e = createEngine(c, { seed: 5 });
    await toBoard(e);
    await nextWeek(e);
    await day(e);
    const id = e.view().openChoices[0].id;
    const left = e.view().clock.capacityLeft;
    const r = await e.dispatch({ type: 'decide', choiceId: id, option: 'cut' });
    const v = en(r.view);
    expect(v.clock.capacityLeft).toBe(left);
    expect(v.openChoices).toEqual([]);
    expect(v.cards.some(x => x.key === 'training_budget')).toBe(false);
    expect(v.variables.find(x => x.key === 'budget')!.value).toBe(40000);
    expect(r.changes.some(ch => ch.metric === 'morale' && ch.delta < 0)).toBe(true);
    expect(v.choices[0]).toMatchObject({ eventKey: 'training_budget', option: 'cut', by: 'you', outcome: 'Finance is happy. The three people hear their courses are off.', variables: [{ key: 'budget', delta: -10000, name: 'Budget' }] });
    await expect(e.dispatch({ type: 'decide', choiceId: id, option: 'travel' })).rejects.toBeInstanceOf(IntentError);
  });

  it('take the default when the deadline passes, and nobody gets the leadership read for it', async () => {
    const e = createEngine(c, { seed: 6 });
    await toBoard(e);
    await nextWeek(e);
    await nextWeek(e);
    const v = en(e.view());
    expect(v.openChoices).toEqual([]);
    expect(v.choices[0]).toMatchObject({ option: 'travel', by: 'default' });
    expect(v.variables.find(x => x.key === 'csat')!.value).toBe(65);
  });

  it('feed the leadership read into the skill evidence and the Leadership pillar', async () => {
    const e = createEngine(c, { seed: 7 });
    await toBoard(e);
    await nextWeek(e);
    await day(e);
    expect(e.view().score.leadership).toBe(100);
    await e.dispatch({ type: 'decide', choiceId: e.view().openChoices[0].id, option: 'cut' });
    // Every weekly style fitted (100); with no conversation yet, the choice's Adequate read (70) is the band mean.
    expect(e.view().score.leadership).toBe(85);
    expect(e.summary().skills.find(s => s.key === 'results_ownership')!.observations).toBe(1);
  });
});

describe('flags and conditions on earlier choices (D138)', () => {
  const c = storyline({ variables: [BUDGET, { ...CSAT, drift: 0 }], events: [TRAINING_CUT, TRAINING_ASK] });

  async function playTo(option: 'cut' | 'travel', weeks = 4) {
    const e = createEngine(c, { seed: 8 });
    await toBoard(e);
    await nextWeek(e);
    await day(e);
    await e.dispatch({ type: 'decide', choiceId: e.view().openChoices[0].id, option });
    for (let w = 2; w < weeks; w++) await nextWeek(e);
    await day(e);
    return e;
  }

  it('cutting the training budget in week 2 brings "Two people ask for the training you cut" in week 4, when morale is low', async () => {
    const e = await playTo('cut');
    const v = en(e.view());
    expect(v.clock.period).toBe(4);
    expect(v.history.some(l => l.title === 'Two people ask for the training you cut')).toBe(true);
    expect(v.choices[0].triggered).toEqual([{ key: 'training_ask', title: 'Two people ask for the training you cut', period: 4 }]);
  });

  it('cutting travel instead never brings it', async () => {
    const e = await playTo('travel', 6);
    expect(en(e.view()).history.some(l => l.title === 'Two people ask for the training you cut')).toBe(false);
  });

  it('the metric clause holds it back too: when team morale is not under its value, the event is skipped', async () => {
    const high = storyline({ variables: [BUDGET, { ...CSAT, drift: 0 }], events: [TRAINING_CUT, { ...TRAINING_ASK, if: [TRAINING_ASK.if[0], { kind: 'metric', metric: 'teamMorale', op: 'below', value: 5 }] }] });
    const e = createEngine(high, { seed: 8 });
    await toBoard(e);
    await nextWeek(e);
    await day(e);
    await e.dispatch({ type: 'decide', choiceId: e.view().openChoices[0].id, option: 'cut' });
    for (let w = 2; w < 5; w++) await nextWeek(e);
    expect(en(e.view()).history.some(l => l.title === 'Two people ask for the training you cut')).toBe(false);
  });

  it('an event timed only by a condition plays the first sub-period it holds: counters and variables', async () => {
    const watch = { key: 'over_budget', title: 'Over budget', body: { he: 'Finance flags the overspend.', she: 'Finance flags the overspend.' }, card: 'crisis' as const, target: 'team', impact: [0, -2, 0] as [number, number, number],
      if: [{ kind: 'variable' as const, variable: 'budget', op: 'below' as const, value: 45000 }, { kind: 'counter' as const, counter: 'cuts', op: 'atLeast' as const, value: 1 }] };
    const cut = { ...TRAINING_CUT, choice: { ...TRAINING_CUT.choice, options: [{ ...TRAINING_CUT.choice.options[0], business: { ...TRAINING_CUT.choice.options[0].business, count: { cuts: 1 } } }, TRAINING_CUT.choice.options[1]] } };
    const e = createEngine(storyline({ variables: [BUDGET, { ...CSAT, drift: 0 }], events: [cut, watch] }), { seed: 9 });
    await toBoard(e);
    await nextWeek(e);
    await day(e);
    expect(en(e.view()).history.some(l => l.title === 'Over budget')).toBe(false);
    await e.dispatch({ type: 'decide', choiceId: e.view().openChoices[0].id, option: 'cut' });
    await day(e);
    expect(en(e.view()).history.some(l => l.title === 'Over budget')).toBe(true);
  });
});

describe('delayed follow ups (D138)', () => {
  it('a choice schedules a later event after its days and weeks', async () => {
    const later = { key: 'audit', title: 'The audit', body: { he: 'The audit you set up reports back.', she: 'The audit you set up reports back.' }, card: 'diagnostic' as const, target: 'team', impact: [0, 0, 0] as [number, number, number] };
    const ch = { ...TRAINING_CUT, choice: { ...TRAINING_CUT.choice, options: [{ ...TRAINING_CUT.choice.options[0], business: { followUps: [{ event: 'audit', weeks: 1, days: 2 }] } }, TRAINING_CUT.choice.options[1]] } };
    const e = createEngine(storyline({ variables: [BUDGET, CSAT], events: [ch, later] }), { seed: 10 });
    await toBoard(e);
    await nextWeek(e);
    await day(e);
    await e.dispatch({ type: 'decide', choiceId: e.view().openChoices[0].id, option: 'cut' });
    // Decided after day 1 of week 2 (absolute day 6): a week and 2 days later is day 13, week 3 day 3.
    await nextWeek(e);
    const fired = () => en(e.view()).history.find(l => l.title === 'The audit');
    await day(e);
    await day(e);
    expect(fired()).toBeUndefined();
    await day(e);
    expect(fired()).toMatchObject({ period: 3, sub: 3 });
    expect(en(e.view()).choices[0].triggered.map(t => t.key)).toEqual(['audit']);
  });

  it('an escalation can wait: an ignored event comes back after its delay', async () => {
    const ignored = { key: 'ask', title: 'A request', body: { he: 'Kent asks for a word.', she: 'Kent asks for a word.' }, card: 'signal' as const, period: 1, subPeriod: 1, target: 'kent', impact: [0, 0, 0] as [number, number, number],
      response: { actions: ['f2f'], within: 1 }, escalation: { sponsor: false, event: 'back', delay: { weeks: 1 } } };
    const back = { key: 'back', title: 'The request again', body: { he: 'Kent asks again, less patiently.', she: 'Kent asks again, less patiently.' }, card: 'signal' as const, target: 'kent', impact: [0, -3, 0] as [number, number, number] };
    const e = createEngine(storyline({ events: [ignored, back] }), { seed: 11 });
    await toBoard(e);
    await nextWeek(e);
    // Due after day 2 of week 1, plus a week of 5 days: day 2 of week 2 at the earliest.
    expect(en(e.view()).history.some(l => l.title === 'The request again')).toBe(false);
    await nextWeek(e);
    expect(en(e.view()).history.find(l => l.title === 'The request again')?.period).toBe(2);
  });
});
