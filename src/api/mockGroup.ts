import { parseStoryline, type Purpose, type StorylineConfig, type StorylineInput } from '../engine/config';
import { BenchmarkSummary, type GroupReport } from '../engine/groupContract';
import salesElevator from '../engine/storylines/sales-elevator.json';
import { withSixStyles } from '../engine/storylines/sixStyles';
import { buildGroupReport } from '../engine/report/group';
import type { RunSummary } from '../engine/report/summary';
import { play, type Player } from '../engine/sim/policies';

/**
 * The mock group report (D77): a cohort played by the calibration's AI players, and a benchmark from
 * 300 seeded runs, cached in `src/api/samples` (`npm run benchmark` writes it, `-- --check` compares).
 * Loaded on demand by `/group`, never in the participant's first load.
 */

export interface MockGroupOptions {
  purpose?: Purpose;
  /** `six_styles` plays the Six Leadership Styles test lens. */
  lens?: string | null;
  /** Participants in the cohort: 37 for development and 18 for assessment by default. */
  size?: number | null;
}

/** Sample participant names; only an assessment's participant table shows them. */
export const SAMPLE_NAMES = [
  'Aisha Rahman', 'Ben Okafor', 'Chen Wei', 'Dana Kowalski', 'Elif Demir', 'Farid Haddad', 'Grace Mensah', 'Hiro Tanaka', 'Isla Murray', 'Jonas Berg',
  'Kavya Iyer', 'Luca Romano', 'Maya Cohen', 'Nina Petrova', 'Omar Siddiqui', 'Priya Nair', 'Quinn Doyle', 'Rosa Alvarez', 'Sam Whitfield', 'Tomas Novak',
  'Uma Krishnan', 'Victor Hale', 'Wen Li', 'Yara Haddad', 'Zoe Carter'
];

/**
 * Who plays participant `i`: mostly strong players, then one style, careless, random and passive ones,
 * and every ninth stops part way through (the completion rate).
 */
const COHORT_MIX: Player[] = ['good', 'random', 'good', 'oneStyle', 'careless', 'good', 'random', 'passive'];
/** Everyone who has played: fewer strong players than a cohort that went through a program. */
const BENCHMARK_MIX: Player[] = ['good', 'random', 'careless', 'oneStyle', 'random', 'passive', 'good', 'random'];

export function cohortPlayer(i: number, periods: number, mix: Player[] = COHORT_MIX): { policy: Player; stopAfter?: number } {
  const policy = mix[i % mix.length];
  return i % 9 === 8 ? { policy, stopAfter: 1 + (i % Math.max(1, periods - 1)) } : { policy };
}

/** Plays `size` participants from `seed`, in order: their run summaries. */
export async function playCohort(config: StorylineConfig, size: number, seed: number): Promise<RunSummary[]> {
  const runs: RunSummary[] = [];
  for (let i = 0; i < size; i++) runs.push(await playOne(config, i, seed + i, COHORT_MIX));
  return runs;
}

async function playOne(config: StorylineConfig, i: number, seed: number, mix: Player[]) {
  const { policy, stopAfter } = cohortPlayer(i, config.time.period.count, mix);
  const { engine } = await play(config, policy, seed, { stopAfter });
  return engine.summary();
}

/** The storyline the mock plays, for a lens and purpose. */
export function mockStoryline(lens: string | null | undefined, purpose: Purpose): StorylineConfig {
  const base = salesElevator as unknown as StorylineInput;
  const r = parseStoryline({ ...(lens === 'six_styles' ? withSixStyles(base) : base), purpose });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.config;
}

export const BENCHMARK_RUNS = 300;
const BENCHMARK_SEED = 10_000;

/** The mock benchmark: 300 seeded runs, half played as assessments, summarized as the server stores it. */
export async function playBenchmark(lens: string | null | undefined, runs = BENCHMARK_RUNS) {
  const { summarizeBenchmark } = await import('../engine/report/group');
  const development = mockStoryline(lens, 'development'), assessment = mockStoryline(lens, 'assessment');
  const out: RunSummary[] = [];
  for (let i = 0; i < runs; i++) out.push(await playOne(i % 2 ? assessment : development, i, BENCHMARK_SEED + i, BENCHMARK_MIX));
  return summarizeBenchmark(out, { completeAt: development.report.group.completeAt });
}

/** The cached benchmark for a lens. */
async function cachedBenchmark(lens: string | null | undefined): Promise<BenchmarkSummary> {
  const raw = lens === 'six_styles' ? (await import('./samples/benchmark-six_styles.json')).default : (await import('./samples/benchmark-readiness_based.json')).default;
  return BenchmarkSummary.parse(raw);
}

/** The mock cohort's group report (`getGroupReport` on the mock API). */
export async function mockGroupReport(cohortId: string, opts: MockGroupOptions = {}): Promise<GroupReport> {
  const purpose = opts.purpose ?? 'development';
  const config = mockStoryline(opts.lens, purpose);
  const size = Math.max(0, Math.min(200, opts.size ?? (purpose === 'assessment' ? 18 : 37)));
  const runs = await playCohort(config, size, purpose === 'assessment' ? 3000 : 2000);
  return buildGroupReport({
    runs, names: runs.map((_, i) => SAMPLE_NAMES[i] ?? `Participant ${i + 1}`), benchmark: await cachedBenchmark(opts.lens),
    cohort: { name: purpose === 'assessment' ? 'Sales manager selection, October 2026' : `Regional sales managers, cohort ${cohortId}`, date: '2026-10-05', purpose, storyline: config }
  });
}
