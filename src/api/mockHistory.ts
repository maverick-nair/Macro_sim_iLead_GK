import { defaultStoryline } from '../engine/mock';
import { play } from '../engine/sim/policies';
import type { HistoryEntry } from '../engine/reportContract';

/**
 * The mock's earlier attempt (`getHistory` with `?history=1`): the default storyline played by the random
 * player, as the server would store it, its run summary with the report's headline. Loaded on demand.
 */
export async function mockHistory(): Promise<HistoryEntry[]> {
  const config = defaultStoryline(new URLSearchParams(globalThis.location?.search ?? '').get('lens'));
  const { engine } = await play(config, 'random', 11);
  // The engine's report for that run; the history keeps only its numbers and headline.
  const report = engine.view().report ?? null;
  if (!report) return [];
  const headline = report.verdict?.overall.label ?? report.summary.level?.name ?? 'Not enough evidence for an overall level';
  return [{ attempt: 1, endedAt: '2026-09-21', headline, summary: report.run }];
}

