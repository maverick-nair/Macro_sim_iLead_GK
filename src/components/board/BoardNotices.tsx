import type { EngineView } from '../../engine/contract';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import type { Notice } from './notices';

export interface BoardNoticesProps {
  notices: Notice[];
  view: Pick<EngineView, 'clock' | 'funnel' | 'actions' | 'gamification' | 'members' | 'sponsor'>;
  onDismiss: (key: string) => void;
  /** Opens your own update to the sponsor (D173), from the silence alert. */
  onUpdateSponsor?: () => void;
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
 * Milestones reached (D93), one time tips (D99) and what neglect is costing now (D173, D174), as slim notices under the team metrics, in the board's
 * flow like the sponsor call, so they never cover a card or a button. A status region: each is read out
 * once, and focus stays where it is. A milestone offers the leaderboard (when it is on) and Continue;
 * a tip, Got it. With `celebration: full` and motion allowed, a milestone's flag gets the burst.
 */
export function BoardNotices({ notices, view, onDismiss, onLeaderboard, onUpdateSponsor }: BoardNoticesProps) {
  const { t } = useI18n();
  const stageName = (key?: string) => view.funnel.find(f => f.key === key)?.name ?? key ?? '';
  const hire = view.actions.find(a => a.rule === 'hire');
  const hireOpen = !!hire && view.clock.period >= hire.unlockPeriod && hire.blocked?.reason !== 'locked';
  return (
    <div role="status" aria-live="polite" className="contents">
      {notices.map(n => {
        const milestone = n.kind === 'milestone';
        const sponsor = view.sponsor.name.split(' ')[0];
        const firsts = (ids: string[]) => ids.map(id => view.members.find(m => m.id === id)?.name.split(' ')[0] ?? id);
        const text = n.kind === 'milestone'
          ? t('board.milestone.body', { kind: n.milestone.kind, pct: n.milestone.pct, stage: stageName(n.milestone.stage ?? undefined) })
          : n.kind === 'alert'
          ? n.alert === 'neglect'
            ? t('board.alert.neglect', { names: firsts(n.ids).join(', '), count: n.ids.length, weeks: n.weeks, unit: view.clock.periodUnit })
            : t('board.alert.silence', { name: sponsor, unit: view.clock.periodUnit })
          : t('board.tip.body', {
              tip: n.tip, stage: stageName(n.stage), unit: view.clock.periodUnit, sub: view.clock.subPeriodUnit,
              hire: hireOpen ? 'open' : 'locked', period: hire ? t('time.period', { unit: view.clock.periodUnit, n: hire.unlockPeriod }) : ''
            });
        return (
          <div key={n.key} data-notice={n.kind} className={`mx-8 mt-3 flex flex-wrap items-center gap-3 border border-s-2 border-line-strong bg-surface-card py-2 pe-2.5 ps-3 text-13 short:mt-2 short:py-1.5 tablet:mx-5 tablet-portrait:mx-6 ${n.kind === 'alert' ? 'border-s-status-attention bg-status-attention-soft' : 'border-s-accent-default'}`}>
            <span className={`flex size-7 flex-none items-center justify-center ${milestone ? 'il-burst bg-(image:--il-fill-brand) text-button-on-solid' : 'bg-accent-soft text-accent-default'}`}>{milestone ? <Flag /> : <Bulb />}</span>
            <span className="min-w-0 flex-1"><b>{milestone ? t('board.milestone.title') : n.kind === 'alert' ? t('board.alert.title') : t('board.tip.title')}</b> {text}</span>
            {n.kind === 'alert' && n.alert === 'silence' && onUpdateSponsor && view.sponsor.update && !view.sponsor.update.blocked && <NoWrapButton variant="primary" size="sm" onClick={onUpdateSponsor}>{t('metrics.sponsor.update', { name: sponsor })}</NoWrapButton>}
            {milestone && onLeaderboard && view.gamification.leaderboard.enabled && <NoWrapButton variant="secondary" size="sm" onClick={onLeaderboard}>{t('board.notice.leaderboard')}</NoWrapButton>}
            <NoWrapButton variant={milestone ? 'primary' : 'secondary'} size="sm" onClick={() => onDismiss(n.key)}>{milestone ? t('board.notice.keepGoing') : n.kind === 'alert' ? t('board.notice.noted') : t('board.notice.hideTip')}</NoWrapButton>
          </div>
        );
      })}
    </div>
  );
}

