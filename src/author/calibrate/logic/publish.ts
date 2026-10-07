import { configHash } from './hash';
import type { CalibrationResults } from './schema';

/**
 * The "Synthetic players" line of GenieKreator's publish checks (Publish.dc.html, D114). Light: no engine,
 * no schema library, so the publish screen can import it without the calibration's code.
 *
 *   passed      every check passed
 *   advisory    only warnings: publish is allowed, the author should look
 *   failed      a check failed (scores do not rise, Experts miss the target tier, a strategy wins alone, ...)
 *   notRun      no results yet
 *   outOfDate   the draft changed since the run (pass the draft to detect it)
 *
 * `blocking` is true only for `failed`; the publish screen decides what to do with the others.
 */
export interface CalibrationPublishCheck {
  key: 'syntheticPlayers';
  title: 'Synthetic players';
  status: 'passed' | 'advisory' | 'failed' | 'notRun' | 'outOfDate';
  blocking: boolean;
  /** The line under the title. */
  summary: string;
  /** The checks that need a look, in plain words. */
  details: string[];
  /** What the link or button says: open the results, or run the test. */
  action: 'See results' | 'Run the test' | 'Run the test again';
}

const words = (n: number) => ['no', 'one', 'two', 'three', 'four'][n] ?? String(n);

export function calibrationPublishCheck(results: CalibrationResults | null | undefined, opts: { draft?: unknown; configHash?: string } = {}): CalibrationPublishCheck {
  const base = { key: 'syntheticPlayers' as const, title: 'Synthetic players' as const };
  if (!results) return { ...base, status: 'notRun', blocking: false, summary: 'Not run yet. Synthetic players at four levels play the whole simulation to check it rewards good leadership.', details: [], action: 'Run the test' };
  const hash = opts.configHash ?? (opts.draft !== undefined ? configHash(opts.draft) : null);
  const runs = results.personas.reduce((n, p) => n + p.runs, 0);
  const levels = results.personas.filter(p => p.runs > 0).length;
  const head = `${runs} ${runs === 1 ? 'playthrough' : 'playthroughs'} at ${words(levels)} ${levels === 1 ? 'level' : 'levels'}`;
  if (hash !== null && hash !== results.configHash) return { ...base, status: 'outOfDate', blocking: false, summary: `${head}, on an earlier version of this draft. Run the test again to check your changes.`, details: [], action: 'Run the test again' };
  const failed = results.checks.filter(c => c.status === 'fail');
  const warned = results.checks.filter(c => c.status === 'warn');
  const has = (k: string) => results.checks.some(c => c.key === k && c.status === 'pass');
  const good = [has('ordered') && 'scores rise with proficiency', has('expertTier') && 'Experts reach the target', has('beginnerTier') && 'Beginners do not'].filter(Boolean) as string[];
  const said = good.length ? `: ${good.length > 1 ? `${good.slice(0, -1).join(', ')}, ${good[good.length - 1]}` : good[0]}.` : '.';
  if (failed.length) return { ...base, status: 'failed', blocking: true, summary: `${head}. ${failed.length === 1 ? 'One check failed' : `${failed.length} checks failed`}.`, details: [...failed, ...warned].map(c => c.title), action: 'See results' };
  if (warned.length) return { ...base, status: 'advisory', blocking: false, summary: `${head}${said} ${warned.length === 1 ? 'One thing' : `${warned.length} things`} to look at.`, details: warned.map(c => c.title), action: 'See results' };
  return { ...base, status: 'passed', blocking: false, summary: `${head}${said}`, details: [], action: 'See results' };
}
