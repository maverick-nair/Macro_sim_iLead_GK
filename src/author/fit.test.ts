import { describe, expect, it } from 'vitest';
import { Brief, QUESTION_IDS } from '../api/author';
import { copyViolations } from '../i18n/copy';
import { CHALLENGES, ROLE_LEVELS } from './context';
import { fitAccepted, fitCheck, fitMessage, SENIOR_NOTE } from './fit';
import { applyAnswer, DECIDE, questionFor } from './questions';
import { INTRO } from './ui/journey/Intro';
import { MOCK_ANSWERS } from './voice';

/** The audit's brief: a healthcare merger, led by VPs, across functions, with a board, unions and a budget. */
const MERGER = 'Our participants are newly appointed VPs at a regional healthcare system that has just merged with a rival hospital group. '
  + 'They must integrate clinical and administrative functions across both organizations, keep the board and physician leaders aligned, '
  + 'negotiate with the nurses\' unions and decide where to cut a 12 million budget while patient satisfaction holds up.';

const blank = () => Brief.parse({});
const noDash = (s: string) => { expect(s).not.toMatch(/\u2014|\u2013/); expect(copyViolations(s), s).toEqual([]); };

describe('the template fit check (D133)', () => {
  it('names everything the merger brief asks for that iLead cannot play, and the nearest fit', () => {
    const f = fitCheck(MERGER);
    expect(f.concerns.map(c => c.kind)).toEqual(['stakeholders', 'merger', 'negotiation', 'budget']);
    expect(f.senior).toBe(true);
    const say = fitMessage(f.concerns);
    expect(say).toMatch(/^Before I go on, a plain word on fit\. An iLead simulation is one leader with a team of 6 to 12 direct reports\. It cannot play /);
    expect(say).toContain('a merger or an integration across several functions');
    expect(say).toContain('**The nearest fit:** the participant leads their own team');
    expect(say).toMatch(/continue with a team leadership version, or change the brief\?$/);
    noDash(say.replace(/\*\*/g, ''));
    noDash(fitAccepted(f.concerns));
  });

  it('raises no team, and leaves a supported brief alone', () => {
    expect(fitCheck('Individual contributors with no direct reports who influence without authority').concerns.map(c => c.kind)).toEqual(['no_team']);
    expect(fitCheck('Strong individual contributors moving into leadership').concerns).toEqual([]);
    // The chat's own suggestions and the mock voice's answers never trip it.
    for (const t of [...ROLE_LEVELS.map(r => r.label), ...CHALLENGES.map(c => c.label), ...Object.values(MOCK_ANSWERS)]) expect(fitCheck(t).concerns, t).toEqual([]);
    expect(fitCheck('Deals stall at negotiation and new reps burn out in the first quarter.').concerns).toEqual([]);
    expect(fitCheck('Our team is going through a merger and people worry about their jobs').concerns).toEqual([]);
  });

  it('says once that senior leaders get their own leadership team', () => {
    const f = fitCheck('create a leadership simulation for senior managers');
    expect(f).toEqual({ concerns: [], senior: true });
    noDash(SENIOR_NOTE);
    const r = applyAnswer(blank(), 'role_level', 'create a leadership simulation for senior managers');
    expect(r.error).toBeUndefined();
    expect(r.brief.roleLevel).toBe('Senior managers');
  });
});

describe('answers the chat does not take (D133)', () => {
  it('asks again when tone words are given as the work process', () => {
    const r = applyAnswer(blank(), 'process', 'warm and brisk and direct');
    expect(r.error).toBe('Those sound like a tone (warm, brisk, direct), not the steps of a work process. What steps does the team\'s work move through, in order? For example: Intake, Diagnose, Resolve, Review. You can set the tone later.');
    expect(r.brief.process).toBeUndefined();
    expect(applyAnswer(blank(), 'process', 'Intake, Triage, Resolve').brief.process).toEqual(['Intake', 'Triage', 'Resolve']);
  });

  it('never takes "idk", "dunno" or "not sure yet" as a company name or an industry, and offers to decide', () => {
    for (const t of ['idk', 'dunno', 'not sure yet', 'Not sure.', 'I don\'t know', 'no idea']) {
      const client = applyAnswer(blank(), 'client', t);
      expect(client.error, t).toMatch(/^That is fine\. Choose Fictional company/);
      expect(client.brief.client).toBeUndefined();
      const industry = applyAnswer(blank(), 'industry', t);
      expect(industry.error, t).toBe(`No problem. Pick an industry below, or choose ${DECIDE} and I will pick one you can change later.`);
      expect(industry.brief.industry).toBeUndefined();
      expect(applyAnswer(blank(), 'language', t).error, t).toMatch(/English, global is a safe start/);
      expect(applyAnswer(blank(), 'role_level', t).error, t).toBeDefined();
    }
    expect(questionFor('industry').chips.at(-1)).toEqual({ label: DECIDE, value: DECIDE });
    const decided = applyAnswer(Brief.parse({ challenge: 'Our bank branches lose clients' }), 'industry', DECIDE);
    expect(decided.brief.industry).toBe('Banking and financial services');
    expect(decided.note).toBe('I picked Banking and financial services for now. Change it any time in the Brief.');
    expect(applyAnswer(blank(), 'client', 'you decide')).toMatchObject({ brief: { client: null }, note: expect.stringMatching(/fictional company/) });
    // Not sure about a framework means none, for now.
    expect(applyAnswer(blank(), 'framework', 'not sure yet').brief.framework).toBeNull();
  });

  it('offers team sizes for "a few" instead of asking the same thing again', () => {
    const r = applyAnswer(blank(), 'team_size', 'a few');
    expect(r.error).toBe('How many people? iLead teams have 6 to 12. Pick 6 for a small team, 8 or 10 for a typical one, or 12 for a large one.');
    expect(applyAnswer(blank(), 'team_size', '4').error).toBe('iLead teams have 6 to 12 people, so 4 is too few to play. Pick 6 for a small team.');
    expect(applyAnswer(blank(), 'team_size', '20 people').error).toMatch(/so 20 is too many to play\. Pick 12/);
    expect(applyAnswer(blank(), 'team_size', 'a few, about eight').brief.teamSize).toBe(8);
  });

  it('says why it asks the industry, duration and tone, and every question has a why', () => {
    for (const id of ['industry', 'duration', 'tone'] as const) expect(questionFor(id).help, id).toMatch(/^Why we ask: /);
    for (const id of QUESTION_IDS) expect(questionFor(id).help, id).toBeTruthy();
  });

  it('the intro and every error are plain copy', () => {
    for (const s of [INTRO.title, INTRO.what, INTRO.goodFor, INTRO.notYet, ...INTRO.glossary.flat()]) noDash(s);
    for (const id of QUESTION_IDS) { const e = applyAnswer(blank(), id, 'idk').error; if (e) noDash(e); }
    noDash(applyAnswer(blank(), 'process', 'warm and brisk and direct').error!);
  });
});
