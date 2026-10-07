import sampleReadiness from '../../src/api/samples/benchmark-readiness_based.json';
import sampleSixStyles from '../../src/api/samples/benchmark-six_styles.json';
import type { StorylineConfig } from '../../src/engine/config';
import { BenchmarkSummary, type GroupReport } from '../../src/engine/groupContract';
import type { HistoryEntry } from '../../src/engine/reportContract';
import { buildGroupReport, summarizeBenchmark } from '../../src/engine/report/group';
import type { RunSummary } from '../../src/engine/report/summary';
import { configOf, type Storylines } from './engine/storylines';
import type { Logger } from './log';
import type { Repository } from './store';
import type { RunRow } from './store/repo';

/**
 * Cohort and history reads, built with the engine's own pure functions (`buildGroupReport`,
 * `summarizeBenchmark`) over the stored run summaries (HANDOFF section 3).
 */

/** The cached sample benchmarks (300 seeded runs per lens, `npm run benchmark`): used until real play gives enough runs. */
const SAMPLES: Record<string, unknown> = { readiness_based: sampleReadiness, six_styles: sampleSixStyles };
export const benchmarkKey = (lensId: string) => `lens:${lensId}`;

const today = () => new Date().toISOString().slice(0, 10);

/** Each participant's latest attempt, in the order given. */
export function latestPerParticipant<T extends Pick<RunRow, 'participantId' | 'attempt'>>(runs: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of runs) {
    const b = best.get(r.participantId);
    if (!b || r.attempt > b.attempt) best.set(r.participantId, r);
  }
  return runs.filter(r => best.get(r.participantId) === r);
}

export class Reports {
  constructor(private readonly repo: Repository, private readonly storylines: Storylines, private readonly log: Logger, private readonly minRuns = 20) {}

  /** The stored benchmark for a lens, else the sample, else none. */
  async benchmark(lensId: string): Promise<BenchmarkSummary | null> {
    const stored = await this.repo.getBenchmark(benchmarkKey(lensId));
    const raw = stored?.summary ?? SAMPLES[lensId] ?? null;
    if (!raw) return null;
    const r = BenchmarkSummary.safeParse(raw);
    return r.success ? r.data : null;
  }

  /**
   * Recomputes every lens's benchmark from all stored run summaries (everyone who has played). A lens with
   * fewer than `BENCHMARK_MIN_RUNS` runs keeps the sample, so a new deployment's first cohort is not its own benchmark.
   */
  async refreshBenchmarks(): Promise<Array<{ lens: string; runs: number; stored: boolean }>> {
    const out = [];
    for (const lens of await this.repo.lensIds()) {
      const runs = (await this.repo.listSummaries(lens)) as RunSummary[];
      const stored = runs.length >= this.minRuns;
      if (stored) await this.repo.putBenchmark(benchmarkKey(lens), summarizeBenchmark(runs), runs.length);
      out.push({ lens, runs: runs.length, stored });
    }
    this.log.info('benchmarks refreshed', { lenses: out });
    return out;
  }

  /** The cohort's group report (D77), or null when there is no such cohort. */
  async groupReport(cohortId: string): Promise<GroupReport | null> {
    const cohort = await this.repo.getCohort(cohortId);
    const runs = latestPerParticipant(await this.repo.listCohortRuns(cohortId));
    if (!cohort && !runs.length) return null;
    // The storyline the cohort played: the latest run's snapshot, else the cohort's storyline.
    let storyline: StorylineConfig;
    const last = runs.at(-1);
    if (last) storyline = configOf(last.config);
    else storyline = (await this.storylines.resolve(cohort?.storylineId, cohort?.purpose)).config;
    const purpose = cohort?.purpose ?? storyline.purpose ?? (storyline.use === 'selection' ? 'assessment' : 'development');
    const withSummary = runs.filter(r => r.summary);
    return buildGroupReport({
      runs: withSummary.map(r => r.summary as RunSummary),
      names: withSummary.map(r => r.name ?? r.participantId),
      benchmark: await this.benchmark(storyline.lens.id),
      cohort: { name: cohort?.name ?? cohortId, date: today(), purpose, storyline }
    });
  }

  /** `POST /cohort/report`: a group report from summaries the caller sends. */
  async groupReportFrom(input: { cohort: { id: string; name: string; date: string; purpose: 'development' | 'assessment' }; runs: Array<{ name: string; summary: RunSummary }> }): Promise<GroupReport> {
    const first = input.runs[0]?.summary;
    const cohort = await this.repo.getCohort(input.cohort.id);
    const storyline = (await this.storylines.resolve(first?.storyline.id ?? cohort?.storylineId, input.cohort.purpose)).config;
    return buildGroupReport({
      runs: input.runs.map(r => r.summary), names: input.runs.map(r => r.name),
      benchmark: await this.benchmark(first?.lens.id ?? storyline.lens.id),
      cohort: { name: input.cohort.name, date: input.cohort.date, purpose: input.cohort.purpose, storyline }
    });
  }

  /** Earlier attempts (D75): ended runs of the storyline other than the current one, oldest first. */
  async history(participantId: string, current: RunRow): Promise<HistoryEntry[]> {
    const runs = (await this.repo.listRuns(participantId, current.storylineId)).filter(r => r.id !== current.id && r.status === 'ended');
    const out: HistoryEntry[] = [];
    for (const r of runs) {
      const summary = await this.repo.getSummary(r.id);
      if (!summary) continue;
      out.push({ attempt: r.attempt, endedAt: (r.endedAt ?? r.updatedAt).slice(0, 10), headline: r.headline ?? 'Not enough evidence for an overall level', summary: summary as HistoryEntry['summary'] });
    }
    return out;
  }

  /**
   * The cohort leaderboard (scoring-and-report.md 6): each participant's latest attempt, by Leadership
   * Score, then conversions, then contextual capability %. The caller's own numbers come from their run,
   * not from what the browser sent.
   */
  async leaderboard(input: { participantId: string; cohortId: string | null; current: RunRow; size: number; anonymous: boolean; you: { score: number; conversions: number; capability: number } }) {
    const mine = { score: input.current.scoreTotal ?? input.you.score, conversions: input.current.conversions ?? input.you.conversions, capability: input.current.capability ?? input.you.capability };
    const others = input.cohortId
      ? latestPerParticipant(await this.repo.listCohortRuns(input.cohortId)).filter(r => r.participantId !== input.participantId && r.storylineId === input.current.storylineId && r.scoreTotal !== null)
      : [];
    const me = await this.repo.getParticipant(input.participantId);
    const all = [
      ...others.map(r => ({ name: r.name, you: false, score: r.scoreTotal ?? 0, conversions: r.conversions ?? 0, capability: r.capability ?? 0 })),
      { name: me?.name ?? null, you: true, ...mine }
    ].sort((a, b) => b.score - a.score || b.conversions - a.conversions || b.capability - a.capability)
      .map((e, i) => ({ ...e, rank: i + 1, name: input.anonymous && !e.you ? null : e.name }));
    const top = all.slice(0, input.size);
    const you = all.find(e => e.you)!;
    return { entries: top.some(e => e.you) ? top : [...top, you], total: all.length };
  }
}
