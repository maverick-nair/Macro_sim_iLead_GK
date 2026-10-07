import { describe, expect, it, vi } from 'vitest';
import { Brief } from '../../api/author';
import { parseRoute } from '../ui/route';
import { changeLens } from '../ui/workspace/tabs/Lens';
import { regenerate } from '../ui/workspace/tabs/regenerate';
import { describeAction } from '../ui/workspace/ActionAdd';
import { readability } from '../ui/workspace/tabs/Brand';
import { checksOf } from '../ui/workspace/tabs/Publish';
import { MOCK_ANSWERS } from '../voice';
import { applyAnswer } from '../questions';
import { WORKSPACE_KEY, type AuthorDraft } from './draft';
import { toStoryline } from './export';
import { applySuggestion, propose } from './kora';
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
    expect(nextMark('you', 'ai')).toBe('ai');
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
    expect(blocked.getState().saveFailed).toBe(true);
    vi.useRealTimers();
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
    expect(checksOf(d).filter(c => c.blocking && c.state !== 'passed')).toEqual([]);
  });

  it('proposes a change before applying it, by character, sponsor, run length or a new character', () => {
    const d = draft();
    const first = d.team[0].first;
    const p = propose(d, 'team', `Make ${first} more defensive in the first meeting`)!;
    expect(p.label).toBe('Persona');
    expect(p.after).toMatch(/guarded/);
    p.apply(d);
    expect(d.team[0].persona).toBe(p.after);
    expect(propose(d, 'overview', 'Shorten it to a 30 minute Lite run')!.after).toMatch(/Lite/);
    const add = propose(d, 'overview', 'Add a remote team member')!;
    add.apply(d);
    expect(d.team.at(-1)!.persona).toMatch(/video/);
    expect(propose(d, 'story', 'Make the sponsor more demanding')!.after).toMatch(/plan from you/);
    expect(propose(d, 'story', '   ')).toBeNull();
  });

  it('applies suggestions, and regenerating keeps what the author wrote', () => {
    const d = draft();
    expect(applySuggestion(d, 'story.rival')).toEqual(['story.market.rivals']);
    expect(d.story.market.rivals).toHaveLength(2);
    const before = d.story.company.about;
    d.story.company.about = 'Kora changed this.';
    d.story.company.hq = 'Mine';
    d.marks['story.company.hq'] = 'edited';
    regenerate(d, 'story');
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
