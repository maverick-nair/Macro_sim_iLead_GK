import { describe, expect, it, vi } from 'vitest';
import { Brief, type AuthorDraftRequest } from '../../../src/api/author';
import { guardDraft } from '../../../src/author/copyGuard';
import { SAMPLE_FRAMEWORK } from '../../../src/author/fixtures';
import { buildModule } from '../../../src/author/module';
import { StorylineConfig, type StorylineInput } from '../../../src/engine/config';
import { settingsFor, silentLogger } from '../config';
import { createFakeTransport, type FakeReply } from '../llm/fake';
import type { LlmTransport } from '../llm/transport';
import { createAnthropicAuthorDrafter, createMockAuthorDrafter, groundFramework, TURN_DEADLINE_MS } from './models';
import type { BriefReading, DraftCopy } from './schema';

function drafter(script: FakeReply[]) {
  const transport = createFakeTransport(script);
  const logger = { ...silentLogger, warn: vi.fn(), error: vi.fn() };
  return { d: createAnthropicAuthorDrafter({ transport, settings: settingsFor('author'), logger }), transport, logger };
}

const reading = (over: Partial<BriefReading> = {}): string => JSON.stringify({
  roleLevel: null, industry: null, challenge: null, client: { kind: 'unknown', name: null }, teamSize: null, process: null,
  duration: null, region: null, language: null, tone: null, frameworkDocument: null, ...over
});

const FULL: Brief = Brief.parse({
  roleLevel: 'First time managers', industry: 'Banking and financial services', challenge: 'Leading through change', client: 'Acme Bank', teamSize: 8,
  process: ['Leads', 'Qualify', 'Proposal', 'Close'], duration: 'full', region: 'india', language: 'English, India', framework: null, tone: 'professional'
});

describe('the author turn', () => {
  it('fills what the answers state, leaves the rest for the next question, and never guesses a client', async () => {
    const { d, transport } = drafter([reading({ roleLevel: 'First time managers', industry: 'Banking and financial services', region: 'india', language: 'English, India', teamSize: 40 })]);
    const r = await d.turn({ brief: {}, asked: ['role_level'], answers: { role_level: 'First time managers at a bank in India' } });
    expect(r.kind).toBe('question');
    if (r.kind !== 'question') return;
    expect(r.brief).toMatchObject({ roleLevel: 'First time managers', industry: 'Banking and financial services', region: 'india' });
    expect(r.brief.client).toBeUndefined();
    expect(r.brief.teamSize).toBeUndefined();
    expect(r.question.id).toBe('challenge');
    expect(transport.requests[0].system[0].text).toMatch(/KNOLSKAPE lens titles only/);
    expect(transport.requests[0].messages[0].content).toMatch(/<answer question="role_level">First time managers at a bank in India<\/answer>/);
  });

  it('never overwrites what the brief already has', async () => {
    const { d } = drafter([reading({ industry: 'Banking and financial services', client: { kind: 'named', name: 'Big Bank' } })]);
    const r = await d.turn({ brief: { industry: 'Healthcare', client: null }, asked: ['industry', 'client'], answers: { industry: 'Healthcare' } });
    expect(r.brief).toMatchObject({ industry: 'Healthcare', client: null });
  });

  it('reads stakeholders, objectives and dilemmas from a pasted brief, and never keeps a name the text does not have (D146)', async () => {
    const brief = 'VPs of Customer Operations at Northstar Health Partners. Key stakeholders: Dana Whitfield, the COO and their boss. Dilemmas: short-term revenue vs customer trust.';
    const { d } = drafter([reading({
      roleLevel: 'VPs of Customer Operations', client: { kind: 'named', name: 'Northstar Health Partners' },
      stakeholders: [{ name: 'Dana Whitfield', role: 'COO', relation: 'boss' }, { name: 'Invented Person', role: 'CEO', relation: 'senior leader' }],
      objectives: ['Retain key talent'], dilemmas: [{ a: 'short-term revenue', b: 'customer trust', stake: null }]
    })]);
    const r = await d.turn({ brief: {}, asked: ['role_level'], answers: { role_level: brief } });
    expect(r.brief).toMatchObject({
      roleLevel: 'VPs of Customer Operations', client: 'Northstar Health Partners',
      stakeholders: [{ name: 'Dana Whitfield', role: 'COO', relation: 'boss' }], objectives: ['Retain key talent'],
      dilemmas: [{ title: 'Short term revenue or customer trust', a: 'Short term revenue', b: 'Customer trust', stake: '' }]
    });
    // A client the text does not name is never kept.
    const { d: d2 } = drafter([reading({ client: { kind: 'named', name: 'Greenfield Hospitals' } })]);
    expect((await d2.turn({ brief: {}, asked: ['role_level'], answers: { role_level: brief } })).brief.client).toBeUndefined();
  });

  it('asks the model\'s clarifying question for a field still open, and ignores one about a field the brief has (D147)', async () => {
    const ask = { question: 'industry' as const, prompt: 'Banking or healthcare?', choices: ['Banking and financial services', 'Healthcare'] };
    const { d } = drafter([reading({ clarify: ask })]);
    const r = await d.turn({ brief: {}, asked: ['industry'], answers: { industry: 'banking but actually a hospital' } });
    expect(r).toMatchObject({ kind: 'clarify', clarify: { id: 'industry', prompt: 'Banking or healthcare?', choices: [{ label: 'Banking and financial services', value: 'Banking and financial services' }, { label: 'Healthcare', value: 'Healthcare' }] } });
    const { d: d2 } = drafter([reading({ clarify: ask })]);
    expect((await d2.turn({ brief: { industry: 'Healthcare' }, asked: ['industry'], answers: { industry: 'Healthcare' } })).kind).toBe('question');
  });

  it('a reading that takes too long ends before the app gives up, and the rules answer the turn (D148)', async () => {
    const slow: LlmTransport = {
      complete: (_req, signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
      stream: () => { throw new Error('not used'); }
    };
    const logger = { ...silentLogger, warn: vi.fn(), error: vi.fn() };
    const d = createAnthropicAuthorDrafter({ transport: slow, settings: settingsFor('author'), logger, turnDeadlineMs: 30 });
    const r = await d.turn({ brief: {}, asked: ['role_level'], answers: { role_level: 'First time managers' } });
    expect(r).toMatchObject({ kind: 'question', question: { id: 'industry' } });
    expect(logger.error).toHaveBeenCalledOnce();
    expect(TURN_DEADLINE_MS).toBeLessThan(30_000);
    // The author's own cancel still cancels.
    const ctl = new AbortController();
    const cancelled = d.turn({ brief: {}, asked: ['role_level'], answers: { role_level: 'x' } }, { signal: ctl.signal });
    ctl.abort();
    await expect(cancelled).rejects.toThrow();
  });

  it('falls back to the templates for the turn when the reading fails', async () => {
    const { d, logger } = drafter(['nope', 'still nope']);
    const r = await d.turn({ brief: {}, asked: ['role_level'], answers: { role_level: 'First time managers' } });
    expect(r.kind).toBe('question');
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('at the lens step keeps the rule based recommendation and only framework items found in the text', async () => {
    const { d } = drafter([JSON.stringify({ dimensions: [
      { name: 'Customer Obsession', behaviours: ['Starts every plan with the customer\'s problem', 'Delights every customer daily'], levels: ['Emerging', 'Practising', 'Role model'] },
      { name: 'Visionary Thinking', behaviours: ['Sets a bold vision'], levels: [] }
    ] })]);
    const r = await d.turn({ brief: { ...FULL, framework: SAMPLE_FRAMEWORK }, asked: ['role_level', 'industry', 'challenge', 'client', 'team_size'], answers: {} });
    expect(r.kind).toBe('lens');
    if (r.kind !== 'lens') return;
    expect(r.recommendation.id).toBe('client_model');
    expect(r.framework).toEqual([{ name: 'Customer Obsession', behaviours: ['Starts every plan with the customer\'s problem'], levels: ['Emerging', 'Practising', 'Role model'] }]);
  });

  it('grounds a framework in its text', () => {
    expect(groundFramework('## Bold Ownership\n- Owns outcomes end to end', [{ name: 'Bold ownership', behaviours: ['Owns outcomes end to end', 'Invented'], levels: [] }]))
      .toEqual({ kept: [{ name: 'Bold ownership', behaviours: ['Owns outcomes end to end'], levels: [] }], dropped: ['Invented'] });
  });
});

describe('the author draft', () => {
  const module = buildModule(FULL, { primary: 'adaptive', secondary: null, clientDimensions: [] }, true);
  const req: AuthorDraftRequest = { brief: FULL, leadership_lens: module };
  const template = async () => (await createMockAuthorDrafter().draft(req)).storyline as unknown as StorylineInput;

  /** A model answer: the template's copy with the organisation renamed and every member renamed. */
  async function copy(edit: (c: DraftCopy) => void = () => {}): Promise<string> {
    const t = await template();
    const c: DraftCopy = {
      name: 'Flex Business Account, Acme Bank', organisation: 'Acme Bank',
      sponsor: { name: t.sponsor.name, title: t.sponsor.title, styleLine: t.sponsor.styleLine ?? 'Each person needs something different this week.' },
      intro: t.intro!,
      styles: t.lens!.styles.map(s => ({ key: s.key, name: s.name, short: s.short, description: s.description })),
      members: t.members.map((m, i) => ({ id: m.id, name: `Person ${String.fromCharCode(65 + i)} Rao`, title: m.title, remarks: m.profile.remarks, hiddenConcern: m.hiddenConcern ?? null, concernLine: m.concernLine ?? null, careerGoal: null })),
      events: (t.events ?? []).map(e => ({ key: e.key, title: e.title, he: e.body.he, she: e.body.she, they: null })),
      sampleEvent: { title: 'A new way of working', body: 'Acme Bank changes how each account is handled.' }
    };
    edit(c);
    return JSON.stringify(c);
  }

  it('lays the copy over the template, and the draft passes the schema and the copy guard', async () => {
    const { d, transport } = drafter([await copy()]);
    const r = await d.draft(req);
    const s = r.storyline as unknown as StorylineInput;
    expect(s.organisation).toBe('Acme Bank');
    expect(s.members[0].name).toBe('Person A Rao');
    expect(StorylineConfig.safeParse(s).success).toBe(true);
    expect(guardDraft(s)).toEqual([]);
    expect(r.preview.sampleEvent.title).toBe('A new way of working');
    expect(s.lens!.title).toBe('Adaptive Leadership');
    expect(transport.requests[0].system[1].text).toMatch(/write the storyline's copy/);
  });

  it('applies the copy rules itself: dashes, emojis and "competency"', async () => {
    const { d, transport } = drafter([await copy(c => { c.intro.welcome = ['Welcome—we are glad you are here 🎉. Your core competency is people.']; })]);
    const s = (await d.draft(req)).storyline as unknown as StorylineInput;
    expect(s.intro!.welcome[0]).toBe('Welcome, we are glad you are here. Your core skill is people.');
    expect(transport.requests).toHaveLength(1);
  });

  it('asks for a repair when the copy names a framework source, and uses the repaired draft', async () => {
    const { d, transport } = drafter([await copy(c => { c.styles[0].description = 'Straight from Heifetz, you fix it yourself.'; }), await copy()]);
    const s = (await d.draft(req)).storyline as unknown as StorylineInput;
    expect(transport.requests[1].messages.at(-1)!.content).toMatch(/source_name/);
    expect(JSON.stringify(s.lens!.styles)).not.toMatch(/Heifetz/);
    expect(s.lens!.basedOn).toMatch(/Heifetz/); // the one place a source belongs
    expect(s.organisation).toBe('Acme Bank');
  });

  it('returns the templates draft when the copy still breaks the guard after the repair', async () => {
    const bad = await copy(c => { c.intro.product = ['Certified by the original framework owner.']; });
    const { d, logger } = drafter([bad, bad]);
    const s = (await d.draft(req)).storyline as unknown as StorylineInput;
    expect(s.organisation).toBe((await template()).organisation);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('rejects repeated member names', async () => {
    const dup = await copy(c => { c.members[1].name = c.members[0].name; });
    const { d, transport } = drafter([dup, await copy()]);
    await d.draft(req);
    expect(transport.requests[1].messages.at(-1)!.content).toMatch(/different name/);
  });
});
