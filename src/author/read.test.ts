import { describe, expect, it } from 'vitest';
import { Brief, type QuestionId } from '../api/author';
import { copyViolations } from '../i18n/copy';
import { MockDrafter } from './drafter';
import { applyAnswer, planQuestions, readDocument } from './questions';
import { frameworkOf, isLong, readBrief, sentences } from './read';
import { recommendLens } from './recommend';
import { draftContext } from './storyline';

/**
 * The audit's detailed brief, in one paragraph (D146): a VP of Customer Operations at a US health insurer merging with
 * a partner company, a team, the challenge, six stakeholders, objectives, three dilemmas, a tone, a named client
 * framework and a run length. It was stored whole as "Participants"; only the industry and region were kept.
 */
export const MERGER_BRIEF = 'We need a simulation for VPs of Customer Operations at Northstar Health Partners, a US health insurer that is merging with its partner company, Bluewave Care. '
  + 'Each VP leads a team of 8 directors and managers across claims, member services and the contact centre. '
  + 'The challenge is keeping service levels and morale up while two customer operations teams merge onto one platform over the next two quarters. '
  + 'Key stakeholders are Dana Whitfield, the COO and their boss; Raj Patel, Head of Claims at Bluewave Care, a peer; Lisa Chen, the HR business partner; Marcus Bell, the CFO; Priya Nair, the union representative; and Tom Alvarez, account lead for their largest employer client. '
  + 'Objectives: retain key talent through the merger, keep member satisfaction above 85 percent, and deliver the synergy savings the board expects. '
  + 'The dilemmas we want them to face are short-term revenue vs customer trust, team wellbeing vs delivery deadlines, and standardising on one process or keeping the best of both. '
  + 'The tone should be serious and realistic. Use our LEAD framework: Listen, Empower, Align, Deliver. Each run should take about an hour.';

const blank = () => Brief.parse({});
const plain = (s: string) => { expect(s).not.toMatch(/—|–/); expect(copyViolations(s), s).toEqual([]); };

describe('reading a detailed brief (D146)', () => {
  it('takes every field the chat asks, and the stakeholders, objectives and dilemmas', () => {
    const r = readBrief(MERGER_BRIEF, blank());
    expect(r.clarify).toBeUndefined();
    expect(r.fields).toMatchObject({
      roleLevel: 'VPs of Customer Operations',
      industry: 'Healthcare',
      client: 'Northstar Health Partners',
      teamSize: 8,
      challenge: 'Keeping service levels and morale up while two customer operations teams merge onto one platform over the next two quarters',
      tone: 'professional',
      duration: 'standard',
      region: 'us',
      framework: 'Use our LEAD framework: Listen, Empower, Align, Deliver.'
    });
    expect(r.fields.stakeholders).toEqual([
      { name: 'Dana Whitfield', role: 'COO', relation: 'boss' },
      { name: 'Raj Patel', role: 'Head of Claims at Bluewave Care', relation: 'peer' },
      { name: 'Lisa Chen', role: 'HR business partner', relation: 'HR partner' },
      { name: 'Marcus Bell', role: 'CFO', relation: 'senior leader' },
      { name: 'Priya Nair', role: 'union representative', relation: 'union' },
      { name: 'Tom Alvarez', role: 'account lead for their largest employer client', relation: 'client' }
    ]);
    expect(r.fields.objectives).toEqual(['Retain key talent through the merger', 'Keep member satisfaction above 85 percent', 'Deliver the synergy savings the board expects']);
    expect(r.fields.dilemmas).toEqual([
      { title: 'Short term revenue or customer trust', a: 'Short term revenue', b: 'Customer trust', stake: '' },
      { title: 'Team wellbeing or delivery deadlines', a: 'Team wellbeing', b: 'Delivery deadlines', stake: '' },
      { title: 'Standardising on one process or keeping the best of both', a: 'Standardising on one process', b: 'Keeping the best of both', stake: '' }
    ]);
    expect(frameworkOf(r.fields.framework!).map(d => d.name)).toEqual(['Listen', 'Empower', 'Align', 'Deliver']);
  });

  it('as the first answer: participants are not the whole paragraph, the rest is said back, and answered questions are skipped', async () => {
    expect(isLong(MERGER_BRIEF)).toBe(true);
    const r = applyAnswer(blank(), 'role_level', MERGER_BRIEF);
    expect(r.error).toBeUndefined();
    expect(r.answered).toBe(true);
    expect(r.brief.roleLevel).toBe('VPs of Customer Operations');
    expect(r.took!.map(t => t.label)).toEqual(['Participants', 'Industry', 'Client', 'Challenge', 'Team size', 'Run length', 'Language and region', 'Framework', 'Tone', 'Stakeholders', 'Objectives', 'Dilemmas']);
    expect(r.took!.find(t => t.id === 'framework')?.value).toBe('LEAD: Listen, Empower, Align, Deliver');
    expect(r.took!.find(t => t.id === 'stakeholders')?.value).toContain('Dana Whitfield (COO, boss)');
    for (const d of r.brief.dilemmas!) plain(`${d.title} ${d.a} ${d.b}`);
    const taken = r.took!.map(t => t.id).filter((id): id is QuestionId => !['role_level', 'stakeholders', 'objectives', 'dilemmas'].includes(id));
    // Only the work process is left to ask; the brief's answers are not asked again to reach five.
    expect(planQuestions(r.brief, ['role_level'], taken)).toEqual({ next: 'process', n: 2, about: 2 });
    expect(planQuestions(r.brief, ['role_level', 'process'], taken).next).toBeNull();
    const turn = await new MockDrafter().turn({ brief: r.brief, asked: ['role_level', 'process'], answers: {}, taken });
    expect(turn.kind).toBe('lens');
    // The named framework leads the recommendation, with its four skills.
    expect(recommendLens(r.brief).id).toBe('client_model');
    expect(turn.kind === 'lens' && turn.framework?.map(d => d.name)).toEqual(['Listen', 'Empower', 'Align', 'Deliver']);
  });

  it('never invents a client: an upload keeps the named one, and a fictional name only when none is given', () => {
    const up = readDocument(blank(), { name: 'brief.txt', text: MERGER_BRIEF });
    expect(up.brief.client).toBe('Northstar Health Partners');
    expect(draftContext(up.brief).company).toBe('Northstar Health Partners');
    expect(up.took.map(t => t.id)).toContain('client');
    // A partner company is never taken as the client.
    expect(readBrief('Our managers at a hospital group are merging with Bluewave Care. The challenge is morale.', blank()).fields.client).toBeUndefined();
    // No client named: the brief says nothing, and the draft's name is fictional (said in the draft, D146).
    const none = readDocument(blank(), { name: 'brief.txt', text: 'First time managers at a regional hospital. The challenge is burnout in the night shift team. Each leads a team of 10 nurses.' });
    expect(none.brief.client).toBeUndefined();
    expect(none.brief.teamSize).toBe(10);
  });

  it('splits sentences without breaking on abbreviations', () => {
    expect(sentences('We sell to U.S. clients, e.g. banks. The team is new.\nTone: warm')).toEqual(['We sell to U.S. clients, e.g. banks.', 'The team is new.', 'Tone: warm']);
  });
});

describe('clarifying questions (D147)', () => {
  it('"create a leadership simulation for senior managers" asks who they lead, and is never an industry', () => {
    const r = applyAnswer(blank(), 'role_level', 'create a leadership simulation for senior managers');
    expect(r.brief.roleLevel).toBe('Senior managers');
    expect(r.clarify?.id).toBe('role_level');
    expect(r.clarify?.prompt).toBe('Senior managers leading which kind of team? It decides the work the team does and the people in it.');
    expect(r.clarify?.choices.map(c => c.label)).toEqual(['Sales teams', 'Service or operations teams', 'Product or engineering teams', 'Keep it as senior managers']);
    const picked = applyAnswer(r.brief, 'role_level', r.clarify!.choices[0].value, { clarified: true });
    expect(picked.brief.roleLevel).toBe('Senior managers leading sales teams');
    expect(picked.clarify).toBeUndefined();
    // Typed where the industry goes, it is a question, not an industry of "senior managers".
    const ind = applyAnswer(blank(), 'industry', 'create a leadership simulation for senior managers');
    expect(ind.brief.industry).toBeUndefined();
    expect(ind.clarify?.id).toBe('industry');
    expect(ind.clarify?.prompt).toBe('That sounds like who the participants are, not an industry. Which industry is the simulation set in?');
    expect(ind.clarify?.choices.at(-1)?.label).toBe('Decide for me');
    // The chips say exactly what they mean: no question after them.
    expect(applyAnswer(blank(), 'role_level', 'Senior leaders').clarify).toBeUndefined();
    expect(applyAnswer(blank(), 'role_level', 'First time sales managers, about two years into the role.').clarify).toBeUndefined();
  });

  it('two industries, or a correction, get one question with both as choices', () => {
    for (const t of ['banking but actually a hospital', 'banking and healthcare']) {
      const r = applyAnswer(blank(), 'industry', t);
      expect(r.brief.industry, t).toBeUndefined();
      expect(r.clarify, t).toEqual({ id: 'industry', prompt: 'You mention Banking and financial services and Healthcare. Which industry should the story be set in?', choices: [{ label: 'Banking and financial services', value: 'Banking and financial services' }, { label: 'Healthcare', value: 'Healthcare' }] });
      plain(r.clarify!.prompt);
    }
    expect(applyAnswer(blank(), 'industry', 'Healthcare', { clarified: true }).brief.industry).toBe('Healthcare');
    // A health insurer is healthcare, not two industries.
    expect(applyAnswer(blank(), 'industry', 'a health insurer').brief.industry).toBe('Healthcare');
  });

  it('a brief that contradicts itself on team size, or says "a few", asks instead of guessing', () => {
    const two = readBrief('First time managers at Acme Bank, a retail bank. Each leads a team of 8. The challenge is that their 12 direct reports burn out.', blank());
    expect(two.fields.teamSize).toBeUndefined();
    expect(two.clarify).toMatchObject({ id: 'team_size', prompt: 'You mention teams of 8 and 12. Which size should the participant\'s team be?', choices: [{ value: '8' }, { value: '12' }] });
    const few = applyAnswer(blank(), 'team_size', 'a few');
    expect(few.clarify?.choices.map(c => c.value)).toEqual(['6', '8', '10', '12']);
    const big = readBrief('Directors of Sales at Acme Bank lead a team of 40 people. The challenge is low morale after a restructure, which we must fix.', blank());
    expect(big.clarify?.prompt).toBe('iLead teams have 6 to 12 people, so 40 cannot play as it is. Which size should the participant\'s team be?');
    const ambiguous = readDocument(blank(), { name: 'b.txt', text: 'Managers at Acme Bank lead teams of 10. The bank also runs three hospitals for its staff, and the hospitals matter as much. The challenge is low morale across both.' });
    expect(ambiguous.clarify?.id).toBe('industry');
    expect(ambiguous.brief.industry).toBeUndefined();
  });
});
