import { describe, expect, it } from 'vitest';
import { createMockApi } from '../../api';
import { parseStoryline } from '../../engine/config';
import { EngineView } from '../../engine/contract';
import { play } from '../../engine/sim/policies';
import salesElevator from '../../engine/storylines/sales-elevator.json';
import { createI18n } from '../../i18n';
import { copyViolations } from '../../i18n/copy';
import { cohortRows } from '../end/cohort';
import { leaderboardRequest } from './leaderboard';

const i18n = createI18n();

async function endedRun(use: 'development' | 'selection', patch: Record<string, unknown> = {}) {
  const parsed = parseStoryline({ ...salesElevator, use, ...patch });
  if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
  const r = await play(parsed.config, 'good', 3);
  return EngineView.parse(r.view);
}

describe('the leaderboard request', () => {
  it('is off for selection use: nothing is asked of the cohort API', async () => {
    const view = await endedRun('selection');
    expect(view.gamification.leaderboard.enabled).toBe(false);
    expect(leaderboardRequest(view)).toBeNull();
  });

  it('sends this participant’s own result, as the engine and report have it', async () => {
    const view = await endedRun('development');
    const lb = view.gamification.leaderboard;
    expect(lb.enabled).toBe(true);
    expect(leaderboardRequest(view)).toEqual({
      size: lb.size, anonymous: lb.anonymous,
      you: { score: view.score.total, conversions: view.report!.results.conversions, capability: view.score.capability }
    });
  });

  it('during play counts conversions from the weeks so far, rounded down', async () => {
    const view = await endedRun('development');
    const playing = { ...view, report: null, periods: view.periods.slice(0, 2) };
    const output = playing.periods.reduce((s, p) => s + p.week.funnel.output, 0);
    expect(leaderboardRequest(playing)!.you.conversions).toBe(Math.floor(output));
  });
});

describe('the cohort table', () => {
  const tiers = [{ key: 'platinum', name: 'Platinum', min: 800 }, { key: 'gold', name: 'Gold', min: 650 }, { key: 'silver', name: 'Silver', min: 450 }, { key: 'bronze', name: 'Bronze', min: 0 }];
  const you = (score: number) => ({ score, conversions: 5, capability: 60 });

  it('shows the top N as sent, with this participant marked inside it', async () => {
    const board = await createMockApi({ latencyMs: 0, name: 'Priya Sharma' }).getLeaderboard({ size: 10, anonymous: false, you: you(990) });
    const c = cohortRows(i18n.t, board, tiers, 10);
    expect(c.top).toHaveLength(10);
    expect(c.outside).toBeNull();
    expect(c.top[0]).toMatchObject({ rank: 1, name: 'Priya Sharma', you: true, score: 990, tier: 'Platinum' });
    expect(c.you).toEqual({ rank: 1, total: 15 });
    expect(c.top.filter(r => r.you)).toHaveLength(1);
  });

  it('appends this participant’s own row when outside the top N', async () => {
    const board = await createMockApi({ latencyMs: 0 }).getLeaderboard({ size: 10, anonymous: false, you: you(100) });
    const c = cohortRows(i18n.t, board, tiers, 10);
    expect(c.top).toHaveLength(10);
    expect(c.top.some(r => r.you)).toBe(false);
    // Unknown name: the row says You (the panel's tag), never a made up name.
    expect(c.outside).toMatchObject({ rank: 15, name: null, you: true, tier: 'Bronze' });
    expect(c.you).toEqual({ rank: 15, total: 15 });
    expect(i18n.t('end.cohort.rank', c.you!)).toBe('Rank 15 of 15');
  });

  it('says A colleague for everyone else when anonymous', async () => {
    const board = await createMockApi({ latencyMs: 0, name: 'Priya Sharma' }).getLeaderboard({ size: 5, anonymous: true, you: you(100) });
    const c = cohortRows(i18n.t, board, tiers, 5);
    expect(c.top.every(r => r.name === 'A colleague')).toBe(true);
    expect(c.outside?.name).toBe('Priya Sharma');
  });

  it('keeps the server’s ranks and order, ties included', () => {
    const e = (rank: number, score: number, name: string, me = false) => ({ rank, score, conversions: 1, capability: 1, name, you: me });
    const board = { total: 4, entries: [e(1, 700, 'A'), e(2, 650, 'B'), e(2, 650, 'C', true), e(4, 640.6, 'D')] };
    const c = cohortRows(i18n.t, board, tiers, 4);
    expect(c.top.map(r => [r.rank, r.name, r.score])).toEqual([[1, 'A', 700], [2, 'B', 650], [2, 'C', 650], [4, 'D', 641]]);
    expect(c.you).toEqual({ rank: 2, total: 4 });
  });

  it('words every scope without dashes', () => {
    for (const scope of ['cohort', 'unit', 'global']) {
      for (const text of [i18n.t('end.cohort.title', { scope }), i18n.t('score.rank', { rank: 3, total: 15, scope }), i18n.t('end.cohort.caption', { scope, size: 10, outside: 'true' })]) {
        expect(copyViolations(text)).toEqual([]);
      }
    }
    expect(i18n.t('score.rank', { rank: 3, total: 15, scope: 'cohort' })).toBe('Rank 3 of 15 in your cohort');
  });
});
