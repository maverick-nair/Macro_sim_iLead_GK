import { describe, expect, it } from 'vitest';
import { Brief } from '../api/author';
import { parseStoryline } from '../engine/config';
import { copyViolations } from '../i18n/copy';
import { choicesFromDilemmas, variableFromObjective, variablesFromBrief } from './dilemmas';
import { MERGER_BRIEF } from './fixtures';
import { toStoryline } from './model/export';
import { emptyChat, seedDraft } from './model/seed';
import { buildModule } from './module';
import { readBrief } from './read';
import { draftStoryline } from './storyline';

/**
 * Decisions and business variables seeded from the brief (D153), on the audit's merger brief: three dilemmas and an
 * objective with a bar ("member satisfaction above 85 percent").
 */
const brief = Brief.parse({ ...readBrief(MERGER_BRIEF, Brief.parse({})).fields, process: ['Intake', 'Review', 'Resolve', 'Follow up'] });
const plain = (s: string) => { expect(s).not.toMatch(/—|–/); expect(copyViolations(s), s).toEqual([]); };

describe('business variables from the objectives (D153)', () => {
  it('maps a satisfaction bar to a percent measure, savings to money, and leaves retention to people dynamics', () => {
    expect(brief.objectives).toEqual(['Retain key talent through the merger', 'Keep member satisfaction above 85 percent', 'Deliver the synergy savings the board expects']);
    expect(variableFromObjective('Retain key talent through the merger', 400000)).toBeNull();
    expect(variableFromObjective('Keep member satisfaction above 85 percent', 400000)).toMatchObject({
      key: 'member_satisfaction', name: 'Member satisfaction', format: 'percent', start: 88, min: 0, max: 100, drift: -1, higherIsBetter: true, customer: true
    });
    expect(variableFromObjective('Keep member satisfaction above 85 percent', 400000)!.about).toContain('The objective: keep it above 85%.');
    expect(variableFromObjective('Deliver the synergy savings the board expects', 400000)).toMatchObject({ key: 'synergy_savings', name: 'Synergy savings', format: 'money', start: 0, min: 0, max: 100000 });
    const vars = variablesFromBrief(brief.objectives!, 400000);
    // The customer measure the brief names replaces the default Customer trust; Budget stays.
    expect(vars.map(v => v.key)).toEqual(['budget', 'member_satisfaction', 'synergy_savings']);
    expect(vars.reduce((a, v) => a + v.weight, 0)).toBeLessThanOrEqual(80);
    // Without objectives that map, the defaults.
    expect(variablesFromBrief(['Retain key talent'], 400000).map(v => v.key)).toEqual(['budget', 'customer_trust']);
  });
});

describe('decisions from the dilemmas (D153)', () => {
  const variables = variablesFromBrief(brief.objectives!, 400000);
  const skills = [{ key: 'listen', name: 'Listen' }, { key: 'empower', name: 'Empower' }];
  const choices = choicesFromDilemmas(brief.dilemmas!, { weeks: 8, target: 400000, skills, variables });

  it('makes one decision per dilemma, spread over the run, with the dilemma as its title', () => {
    expect(choices.map(c => [c.title, c.week])).toEqual([
      ['Short term revenue or customer trust', 2], ['Team wellbeing or delivery deadlines', 4], ['Standardising on one process or keeping the best of both', 6]
    ]);
    expect(choices.map(c => c.options.map(o => o.label))).toEqual([
      ['Put short term revenue first', 'Put customer trust first'],
      ['Put delivery deadlines first', 'Put team wellbeing first'],
      ['Standardising on one process', 'Keeping the best of both']
    ]);
    for (const c of choices) {
      expect(c.default).toBe('push');
      for (const s of [c.title, c.body, ...c.known, ...c.options.flatMap(o => [o.label, o.outcome])]) plain(s);
    }
  });

  it('gives each option opposing effects on the business and on people or customers, and a leadership read', () => {
    const [revenue, wellbeing, process] = choices;
    const [push, protect] = revenue.options;
    // Revenue now against the customer measure the objective named.
    expect(push.revenue).toBeGreaterThan(0);
    expect(push.variables.member_satisfaction).toBeLessThan(0);
    expect(protect.variables.member_satisfaction).toBeGreaterThan(0);
    expect(protect.sponsor).toBeLessThan(0);
    // Deadlines against wellbeing: the people pay one way, customers wait the other.
    expect(wellbeing.options[0].morale).toBeLessThan(0);
    expect(wellbeing.options[0].result).toBeGreaterThan(0);
    expect(wellbeing.options[1].morale).toBeGreaterThan(0);
    expect(wellbeing.options[1].variables.member_satisfaction).toBeLessThan(0);
    // One process saves money and costs morale; keeping both costs budget and keeps people.
    expect(process.options[0].variables.synergy_savings).toBeGreaterThan(0);
    expect(process.options[0].morale).toBeLessThan(0);
    expect(process.options[1].variables.budget).toBeLessThan(0);
    expect(process.options[1].morale).toBeGreaterThan(0);
    // The business option is never the stronger leadership read.
    for (const c of choices) {
      expect(c.options[0].read.map(r => [r.skill.key, r.band])).toEqual([['listen', 'adequate'], ['empower', 'weak']]);
      expect(c.options[1].read.map(r => [r.skill.key, r.band])).toEqual([['listen', 'strong'], ['empower', 'adequate']]);
    }
  });

  it('a brief without dilemmas seeds none, and the draft keeps its default decisions', () => {
    expect(choicesFromDilemmas([], { weeks: 8, target: 400000, skills, variables })).toEqual([]);
    const d = seedDraft({ ...emptyChat(), brief: Brief.parse({ industry: 'Banking and financial services' }) }, 'workspace');
    expect(d.events.filter(e => e.choice).map(e => e.key)).toEqual(['discount_decision', 'budget_decision']);
    expect(d.variables.map(v => v.key)).toEqual(['budget', 'customer_trust']);
  });
});

describe('both drafters seed them (D153)', () => {
  it('the offline draft: the variables and three decisions, exported as a storyline that plays them', () => {
    const d = seedDraft({ ...emptyChat(), brief }, 'workspace');
    expect(d.variables.map(v => v.name)).toEqual(['Budget', 'Member satisfaction', 'Synergy savings']);
    const decisions = d.events.filter(e => e.choice);
    expect(decisions.map(e => e.title)).toEqual(['Short term revenue or customer trust', 'Team wellbeing or delivery deadlines', 'Standardising on one process or keeping the best of both']);
    // The leadership read names the draft's own skills.
    const names = d.scoring.skills.filter(s => !s.reportOnly).map(s => s.name);
    for (const e of decisions) for (const o of e.choice!.options) for (const r of o.read) expect(names).toContain(r.skill);
    const out = toStoryline(d);
    expect(out.issues).toEqual([]);
    const p = parseStoryline(out.storyline);
    if (!p.ok) throw new Error(p.issues.join('\n'));
    const played = p.config.events.filter(e => e.choice);
    expect(played).toHaveLength(3);
    expect(played[0].choice!.options[0].business.variables).toMatchObject({ member_satisfaction: -5 });
    expect(p.config.variables.find(v => v.key === 'member_satisfaction')).toMatchObject({ start: 88, weight: 0.2 });
  });

  it('the template storyline the model words carries them too, and parses', () => {
    const module = buildModule(brief, { primary: 'readiness_based', secondary: null, clientDimensions: [] }, true);
    const sl = draftStoryline(brief, module);
    const p = parseStoryline(sl);
    if (!p.ok) throw new Error(p.issues.join('\n'));
    expect(p.config.variables.map(v => v.key)).toEqual(['budget', 'member_satisfaction', 'synergy_savings']);
    expect(p.config.events.filter(e => e.choice).map(e => e.title)).toEqual(['Short term revenue or customer trust', 'Team wellbeing or delivery deadlines', 'Standardising on one process or keeping the best of both']);
  });
});
