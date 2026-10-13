import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Brief } from '../../api/author';
import { isChunkError, retryImport } from '../../lib/lazyRetry';
import { playDraft, PLAY_STORAGE_FULL } from '../ui/play';
import { changeLens } from '../ui/workspace/tabs/Lens';
import { AuthorDraft, DRAFT_KEY, WORKSPACE_BACKUP_KEY, WORKSPACE_KEY, WORKSPACE_VERSIONS_KEY } from './draft';
import { COALESCE_MS, MAX_UNDO, MAX_VERSIONS, readVersions } from './history';
import { repairDraft } from './repair';
import { emptyChat, seedDraft } from './seed';
import { bindAuthorStore, createAuthorStore, freshDraft, readStored } from './store';

/** Undo, versions, two tabs, repair and saving on leave (D122 to D124). */

const chat = (): AuthorDraft['chat'] => ({
  ...emptyChat(),
  brief: Brief.parse({ roleLevel: 'First time sales managers', industry: 'Manufacturing', challenge: 'Deals stall at negotiation.', client: 'Ascent Lifts', teamSize: 10, duration: 'standard' }),
  asked: ['role_level', 'industry', 'challenge', 'client'], answers: { role_level: 'First time sales managers' }, primary: 'readiness_based'
});
const draft = () => seedDraft(chat(), 'workspace');

/** Local storage in memory, shared by "tabs", with an optional size limit in characters. */
function memoryStorage(capacity = Infinity, blocked = false): Storage & { used(): number } {
  const m = new Map<string, string>();
  const used = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    used,
    get length() { return m.size; }, clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, removeItem: k => { m.delete(k); },
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => {
      if (blocked) throw new DOMException('denied', 'SecurityError');
      if (used() - (m.has(k) ? k.length + m.get(k)!.length : 0) + k.length + v.length > capacity) throw new DOMException('full', 'QuotaExceededError');
      m.set(k, v);
    }
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('undo and redo (D122)', () => {
  it('merges typing into one field into one step, and separates pauses and other fields', () => {
    const s = createAuthorStore(draft(), null);
    const type = (text: string) => s.getState().edit(d => { d.story.company.about = text; }, 'story.company.about');
    const original = s.getState().draft.story.company.about;
    type('A'); vi.advanceTimersByTime(200); type('Ab'); vi.advanceTimersByTime(200); type('Abc');
    expect(s.getState().past).toHaveLength(1);
    vi.advanceTimersByTime(COALESCE_MS + 1);
    type('Abcd');
    expect(s.getState().past).toHaveLength(2);
    s.getState().edit(d => { d.title = 'New title'; }, 'title');
    expect(s.getState().past).toHaveLength(3);
    expect(s.getState().past[2].label).toBe('Edit title');

    s.getState().undo();
    expect(s.getState().draft.title).not.toBe('New title');
    expect(s.getState().announcement?.text).toBe('Undid: Edit title');
    s.getState().undo();
    expect(s.getState().draft.story.company.about).toBe('Abc');
    s.getState().undo();
    expect(s.getState().draft.story.company.about).toBe(original);
    expect(s.getState().past).toHaveLength(0);
    s.getState().undo(); // nothing left: no change
    expect(s.getState().draft.story.company.about).toBe(original);

    s.getState().redo();
    expect(s.getState().draft.story.company.about).toBe('Abc');
    expect(s.getState().announcement?.text).toMatch(/^Redid: /);
    type('Other');
    expect(s.getState().future).toHaveLength(0);
  });

  it('keeps at most MAX_UNDO steps, and a change to where the author is (stage) is not a step', () => {
    const s = createAuthorStore(draft(), null);
    for (let i = 0; i < MAX_UNDO + 20; i++) s.getState().edit(d => { d.publish.cohort = `c${i}`; });
    expect(s.getState().past).toHaveLength(MAX_UNDO);
    const n = s.getState().past.length;
    s.getState().edit(d => { d.stage = 'ready'; });
    expect(s.getState().past).toHaveLength(n);
  });

  it('a lens change is a named step with a version saved first; undo brings the team back', () => {
    const st = memoryStorage();
    const s = createAuthorStore(draft(), st);
    const team = s.getState().draft.team.map(c => c.id).join();
    s.getState().edit(d => changeLens(d, 'servant'));
    expect(s.getState().draft.lens.id).toBe('servant');
    expect(s.getState().past.at(-1)?.label).toMatch(/^Change lens to /);
    expect(s.getState().versions.at(-1)?.label).toMatch(/^Before: Change lens to /);
    expect(readVersions(st)).toHaveLength(1);
    s.getState().undo();
    expect(s.getState().draft.lens.id).toBe('readiness_based');
    expect(s.getState().draft.team.map(c => c.id).join()).toBe(team);
    expect(s.getState().announcement?.text).toMatch(/^Undid: Change lens to /);
  });

  it('names removals and Kora\'s changes, takes a caller\'s label, and restores a version as a step', () => {
    const s = createAuthorStore(draft(), memoryStorage());
    const gone = s.getState().draft.team[3];
    s.getState().edit(d => { d.team = d.team.filter(c => c.id !== gone.id); });
    expect(s.getState().past.at(-1)?.label).toBe(`Remove ${gone.first} ${gone.last}`);
    s.getState().edit(d => { d.story.sponsor.voice = 'Warm.'; }, 'story.sponsor.voice', 'ai');
    expect(s.getState().past.at(-1)?.label).toBe('Kora\'s change');
    s.getState().edit(d => { d.brief.industry = 'Retail'; }, { mark: 'brief.industry', label: 'Regenerate Brief', restorePoint: true });
    expect(s.getState().past.at(-1)?.label).toBe('Regenerate Brief');
    expect(s.getState().versions.map(v => v.label)).toEqual([`Before: Remove ${gone.first} ${gone.last}`, 'Before: Kora\'s change', 'Before: Regenerate Brief']);

    const first = s.getState().versions[0];
    s.getState().restore(first.id);
    expect(s.getState().draft.team.some(c => c.id === gone.id)).toBe(true);
    expect(s.getState().announcement?.text).toBe(`Restored: ${first.label}`);
    s.getState().undo();
    expect(s.getState().draft.team.some(c => c.id === gone.id)).toBe(false);
  });

  it('a publish saves the published version', () => {
    const s = createAuthorStore(draft(), memoryStorage());
    s.getState().edit(d => { d.publish.version = 1; });
    expect(s.getState().versions.at(-1)?.label).toBe('Published version 1');
  });
});

describe('versions in storage (D122)', () => {
  it('keeps the newest MAX_VERSIONS and reads them back in a new visit', () => {
    const st = memoryStorage();
    const s = createAuthorStore(draft(), st);
    for (let i = 0; i < MAX_VERSIONS + 5; i++) s.getState().checkpoint(`Point ${i}`);
    expect(s.getState().versions).toHaveLength(MAX_VERSIONS);
    expect(s.getState().versions[0].label).toBe('Point 5');
    const again = createAuthorStore(undefined, st);
    expect(again.getState().versions.map(v => v.label)).toEqual(s.getState().versions.map(v => v.label));
  });

  it('when storage is full, drops the oldest versions, and the draft itself always comes first', async () => {
    const size = JSON.stringify(draft()).length;
    const st = memoryStorage(size * 4.5);
    const s = createAuthorStore(draft(), st);
    for (let i = 0; i < 6; i++) s.getState().checkpoint(`Point ${i}`);
    const stored = readVersions(st);
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.length).toBeLessThan(6);
    expect(stored.at(-1)!.label).toBe('Point 5');
    expect(s.getState().versionsFailed).toBe(false);
    // The draft needs room: versions make way for it.
    s.getState().edit(d => { d.story.company.about = 'Saved over the versions.'; }, 'story.company.about');
    await vi.advanceTimersByTimeAsync(400);
    expect(s.getState().saveFailed).toBe(false);
    expect(readStored(st).draft?.story.company.about).toBe('Saved over the versions.');
  });

  it('tells full from blocked storage', async () => {
    const full = createAuthorStore(draft(), memoryStorage(10));
    full.getState().edit(d => { d.title = 'x'; }, 'title');
    await vi.advanceTimersByTimeAsync(400);
    expect(full.getState().saveFailed).toBe('full');
    const blocked = createAuthorStore(draft(), memoryStorage(Infinity, true));
    blocked.getState().edit(d => { d.title = 'x'; }, 'title');
    await vi.advanceTimersByTimeAsync(400);
    expect(blocked.getState().saveFailed).toBe('blocked');
    expect(blocked.getState().versionsFailed).toBe(false);
    blocked.getState().checkpoint('Kept in memory');
    expect(blocked.getState().versions.at(-1)?.label).toBe('Kept in memory');
    expect(blocked.getState().versionsFailed).toBe(true);
  });
});

describe('two tabs (D123)', () => {
  it('never saves over another tab\'s change: a conflict until the author picks a version', async () => {
    const st = memoryStorage();
    const a = createAuthorStore(draft(), st);
    a.getState().edit(d => { d.title = 'Tab A'; }, 'title');
    await vi.advanceTimersByTimeAsync(400);
    const b = createAuthorStore(undefined, st);
    expect(b.getState().draft.title).toBe('Tab A');

    a.getState().edit(d => { d.title = 'Tab A again'; }, 'title');
    await vi.advanceTimersByTimeAsync(400);
    b.getState().external(st.getItem(WORKSPACE_KEY));
    expect(b.getState().conflict).not.toBeNull();
    expect(b.getState().saveFailed).toBe('conflict');
    b.getState().edit(d => { d.story.company.about = 'Tab B wrote this.'; }, 'story.company.about');
    await vi.advanceTimersByTimeAsync(400);
    expect(readStored(st).draft?.title).toBe('Tab A again');

    b.getState().resolveConflict('theirs');
    expect(b.getState().conflict).toBeNull();
    expect(b.getState().draft.title).toBe('Tab A again');
    expect(b.getState().versions.at(-1)?.label).toBe('Before: Load the changes from another tab');
    b.getState().undo();
    expect(b.getState().draft.story.company.about).toBe('Tab B wrote this.');
  });

  it('keep mine saves over the other tab on purpose, and a missed event is caught before writing', async () => {
    const st = memoryStorage();
    const a = createAuthorStore(draft(), st);
    a.getState().edit(d => { d.title = 'A'; }, 'title');
    await vi.advanceTimersByTimeAsync(400);
    const b = createAuthorStore(undefined, st);
    a.getState().edit(d => { d.title = 'A2'; }, 'title');
    await vi.advanceTimersByTimeAsync(400);
    // No storage event reached b (a frozen tab): its next save still sees the change.
    b.getState().edit(d => { d.title = 'B'; }, 'title');
    await vi.advanceTimersByTimeAsync(400);
    expect(b.getState().conflict).not.toBeNull();
    expect(readStored(st).draft?.title).toBe('A2');
    b.getState().resolveConflict('mine');
    expect(readStored(st).draft?.title).toBe('B');
    expect(b.getState().conflict).toBeNull();
  });

  it('an identical draft from another tab is not a conflict', async () => {
    const st = memoryStorage();
    const a = createAuthorStore(draft(), st);
    a.getState().edit(d => { d.title = 'Same'; }, 'title');
    await vi.advanceTimersByTimeAsync(400);
    const b = createAuthorStore(undefined, st);
    b.getState().external(st.getItem(WORKSPACE_KEY));
    expect(b.getState().conflict).toBeNull();
  });

  it('the storage event reaches the store through bindAuthorStore', () => {
    const st = memoryStorage();
    const s = createAuthorStore(draft(), st);
    const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
    const off = bindAuthorStore(s, { win, doc, storage: st });
    const other = { ...draft(), title: 'From the other tab' };
    win.dispatchEvent(Object.assign(new Event('storage'), { key: WORKSPACE_KEY, newValue: JSON.stringify(other), storageArea: st }));
    expect(s.getState().conflict).not.toBeNull();
    off();
  });
});

describe('saving when the page is left (D123)', () => {
  it('flushes the waiting save on pagehide and when the page is hidden', () => {
    const st = memoryStorage();
    const s = createAuthorStore(draft(), st);
    const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
    const off = bindAuthorStore(s, { win, doc, storage: st });
    s.getState().edit(d => { d.title = 'Typed just before reload'; }, 'title');
    expect(readStored(st).draft).toBeNull();
    win.dispatchEvent(new Event('pagehide'));
    expect(readStored(st).draft?.title).toBe('Typed just before reload');
    s.getState().edit(d => { d.title = 'Before switching tabs'; }, 'title');
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(readStored(st).draft?.title).toBe('Before switching tabs');
    off();
  });
});

describe('repair, field by field (D124)', () => {
  it('a stat of 500 becomes 100 and the team stays the team', () => {
    const st = memoryStorage();
    const d = draft();
    const raw = JSON.parse(JSON.stringify(d));
    raw.team[2].stats.skill = 500;
    st.setItem(WORKSPACE_KEY, JSON.stringify(raw));
    const s = createAuthorStore(undefined, st);
    expect(s.getState().draft.team.map(c => c.first)).toEqual(d.team.map(c => c.first));
    expect(s.getState().draft.team[2].stats.skill).toBe(100);
    expect(s.getState().draft.team[2].stats.morale).toBe(d.team[2].stats.morale);
    expect(s.getState().recovery?.notes).toEqual([`Team, ${d.team[2].first} ${d.team[2].last}, stats, skill: 500 changed to 100`]);
    expect(st.getItem(WORKSPACE_BACKUP_KEY)).toBe(JSON.stringify(raw));
  });

  it('a value of the wrong kind goes back to its default, alone', () => {
    const d = draft();
    const raw = JSON.parse(JSON.stringify(d));
    raw.team[1].gender = 'robot';
    raw.process.weeks = 'many';
    raw.brief.tones = 'serious';
    const r = repairDraft(raw, freshDraft)!;
    expect(r.draft.team[1].first).toBe(d.team[1].first);
    expect(r.draft.team[1].persona).toBe(d.team[1].persona);
    expect(r.draft.team[1].gender).toBe('woman');
    expect(r.draft.process.weeks).toBe(freshDraft().process.weeks);
    expect(r.draft.process.stages).toEqual(d.process.stages);
    expect(r.draft.brief.challenge).toBe(d.brief.challenge);
    expect(r.notes).toHaveLength(3);
  });

  it('one bad list item is dropped, and only that one', () => {
    const d = draft();
    const raw = JSON.parse(JSON.stringify(d));
    raw.events[2] = { title: 'Broken', key: 'NOT A KEY' };
    const r = repairDraft(raw, freshDraft)!;
    expect(r.draft.events.map(e => e.key)).toEqual(d.events.filter((_, i) => i !== 2).map(e => e.key));
    expect(r.notes.some(n => n.startsWith('Events: removed "Broken"'))).toBe(true);
    expect(r.draft.team).toEqual(d.team);
  });

  it('a mark that cannot be read is removed, not the marks', () => {
    const d = draft();
    const raw = JSON.parse(JSON.stringify(d));
    raw.marks['story.company.name'] = 'mine';
    const r = repairDraft(raw, freshDraft)!;
    expect(r.draft.marks['story.company.name']).toBeUndefined();
    expect(Object.keys(r.draft.marks).length).toBe(Object.keys(d.marks).length - 1);
  });

  it('corrupt JSON starts a new draft, keeps the original, and says so', () => {
    const st = memoryStorage();
    st.setItem(WORKSPACE_KEY, '{"v":1,"title":"Half writ');
    const s = createAuthorStore(undefined, st);
    expect(s.getState().draft.stage).toBe('chat');
    expect(s.getState().recovery).toMatchObject({ unreadable: true, original: '{"v":1,"title":"Half writ', restorable: false });
    expect(st.getItem(WORKSPACE_BACKUP_KEY)).toBe('{"v":1,"title":"Half writ');
  });

  it('every stored draft repairs to one that parses', () => {
    const d = draft();
    const raw = JSON.parse(JSON.stringify(d));
    raw.lens.styles = 'none';
    raw.scoring.samples[0].scored = 7;
    raw.publish.version = -3;
    raw.chat.log.push({ kind: 'nonsense' });
    const r = repairDraft(raw, freshDraft)!;
    expect(AuthorDraft.safeParse(r.draft).success).toBe(true);
    expect(r.draft.publish.version).toBe(0);
    expect(r.draft.chat.log).toHaveLength(d.chat.log.length);
    expect(r.draft.lens.styles.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Play a week never plays the wrong simulation (D123)', () => {
  const playable = () => { const d = draft(); d.story.product.dealValue = 30000; return d; };

  it('hands the draft over and opens the tab', () => {
    const local = memoryStorage();
    const opened: string[] = [];
    expect(playDraft(playable(), u => opened.push(u), [() => memoryStorage(), () => local]).ok).toBe(true);
    expect(opened).toHaveLength(1);
    expect(JSON.parse(local.getItem(DRAFT_KEY)!).name).toBeTruthy();
  });

  it('with storage full, removes the older draft, makes room from versions, and says so when that is not enough', () => {
    const local = memoryStorage(2000);
    local.setItem(DRAFT_KEY, '{"name":"an older draft"}');
    const opened: string[] = [];
    const r = playDraft(playable(), u => opened.push(u), [() => memoryStorage(10), () => local]);
    expect(r).toMatchObject({ ok: false, reason: 'storage', issues: [PLAY_STORAGE_FULL] });
    expect(opened).toEqual([]);
    expect(local.getItem(DRAFT_KEY)).toBeNull();

    const roomy = memoryStorage(JSON.stringify(draft()).length * 2 + 2000);
    const s = createAuthorStore(draft(), roomy);
    s.getState().checkpoint('One');
    s.getState().checkpoint('Two');
    expect(readVersions(roomy)).toHaveLength(2);
    expect(playDraft(playable(), u => opened.push(u), [() => roomy]).ok).toBe(true);
    expect(readVersions(roomy).length).toBeLessThan(2);
  });
});

describe('lazy chunks (D123)', () => {
  it('tells a chunk that did not load from other errors, and tries once more', async () => {
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: http://x/a.js'))).toBe(true);
    expect(isChunkError(Object.assign(new Error('x'), { name: 'ChunkLoadError' }))).toBe(true);
    expect(isChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
    let n = 0;
    const load = () => (++n === 1 ? Promise.reject(new TypeError('Importing a module script failed.')) : Promise.resolve('loaded'));
    const p = retryImport(load, 10);
    await vi.advanceTimersByTimeAsync(20);
    await expect(p).resolves.toBe('loaded');
    await expect(retryImport(() => Promise.reject(new Error('a bug')), 10)).rejects.toThrow('a bug');
  });
});

it('the versions key is its own', () => {
  expect(WORKSPACE_VERSIONS_KEY).not.toBe(WORKSPACE_KEY);
});
