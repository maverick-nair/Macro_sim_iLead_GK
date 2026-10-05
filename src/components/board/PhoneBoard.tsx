import type { ReactNode } from 'react';
import { Button } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { ActionDrawer, type ActionDrawerProps } from '../action/ActionDrawer';
import { ActionsPanel, type ActionsPanelProps } from '../actions/ActionsPanel';
import type { HudProps } from '../hud/Hud';
import { PhoneHud } from '../hud/PhoneHud';
import { InboxDrawer, type InboxDrawerItem } from '../inbox/InboxDrawer';
import type { SubPeriodUnit } from '../action/days';
import { MetricsStrip, type MetricsStripProps } from '../metrics/MetricsStrip';
import { ProfilePanel, type ProfilePanelProps } from '../profile/ProfilePanel';
import { BottomSheet } from '../sheet/BottomSheet';
import { TeamBoard, type TeamBoardProps } from '../team/TeamBoard';

/** What the bottom sheet holds now, if anything. */
export type PhoneSheet = 'none' | 'actions' | 'drawer' | 'profile' | 'inbox' | 'score';

export interface PhoneBoardProps {
  hud: HudProps;
  strip: MetricsStripProps;
  /** Over the team, in this order: the sponsor call, the read only banner, the outcome card. */
  call?: ReactNode;
  banner?: ReactNode;
  outcome?: ReactNode;
  team: Omit<TeamBoardProps, 'layout'>;
  actions: Omit<ActionsPanelProps, 'layout' | 'drawer' | 'memberExtra'>;
  /** The selected person's profile, from the actions sheet. */
  onOpenProfile?: () => void;
  /** The action being planned (the drawer), or null. */
  drawer: ActionDrawerProps | null;
  /**
   * People are being picked for the action on the team list, with the sheet lowered: the dock says
   * how many are picked and leads back to the drawer.
   */
  picking: { action: string; count: number; max: number } | null;
  inbox: { unread: number; items: InboxDrawerItem[]; sponsorName?: string; subPeriodUnit: SubPeriodUnit; onOpen: (id: string) => void; onLater: (id: string) => void };
  profile: ProfilePanelProps | null;
  /** The score breakdown (ScoreBreakdown), shown in the score sheet. */
  breakdown?: ReactNode;
  sheet: PhoneSheet;
  onOpenSheet: (sheet: 'actions' | 'inbox') => void;
  onCloseSheet: () => void;
  /** Lowers the drawer to pick people on the list, or raises it again. */
  onLower: (lowered: boolean) => void;
}

const InboxIcon = () => (
  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const BoltIcon = () => <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>;

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const dock = 'fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-line-default bg-surface-solid px-(--il-phone-gutter-x) pt-3 pb-(--il-phone-gutter-bottom) shadow-(--il-phone-dock-shadow)';
const external = 'flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-pill border border-solid border-line-default bg-surface-raised px-4 py-0 text-13 font-700 text-fg-primary ' + focus;

/**
 * The board on a phone (390), in the design's phone language (frame m6 and the prototype's phone
 * board): a compact HUD, the KPI tiles in a sideways scroller with Team Pulse, the target and sponsor
 * confidence, the outcome card, then the team as a list grouped by stage. A dock at the bottom opens
 * the inbox and the actions; the actions, the action drawer, a profile, the inbox and the score open
 * in a bottom sheet. Presentational: the engine board shapes the view into these props.
 */
export function PhoneBoard(p: PhoneBoardProps) {
  const { t, number } = useI18n();
  const selected = p.actions.member;

  let sheet: ReactNode = null;
  switch (p.sheet) {
    case 'drawer':
      if (p.drawer) {
        sheet = (
          <BottomSheet title={t('phone.sheet.title', { sheet: 'drawer' })} onClose={p.onCloseSheet}>
            <ActionDrawer {...p.drawer} layout="sheet" headingLevel={3} onPickPeople={p.drawer.people.mode === 'pick' ? () => p.onLower(true) : undefined} />
          </BottomSheet>
        );
      }
      break;
    case 'profile':
      if (p.profile) sheet = <BottomSheet title={p.profile.name} closeLabel={t('profile.close')} onClose={p.onCloseSheet}><ProfilePanel {...p.profile} layout="sheet" /></BottomSheet>;
      break;
    case 'inbox':
      sheet = (
        <BottomSheet title={t('inbox.title')} closeLabel={t('inbox.close')} onClose={p.onCloseSheet}>
          <InboxDrawer open layout="sheet" items={p.inbox.items} sponsorName={p.inbox.sponsorName} subPeriodUnit={p.inbox.subPeriodUnit}
            onOpen={p.inbox.onOpen} onLater={p.inbox.onLater} onClose={p.onCloseSheet} />
        </BottomSheet>
      );
      break;
    case 'score':
      sheet = <BottomSheet title={t('phone.sheet.title', { sheet: 'score' })} onClose={p.onCloseSheet}><div className="px-(--il-phone-gutter-x) pt-3">{p.breakdown}</div></BottomSheet>;
      break;
    case 'actions':
      sheet = (
        <BottomSheet title={t('phone.sheet.title', { sheet: 'actions' })} onClose={p.onCloseSheet}>
          <ActionsPanel {...p.actions} layout="sheet" headingLevel={2}
            memberExtra={selected && p.onOpenProfile ? <button type="button" onClick={p.onOpenProfile} className={external}>{t('phone.actions.profile', { name: selected.firstName })}</button> : undefined} />
        </BottomSheet>
      );
      break;
    default:
      break;
  }

  return (
    <div className="flex flex-1 flex-col pb-(--il-phone-dock-reserve)">
      <PhoneHud {...p.hud} />
      {p.call}
      <MetricsStrip {...p.strip} layout="phone" />
      {p.banner}
      {p.outcome && <div className="px-(--il-phone-gutter-x) pb-3">{p.outcome}</div>}
      <TeamBoard {...p.team} layout="list" rowAction={p.picking ? 'toggle' : 'open'} />

      {p.picking ? (
        // Picking people for the action: the list stays in reach, the dock counts and leads back.
        <div role="region" aria-label={t('phone.pick.aria', { action: p.picking.action })} className={`${dock} flex-wrap`}>
          <span aria-live="polite" className="min-w-0 flex-1 text-13 text-pretty">
            <b>{p.picking.action}</b> {t('phone.pick.count', { count: p.picking.count, max: p.picking.max })}
          </span>
          <span className="inline-flex flex-none"><Button variant="primary" size="lg" onClick={() => p.onLower(false)}>{t('phone.pick.done')}</Button></span>
        </div>
      ) : (
        <nav aria-label={t('phone.dock.aria')} className={dock}>
          <button type="button" onClick={() => p.onOpenSheet('inbox')} aria-haspopup="dialog" aria-label={t('inbox.open', { count: p.inbox.unread })}
            className={`relative flex min-h-12 flex-none cursor-pointer items-center gap-2 rounded-pill border border-solid border-line-default bg-surface-raised px-4 py-0 text-14 font-700 text-fg-primary ${focus}`}>
            <InboxIcon />{t('inbox.title')}
            {p.inbox.unread > 0 && <span aria-hidden="true" className="flex h-5.5 min-w-5.5 items-center justify-center rounded-pill bg-brand px-1.5 text-12 font-700 text-brand-deep-space">{number(p.inbox.unread)}</span>}
          </button>
          <button type="button" onClick={() => p.onOpenSheet('actions')} aria-haspopup="dialog"
            className={`flex min-h-12 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-pill border-0 bg-(image:--il-fill-brand) px-4 py-0 text-15 font-700 text-brand-deep-space ${focus}`}>
            <BoltIcon /><span className="truncate">{selected ? t('actions.member', { name: selected.firstName }) : t('actions.title')}</span>
          </button>
        </nav>
      )}
      {sheet}
    </div>
  );
}
