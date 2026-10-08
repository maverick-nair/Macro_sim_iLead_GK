import { describe, expect, it, vi } from 'vitest';
import { Brief } from '../../api/author';
import { parseRoute } from '../ui/route';
import { changeLens } from '../ui/workspace/tabs/Lens';
import { describeAction, parseMyLibrary } from '../ui/workspace/ActionAdd';
import { readability } from '../ui/workspace/tabs/Brand';
import { checksOf } from '../ui/workspace/tabs/Publish';
import { MOCK_ANSWERS } from '../voice';
import { applyAnswer } from '../questions';
import { AuthorDraft, WORKSPACE_BACKUP_KEY, WORKSPACE_KEY } from './draft';
import { toStoryline } from './export';
import { understand } from './intents';
import { applySuggestion } from './kora';
import { applyOps } from './patch';
import { regenerate } from './regenerate';
import { needsOf, tabStatus } from './needs';
import { emptyChat, seedDraft } from './seed';
import { createAuthorStore, loadDraft, nextMark } from './store';

const chat = (): AuthorDraft['chat'] => ({
  ...emptyChat(),
  brief: Brief.parse({ roleLevel: 'First time sales managers', industry: 'Manufacturing', challenge: 'Deals stall at negotiation and new reps burn out.', client: 'Ascent Lifts', teamSize: 10, duration: 'standard' }),
  asked: ['role_level', 'industry', 'challenge', 'client'], answers: { role_level: 'First time sales managers', industry: 'Manufacturing', challenge: 'x', client: 'Ascent Lifts' }, primary: 'readiness_based'
});
const draft = () => seedDraft(chat(), 'workspace');

function memoryStorage(fail = false): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, removeItem: k => { m.delete(k); },
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => { if (fail) throw new Error('QuotaExceededError'); m.set(k, v); }
  };
}

describe('the author store (D105)', () => {
  it('marks what the author edits: Kora\'s field becomes Edited, theirs stays You', () => {
    expect(nextMark('ai', 'you')).toBe('edited');
    expect(nextMark(undefined, 'you')).toBe('you');
    expect(nextMark('you', 'you')).toBe('you');
    expect(nextMark('you', 'ai')).toBe('edited');
    expect(nextMark('edited', 'ai')).toBe('edited');
    expect(nextMark('ai', 'ai')).toBe('ai');
    const s = createAuthorStore(draft(), null);
    s.getState().edit(d => { d.story.company.about = 'Mine now.'; }, 'story.company.about');
    expect(s.getState().draft.marks['story.company.about']).toBe('edited');
    expect(s.getState().draft.story.company.about).toBe('Mine now.');
  });

  it('saves to storage after a pause and reads it back; bad or blocked storage never throws', async () => {
    vi.useFakeTimers();
    const st = memoryStorage();
    const s = createAuthorStore(draft(), st);
    s.getState().edit(d => { d.title = 'Saved title'; }, 'title');
    await vi.advanceTimersByTimeAsync(400);
    expect(s.getState().savedAt).not.toBeNull();
    expect(loadDraft(st)!.title).toBe('Saved title');
    st.setItem(WORKSPACE_KEY, '{"v":2}');
    expect(loadDraft(st)).toBeNull();
    st.setItem(WORKSPACE_KEY, 'not json');
    expect(loadDraft(st)).toBeNull();
    const blocked = createAuthorStore(draft(), memoryStorage(true));
    blocked.getState().edit(d => { d.title = 'x'; });
    await vi.advanceTimersByTimeAsync(400);
    expect(blocked.getState().saveFailed).toBe('full');
    vi.useRealTimers();
  });

  it('repairs a stored draft over a limit instead of starting fresh, and keeps the original (D120)', () => {
    const st = memoryStorage();
    const d = draft();
    d.story.company.about = 'Kept about.';
    const raw = JSON.stringify({ ...d, title: 'x'.repeat(401), process: { ...d.process, weeks: 'many' } });
    st.setItem(WORKSPACE_KEY, raw);
    const back = loadDraft(st)!;
    expect(back).not.toBeNull();
    expect(back.title).toBe('x'.repeat(400));
    expect(back.story.company.about).toBe('Kept about.');
    expect(back.team.map(c => c.id)).toEqual(d.team.map(c => c.id));
    expect(AuthorDraft.safeParse(back).success).toBe(true);
    expect(st.getItem(WORKSPACE_BACKUP_KEY)).toBe(raw);
  });

  it('clamps an edit to the schema\'s limits, so the saved draft reads back', () => {
    const s = createAuthorStore(draft(), null);
    s.getState().edit(d => { d.title = 'x'.repeat(401); d.story.company.about = 'y'.repeat(5000); });
    expect(s.getState().draft.title).toHaveLength(400);
    expect(s.getState().draft.story.company.about).toHaveLength(4000);
    expect(AuthorDraft.safeParse(s.getState().draft).success).toBe(true);
  });
});

describe('needs, Kora and regeneration', () => {
  it('lists what needs the author, and filling a field clears it', () => {
    const d = draft();
    expect(needsOf(d).map(n => n.id)).toEqual(['story.product.dealValue', 'scoring.samples']);
    expect(tabStatus(d, 'story')).toBe('need');
    d.story.product.dealValue = 30000;
    for (const s of d.scoring.samples) s.call = s.scored;
    expect(needsOf(d)).toEqual([]);
    // Only the synthetic test is left (D132): run it, or tick Publish without testing.
    expect(checksOf(d).filter(c => c.blocking && c.state !== 'passed').map(c => c.id)).toEqual(['synthetic']);
    const e = structuredClone(d);
    e.publish.skipTest = true;
    expect(checksOf(e).filter(c => c.blocking && c.state !== 'passed')).toEqual([]);
    expect(checksOf(e).find(c => c.id === 'synthetic')?.state).toBe('advisory');
  });

  it('proposes a change before applying it, by character, run length, a new character or the sponsor', () => {
    const d = draft();
    const first = d.team[0].first;
    const p = understand(d, 'team', `Make ${first} more defensive in the first meeting`);
    if (p.kind !== 'change') throw new Error(p.reply);
    expect(p.changes[0].field).toMatch(/· Persona$/);
    expect(p.changes[0].after).toMatch(/defensive when questioned/);
    applyOps(d, p.ops);
    expect(d.team[0].persona).toBe(p.changes[0].after);
    expect(understand(d, 'overview', 'Shorten it to a 30 minute Lite run')).toMatchObject({ kind: 'change', changes: expect.arrayContaining([expect.objectContaining({ field: 'Run length', after: 'Lite' })]) });
    const add = understand(d, 'overview', 'Add a remote team member');
    if (add.kind !== 'change') throw new Error(add.reply);
    applyOps(d, add.ops);
    expect(d.team.at(-1)!.persona).toMatch(/video/);
    expect(understand(d, 'story', 'Make the sponsor more demanding')).toMatchObject({ kind: 'change', changes: expect.arrayContaining([expect.objectContaining({ field: 'Welcome letter', after: expect.stringMatching(/plan from you/) })]) });
    expect(understand(d, 'story', '   ')).toMatchObject({ kind: 'reply' });
  });

  it('applies suggestions, and regenerating keeps what the author wrote', () => {
    const d = draft();
    expect(applySuggestion(d, 'story.rival')).toEqual(['story.market.rivals']);
    expect(d.story.market.rivals).toHaveLength(2);
    const before = d.story.company.about;
    d.story.company.about = 'Kora changed this.';
    d.story.company.hq = 'Mine';
    d.marks['story.company.hq'] = 'edited';
    regenerate(d, { tab: 'story' });
    expect(d.story.company.about).toBe(before);
    expect(d.story.company.hq).toBe('Mine');
  });

  it('changing the lens redrafts the styles, team and events, and the storyline still parses', () => {
    const d = draft();
    changeLens(d, 'servant');
    expect(d.lens.id).toBe('servant');
    expect(d.lens.styles).toHaveLength(5);
    expect(toStoryline(d).issues).toEqual([]);
  });
});

describe('the workspace\'s helpers', () => {
  it('routes /author, the workspace tabs and the library', () => {
    expect(parseRoute('/author')).toEqual({ page: 'journey' });
    expect(parseRoute('/author/workspace/team')).toEqual({ page: 'workspace', tab: 'team' });
    expect(parseRoute('/author/workspace/nope')).toEqual({ page: 'workspace', tab: 'overview' });
    expect(parseRoute('/author/library/')).toEqual({ page: 'library' });
  });

  it('reads the saved action library, dropping entries that do not parse', () => {
    const good = { key: 'discount', name: 'Discount approval', description: 'Approve or refuse.', type: 'hybrid', plays: 'hybrid', template: 'reward', group: 'person', inNew: 'off', version: 1, format: 'Decide, then talk' };
    const raw = JSON.stringify([good, { ...good, key: 'bad', template: 'nope' }, { ...good, key: 'Bad Key' }, 'x', null, { ...good, key: 'two', plays: 'sideways' }]);
    expect(parseMyLibrary(raw)).toEqual([good]);
    expect(parseMyLibrary('{"not":"a list"}')).toEqual([]);
    expect(parseMyLibrary('not json')).toEqual([]);
    expect(parseMyLibrary(null)).toEqual([]);
  });

  it('reads a described action as Kora would set it up', () => {
    const k = describeAction('Approve or refuse a discount a rep asks for, then explain the decision.', ['Style fit']);
    expect(k.template.name).toBe('Discount approval');
    expect(k.template.plays).toBe('hybrid');
    expect(k.options).toEqual(['Approve', 'Approve with conditions', 'Refuse']);
  });

  it('checks brand colors the way the theme loader does', () => {
    expect(readability('#1F4FD1').ok).toBe(false);
    expect(readability('nope').ok).toBe(false);
  });

  it('the offline voice says an answer every question accepts', () => {
    let b = Brief.parse({});
    for (const [id, text] of Object.entries(MOCK_ANSWERS)) {
      const r = applyAnswer(b, id as keyof typeof MOCK_ANSWERS, text);
      expect(r.error, id).toBeUndefined();
      b = r.brief;
    }
    expect(b.teamSize).toBe(10);
    expect(b.client).toBe('Ascent Lifts');
    expect(b.framework).toBeNull();
    expect(b.process).toEqual(['Leads', 'Qualify', 'Proposal', 'Negotiation', 'Close']);
  });
});
