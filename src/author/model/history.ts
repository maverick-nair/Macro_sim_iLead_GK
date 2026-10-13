import { LENS_BY_ID } from '../lenses';
import { AuthorDraft, WORKSPACE_VERSIONS_KEY } from './draft';

/**
 * Undo, redo and named versions for the author's draft (D122).
 *
 * Undo and redo live in memory: each step keeps the whole draft as it was before the change (drafts
 * are never changed in place, every edit works on a copy, so a step costs one reference). Typing into
 * one field merges into one step while the keys come less than COALESCE_MS apart.
 *
 * Versions are named restore points kept in local storage under their own key, at most MAX_VERSIONS,
 * the oldest dropped first. They are saved before a change that replaces or removes work (a new lens,
 * a regenerated tab, Kora's change, a removed character, stage, style or event, a confirmed framework,
 * a reset) and when a version is published. Storage that is full drops the oldest versions until the
 * list fits; the draft itself always comes first (`trimVersions`).
 */

export const MAX_UNDO = 100;
export const COALESCE_MS = 800;
export const MAX_VERSIONS = 20;

/** One step of undo: the draft before the change, and what the change was called. */
export interface Step { draft: AuthorDraft; label: string; at: number; key: string | null }

/** A named restore point. */
export interface Version { id: string; at: number; label: string; draft: AuthorDraft }

/** How a change is told apart: its label, whether it saves a version first, and what merges it with the next. */
export interface ChangeInfo { label: string; restorePoint: boolean; key: string | null }

const words = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();

/** "Edit Ana's persona", "Edit company name": a plain label for an edit to marked fields. */
export function labelOfMark(d: AuthorDraft, mark: string): string {
  const p = mark.split('.');
  if (p[0] === 'team') {
    const c = d.team.find(x => x.id === p[1]);
    const who = c ? `${c.first}'s` : 'a character\'s';
    return `Edit ${who} ${p[2] ? words(p[2]) : 'details'}`;
  }
  if (p[0] === 'events') return `Edit event ${d.events.find(e => e.key === p[1])?.title ?? ''}`.trim();
  if (p[0] === 'actions') return `Edit action ${d.actions.find(a => a.key === p[1])?.name ?? ''}`.trim();
  if (p[0] === 'lens' && p[1] === 'styles') return `Edit style ${d.lens.styles.find(s => s.key === p[2])?.name ?? ''}`.trim();
  if (p[0] === 'story' && p[1] === 'screens') return 'Edit a story screen';
  const last = p[p.length - 1];
  const prev = p.length > 2 ? p[p.length - 2] : '';
  return `Edit ${prev && !['brief', 'story', 'process', 'scoring', 'brand', 'publish'].includes(prev) ? `${words(prev)} ` : ''}${words(last)}`;
}

const removed = <T>(a: T[], b: T[], id: (x: T) => string) => a.filter(x => !b.some(y => id(y) === id(x)));

/**
 * What a change did, read from the draft before and after, so destructive changes get a version and a
 * name even when the caller gives none: a new lens, something removed, a confirmed framework, Kora's
 * change, a publish. Null for an ordinary edit.
 */
export function inferChange(before: AuthorDraft, after: AuthorDraft, by: 'you' | 'ai', marked = false): { label: string; restorePoint: boolean } | null {
  if (before.lens.id !== after.lens.id) return { label: `Change lens to ${LENS_BY_ID[after.lens.id]?.title ?? after.lens.id}`, restorePoint: true };
  const team = removed(before.team, after.team, c => c.id);
  if (team.length) return { label: `Remove ${team.map(c => `${c.first} ${c.last}`.trim()).join(', ')}`, restorePoint: true };
  const stages = removed(before.process.stages, after.process.stages, s => s.key);
  if (stages.length) return { label: `Remove stage ${stages.map(s => s.name).join(', ')}`, restorePoint: true };
  const events = removed(before.events, after.events, e => e.key);
  if (events.length) return { label: `Remove event ${events.map(e => e.title).join(', ')}`, restorePoint: true };
  const actions = removed(before.actions, after.actions, a => a.key);
  if (actions.length) return { label: `Remove action ${actions.map(a => a.name).join(', ')}`, restorePoint: true };
  const styles = removed(before.lens.styles, after.lens.styles, s => s.key);
  if (styles.length) return { label: `Remove style ${styles.map(s => s.name).join(', ')}`, restorePoint: true };
  const fb = before.scoring.framework, fa = after.scoring.framework;
  if (fa?.confirmed && !fb?.confirmed) return { label: 'Confirm framework skills', restorePoint: true };
  if (fb && !fa) return { label: 'Keep the lens skills', restorePoint: true };
  if (after.publish.version > before.publish.version) return { label: `Publish version ${after.publish.version}`, restorePoint: false };
  const toAi = Object.keys(after.marks).filter(k => after.marks[k] === 'ai' && before.marks[k] !== 'ai');
  if (by === 'ai' || toAi.length) return { label: 'Kora\'s change', restorePoint: true };
  // Many fields at once with none named (a regenerated tab): worth a version.
  if (!marked && countChanges({ ...before, stage: null, marks: null }, { ...after, stage: null, marks: null }, 3) >= 3) return { label: 'Several changes at once', restorePoint: true };
  return null;
}

/** How many values differ between two drafts, counting up to `limit`. */
export function countChanges(a: unknown, b: unknown, limit = Infinity): number {
  if (a === b) return 0;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return 1;
  let n = 0;
  const ka = Object.keys(a), kb = Object.keys(b);
  for (const k of new Set([...ka, ...kb])) {
    n += countChanges((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], limit - n);
    if (n >= limit) return n;
  }
  return n;
}

/** True when two drafts differ in more than where the author is (`stage`). */
export function differs(a: AuthorDraft, b: AuthorDraft): boolean {
  if (a === b) return false;
  return JSON.stringify({ ...a, stage: null }) !== JSON.stringify({ ...b, stage: null });
}

/** The undo stack after a change: a new step, or the change merged into the last one while typing. */
export function pushStep(past: Step[], before: AuthorDraft, info: ChangeInfo, now: number): Step[] {
  const last = past[past.length - 1];
  if (info.key && last && last.key === info.key && now - last.at < COALESCE_MS) {
    return [...past.slice(0, -1), { ...last, at: now }];
  }
  const next = [...past, { draft: before, label: info.label, at: now, key: info.key }];
  return next.length > MAX_UNDO ? next.slice(next.length - MAX_UNDO) : next;
}

/* Versions in storage. */

export function readVersions(storage: Storage | null): Version[] {
  try {
    const raw = storage?.getItem(WORKSPACE_VERSIONS_KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: Version[] = [];
    for (const x of list) {
      if (!x || typeof x !== 'object') continue;
      const { id, at, label, draft } = x as Record<string, unknown>;
      const d = AuthorDraft.safeParse(draft);
      if (typeof id === 'string' && typeof at === 'number' && typeof label === 'string' && d.success) out.push({ id, at, label, draft: d.data });
    }
    return out.sort((a, b) => a.at - b.at).slice(-MAX_VERSIONS);
  } catch {
    return [];
  }
}

export function isQuota(e: unknown): boolean {
  if (!(e instanceof Error) && !(typeof DOMException !== 'undefined' && e instanceof DOMException)) return /quota/i.test(String(e));
  const x = e as { name?: string; code?: number; message?: string };
  return x.name === 'QuotaExceededError' || x.name === 'NS_ERROR_DOM_QUOTA_REACHED' || x.code === 22 || x.code === 1014 || /quota/i.test(x.message ?? '') || /quota/i.test(x.name ?? '');
}

/**
 * Writes the versions, merged with what another tab may have written, newest MAX_VERSIONS. When storage
 * is full the oldest are dropped until the list fits. Returns what was kept, and whether any was lost.
 */
export function writeVersions(storage: Storage | null, mine: Version[]): { kept: Version[]; ok: boolean } {
  const byId = new Map<string, Version>();
  for (const v of [...readVersions(storage), ...mine]) byId.set(v.id, v);
  let list = [...byId.values()].sort((a, b) => a.at - b.at).slice(-MAX_VERSIONS);
  if (!storage) return { kept: list, ok: false };
  while (list.length) {
    try {
      storage.setItem(WORKSPACE_VERSIONS_KEY, JSON.stringify(list));
      return { kept: list, ok: true };
    } catch (e) {
      if (!isQuota(e)) return { kept: list, ok: false };
      list = list.slice(1);
    }
  }
  try { storage.removeItem(WORKSPACE_VERSIONS_KEY); } catch { /* nothing to free */ }
  return { kept: [], ok: false };
}

/**
 * Frees room for the draft itself: drops the oldest stored version. False when there was none to drop.
 * The versions in memory stay listed for this visit.
 */
export function trimVersions(storage: Storage | null): boolean {
  const list = readVersions(storage);
  if (!list.length || !storage) return false;
  try {
    if (list.length === 1) storage.removeItem(WORKSPACE_VERSIONS_KEY);
    else storage.setItem(WORKSPACE_VERSIONS_KEY, JSON.stringify(list.slice(1)));
    return true;
  } catch {
    try { storage.removeItem(WORKSPACE_VERSIONS_KEY); return true; } catch { return false; }
  }
}
