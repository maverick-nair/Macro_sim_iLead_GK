import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { MoodKey } from '../../data/types';
import { NoWrapButton } from '../../ds/Button';
import { useI18n } from '../../i18n';
import { NudgeNote, OptionCards, PickedChips, type ActionDrawerProps, type PickedPerson } from '../action/ActionDrawer';
import { actionSub, type ActionTileProps } from '../action/ActionTile';
import { SubPeriodUnitContext, useDays, type PeriodUnit, type SubPeriodUnit } from '../action/days';
import { Heading } from '../Heading';
import { Chat, Clock, MOOD_DOT, type MemberCardProps } from '../member/MemberCard';
import { ProfileHistory, ProfileSummary, type ProfilePanelProps } from '../profile/ProfilePanel';
import { useStyleName } from '../style/lens';
import { StageHeader, type StageColumn, type TeamBoardHint } from '../team/TeamBoard';
import './tabletMessages';

/**
 * The portrait tablet board (D73), loaded only on a tablet so the desktop's first load does not
 * carry it. EngineBoard keeps every rule and all the data shaping; these pieces only lay the same
 * props out for touch: the team as larger tappable cards, the actions drawer (a modal panel from the
 * right), the bottom dock and the bar that stands in for the drawer while people are picked.
 */

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary';
const eyebrow = 'text-12 font-700 tracking-(--il-action-section-tracking) text-fg-secondary uppercase';
const primary = `min-h-14 cursor-pointer rounded-16 border-0 bg-transparent bg-(image:--il-button-primary-bg) px-4 py-0 text-16 font-700 text-(--il-button-primary-fg) disabled:cursor-not-allowed disabled:opacity-40 ${focus}`;
const footer = 'sticky bottom-0 mt-auto flex flex-col gap-2 border-x-0 border-b-0 border-t border-solid border-line-default bg-surface-solid pt-3';
/** Icon glyph, not copy: the button is named from the catalog. */
const CLOSE_GLYPH = '✕';
const GRID_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6' };

export const MOOD_RING: Record<MoodKey, string> = {
  happy: 'ring-member-mood-happy',
  neutral: 'ring-member-mood-neutral',
  thinking: 'ring-member-mood-thinking',
  concerned: 'ring-member-mood-concerned',
  frustrated: 'ring-member-mood-frustrated'
};

/**
 * A member on the tablet board: the photo in its mood ring, name, title, mood and this period's style
 * as a tag, all one 168px tall button that selects the person and opens their actions. The same
 * props as the desktop MemberCard; the stats, profile and style live in the drawer.
 */
export function TabletMemberCard(props: MemberCardProps) {
  const { name, title, img, mood, away = false, skill, morale, result, trust, style, statsHidden = false, unread = false, promise, selected = false, unavailableReason, onSelect } = props;
  const { t } = useI18n();
  const styleName = useStyleName();
  const unavailable = !!unavailableReason;
  const moodName = t('member.mood', { mood });
  const aria = t('member.card.aria', { name, title, mood: moodName, skill, morale, result, trust, hidden: String(statsHidden), available: String(!unavailable), reason: unavailableReason ?? '' });
  return (
    <button type="button" data-member-card="" onClick={onSelect} aria-pressed={selected} aria-label={aria} aria-disabled={unavailable || undefined} title={unavailable ? unavailableReason : undefined}
      className={`relative flex min-h-42 w-full flex-col items-start gap-2.5 rounded-18 border border-solid px-3 py-3.5 text-left text-fg-primary ${focus} ${selected ? 'border-accent-secondary bg-accent-soft' : 'border-line-default bg-surface-card'} ${unavailable ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
      <img src={img} alt="" className={`size-13 flex-none rounded-round bg-brand-pale-lavender object-cover object-top ring-2 ${MOOD_RING[mood]} ${away ? 'grayscale' : ''}`} />
      {(unread || promise) && (
        <span className="absolute top-2.5 right-2.5 flex gap-1">
          {unread && <span title={t('member.unread')} className="flex size-6 items-center justify-center rounded-round bg-member-signal text-member-signal-fg"><Chat /></span>}
          {promise && <span title={promise} className="flex size-6 items-center justify-center rounded-round bg-member-signal text-member-signal-fg"><Clock /></span>}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-15 leading-tight break-words">{name}</b>
        <span className="text-12 break-words text-fg-secondary">{title}</span>
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1.25 text-12 font-700"><span className={`size-1.75 flex-none rounded-round ${MOOD_DOT[mood]}`} />{away ? t('member.mood.away') : moodName}</span>
        <span className="flex min-h-5.5 items-center rounded-pill bg-surface-raised px-2 text-11 font-700 text-fg-secondary">{style ? styleName(style) : t('tablet.card.noStyle')}</span>
      </span>
    </button>
  );
}

/** The team by stage: one column per funnel stage, its header, then the tablet cards. */
export function TabletTeam({ columns, hint, periodUnit }: { columns: StageColumn[]; hint: TeamBoardHint; periodUnit: PeriodUnit }) {
  const { t } = useI18n();
  const hintText = hint.kind === 'picking' ? t('tablet.pick.hint') : t('team.hint', { kind: hint.kind, name: hint.kind === 'selected' ? hint.name : '' });
  return (
    <section aria-label={t('tablet.team.aria')} className="flex min-w-0 flex-col px-6 pt-4.5">
      <Heading level={2} className="sr-only">{t('team.title')}</Heading>
      <span aria-live="polite" className="sr-only">{hintText}</span>
      <div className={`grid gap-2.5 ${GRID_COLS[columns.length] ?? 'grid-cols-6'}`}>
        {columns.map(({ key, cards, ...col }) => (
          <div key={key} className="flex min-w-0 flex-col gap-2.5">
            <StageHeader {...col} periodUnit={periodUnit} />
            {cards.map(({ id, ...card }) => <TabletMemberCard key={id} {...card} />)}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The chosen action's flow under the drawer's action rows: what it does, its options as large rows,
 * the people to pick with a way to pick them on the board, the nudge, then the summary over a 56px
 * confirm with the cost. The same props as the Actions panel's ActionDrawer.
 */
export function TabletFlow(p: ActionDrawerProps & { onPickOnBoard: () => void }) {
  const { t } = useI18n();
  const fmt = useDays();
  return (
    <>
      <div className="flex animate-(--il-action-drawer-enter) flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <span className="text-13 text-pretty text-fg-secondary">{p.description}</span>
          {p.perk && <span role="note" className="text-13 font-700 text-pretty text-status-gain">{p.perk}</span>}
        </div>
        {p.options && <OptionCards options={p.options} value={p.option ?? null} onChange={i => p.onOption?.(i)} size="lg" />}
        {p.people.mode === 'pick' && (
          <div className="flex flex-col items-start gap-2">
            <span className={eyebrow}>{t('action.drawer.people', { count: p.picks.length, max: p.people.max })}</span>
            <span className="text-13 text-fg-secondary">{p.people.limit}</span>
            <PickedChips picks={p.picks} />
            <NoWrapButton variant="secondary" size="md" onClick={p.onPickOnBoard}>{t('tablet.pick.lower')}</NoWrapButton>
          </div>
        )}
        {p.nudge && <NudgeNote nudge={p.nudge} />}
      </div>
      <div className={footer}>
        <span aria-live="polite" className="text-center text-12 text-pretty text-fg-secondary">{p.summary}</span>
        <button type="button" disabled={!p.canConfirm} onClick={p.onConfirm} className={`w-full ${primary}`}>
          {t('tablet.cta', { cta: t('action.drawer.cta', { cta: p.cta }), cost: fmt(p.days) })}
        </button>
      </div>
    </>
  );
}

export type SheetTab = 'member' | 'team' | 'profile';

export interface ActionSheetPerson {
  name: string;
  img: string;
  mood: MoodKey;
  away: boolean;
  /** The stage's name. */
  stage: string;
  /** Trust, once the profile has revealed it. */
  trust: number | null;
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
  /** Time left this period in words ("3 days left"), under the title when nobody is selected. */
  left: string;
  /** A message from this person that is due (in sub periods, 0 is now), with a way to answer it. */
  due?: { title: string; in: number; onReply: () => void };
  /** The actions of the open tab, as large radio rows. Choosing one starts its flow. */
  rows: ActionSheetRow[];
  /** The action being planned (its key), or null. */
  chosen: string | null;
  /** The chosen action's flow. */
  flow: ActionDrawerProps | null;
  /** The person's profile once the engine has revealed it; null while it opens. */
  profile: ProfilePanelProps | null;
  subPeriodUnit: SubPeriodUnit;
  onClose: () => void;
  /** Lowers the drawer so people can be picked on the board (actions for several people). */
  onPickOnBoard: () => void;
  /**
   * Where focus goes back to when the drawer closes and nothing else took it, asked when it opens (the
   * person's card or the dock's Actions button): the opener itself may be gone by then (the pick bar's Done).
   */
  opener: () => HTMLElement | null | undefined;
}

/**
 * The actions drawer: a 440 wide modal panel from the right over the dimmed board. The person's
 * header with Close, the tabs (For the person, For the team, Profile), the due notice, the actions as
 * large radio rows, then the chosen action's flow with its confirm and cost. Focus moves in and stays
 * inside; Escape or a tap on the dimmed board closes it, and focus returns to what opened it.
 */
export function ActionSheet(p: ActionSheetProps) {
  const { t, number } = useI18n();
  const fmt = useDays(p.subPeriodUnit);
  const ids = useId();
  const back = useRef<HTMLElement | null>(null);
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
  const person = p.person;
  const first = person?.name.split(' ')[0] ?? '';
  const meta = person && t('tablet.sheet.meta', { stage: person.stage, mood: person.away ? t('member.mood.away') : t('member.mood', { mood: person.mood }), trust: person.trust === null ? 'none' : number(person.trust) });
  const due = p.due && t('tablet.sheet.due', { name: first, when: p.due.in === 0 ? t('tablet.sheet.dueNow', { unit: p.subPeriodUnit }) : t('tablet.sheet.dueIn', { amount: fmt(p.due.in) }), title: p.due.title });
  return (
    <Dialog.Root open onOpenChange={o => { if (!o) p.onClose(); }}>
      <Dialog.Overlay className="fixed inset-0 z-45 flex justify-end bg-surface-scrim">
        <Dialog.Content aria-describedby={undefined} aria-labelledby={undefined} aria-modal="true" aria-label={person ? t('tablet.sheet.aria', { who: person.name }) : t('tablet.sheet.teamTitle')}
          onOpenAutoFocus={() => { back.current = p.opener() ?? null; }}
          // Focus already moved on (the pick bar, the outcome, a conversation): leave it. Else back to the opener.
          onCloseAutoFocus={e => {
            const active = document.activeElement;
            if (active && active !== document.body) { e.preventDefault(); return; }
            if (back.current?.isConnected) { e.preventDefault(); back.current.focus({ preventScroll: true }); }
          }}
          className="flex h-full w-110 max-w-full animate-(--il-tablet-sheet-enter) flex-col gap-4 overflow-auto border-y-0 border-r-0 border-l border-solid border-line-strong bg-surface-solid px-6 pt-5.5 pb-6 text-fg-primary shadow-(--il-tablet-sheet-shadow) outline-0">
          <div className="flex items-center gap-3.5">
            {person && <img src={person.img} alt="" className={`size-15 flex-none rounded-round bg-brand-pale-lavender object-cover object-top ring-2 ${MOOD_RING[person.mood]} ${person.away ? 'grayscale' : ''}`} />}
            <div className="flex min-w-0 flex-1 flex-col">
              <Dialog.Title className="m-0 text-20 font-700">{person ? person.name : t('tablet.sheet.teamTitle')}</Dialog.Title>
              <span className="text-13 text-fg-secondary">{meta || p.left}</span>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label={t('tablet.sheet.close')}
                className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-12 border border-solid border-line-default bg-surface-raised p-0 text-fg-primary ${focus}`}>{CLOSE_GLYPH}</button>
            </Dialog.Close>
          </div>
          {person && (
            <div role="tablist" aria-label={t('tablet.sheet.tabs')} className="flex flex-wrap gap-2">
              {tabs.map((k, i) => {
                const on = p.tab === k;
                return (
                  <button key={k} ref={el => { tabRefs.current[i] = el; }} type="button" role="tab" id={`${ids}-${k}`} aria-selected={on} aria-controls={`${ids}-panel`} tabIndex={on ? 0 : -1}
                    onClick={() => p.onTab(k)} onKeyDown={e => onTabKey(e, i)}
                    className={`min-h-10 cursor-pointer rounded-pill px-3.5 py-0 text-13 ${on ? 'border-0 bg-accent-soft font-700 text-fg-primary' : 'border border-solid border-line-default bg-transparent font-600 text-fg-secondary'} ${focus}`}>
                    {t('tablet.sheet.tab', { tab: k, name: first })}
                  </button>
                );
              })}
            </div>
          )}
          <div role={person ? 'tabpanel' : undefined} id={`${ids}-panel`} aria-labelledby={person ? `${ids}-${p.tab}` : undefined} className="flex flex-1 flex-col gap-4">
            <SubPeriodUnitContext.Provider value={p.subPeriodUnit}>
              {p.tab === 'profile'
                ? (p.profile
                  ? <div className="flex flex-col gap-3"><ProfileSummary {...p.profile} compact /><ProfileHistory {...p.profile} headingId={`${ids}-history`} /></div>
                  : <div role="status" className="text-14 text-fg-secondary">{t('tablet.sheet.profileLoading')}</div>)
                : <>
                  {due && p.tab === 'member' && (
                    <div className="flex flex-col items-start gap-2 rounded-14 border border-solid border-status-attention bg-status-attention-soft px-3.5 py-3 text-13 text-pretty">
                      <span>{due}</span>
                      <NoWrapButton variant="secondary" size="sm" onClick={p.due!.onReply}>{t('tablet.sheet.reply')}</NoWrapButton>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <span className={eyebrow}>{t('tablet.sheet.choose')}</span>
                    {p.rows.length === 0
                      ? <p className="m-0 text-13 text-fg-secondary">{t('tablet.sheet.empty', { name: first })}</p>
                      : <OptionCards size="lg" label={t('tablet.sheet.choose')} value={value < 0 ? null : value} onChange={i => p.rows[i].tile.onPick()}
                          options={p.rows.map(r => ({ name: r.tile.name, detail: actionSub(t, fmt, r.tile), disabled: !!r.tile.block, aside: fmt(r.tile.days) }))} />}
                  </div>
                  {p.flow
                    ? <TabletFlow {...p.flow} onPickOnBoard={p.onPickOnBoard} />
                    : (
                      <div className={footer}>
                        <span className="text-center text-12 text-fg-secondary">{t('tablet.sheet.chooseHint')}</span>
                        <button type="button" disabled className={`w-full ${primary}`}>{t('action.drawer.cta', { cta: 'confirm' })}</button>
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
      <button type="button" data-dock="actions" onClick={onActions}
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
 * Stands in for the lowered drawer while people are picked on the board: what is being planned, the
 * rule, who is picked so far, Cancel and Done (back to the drawer). Takes focus when it shows.
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
          {t('tablet.pick.count', { n: picks.length, names: new Intl.ListFormat(locale, { type: 'conjunction' }).format(picks.map(x => x.name)) })}{' '}{t('tablet.pick.hint')}
        </span>
      </div>
      <NoWrapButton variant="secondary" size="md" onClick={onCancel}>{t('tablet.pick.cancel')}</NoWrapButton>
      <button type="button" onClick={onDone} className={`px-6 ${primary}`}>{t('tablet.pick.done')}</button>
    </section>
  );
}

export interface TabletBoardViewProps {
  /** The HUD, the sponsor call, the KPI tiles and the read only banner, as the board renders them. */
  top: ReactNode;
  team: { columns: StageColumn[]; hint: TeamBoardHint; periodUnit: PeriodUnit };
  /** The outcome of the last decision, under the team. */
  outcome: ReactNode;
  dock: TabletDockProps;
  /** Picking people on the board: the pick bar stands in for the dock and the drawer. */
  pick: PickBarProps | null;
  sheet: ActionSheetProps | null;
  /** Called once the board is on screen (its code loads on demand). */
  onReady?: () => void;
}

/**
 * The tablet board's frame: it fills the screen, the team and the outcome scroll in the middle, and
 * the dock (or the pick bar) stays in reach at the bottom.
 */
export default function TabletBoardView({ top, team, outcome, dock, pick, sheet, onReady }: TabletBoardViewProps) {
  // Once, on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onReady?.(); }, []);
  return (
    <div className="flex h-(--il-tablet-board-height) min-h-0 flex-col">
      {top}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <TabletTeam {...team} />
        {outcome && <div className="pt-4.5">{outcome}</div>}
      </div>
      {pick ? <PickBar {...pick} /> : <TabletDock {...dock} />}
      {sheet && <ActionSheet {...sheet} />}
    </div>
  );
}
