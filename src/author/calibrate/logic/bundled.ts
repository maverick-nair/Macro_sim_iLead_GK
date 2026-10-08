import { parseStoryline, type StorylineConfig } from '../../../engine/config';
import salesElevator from '../../../engine/storylines/sales-elevator.json';

/**
 * Whether a storyline plays on the bundled Sales Elevator's calibrated actions (D149): every /author draft
 * starts from them (`draftStoryline` copies them), so a finding in them is the bundled storyline's, not the
 * author's. Compares what the actions do (rules, costs, cooldowns, effects, limits), never their wording or
 * the lens's style keys; an action switched off does not count. Once an author changes what an action does,
 * or adds one, the storyline is theirs to fix.
 *
 * The bundled Client Trust (D141) plays the same actions with budget costs and quality gains on some options
 * (business effects, D136). Those do not change what the actions do to people and the funnel, where the finding
 * lies (the routine still wins with them, D152), so for the bundled storylines the actions' business effects are
 * left out of the comparison; an author's storyline that adds one has changed the action.
 * Runs with the calibration (worker, server, CLI), never in the screen.
 */

/** The storylines that ship with the app (src/engine/storylines), whose owner rebalances them. */
export const BUNDLED_STORYLINES: ReadonlySet<string> = new Set(['sales_elevator', 'client_trust']);

const WORDS = new Set(['key', 'rule', 'scope', 'kind', 'format']);

/** An action's mechanics: numbers, flags and the few words that are mechanics, with keys in order. */
function mechanics(x: unknown, key = '', business = true): unknown {
  if (typeof x === 'string') return WORDS.has(key) ? x : undefined;
  if (Array.isArray(x)) return x.map(v => mechanics(v, '', business));
  if (x && typeof x === 'object') {
    // An effect table without a clear miss plays its partial miss there (the engine's default): the same mechanics.
    const o = x as Record<string, unknown>;
    const filled = 'm0' in o && 'm1' in o && o.m2 === undefined ? { ...o, m2: o.m1 } : o;
    return Object.fromEntries(Object.entries(filled)
      .filter(([k]) => k !== 'style' && (business || k !== 'business'))
      .map(([k, v]) => [k, mechanics(v, k, business)] as const)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)));
  }
  return x;
}

const bundled = new Map<boolean, Map<string, string>>();
const fingerprint = (a: unknown, business: boolean) => JSON.stringify(mechanics(a, '', business));

function bundledActions(business: boolean): Map<string, string> {
  let m = bundled.get(business);
  if (!m) {
    const p = parseStoryline(salesElevator);
    m = new Map(p.ok ? p.config.actions.map(a => [a.key, fingerprint(a, business)]) : []);
    bundled.set(business, m);
  }
  return m;
}

/**
 * The storyline's actions whose mechanics are not the bundled ones (changed, or new), by key. A bundled storyline's
 * business effects on actions are left out (D152).
 */
export function changedActions(config: StorylineConfig): string[] {
  const business = !BUNDLED_STORYLINES.has(config.id);
  const known = bundledActions(business);
  return config.actions.filter(a => known.get(a.key) !== fingerprint(a, business)).map(a => a.key);
}

/** True when every action the storyline has is a bundled one, unchanged; actions switched off do not count. */
export function playsBundledActions(config: StorylineConfig): boolean {
  return config.id === 'sales_elevator' || (config.actions.length > 0 && changedActions(config).length === 0);
}
