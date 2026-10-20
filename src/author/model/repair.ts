import { z } from 'zod';
import { AuthorDraft } from './draft';

/**
 * Keeps the author's work when the stored draft no longer parses (D120, D124). Each problem is fixed
 * where it is: a number out of range is brought back into range, a text or list over its limit is cut,
 * a value of the wrong kind goes back to its default (that one value), a list item that still cannot
 * be read is dropped (that one item), and only when none of that works does the smallest enclosing
 * part go back to the default draft's. Every fix is listed in plain words for the recovery notice.
 * `clampDraft` does only the cutting, in place, and runs on every edit so the draft always saves in a
 * shape that reads back.
 */

type Path = ReadonlyArray<PropertyKey>;
type Obj = Record<PropertyKey, unknown>;

function parentOf(root: unknown, path: Path): Obj | null {
  let at: unknown = root;
  for (const k of path.slice(0, -1)) {
    if (at === null || typeof at !== 'object') return null;
    at = (at as Obj)[k];
  }
  return at !== null && typeof at === 'object' ? (at as Obj) : null;
}

function valueAt(root: unknown, path: Path): { found: boolean; value: unknown } {
  let at: unknown = root;
  for (const k of path) {
    if (at === null || typeof at !== 'object' || !(k in (at as Obj))) return { found: false, value: undefined };
    at = (at as Obj)[k];
  }
  return { found: true, value: at };
}

/** Cuts a string or list over its maximum at `issue.path`. True when it changed something. */
function cut(root: unknown, issue: z.core.$ZodIssue): boolean {
  if (issue.code !== 'too_big' || issue.path.length === 0) return false;
  const parent = parentOf(root, issue.path);
  const key = issue.path[issue.path.length - 1];
  if (!parent) return false;
  const v = parent[key];
  const max = Number(issue.maximum);
  if (!Number.isFinite(max)) return false;
  if (typeof v === 'string' && v.length > max) { parent[key] = v.slice(0, max); return true; }
  if (Array.isArray(v) && v.length > max) { parent[key] = v.slice(0, max); return true; }
  return false;
}

/** Cuts every string and list over its limit, in place. Cheap when the draft already parses. */
export function clampDraft(d: AuthorDraft): AuthorDraft {
  for (let i = 0; i < 4; i++) {
    const r = AuthorDraft.safeParse(d);
    if (r.success) return d;
    if (!r.error.issues.map(x => cut(d, x)).some(Boolean)) return d;
  }
  return d;
}

/* Reading the schema: what a path holds, and a plain default for it. */

function unwrap(s: z.ZodType): z.ZodType {
  let at = s;
  for (let i = 0; i < 8; i++) {
    if (at instanceof z.ZodNullable || at instanceof z.ZodOptional || at instanceof z.ZodDefault) at = at.unwrap() as z.ZodType;
    else break;
  }
  return at;
}

/** The schema at `path`, or null when the path leaves what the schema describes. */
export function schemaAt(root: z.ZodType, path: Path, value?: unknown): z.ZodType | null {
  let s: z.ZodType = root;
  let v: unknown = value;
  for (const k of path) {
    const u = unwrap(s);
    if (u instanceof z.ZodObject) s = (u.shape as Record<string, z.ZodType>)[String(k)];
    else if (u instanceof z.ZodArray) s = u.element as z.ZodType;
    else if (u instanceof z.ZodRecord) s = u.valueType as z.ZodType;
    else if (u instanceof z.ZodUnion) {
      // A discriminated item: the option whose shape has this key and accepts the item's kind.
      const options = (u.options as z.ZodType[]).map(unwrap).filter((o): o is z.ZodObject => o instanceof z.ZodObject);
      const kind = v && typeof v === 'object' ? (v as Obj).kind : undefined;
      // An item whose kind no option takes has no schema here: it is dropped, not rebuilt as another kind.
      const o = options.find(x => String(k) in x.shape && (kind === undefined || !('kind' in x.shape) || x.shape.kind.safeParse(kind).success));
      if (!o) return null;
      s = o.shape[String(k)] as z.ZodType;
    } else return null;
    if (!s) return null;
    v = v && typeof v === 'object' ? (v as Obj)[k] : undefined;
  }
  return s;
}

/** A plain value that the schema accepts where one can be made: empty text, the lowest number, the first choice. */
export function zeroOf(s: z.ZodType): unknown {
  if (s instanceof z.ZodDefault) return s.safeParse(undefined).data;
  if (s instanceof z.ZodNullable) return null;
  if (s instanceof z.ZodOptional) return undefined;
  if (s instanceof z.ZodString) return '';
  if (s instanceof z.ZodNumber) {
    const lo = Number.isFinite(s.minValue ?? NaN) ? s.minValue! : 0;
    const hi = Number.isFinite(s.maxValue ?? NaN) ? s.maxValue! : Math.max(lo, 0);
    return Math.min(hi, Math.max(lo, 0));
  }
  if (s instanceof z.ZodBoolean) return false;
  if (s instanceof z.ZodEnum) return (s.options as unknown[])[0];
  if (s instanceof z.ZodLiteral) return s.value;
  if (s instanceof z.ZodArray) return [];
  if (s instanceof z.ZodRecord) return {};
  if (s instanceof z.ZodObject) return Object.fromEntries(Object.entries(s.shape as Record<string, z.ZodType>).map(([k, f]) => [k, zeroOf(f)]));
  if (s instanceof z.ZodUnion) return zeroOf((s.options as z.ZodType[])[0]);
  return undefined;
}

/* Saying where a fix was, in the author's words. */

const SECTION: Record<string, string> = {
  chat: 'The chat', brief: 'Brief', story: 'Story and world', process: 'Work process', team: 'Team', lens: 'Leadership lens',
  actions: 'Actions and conversations', events: 'Events', scoring: 'Scoring and report', brand: 'Brand and theme', publish: 'Review and publish',
  marks: 'Who wrote what', suggestions: 'Kora\'s suggestions', calibration: 'Synthetic players', title: 'Title', stage: 'Where you were', savedAt: 'Saved time'
};
const words = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();

function nameOf(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Obj;
  const full = [o.first, o.last].filter(x => typeof x === 'string' && x).join(' ');
  if (full) return full;
  for (const k of ['name', 'title', 'skill', 'label', 'key', 'id']) if (typeof o[k] === 'string' && o[k]) return o[k] as string;
  return null;
}

/** "Team, Ana Ruiz, stats, skill": where a path is, named from the draft as it was. */
export function describePath(root: unknown, path: Path): string {
  const parts: string[] = [];
  let at: unknown = root;
  path.forEach((k, i) => {
    const next = at && typeof at === 'object' ? (at as Obj)[k] : undefined;
    if (i === 0) parts.push(SECTION[String(k)] ?? words(String(k)));
    else if (typeof k === 'number') parts.push(nameOf(next) ?? `item ${k + 1}`);
    else parts.push(words(String(k)));
    at = next;
  });
  return parts.join(', ') || 'The draft';
}

const PRIMITIVE = [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodEnum, z.ZodLiteral] as const;
const isPrimitive = (s: z.ZodType | null) => !!s && PRIMITIVE.some(C => unwrap(s) instanceof C);
const shown = (v: unknown) => (typeof v === 'string' ? `"${v.length > 40 ? `${v.slice(0, 40)}...` : v}"` : typeof v === 'number' || typeof v === 'boolean' ? String(v) : null);

/** What a repair did: the cleaned draft and one plain line per fix. */
export interface Repaired { draft: AuthorDraft; notes: string[] }

/**
 * Repairs a stored value that fails the schema, field by field (see the top of this file). Null when
 * the value is not a draft at all (not an object, or a different version).
 *
 * For each failing path, in order, the first step that applies: cut it (too long), bring it into range
 * (a number), remove it (an entry of a keyed list, such as a mark), set that one value back to its
 * default (a plain value: text, a number, a choice; outside a list, the default draft's value). When
 * the path fails again: drop the list item it is in, or else set the smallest enclosing part that the
 * default draft has back to the default. One item is dropped per round, so positions stay true.
 */
export function repairDraft(raw: unknown, fallback: () => AuthorDraft): Repaired | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw) || (raw as { v?: unknown }).v !== 1) return null;
  const original = raw;
  const v = structuredClone(raw) as Obj;
  let fresh: AuthorDraft | null = null;
  const def = () => (fresh ??= fallback());
  const notes: string[] = [];
  /** How many times each path has been fixed: a second failure there takes the wider step. */
  const tries = new Map<string, number>();
  const id = (p: Path) => p.map(String).join('\u0000');

  for (let round = 0; round < 300; round++) {
    const r = AuthorDraft.safeParse(v);
    if (r.success) return { draft: r.data, notes };
    let restart = false;
    const seen = new Set<string>();
    for (const issue of r.error.issues) {
      const path = issue.path as PropertyKey[];
      if (path.length === 0) return null;
      if (seen.has(id(path))) continue;
      seen.add(id(path));
      const n = tries.get(id(path)) ?? 0;
      tries.set(id(path), n + 1);
      const where = describePath(original, path);
      const parent = parentOf(v, path);
      const leaf = path[path.length - 1];
      const before = parent?.[leaf];
      const schema = schemaAt(AuthorDraft, path, v);
      const parentSchema = schemaAt(AuthorDraft, path.slice(0, -1), v);
      const inRecord = !!parentSchema && unwrap(parentSchema) instanceof z.ZodRecord;
      const listAt = path.findLastIndex(k => typeof k === 'number');

      if (n === 0 && parent) {
        if (cut(v, issue)) {
          const max = Number((issue as { maximum?: unknown }).maximum);
          notes.push(Array.isArray(before) ? `${where}: kept the first ${max} items` : `${where}: shortened to ${max} characters`);
          continue;
        }
        const base = schema && unwrap(schema);
        if (base instanceof z.ZodNumber && typeof before === 'number' && Number.isFinite(before)) {
          let x = base.isInt ? Math.round(before) : before;
          if (Number.isFinite(base.minValue ?? NaN)) x = Math.max(base.minValue!, x);
          if (Number.isFinite(base.maxValue ?? NaN)) x = Math.min(base.maxValue!, x);
          if (x !== before) { parent[leaf] = x; notes.push(`${where}: ${before} changed to ${x}`); continue; }
        }
        if (inRecord && before !== undefined) {
          delete parent[leaf];
          notes.push(`${where}: removed, it could not be read`);
          continue;
        }
        if (schema && (isPrimitive(schema) || listAt < 0)) {
          const f = listAt < 0 ? valueAt(def(), path) : { found: false, value: undefined };
          const value = f.found ? structuredClone(f.value) : zeroOf(schema);
          parent[leaf] = value;
          const was = shown(before);
          const now = f.found ? 'the default' : value === '' ? 'empty' : shown(value) ?? 'the default';
          notes.push(`${where}: ${was === null ? (before === undefined ? 'missing, ' : 'could not be read, ') : `${was} could not be read, `}set to ${now}`);
          continue;
        }
      }
      // A second failure, or a part that is not a plain value: drop the list item it is in.
      if (listAt >= 0) {
        const list = valueAt(v, path.slice(0, listAt)).value;
        const i = path[listAt] as number;
        if (Array.isArray(list) && i < list.length) {
          const item = valueAt(original, path.slice(0, listAt + 1)).value;
          list.splice(i, 1);
          const name = nameOf(item);
          notes.push(`${describePath(original, path.slice(0, listAt))}: removed ${name ? `"${name}"` : `item ${i + 1}`}, it could not be read`);
          restart = true;
          break;
        }
      }
      // Last: the smallest enclosing part the default draft has goes back to the default.
      let at: PropertyKey[] = n === 0 ? path : path.slice(0, -1);
      while (at.length > 1 && !valueAt(def(), at).found) at = at.slice(0, -1);
      const holder = parentOf(v, at);
      const d = valueAt(def(), at);
      if (!holder || !d.found) return null;
      holder[at[at.length - 1]] = structuredClone(d.value);
      notes.push(`${describePath(original, at)}: could not be read, set back to the default`);
      restart = true;
      break;
    }
    if (restart) tries.clear();
  }
  return null;
}

