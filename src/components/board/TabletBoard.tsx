import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import type { MoodKey } from '../../data/types';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { ActionDrawer, OptionCards, type ActionDrawerProps, type PickedPerson } from '../action/ActionDrawer';
import { actionSub, type ActionTileProps } from '../action/ActionTile';
import { SubPeriodUnitContext, useDays, type SubPeriodUnit } from '../action/days';
import { MOOD_RING } from '../member/MemberCard';
import { ProfilePanel, type ProfilePanelProps } from '../profile/ProfilePanel';

/**
 * The portrait tablet board's own pieces (D72): the actions drawer, the bottom dock and the bar that
 * stands in for the drawer while people are picked on the board. Loaded only on a tablet, so the
 * desktop's first load does not carry them. Everything shown comes from the board (EngineBoard),
 * which keeps all the logic; these only lay it out for touch.
 */

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const eyebrow = 'text-12 font-700 tracking-(--il-action-section-tracking) text-fg-secondary uppercase';
/** Icon glyph, not copy: the button is named from the catalog. */
const CLOSE_GLYPH = '✕';

export type SheetTab = 'member' | 'team' | 'profile';

export interface ActionSheetPerson {
  name: string;
  firstName: string;
  img: string;
  mood: MoodKey;
  away: boolean;
  /** "Leads · Frustrated · trust 41". */
  meta: string;
}

export interface ActionSheetRow {
  key: string;
  tile: ActionTileProps;
}

export interface ActionSheetProps {
  /** The selected person, or null for the team's actions only. */
  person: ActionSheetPerson | null;
  tab: SheetTab;
  onTab: (tab: SheetTab) => void;
  /** Time left this period, in words ("3 days left"), under the title when nobody is selected. */
  left: string;
  /** A message from this person that is due, with a way to answer it now. */
  due?: { text: string; onReply: () => void };
  /** The actions of the open tab, as large radio rows. Choosing one starts its flow. */
  rows: ActionSheetRow[];
  /** The action being planned (its key), or null. */
  chosen: string | null;
  /** The flow of the chosen action: options, people, nudge, summary and confirm. */
  flow: ActionDrawerProps | null;
  /** The person's profile once the engine has revealed it; null while it opens. */
  profile: ProfilePanelProps | null;
  subPeriodUnit: SubPeriodUnit;
  onClose: () => void;
  /** Lowers the drawer so people can be picked on the board (multi person actions). */
  onPickOnBoard: () => void;
}

/**
 * The actions drawer: a 440 wide modal panel from the right over the dimmed board. The person's
 * header with Close, the tabs (For the person, For the team, Profile), the due notice, the actions
 * as large radio rows, then the chosen action's flow with its confirm and cost. Focus moves in and
 * stays inside, Escape or a tap on the dimmed board closes it, and focus returns to the card or the
 * dock button that opened it.
 */
export function ActionSheet(p: ActionSheetProps) {
  const { t } = useI18n();
  const fmt = useDays(p.subPeriodUnit);
  const ids = useId();
  /** Lowering for picks hands focus to the pick bar instead of the opener. */
  const lowering = useRef(false);
  const tabs: SheetTab[] = p.person ? ['member', 'team', 'profile'] : ['team'];
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + tabs.length) % tabs.length;
    p.onTab(tabs[next]);
    tabRefs.current[next]?.focus();
  };
  const value = p.rows.findIndex(r => r.key === p.chosen);
  const title = p.person ? p.person.name : t('tablet.sheet.teamTitle');
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) p.onClose(); }}>
      <Dialog.Overlay className="fixed inset-0 z-45 flex justify-end bg-surface-scrim">
        <Dialog.Content aria-describedby={undefined} aria-modal="true" aria-label={t('tablet.sheet.aria', { who: p.person?.name ?? 'team' })}
          onCloseAutoFocus={e => { if (lowering.current) e.preventDefault(); }}
          className="flex h-full w-110 max-w-full animate-(--il-tablet-sheet-enter) flex-col gap-4 overflow-auto border-y-0 border-r-0 border-l border-solid border-line-strong bg-surface-solid px-6 pt-5.5 pb-6 text-fg-primary shadow-(--il-tablet-sheet-shadow) outline-0">
          <div className="flex items-center gap-3.5">
            {p.person && <img src={p.person.img} alt="" className={`size-15 flex-none rounded-round bg-brand-pale-lavender object-cover object-top ring-2 ${MOOD_RING[p.person.mood]} ${p.person.away ? 'grayscale' : ''}`} />}
            <div className="flex min-w-0 flex-1 flex-col">
              <Dialog.Title className="m-0 text-20 font-700">{title}</Dialog.Title>
              <span className="text-13 text-fg-secondary">{p.person ? p.person.meta : p.left}</span>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label={t('tablet.sheet.close')}
                className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-12 border border-solid border-line-default bg-surface-raised p-0 text-fg-primary ${focus}`}>{CLOSE_GLYPH}</button>
            </Dialog.Close>
          </div>
          {p.person && (
            <div role="tablist" aria-label={t('tablet.sheet.tabs')} className="flex flex-wrap gap-2">
              {tabs.map((k, i) => {
                const on = p.tab === k;
                return (
                  <button key={k} ref={el => { tabRefs.current[i] = el; }} type="button" role="tab" id={`${ids}-${k}`} aria-selected={on} aria-controls={`${ids}-panel`} tabIndex={on ? 0 : -1}
                    onClick={() => p.onTab(k)} onKeyDown={e => onTabKey(e, i)}
                    className={`min-h-10 cursor-pointer rounded-pill px-3.5 py-0 text-13 ${on ? 'border-0 bg-accent-soft font-700 text-fg-primary' : 'border border-solid border-line-default bg-transparent font-600 text-fg-secondary'} ${focus}`}>
                    {t('tablet.sheet.tab', { tab: k, name: p.person!.firstName })}
                  </button>
                );
              })}
            </div>
          )}
          <div role={p.person ? 'tabpanel' : undefined} id={`${ids}-panel`} aria-labelledby={p.person ? `${ids}-${p.tab}` : undefined} className="flex flex-1 flex-col gap-4">
            <SubPeriodUnitContext.Provider value={p.subPeriodUnit}>
              {p.tab === 'profile'
                ? (p.profile ? <ProfilePanel {...p.profile} layout="tablet" /> : <div role="status" className="text-14 text-fg-secondary">{t('tablet.sheet.profileLoading')}</div>)
                : <>
                  {p.due && p.tab === 'member' && (
                    <div className="flex flex-col items-start gap-2 rounded-14 border border-solid border-status-attention bg-status-attention-soft px-3.5 py-3 text-13 text-pretty">
                      <span>{p.due.text}</span>
                      <NoWrapButton variant="secondary" size="sm" onClick={p.due.onReply}>{t('tablet.sheet.reply')}</NoWrapButton>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <span className={eyebrow}>{t('tablet.sheet.choose')}</span>
                    {p.rows.length === 0
                      ? <p className="m-0 text-13 text-fg-secondary">{t('tablet.sheet.empty', { name: p.person?.firstName ?? '' })}</p>
                      : <OptionCards size="lg" label={t('tablet.sheet.choose')} value={value < 0 ? null : value} onChange={i => p.rows[i].tile.onPick()}
                          options={p.rows.map(r => ({ name: r.tile.name, detail: actionSub(t, fmt, r.tile), disabled: !!r.tile.block, aside: fmt(r.tile.days) }))} />}
                  </div>
                  {p.flow
                    ? <ActionDrawer {...p.flow} layout="tablet" onPickOnBoard={() => { lowering.current = true; p.onPickOnBoard(); }} />
                    : (
                      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-x-0 border-b-0 border-t border-solid border-line-default bg-surface-solid pt-3">
                        <span className="text-center text-12 text-fg-secondary">{t('tablet.sheet.chooseHint')}</span>
                        <button type="button" disabled className="min-h-14 w-full cursor-not-allowed rounded-16 border-0 bg-transparent bg-(image:--il-button-primary-bg) px-4 py-0 text-16 font-700 text-(--il-button-primary-fg) opacity-40">
                          {t('action.drawer.cta', { cta: 'confirm' })}
                        </button>
                      </div>
                    )}
                </>}
            </SubPeriodUnitContext.Provider>
          </div>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}

export interface TabletDockProps {
  unread: number;
  inboxOpen: boolean;
  onInbox: () => void;
  /** Actions that can be taken now. */
  open: number;
  /** "3 days left". */
  left: string;
  onActions: () => void;
}

/** The bottom dock of the tablet board: the inbox with its count, and the wide Actions button. */
export function TabletDock({ unread, inboxOpen, onInbox, open, left, onActions }: TabletDockProps) {
  const { t, number } = useI18n();
  return (
    <nav aria-label={t('tablet.dock.aria')} className="mx-6 mt-4 mb-6 flex gap-2.5 rounded-20 border border-solid border-line-default bg-surface-material p-2.5 shadow-(--il-tablet-dock-shadow) backdrop-blur-20">
      <button type="button" onClick={onInbox} aria-expanded={inboxOpen} aria-label={t('inbox.open', { count: unread })}
        className={`flex min-h-14 cursor-pointer items-center gap-2.5 rounded-14 border border-solid border-line-default bg-transparent px-5 py-0 text-15 font-700 text-fg-primary ${focus}`}>
        {t('inbox.title')}
        {unread > 0 && <span aria-hidden="true" className="flex min-h-6 min-w-6 items-center justify-center rounded-pill bg-brand px-1.5 text-12 font-700 text-brand-deep-space">{number(unread)}</span>}
      </button>
      <button type="button" onClick={onActions}
        className={`min-h-14 flex-1 cursor-pointer rounded-14 border-0 bg-transparent bg-(image:--il-fill-brand) px-4 py-0 text-16 font-700 text-brand-deep-space ${focus}`}>
        {t('tablet.dock.actions', { n: open, left })}
      </button>
    </nav>
  );
}

export interface PickBarProps {
  action: string;
  /** The rule ("Pick 2 people"). */
  limit: string;
  picks: PickedPerson[];
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Stands in for the lowered drawer while people are picked on the board: what is being planned,
 * the rule, who is picked so far, Cancel and Done (back to the drawer). Takes focus when it shows.
 */
export function PickBar({ action, limit, picks, onDone, onCancel }: PickBarProps) {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <section ref={ref} tabIndex={-1} aria-label={t('tablet.pick.aria', { action })}
      className="mx-6 mt-4 mb-6 flex items-center gap-3 rounded-20 border border-solid border-accent-secondary bg-surface-material py-2.5 pr-2.5 pl-5 shadow-(--il-tablet-dock-shadow) outline-0 backdrop-blur-20">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="text-15">{t('tablet.pick.bar', { action, limit })}</b>
        <span aria-live="polite" className="text-13 text-fg-secondary">
          {picks.length ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(picks.map(x => x.name)) : t('tablet.pick.count', { n: 0 })}{' '}{t('tablet.pick.hint')}
        </span>
      </div>
      <NoWrapButton variant="secondary" size="md" onClick={onCancel}>{t('tablet.pick.cancel')}</NoWrapButton>
      <button type="button" onClick={onDone}
        className={`min-h-14 cursor-pointer rounded-14 border-0 bg-transparent bg-(image:--il-button-primary-bg) px-6 py-0 text-16 font-700 text-(--il-button-primary-fg) ${focus}`}>
        {t('tablet.pick.done')}
      </button>
    </section>
  );
}
