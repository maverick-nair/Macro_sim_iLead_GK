/**
 * JSON Pointer helpers (RFC 6901) plus "stable paths": pointers where an array index is replaced by
 * "@<id>" whenever the array item has an `id`. Provenance and locks are stored on stable paths so that
 * adding or removing an NPC, action or event never shifts the AI badge onto the wrong item.
 */

export type Segment = string;

export function parsePointer(pointer: string): Segment[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new Error(`Invalid JSON Pointer "${pointer}"`);
  return pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

export function formatPointer(segments: readonly (string | number)[]): string {
  if (segments.length === 0) return "";
  return "/" + segments.map((s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1")).join("/");
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const itemId = (v: unknown): string | undefined =>
  isRecord(v) && typeof v.id === "string" ? v.id : undefined;

/** Reads the value at a pointer, or undefined when the path does not exist. */
export function getAt(doc: unknown, pointer: string): unknown {
  let cur: unknown = doc;
  for (const seg of parsePointer(pointer)) {
    if (Array.isArray(cur)) {
      const i = Number(seg);
      if (!Number.isInteger(i) || i < 0 || i >= cur.length) return undefined;
      cur = cur[i];
    } else if (isRecord(cur)) {
      if (!Object.prototype.hasOwnProperty.call(cur, seg)) return undefined;
      cur = cur[seg];
    } else return undefined;
  }
  return cur;
}

/** Converts a pointer into its stable form, e.g. /cast/npcs/7/persona to /cast/npcs/@peter/persona. */
export function toStablePath(doc: unknown, pointer: string): string {
  const out: string[] = [];
  let cur: unknown = doc;
  for (const seg of parsePointer(pointer)) {
    if (Array.isArray(cur)) {
      const i = Number(seg);
      const item = Number.isInteger(i) ? cur[i] : undefined;
      const id = itemId(item);
      out.push(id !== undefined ? `@${id}` : seg);
      cur = item;
    } else {
      out.push(seg);
      cur = isRecord(cur) ? cur[seg] : undefined;
    }
  }
  return formatPointer(out);
}

/** Resolves a stable path back to a pointer in this document, or undefined when an id no longer exists. */
export function fromStablePath(doc: unknown, stable: string): string | undefined {
  const out: string[] = [];
  let cur: unknown = doc;
  for (const seg of parsePointer(stable)) {
    if (Array.isArray(cur) && seg.startsWith("@")) {
      const id = seg.slice(1);
      const i = cur.findIndex((v) => itemId(v) === id);
      if (i < 0) return undefined;
      out.push(String(i));
      cur = cur[i];
    } else if (Array.isArray(cur)) {
      out.push(seg);
      cur = cur[Number(seg)];
    } else {
      out.push(seg);
      cur = isRecord(cur) ? cur[seg] : undefined;
    }
  }
  return formatPointer(out);
}

/** True when `prefix` equals `path` or is an ancestor of it (segment wise, not string wise). */
export function isPrefixPath(prefix: string, path: string): boolean {
  const a = parsePointer(prefix);
  const b = parsePointer(path);
  return a.length <= b.length && a.every((s, i) => s === b[i]);
}

/** Two paths overlap when either one contains the other. */
export const pathsOverlap = (a: string, b: string): boolean => isPrefixPath(a, b) || isPrefixPath(b, a);
