import type { EngineView } from '../../engine/contract';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import type { Notice } from './notices';

export interface BoardNoticesProps {
  notices: Notice[];
  view: Pick<EngineView, 'clock' | 'funnel' | 'actions' | 'gamification'>;
  onDismiss: (key: string) => void;
  /** Opens the leaderboard from a milestone, when it is on. */
  onLeaderboard?: () => void;
}

const Flag = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 22V4" /><path d="M4 4h12l-2 4 2 4H4" /></svg>
);
const Bulb = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></svg>
);

/**
 * Milestones reached (D93) and one time tips (D99), as slim notices under the team metrics, in the board's
 * flow like the sponsor call, so they never cover a card or a button. A status region: each is read out
 * once, and focus stays where it is. A milestone offers the leaderboard (when it is on) and Continue;
 * a tip, Got it. With `celebration: full` and motion allowed, a milestone's flag gets the burst.
 */
export function BoardNotices({ notices, view, onDismiss, onLeaderboard }: BoardNoticesProps) {
  const { t } = useI18n();
  const stageName = (key?: string) => view.funnel.find(f => f.key === key)?.name ?? key ?? '';
  const hire = view.actions.find(a => a.rule === 'hire');
  const hireOpen = !!hire && view.clock.period >= hire.unlockPeriod && hire.blocked?.reason !== 'locked';
  return (
    <div role="status" aria-live="polite" className="contents">
      {notices.map(n => {
        const milestone = n.kind === 'milestone';
        const text = n.kind === 'milestone'
          ? t('board.milestone.body', { kind: n.milestone.kind, pct: n.milestone.pct, stage: stageName(n.milestone.stage ?? undefined) })
          : t('board.tip.body', {
              tip: n.tip, stage: stageName(n.stage), unit: view.clock.periodUnit, sub: view.clock.subPeriodUnit,
              hire: hireOpen ? 'open' : 'locked', period: hire ? t('time.period', { unit: view.clock.periodUnit, n: hire.unlockPeriod }) : ''
            });
        return (
          <div key={n.key} data-notice={n.kind} className="mx-6 mb-2.5 flex flex-wrap items-center gap-3 rounded-16 border border-line-strong bg-surface-material py-2 pe-2.5 ps-3 text-13 short:mb-2 short:py-1.5">
            <span className={`flex size-7 flex-none items-center justify-center rounded-round ${milestone ? 'il-burst bg-(image:--il-fill-brand) text-brand-deep-space' : 'bg-accent-soft text-fg-primary'}`}>{milestone ? <Flag /> : <Bulb />}</span>
            <span className="min-w-0 flex-1"><b>{milestone ? t('board.milestone.title') : t('board.tip.title')}</b> {text}</span>
            {milestone && onLeaderboard && view.gamification.leaderboard.enabled && <NoWrapButton variant="secondary" size="sm" onClick={onLeaderboard}>{t('board.notice.leaderboard')}</NoWrapButton>}
            <NoWrapButton variant={milestone ? 'primary' : 'secondary'} size="sm" onClick={() => onDismiss(n.key)}>{milestone ? t('board.notice.keepGoing') : t('board.notice.hideTip')}</NoWrapButton>
          </div>
        );
      })}
    </div>
  );
}

