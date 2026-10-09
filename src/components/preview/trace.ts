/**
 * Where a participant surface comes from in GenieKreator (D197). Participant surfaces carry
 * `data-trace="<storyline config path>"` (`members.kent`, `actions.coach`, `events.price_war`, `lens.styles`);
 * the preview's "Show where this comes from" labels each with the GenieKreator section and field that
 * make it.
 *
 * This is the one seam the overlay reads through. The full registry (`src/shared/trace.ts`) is being built
 * separately; until it lands this stub answers from the config path's first part. Rewire `getTrace` to
 * the registry when it does: nothing else changes.
 */
export interface TraceInfo {
  /** The GenieKreator section (its nav label). */
  section: string;
  /** The field or item in that section. */
  label: string;
}

export type TraceLookup = (path: string) => TraceInfo | null;

/** Authoring copy: the GenieKreator section labels (src/author/ui/sections.ts) and their fields. */
const STUB: Record<string, TraceInfo> = {
  name: { section: 'Overview', label: 'Title' },
  organisation: { section: 'Story and world', label: 'Company' },
  intro: { section: 'Story and world', label: 'Intro screens' },
  world: { section: 'Story and world', label: 'Company and market' },
  sponsor: { section: 'Story and world', label: 'Sponsor' },
  money: { section: 'Story and world', label: 'Currency and deal value' },
  time: { section: 'Brief', label: 'Run length' },
  stages: { section: 'Work process', label: 'Stages and targets' },
  members: { section: 'Team', label: 'Character' },
  candidates: { section: 'Team', label: 'Candidate' },
  stakeholders: { section: 'Team', label: 'Stakeholder' },
  lens: { section: 'Leadership lens', label: 'Styles and fit' },
  'lens.styles': { section: 'Leadership lens', label: 'Styles' },
  actions: { section: 'Actions and conversations', label: 'Action' },
  events: { section: 'Events', label: 'Event' },
  gamification: { section: 'Scoring and report', label: 'Score and badges' },
  report: { section: 'Scoring and report', label: 'Report' },
  video: { section: 'Story and world', label: 'Welcome video' }
};

let lookup: TraceLookup = path => STUB[path] ?? STUB[path.split('.').slice(0, 2).join('.')] ?? STUB[path.split('.')[0]] ?? null;

/** The GenieKreator section and field a config path comes from, or null when none is known. */
export function getTrace(path: string): TraceInfo | null {
  return path ? lookup(path) : null;
}

/** Points `getTrace` at another registry (the shared one, or a test's). Returns the previous lookup. */
export function setTraceLookup(next: TraceLookup): TraceLookup {
  const prev = lookup;
  lookup = next;
  return prev;
}
