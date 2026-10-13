import { useId } from 'react';
import type { EngineView } from '../../engine/contract';
import { useI18n } from '../../i18n';
import { CohortPanel } from '../end/CohortPanel';
import { cohortRows } from '../end/cohort';
import { tierProgress } from '../desk/band';
import { useLeaderboard } from '../gamification/leaderboard';
import { PanelShell } from './PanelShell';

export interface LeaderboardPanelProps {
  view: Pick<EngineView, 'gamification' | 'score' | 'report' | 'periods' | 'clock'>;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
}

const EYEBROW = 'm-0 text-12 font-600 uppercase tracking-(--il-desk-band-eyebrow-tracking) text-fg-secondary';
const PILLARS = ['business', 'people', 'leadership'] as const;

/**
 * The leaderboard during play (D89, D215 after the approved canvas), when the storyline has it on: where
 * the participant stands (Leadership Score, tier and the points to the next, rank), the cohort table ranked
 * by the server (the UI never ranks), how points are earned (the pillar weights and the streak bonus, from
 * the storyline's config) and a privacy note that follows the configured anonymity and scope. Loading and
 * errors say so in words.
 */
export function LeaderboardPanel({ view, onClose, returnFocus }: LeaderboardPanelProps) {
  const { t, number } = useI18n();
  const lb = view.gamification.leaderboard;
  const board = useLeaderboard(view);
  const ids = { stand: useId(), earn: useId() };
  const tier = tierProgress(view.score.total, view.gamification.tiers, view.score.tier);
  const cohort = board ? cohortRows(t, board, view.gamification.tiers, lb.size) : null;
  const w = view.gamification.weights;
  const unit = view.clock.periodUnit;
  const streak = view.gamification.streak;
  return (
    <PanelShell title={t('panels.leaderboard.title')} intro={t('panels.leaderboard.intro', { scope: lb.scope })} onClose={onClose} returnFocus={returnFocus}>
      <section aria-labelledby={ids.stand} className="flex flex-col gap-2.5 rounded-6 border border-line-default bg-surface-card p-4">
        <h3 id={ids.stand} className={EYEBROW}>{t('leaderboard.stand')}</h3>
        <span className="flex flex-wrap items-baseline gap-x-3">
          <b className="text-32 leading-none font-600 tabular-nums">{number(view.score.total)}</b>
          <span className="text-15 text-fg-secondary">{t('leaderboard.points')}{tier && <> · <b className="font-600 text-fg-primary">{tier.name}</b></>}</span>
        </span>
        {tier && <span aria-hidden="true" className="block h-2 rounded-3 bg-track"><span className="block h-full rounded-3 bg-meter" style={{ width: `${Math.round(tier.progress * 100)}%` }} /></span>}
        <span className="flex flex-wrap justify-between gap-2 text-13 text-fg-secondary">
          {tier && <span>{tier.next ? t('desk.tier.next', { n: number(tier.next.toGo), tier: tier.next.name }) : t('desk.tier.top')}</span>}
          {cohort?.you && <span>{t('end.cohort.rank', { rank: cohort.you.rank, total: cohort.you.total })}</span>}
        </span>
      </section>
      {cohort
        ? <CohortPanel scope={lb.scope} size={lb.size} {...cohort} />
        : <p role="status" className="m-0 text-14 text-fg-secondary">{t('panels.leaderboard.loading')}</p>}
      <section aria-labelledby={ids.earn} className="flex flex-col gap-1">
        <h3 id={ids.earn} className={EYEBROW}>{t('leaderboard.earn')}</h3>
        <dl className="m-0 flex flex-col border-t border-line-strong">
          {PILLARS.map(k => (
            <div key={k} className="flex flex-col gap-0.5 border-b border-line-default py-2">
              <dt className="text-14 font-600">{t('leaderboard.pillar', { pillar: k })} <span className="tabular-nums text-fg-secondary">{t('leaderboard.weight', { n: Math.round(w[k] * 100) })}</span></dt>
              <dd className="m-0 text-13 text-fg-secondary">{t('leaderboard.pillarLine', { pillar: k, unit })}</dd>
            </div>
          ))}
          {streak.cap > 0 && (
            <div className="flex flex-col gap-0.5 border-b border-line-default py-2">
              <dt className="text-14 font-600">{t('leaderboard.streak')} <span className="tabular-nums text-fg-secondary">{t('leaderboard.streakWeight', { n: number(streak.cap) })}</span></dt>
              <dd className="m-0 text-13 text-fg-secondary">{t('leaderboard.streakLine', { cap: number(streak.cap), length: streak.length, unit, stars: streak.minStars })}</dd>
            </div>
          )}
        </dl>
      </section>
      <p data-leaderboard-privacy="" className="m-0 rounded-4 bg-accent-soft px-3.5 py-3 text-13">
        <b>{t('leaderboard.privacy')}</b> {t('leaderboard.privacyBody', { anonymous: lb.anonymous ? 'yes' : 'no', scope: lb.scope })}
      </p>
    </PanelShell>
  );
}
