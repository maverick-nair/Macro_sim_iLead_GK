import { TRACE, traceOf, type Section } from '../../shared/trace';

/**
 * Where a participant surface comes from in GenieKreator (D197). Participant surfaces carry
 * `data-trace="<storyline config path>"` (`members.kent`, `actions.coach`, `events.price_war`, `lens.styles`);
 * the preview's "Show where this comes from" labels each with the GenieKreator section and field that
 * make it.
 *
 * This is the one seam the overlay reads through, and it reads the traceability registry
 * (`src/shared/trace.ts`, D180): the same registry GenieKreator's "Where it appears" panels read forwards.
 * A list element named by its key (`members.kent`) is read as the list's pattern (`members[]`). A path the
 * registry traces only through its fields (a member card, an action, the clock) takes the section most of
 * those fields are in, and the first such field as its label. Internal and unknown paths get no label.
 */
export interface TraceInfo {
  /** The GenieKreator section (its nav label). */
  section: string;
  /** The field or item in that section. */
  label: string;
}

export type TraceLookup = (path: string) => TraceInfo | null;

/**
 * Authoring copy: GenieKreator's nav labels (src/author/ui/sections.ts, kept equal by a test). Held here so
 * the player's preview does not load GenieKreator's code.
 */
export const SECTION_LABELS: Record<Section, string> = {
  overview: 'Overview',
  brief: 'Brief',
  story: 'Story and world',
  process: 'Work process',
  team: 'Team',
  lens: 'Leadership lens',
  actions: 'Actions and conversations',
  events: 'Events',
  scoring: 'Scoring and report',
  brand: 'Brand and theme',
  calibrate: 'Test with synthetic players',
  publish: 'Review and publish'
};

const KEYS = Object.keys(TRACE);

/** `members.kent.name` as `members[].name`: a segment no registry path names, under a list, is that list's element. */
export function patternFor(path: string): string {
  let at = '';
  for (const seg of path.split('.')) {
    const named = at ? `${at}.${seg}` : seg;
    const known = (p: string) => KEYS.some(k => k === p || k.startsWith(`${p}.`) || k.startsWith(`${p}[]`));
    at = !known(named) && at && known(`${at}[]`) ? `${at}[]` : named;
  }
  return at;
}

/** The registry's answer for a participant surface's path. */
export function registryTrace(path: string): TraceInfo | null {
  const pattern = patternFor(path);
  const own = traceOf(pattern);
  if (own) return { section: SECTION_LABELS[own.section], label: own.label };
  const under = Object.entries(TRACE).filter(([k]) => k.startsWith(`${pattern}.`) || k.startsWith(`${pattern}[]`));
  if (!under.length) return null;
  const count = new Map<Section, number>();
  for (const [, t] of under) count.set(t.section, (count.get(t.section) ?? 0) + 1);
  const section = [...count].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return { section: SECTION_LABELS[section], label: under.find(([, t]) => t.section === section)![1].label };
}

let lookup: TraceLookup = registryTrace;

/** The GenieKreator section and field a config path comes from, or null when none is known. */
export function getTrace(path: string): TraceInfo | null {
  return path ? lookup(path) : null;
}

/** Points `getTrace` at another registry (a test's). Returns the previous lookup. */
export function setTraceLookup(next: TraceLookup): TraceLookup {
  const prev = lookup;
  lookup = next;
  return prev;
}
