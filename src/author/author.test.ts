import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AuthorTurnResponse, Brief, LeadershipLensModule, QUESTION_IDS, type QuestionId } from '../api/author';
import { guardCopy, guardDraft, isLensTitle } from './copyGuard';
import { firstAnswer, MockDrafter, ServerDrafter } from './drafter';
import { extractFramework } from './extract';
import { LENS_LIBRARY } from './lenses';
import { buildModule } from './module';
import { addDocument, applyAnswer, MAX_QUESTIONS, MIN_QUESTIONS, planQuestions, questionFor } from './questions';
import { recommendLens } from './recommend';
import { SAMPLE_FRAMEWORK } from './fixtures';

const empty = () => Brief.parse({});

/** Plays the chat with the first chip for every question; returns the questions asked. */
function chat(start: Brief): QuestionId[] {
  let brief = start;
  const asked: QuestionId[] = [];
  for (;;) {
    const plan = planQuestions(brief, asked);
    if (!plan.next) return asked;
    expect(plan.n).toBe(asked.length + 1);
    expect(plan.about).toBeGreaterThanOrEqual(MIN_QUESTIONS);
    expect(plan.about).toBeLessThanOrEqual(MAX_QUESTIONS);
    const q = questionFor(plan.next);
    const r = applyAnswer(brief, plan.next, q.chips[0].value);
    expect(r.error).toBeUndefined();
    brief = r.brief;
    asked.push(plan.next);
  }
}

describe('question policy', () => {
  it('asks the ten core questions in order with nothing covered', () => {
    expect(chat(empty())).toEqual([...QUESTION_IDS]);
    expect(planQuestions(empty(), [])).toEqual({ next: 'role_level', n: 1, about: 10 });
  });

  it('skips what an upload covers', () => {
    const brief = addDocument(empty(), { name: 'brief.txt', text: 'Client: Brightline\nTeam size: 8\nStages: Discover, Design, Build, Test\nWe sell software in Singapore.\nChallenge: managers rely on one style' });
    expect(brief).toMatchObject({ client: 'Brightline', teamSize: 8, process: ['Discover', 'Design', 'Build', 'Test'], industry: 'Technology', region: 'singapore', challenge: 'managers rely on one style' });
    expect(chat(brief)).toEqual(['role_level', 'duration', 'framework', 'tone', 'industry']);
  });

  it('skips what an earlier answer covers', () => {
    const r = applyAnswer(empty(), 'role_level', 'First time managers at a hospital in India');
    expect(r.brief).toMatchObject({ roleLevel: 'First time managers at a hospital in India', industry: 'Healthcare', region: 'india' });
    const asked = chat(r.brief);
    expect(asked).not.toContain('industry');
    expect(asked).not.toContain('language');
  });

  it('never asks fewer than five: covered questions come back to confirm', () => {
    const full = Brief.parse({ roleLevel: 'Senior leaders', industry: 'Retail and consumer goods', challenge: 'Growth', client: null, teamSize: 10, process: ['A', 'B', 'C'], duration: 'lite', region: 'uk', language: 'English, United Kingdom', framework: null });
    const plan = planQuestions(full, []);
    expect(plan).toMatchObject({ next: 'tone', n: 1, about: 5 });
    expect(planQuestions(full, ['tone'])).toMatchObject({ next: 'role_level', confirm: 'Senior leaders', n: 2, about: 5 });
    expect(planQuestions(full, ['tone', 'role_level', 'industry', 'challenge', 'client']).next).toBeNull();
  });

  it('checks answers it cannot use', () => {
    expect(applyAnswer(empty(), 'team_size', '30').error).toBe('iLead teams have 6 to 12 people, so 30 is too many to play. Pick 12 for a large team.');
    expect(applyAnswer(empty(), 'team_size', 'ten or so people, we think').brief.teamSize).toBe(10);
    expect(applyAnswer(empty(), 'team_size', 'twelve').brief.teamSize).toBe(12);
    expect(applyAnswer(empty(), 'team_size', '10 (default)').brief.teamSize).toBe(10);
    expect(applyAnswer(empty(), 'process', 'Just one stage').error).toBe('List 3 to 6 stage names, separated by commas.');
    expect(applyAnswer(empty(), 'process', 'Intake, Triage, Fix, Close').brief.process).toEqual(['Intake', 'Triage', 'Fix', 'Close']);
    expect(applyAnswer(empty(), 'duration', 'Lite').brief.duration).toBe('lite');
    expect(applyAnswer(empty(), 'client', 'Fictional company').brief.client).toBeNull();
    expect(applyAnswer(empty(), 'framework', 'No framework').brief.framework).toBeNull();
    expect(applyAnswer(empty(), 'tone', 'Warm and encouraging').brief.tone).toBe('warm');
    expect(applyAnswer(empty(), 'industry', '  ').error).toBeDefined();
  });

  it('offers the Sales Elevator funnel as the default process and 10 as the default team size', () => {
    expect(questionFor('process').chips[0]).toMatchObject({ label: 'Sales Elevator funnel (default)', detail: 'Leads, Qualify, Proposal, Negotiation, Conversion' });
    expect(questionFor('team_size').chips.map(c => c.label)).toContain('10 (default)');
  });
});

describe('lens recommendation precedence', () => {
  const rec = (b: Partial<Brief>) => recommendLens(Brief.parse(b));
  it('puts a client framework first', () => {
    expect(rec({ framework: SAMPLE_FRAMEWORK, challenge: 'Leading through change', roleLevel: 'Senior leaders' })).toMatchObject({ id: 'client_model', rule: 'client_framework' });
  });
  it('then the business challenge', () => {
    expect(rec({ challenge: 'Leading through change or transformation', roleLevel: 'First time managers' })).toMatchObject({ id: 'adaptive', rule: 'challenge' });
    expect(rec({ challenge: 'Hitting targets without burning out the team' }).id).toBe('inspire_deliver');
    expect(rec({ challenge: 'Our agile product teams miss sprints' }).id).toBe('servant');
    expect(rec({ challenge: 'Managers who rely on one style' }).id).toBe('six_styles');
  });
  it('then the role level', () => {
    expect(rec({ challenge: 'Growing a new market', roleLevel: 'First time managers' })).toMatchObject({ id: 'readiness_based', rule: 'role_level' });
    expect(rec({ roleLevel: 'Mid level managers' }).id).toBe('readiness_based');
    expect(rec({ roleLevel: 'Senior leaders' }).id).toBe('five_practices');
    expect(rec({ roleLevel: 'High potentials' }).id).toBe('five_practices');
    expect(rec({ roleLevel: 'Strong individual contributors moving into leadership' }).id).toBe('team_amplifier');
  });
  it('defaults to Readiness Based Leadership, in one sentence', () => {
    const r = rec({});
    expect(r).toMatchObject({ id: 'readiness_based', rule: 'default' });
    expect(r.reason.match(/\./g)).toHaveLength(1);
  });
});

describe('client framework extraction', () => {
  it('reads headings, bullets and levels', () => {
    expect(extractFramework(SAMPLE_FRAMEWORK)).toEqual([
      { name: 'Customer Obsession', behaviours: ['Starts every plan with the customer\'s problem', 'Brings customer stories into team meetings'], levels: ['Emerging', 'Practising', 'Role model'] },
      { name: 'Bold Ownership', behaviours: ['Owns outcomes end to end', 'Raises risks early and offers a fix'], levels: ['Emerging', 'Practising', 'Role model'] },
      { name: 'Growing People', behaviours: ['Gives specific, timely feedback', 'Makes time for coaching every week'], levels: ['Emerging', 'Practising', 'Role model'] }
    ]);
  });
  it('reads "Name:" headings and a levels list', () => {
    expect(extractFramework('Courage:\n* Speaks up\nCare:\n1. Listens first\n\nProficiency levels:\n- Basic\n- Expert')).toEqual([
      { name: 'Courage', behaviours: ['Speaks up'], levels: ['Basic', 'Expert'] },
      { name: 'Care', behaviours: ['Listens first'], levels: ['Basic', 'Expert'] }
    ]);
  });
  it('never invents dimensions', () => {
    expect(extractFramework('We value courage and care, and expect leaders to model both.')).toEqual([]);
    expect(extractFramework('# Brief\n- Client: Acme\n- Team size: 8')).toEqual([]);
  });
});

describe('copy guard', () => {
  it('flags each rule', () => {
    expect(guardCopy('Lead well — always')).toEqual(['em_dash']);
    expect(guardCopy('Lead well - always')).toEqual(['dash_punctuation']);
    expect(guardCopy('A follow-up')).toEqual([]);
    expect(guardCopy('A follow-up', { participant: true })).toEqual(['dash']);
    expect(guardCopy('Great work 🎉')).toEqual(['emoji']);
    expect(guardCopy('Core competencies')).toEqual(['competency']);
    expect(guardCopy('A certified Situational Leadership programme')).toEqual(['certification', 'source_name']);
    expect(guardCopy('Licensed from the framework owner')).toEqual(['certification']);
    expect(guardCopy('Based on Goleman')).toEqual(['source_name']);
    expect(guardCopy('Readiness Based Leadership builds skills.')).toEqual([]);
  });
  it('allows sources in Based on only, and KNOLSKAPE lens titles only', () => {
    expect(guardDraft({ lens: { title: 'Readiness Based Leadership', basedOn: 'Hersey and Blanchard', description: 'Fine.' } })).toEqual([]);
    expect(guardDraft({ lens: { title: 'Situational Leadership II', description: 'Hersey' } }).map(i => `${i.path} ${i.rule}`)).toEqual(['lens.title source_name', 'lens.title lens_title', 'lens.description source_name']);
    expect(LENS_LIBRARY.every(l => isLensTitle(l.title))).toBe(true);
  });
  it('passes the library and every author facing string', () => {
    for (const l of LENS_LIBRARY) {
      const { basedOn: _b, ...rest } = l;
      expect(guardDraft(rest), l.id).toEqual([]);
    }
    for (const id of QUESTION_IDS) expect(guardDraft(questionFor(id)), id).toEqual([]);
    // String literals in the author UI and chat logic: no em dashes, dash punctuation, emoji or "competency".
    const dir = path.join(import.meta.dirname);
    const files = fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(f => /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) && !f.endsWith('lenses.ts') && !f.endsWith('copyGuard.ts'));
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const strings = [...src.matchAll(/'([^'\n]{12,})'|`([^`\n]{12,})`|>([^<>{}\n]{12,})</g)].map(m => (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, 'x')).filter(s => / [a-z]+ /.test(s));
      const bad = strings.flatMap(s => guardCopy(s).filter(r => r !== 'source_name').map(r => `${f}: ${r}: ${s}`));
      expect(bad).toEqual([]);
    }
  });
});

describe('drafters', () => {
  const brief = Brief.parse({ roleLevel: 'Senior leaders' });
  it('the mock turns to the lens step once the brief is complete', async () => {
    const all = Brief.parse({ roleLevel: 'Senior leaders', industry: 'Retail and consumer goods', challenge: 'Growth', client: null, teamSize: 10, process: ['A', 'B', 'C'], duration: 'lite', region: 'uk', framework: null, tone: 'direct' });
    const r = AuthorTurnResponse.parse(await new MockDrafter().turn({ brief: all, asked: ['role_level', 'industry', 'challenge', 'client', 'tone'], answers: {} }));
    expect(r).toMatchObject({ kind: 'lens', recommendation: { id: 'five_practices' }, framework: null });
  });
  it('the server returns null on 404 or 501, so the mock answers', async () => {
    for (const status of [404, 501]) {
      const fetchImpl = vi.fn(async () => new Response('', { status }));
      const server = new ServerDrafter('https://genie.example/api/', fetchImpl as unknown as typeof fetch);
      expect(await server.turn({ brief, asked: [], answers: {} })).toBeNull();
      expect(fetchImpl).toHaveBeenCalledWith('https://genie.example/api/author/turn', expect.objectContaining({ method: 'POST' }));
      const r = await firstAnswer([server, new MockDrafter()], d => d.turn({ brief, asked: [], answers: {} }));
      expect(r.source).toBe('templates');
    }
  });
  it('the server answer is checked against the schema', async () => {
    const module = LeadershipLensModule.parse(buildModule(brief, { primary: 'five_practices', secondary: null, clientDimensions: [] }, true));
    const ok = await new MockDrafter().draft({ brief, leadership_lens: module });
    const server = new ServerDrafter('https://genie.example', (async () => new Response(JSON.stringify(ok), { status: 200 })) as unknown as typeof fetch);
    expect((await server.draft({ brief, leadership_lens: module }))?.preview.styles).toHaveLength(5);
    const bad = new ServerDrafter('https://genie.example', (async () => new Response('{"storyline":1}', { status: 200 })) as unknown as typeof fetch);
    await expect(bad.draft({ brief, leadership_lens: module })).rejects.toThrow();
  });
  it('the module keeps the secondary distinct and marks the client model', () => {
    const b = Brief.parse({ framework: SAMPLE_FRAMEWORK, documents: [{ name: 'compass.md', text: SAMPLE_FRAMEWORK }] });
    const m = buildModule(b, { primary: 'client_model', secondary: 'readiness_based', clientDimensions: extractFramework(SAMPLE_FRAMEWORK) }, true);
    expect(m.client_model).toMatchObject({ used: true, source_document: 'compass.md' });
    expect(m.primary.scoring_dimensions).toEqual(['Customer Obsession', 'Bold Ownership', 'Growing People']);
    expect(m.secondary?.report_only_dimensions).toEqual(['Diagnosing readiness', 'Style fit', 'Style flexibility', 'Team development progress']);
    expect(LeadershipLensModule.safeParse({ ...m, secondary: { id: 'client_model', title: 'Client Leadership Model', report_only_dimensions: [] } }).success).toBe(false);
  });
});
