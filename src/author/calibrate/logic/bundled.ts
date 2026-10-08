import { parseStoryline, type StorylineConfig } from '../../../engine/config';
import salesElevator from '../../../engine/storylines/sales-elevator.json';

/**
 * Whether a storyline plays on the bundled Sales Elevator's calibrated actions (D149): every /author draft
 * starts from them (`draftStoryline` copies them), so a finding in them is the bundled storyline's, not the
 * author's. Compares what the actions do (rules, costs, cooldowns, effects, limits), never their wording or
 * the lens's style keys; an action switched off does not count. Once an author changes what an action does,
 * or adds one, the storyline is theirs to fix.
 * Runs with the calibration (worker, server, CLI), never in the screen.
 */

const WORDS = new Set(['key', 'rule', 'scope', 'kind', 'format']);

/** An action's mechanics: numbers, flags and the few words that are mechanics, with keys in order. */
function mechanics(x: unknown, key = ''): unknown {
  if (typeof x === 'string') return WORDS.has(key) ? x : undefined;
  if (Array.isArray(x)) return x.map(v => mechanics(v));
  if (x && typeof x === 'object') {
    // An effect table without a clear miss plays its partial miss there (the engine's default): the same mechanics.
    const o = x as Record<string, unknown>;
    const filled = 'm0' in o && 'm1' in o && o.m2 === undefined ? { ...o, m2: o.m1 } : o;
    return Object.fromEntries(Object.entries(filled)
      .filter(([k]) => k !== 'style')
      .map(([k, v]) => [k, mechanics(v, k)] as const)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)));
  }
  return x;
}

let bundled: Map<string, string> | null = null;
const fingerprint = (a: unknown) => JSON.stringify(mechanics(a));

function bundledActions(): Map<string, string> {
  if (bundled === null) {
    const p = parseStoryline(salesElevator);
    bundled = new Map(p.ok ? p.config.actions.map(a => [a.key, fingerprint(a)]) : []);
  }
  return bundled;
}

/** The storyline's actions whose mechanics are not the bundled ones (changed, or new), by key. */
export function changedActions(config: StorylineConfig): string[] {
  const known = bundledActions();
  return config.actions.filter(a => known.get(a.key) !== fingerprint(a)).map(a => a.key);
}

/** True when every action the storyline has is a bundled one, unchanged; actions switched off do not count. */
export function playsBundledActions(config: StorylineConfig): boolean {
  return config.id === 'sales_elevator' || (config.actions.length > 0 && changedActions(config).length === 0);
}
