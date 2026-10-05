import type { Meta, StoryObj } from '@storybook/react-vite';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { ApiContext, createMockApi, type IleadApi } from '../../api';
import { EngineView } from '../../engine/contract';
import { defaultStoryline } from '../../engine/mock';
import { play } from '../../engine/sim/policies';
import { useI18n } from '../../i18n';
import { MoneyProvider } from '../../i18n/money';
import { EngineEnd } from '../board/EngineEnd';
import CohortRank from '../gamification/CohortRank';
import { ScoreBreakdown } from '../gamification/ScoreBreakdown';
import { cohortRows } from './cohort';
import { CohortPanel } from './CohortPanel';

/**
 * The cohort leaderboard (scoring-and-report.md 6; Configuration Spec, Leaderboard): on the end screen
 * and as one line in the HUD score breakdown. Off for selection use. Ranks come from the cohort API.
 */
const noop = () => {};
const TIERS = [{ key: 'platinum', name: 'Platinum', min: 800 }, { key: 'gold', name: 'Gold', min: 650 }, { key: 'silver', name: 'Silver', min: 450 }, { key: 'bronze', name: 'Bronze', min: 0 }];

/** The panel from the mock cohort API, for a given result of this participant. */
function Panel({ score, size = 10, anonymous = false, name = 'Priya Sharma', scope = 'cohort' }: { score: number; size?: number; anonymous?: boolean; name?: string | null; scope?: 'cohort' | 'unit' | 'global' }) {
  const { t } = useI18n();
  const [board, setBoard] = useState<Awaited<ReturnType<IleadApi['getLeaderboard']>> | null>(null);
  useEffect(() => {
    void createMockApi({ latencyMs: 0, name, participant: 'story' }).getLeaderboard({ size, anonymous, you: { score, conversions: 6, capability: 64 } }).then(setBoard);
  }, [score, size, anonymous, name]);
  if (!board) return null;
  return <div style={{ width: 1376 }}><CohortPanel scope={scope} size={size} {...cohortRows(t, board, TIERS, size)} /></div>;
}

const meta: Meta = { title: 'Components/Cohort leaderboard' };
export default meta;

/** Inside the top 10: the participant's row is highlighted and marked You. */
export const InTheTop: StoryObj = { render: () => <Panel score={742} /> };
/** Outside the top 10: their own row follows the top, "Rank 15 of 15". */
export const OutsideTheTop: StoryObj = { render: () => <Panel score={280} /> };
/** Anonymous: everyone else is "A colleague". */
export const Anonymous: StoryObj = { render: () => <Panel score={560} anonymous /> };
/** No name from the launch: the participant's row says You. */
export const NoName: StoryObj = { render: () => <Panel score={560} name={null} /> };
/** Business unit scope, top 5. */
export const UnitTopFive: StoryObj = { render: () => <Panel score={610} size={5} scope="unit" /> };
/** Global scope. */
export const Global: StoryObj = { render: () => <Panel score={610} scope="global" /> };

/** A real run's view (Sales Elevator, seed 3), optionally with the leaderboard off. */
function useRun(enabled = true) {
  const [view, setView] = useState<EngineView | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await play(defaultStoryline(), 'good', 3);
      const v = EngineView.parse(r.view);
      setView({ ...v, gamification: { ...v.gamification, leaderboard: { ...v.gamification.leaderboard, enabled } } });
    })();
  }, [enabled]);
  return view;
}

/** An API that answers the leaderboard the way a story needs: from the mock, never, with an error, or not at all. */
function withLeaderboard(mode: 'mock' | 'pending' | 'error' | 'forbidden'): IleadApi {
  const api = createMockApi({ latencyMs: 200, name: 'Priya Sharma' });
  if (mode === 'pending') return { ...api, getLeaderboard: () => new Promise(noop) };
  if (mode === 'error') return { ...api, getLeaderboard: () => Promise.reject(new Error('cohort service down')) };
  // The leaderboard is off: asking for it is a bug, and the Storybook smoke fails on this error.
  if (mode === 'forbidden') return { ...api, getLeaderboard: () => { console.error('getLeaderboard was called with the leaderboard off'); return new Promise(noop); } };
  return api;
}

function End({ mode, enabled = true }: { mode: 'mock' | 'pending' | 'error' | 'forbidden'; enabled?: boolean }) {
  const view = useRun(enabled);
  const [api] = useState(() => withLeaderboard(mode));
  if (!view) return null;
  return (
    <ApiContext.Provider value={api}>
      <MoneyProvider money={view.money}>
        <div style={{ width: 1440, minHeight: 900, display: 'flex', flexDirection: 'column' }}>
          <EngineEnd view={view} voiceConsent send={async () => true} say={noop} onViewReport={noop} onLookAtBoard={noop} />
        </div>
      </MoneyProvider>
    </ApiContext.Provider>
  );
}

/** The end screen of a real run with the cohort panel below the reflection. */
export const EndScreenWithCohort: StoryObj = { render: () => <End mode="mock" /> };
/** Selection use: the leaderboard is off, nothing is asked of the cohort API and no panel shows. */
export const EndScreenSelectionUse: StoryObj = { render: () => <End mode="forbidden" enabled={false} /> };
/** The cohort API has not answered yet: the panel is simply not there. */
export const EndScreenCohortLoading: StoryObj = { render: () => <End mode="pending" /> };
/** The cohort API failed: the panel is left out, quietly. */
export const EndScreenCohortError: StoryObj = { render: () => <End mode="error" /> };

function Breakdown({ mode, enabled = true }: { mode: 'mock' | 'pending' | 'error' | 'forbidden'; enabled?: boolean }) {
  const view = useRun(enabled);
  const [api] = useState(() => withLeaderboard(mode));
  if (!view) return null;
  const v = view;
  const wrap = (children: ReactNode) => <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 16, border: '1px solid var(--il-color-line-strong)', background: 'var(--il-color-surface-material)' }}>{children}</div>;
  return (
    <ApiContext.Provider value={api}>
      {wrap(
        <ScoreBreakdown total={v.score.total} max={v.score.max}
          pillars={(['business', 'people', 'leadership'] as const).map(k => ({ key: k, value: v.score[k], weight: v.gamification.weights[k] }))}
          capability={v.score.capability} live={v.score.live} bonus={v.score.bonus} bonusCap={v.gamification.streak.cap}
          streak="" tiers={v.gamification.tiers} tier={null} badges={{ earned: 3, total: 10 }} onBadges={noop}
          rank={v.gamification.leaderboard.enabled ? <Suspense fallback={null}><CohortRank view={v} /></Suspense> : undefined} />
      )}
    </ApiContext.Provider>
  );
}

/** The HUD score breakdown with "Rank N of M in your cohort" under its lead line. */
export const BreakdownWithRank: StoryObj = { render: () => <Breakdown mode="mock" /> };
/** Selection use: no rank line, and no request. */
export const BreakdownSelectionUse: StoryObj = { render: () => <Breakdown mode="forbidden" enabled={false} /> };
/** The cohort API failed: the line is left out. */
export const BreakdownRankError: StoryObj = { render: () => <Breakdown mode="error" /> };
