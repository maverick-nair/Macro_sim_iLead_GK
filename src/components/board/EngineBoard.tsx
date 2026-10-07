import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Block, EngineView, Intent, MemberView, MetricChange, StyleKey } from '../../engine/contract';
import { EngineError } from '../../engine/client';
import { useEngineView, useIntent } from '../../engine/react';
import { useApi } from '../../api';
import { useUi } from '../../app/uiStore';
import { SessionClockText, useSessionTicker } from '../../app/sessionClock';
import { NARROW_BOARD, TABLET, useMediaQuery } from '../../lib/useMediaQuery';
import { Button } from '../../ds/Button';
import { MoneyProvider } from '../../i18n/money';
import { useI18n } from '../../i18n';
import { Hud, type HudProps } from '../hud/Hud';
import { MetricsStrip, type MetricsStripProps } from '../metrics/MetricsStrip';
import { TeamBoard, type StageColumn, type TeamBoardHint } from '../team/TeamBoard';
import { ActionsPanel } from '../actions/ActionsPanel';
import { ActionDrawer, type ActionDrawerProps } from '../action/ActionDrawer';
import type { ActionBlock, ActionTileProps } from '../action/ActionTile';
import { useDays } from '../action/days';
import { InboxRail, type InboxRailItem } from '../inbox/InboxRail';
import { InboxDrawer, type InboxDrawerItem } from '../inbox/InboxDrawer';
import type { InboxSender } from '../inbox/sender';
import { OutcomePanel, type OutcomePerson } from '../outcome/OutcomePanel';
import type { PaletteResult } from '../palette/CommandPalette';
import { Toast } from '../feedback/Toast';
import type { MetricKey } from '../../engine/contract';
import { ProfilePanel, type ProfilePanelProps } from '../profile/ProfilePanel';
import { StyleSettingView, type StyleSettingLayout } from '../stylesetting/StyleSettingView';
import { ReactingScreen } from '../liveshell/ReactingScreen';
import type { LivePerson } from '../liveshell/types';
// The live screen loads when a conversation starts, so the board's first load stays in budget.
const EngineLive = lazy(() => import('./EngineLive').then(m => ({ default: m.EngineLive })));
const EngineWeekEnd = lazy(() => import('./EngineWeekEnd').then(m => ({ default: m.EngineWeekEnd })));
// The end screen loads once the run is over. The report opens in its slot (swap this import for the report).
const EngineEnd = lazy(() => import('./EngineEnd').then(m => ({ default: m.EngineEnd })));
// The development report (M6) and its charts load only when opened.
const EngineReport = lazy(() => import('../report/EngineReport'));
// The cohort rank in the score breakdown loads when the breakdown first opens with the leaderboard on.
const CohortRank = lazy(() => import('../gamification/CohortRank'));
// The badge shelf and the command palette load when first opened (D73: room in the first load for the tablet board).
const BadgeShelfDialog = lazy(() => import('../gamification/BadgeShelfDialog').then(m => ({ default: m.BadgeShelfDialog })));
const CommandPalette = lazy(() => import('../palette/CommandPalette').then(m => ({ default: m.CommandPalette })));
// The portrait tablet board (D73) loads only on a tablet.
const TabletBoardView = lazy(() => import('./TabletBoard'));
import type { SheetTab } from './TabletBoard';
import { EventCard } from './EventCard';
import { PracticeOffer } from './PracticeOffer';
import { Deferred } from '../../lib/useAfterPaint';
import { SponsorCall } from './SponsorCall';
import { ScoreBreakdown } from '../gamification/ScoreBreakdown';
import { initials, streakText } from '../gamification/display';
import { teamChips, type Chip } from './chips';
import { GameMenu, type GameMenuItem } from '../hud/GameMenu';
import { BoardNotices } from './BoardNotices';
import { dueTips, newMilestones, type Notice } from './notices';
import { guideOff, guideSeen, markGuideSeen, turnGuideOff } from '../tour/guideStore';
import type { TourArea } from '../tour/steps';
import type { TourEnd } from '../tour/Tour';
import { resultColumns } from '../panels/overview';
import type { PlayPanel } from '../panels/PlayPanels';
import type { OutcomeReply } from '../outcome/OutcomePanel';
import { actionSub } from '../action/ActionTile';
// The in play panels (D89) and the guided tour (D94) load when first opened, with their copy.
const PlayPanels = lazy(() => import('../panels/PlayPanels'));
const Tour = lazy(() => import('../tour/Tour'));

/**
 * The main board, rendered only from the engine view (brief, rule 1). Every button sends an intent;
 * the board never computes outcomes, scores or availability. UI state (selection, open panels) lives
 * in the UI store and local state.
 */
const PLACEHOLDER = '/assets/npc/placeholder.svg';
const TOAST_MS = 3400;
/** "The team is reacting" lasts at least this long, so the evaluation reads as a moment (D53). */
export const REACTING_MS = 1600;
const first = (n: string) => n.split(' ')[0];
/** The outcome panel's headline, made focusable, when the outcome is on screen. */
const headlineIn = (panel: HTMLElement | null) => {
  const h = panel?.querySelector<HTMLElement>('h2, h3');
  if (h && !h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
  return h ?? null;
};

/** The action being planned: which drawer card is chosen, who is picked, and whether the nudge was waved off. */
interface Flow { key: string; choice: string | null; picks: string[]; nudgeOk: boolean }

/** Ends a live interaction: the board shows "The team is reacting" and holds the outcome until it has had its moment. */
export type FinishLive = (intent: Extract<Intent, { type: 'endInteraction' | 'submitInteraction' | 'chooseCandidate' }>, people: LivePerson[]) => Promise<boolean>;

export interface EngineBoardProps {
  /** Consent to audio capture, from onboarding or Settings. */
  voiceConsent?: boolean;
  /** Preferred input for live interactions. */
  input?: 'ptt' | 'open' | 'text';
  /** Captions on NPC speech (Settings). */
  captions?: boolean;
  onPause: () => void;
  onSettings: () => void;
  /**
   * The run is paused: an app dialog (pause, settings, welcome back) is open over the board. Nothing
   * moves: the session clock stops, and a live conversation holds its streamed words and its clock.
   */
  paused?: boolean;
  /** Show the session clock in the HUD's Pause button (Settings). The button stays without it. */
  showClock?: boolean;
  /** The participant folded the Actions panel on a narrow board (a setting, saved per participant). */
  actionsCollapsed?: boolean;
  onActionsCollapsed?: (collapsed: boolean) => void;
  /**
   * The layout. By default the board follows the window: a tablet held upright (744 to 1023 wide,
   * portrait) gets the tablet board with its dock and actions drawer (D73), anything else the desktop
   * board. Stories and tests can fix it.
   */
  layout?: 'desk' | 'tablet';
  /** Exit to the learning platform (D89): the menu offers Exit only when the launch gave a return address. */
  onExit?: () => void;
  /**
   * The demo round (D92): the board runs on the demo's own engine, with styles set for everyone but the
   * person the demo is about, conversations unavailable (they are the Week 0 practice's), no menu, tour,
   * notices or End week, and the session clock held.
   */
  demo?: DemoMode;
}

export interface DemoMode {
  /** Styles set for everyone but the person the demo is about. */
  prefill: Record<string, StyleKey>;
  /** The demo's banner over the board, with Exit demo. */
  banner: ReactNode;
}


/** The catalog's words for an engine that could not be reached or answered nonsense. */
const loadCode = (e: unknown) => (e instanceof EngineError ? (e.code === 'badPayload' ? 'badPayload' : e.code === 'network' ? 'network' : 'other') : 'network');

export function EngineBoard(props: EngineBoardProps) {
  const q = useEngineView();
  const { t } = useI18n();
  /*
   * The board's first render runs in a transition (D87): React builds it in slices that yield to the
   * browser, so arriving on the board is not one long task. Later views render as usual.
   */
  const [shown, setShown] = useState(false);
  useEffect(() => { if (q.data && !shown) startTransition(() => setShown(true)); }, [q.data, shown]);
  if (!q.data || !shown) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <h1 className="sr-only">{t('board.h1', { view: 'loading' })}</h1>
        {q.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 text-center text-14">
            <span>{t('board.error', { code: loadCode(q.error) })}</span>
            <Button variant="primary" size="md" disabled={q.isFetching} onClick={() => void q.refetch()}>{t('board.retry')}</Button>
          </div>
        ) : <div role="status" className="text-14 text-fg-secondary">{t('board.loading')}</div>}
      </main>
    );
  }
  return (
    <MoneyProvider money={q.data.money}>
      <Board view={q.data} {...props} />
    </MoneyProvider>
  );
}

/**
 * The team board's region. When the stage columns would get narrower than a card can be (a narrow
 * window, 200% text), they keep their width and scroll sideways inside this region, which then
 * becomes a focusable, named scroll region. At the designed 1440 width nothing changes.
 */
function TeamScroll({ stages, label, children }: { stages: number; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    check();
    return () => ro.disconnect();
  }, []);
  // A card column at least 44 spacing units wide, the 3 unit gaps between, and the board's 5 unit padding each side.
  const minWidth = `calc(var(--spacing) * ${44 * stages + 3 * Math.max(0, stages - 1) + 10})`;
  const base = 'col-start-2 row-start-1 flex min-h-0 min-w-0 flex-col';
  const inner = <div className="flex flex-1 flex-col" style={{ minWidth }}>{children}</div>;
  return scrolls
    ? <div ref={ref} role="region" aria-label={label} tabIndex={0} className={`${base} overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-secondary`}>{inner}</div>
    : <div ref={ref} className={base}>{inner}</div>;
}

function Board({ view: v, ...app }: EngineBoardProps & { view: EngineView }) {
  const api = useApi();
  // The participant's name from the launch, for the report header.
  const [profileName, setProfileName] = useState<string | null>(null);
  useEffect(() => { let live = true; void api.getProfile().then(p => { if (live) setProfileName(p.name); }, () => undefined); return () => { live = false; }; }, [api]);
  const { t } = useI18n();
  const ui = useUi();
  const intent = useIntent();
  const unit = v.clock.subPeriodUnit, periodUnit = v.clock.periodUnit;
  const amount = useDays(unit);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [draft, setDraft] = useState<Record<string, StyleKey>>(() => app.demo?.prefill ?? {});
  const demo = app.demo;
  /** The in play panel that is open (D89), if any. */
  const [panel, setPanel] = useState<PlayPanel | null>(null);
  /** The guided tour that is running (D94), if any. */
  const [tour, setTour] = useState<TourArea | null>(null);
  /** Notices on screen this load, and the ones dismissed. Milestones reached before the board opened are not news (a resumed run). */
  const [shown, setShown] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(v.milestones.map(m => `milestone:${m.key}`)));
  /** Names of everyone seen on the team this load, so History still names someone who has since left. */
  const [names] = useState(() => new Map<string, string>());
  for (const m of v.members) names.set(m.id, m.name);
  const [fullscreen, setFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [styleView, setStyleView] = useState<{ layout: StyleSettingLayout; summary: boolean }>({ layout: 'cards', summary: false });
  const [toast, setToast] = useState<string | null>(null);
  /** News items read here. Messages that need an answer stay with the engine. */
  const [readIds, setReadIds] = useState<string[]>([]);
  /** Set aside with Later: hidden until the next sub-period (id to the clock it was set aside at). */
  const [snoozed, setSnoozed] = useState<Record<string, string>>({});
  const [legend, setLegend] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [pal, setPal] = useState(false);
  const [query, setQuery] = useState('');
  /** Whose reaction is showing, for which outcome: a new outcome starts with none. */
  const [reveal, setReveal] = useState<{ outcome: string; id: string } | null>(null);
  /** "The team is reacting", for one interaction. The outcome waits behind it until its moment has passed. */
  const [reacting, setReacting] = useState<{ id: string; people: LivePerson[] } | null>(null);
  /** After the run: the end screen, the board read only, or the report (web or print view). */
  const [endView, setEndView] = useState<'end' | 'board' | 'report' | 'print'>('end');
  /** At the end of the run, the last week end (banner, report, badges) comes before the end screen. */
  const [lastWeekSeen, setLastWeekSeen] = useState(false);
  /** The outcome headline, for screen readers, when focus cannot move to it (an action is being planned). */
  const [announce, setAnnounce] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const narrow = useMediaQuery(NARROW_BOARD);
  const tabletQuery = useMediaQuery(TABLET);
  const tablet = app.layout ? app.layout === 'tablet' : tabletQuery;
  /** The tablet's actions drawer: which tab is open, or null when it is closed (D73). */
  const [sheet, setSheet] = useState<SheetTab | null>(null);
  /** The drawer is lowered so people can be picked on the board. */
  const [lowered, setLowered] = useState(false);
  /** The tablet board's code has loaded and it is on screen. */
  const [tabletReady, setTabletReady] = useState(false);
  /** Selecting someone opens a folded Actions panel for them; folding it again while they are selected leaves it folded. */
  const [foldedFor, setFoldedFor] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);
  /** The dialog the last focused element was in, if any: focus stays in it when an item inside goes away. */
  const lastDialog = useRef<HTMLElement | null>(null);
  /** Where focus should go the next time it is lost, when somewhere better than the default is known. */
  const focusHint = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const paletteOk = useRef(false);

  const say = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /** Sends one intent. A second click while one is on its way is ignored, so nothing is sent twice. */
  const send = async (i: Intent) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    try {
      return await intent.mutateAsync(i);
    } catch (e) {
      say(t('board.error', { code: e instanceof EngineError ? e.code : 'other' }));
      return null;
    } finally {
      inFlight.current = false;
    }
  };

  // Keys. The palette (Ctrl or Cmd K) is for the plain board only: not during style setting, a
  // conversation, or with a modal open. The handler reads the store directly so it never re-binds.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!paletteOk.current) return;
        e.preventDefault(); setQuery(''); setPal(true);
      }
      if (e.key === 'Escape') { setFlow(null); setLegend(false); setSheet(null); setLowered(false); useUi.getState().openPanel('none'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A new period clears the style draft and any half planned action.
  const [draftPeriod, setDraftPeriod] = useState(v.clock.period);
  if (draftPeriod !== v.clock.period) {
    setDraftPeriod(v.clock.period);
    setDraft({}); setNotes({}); setStyleView(x => ({ ...x, summary: false })); setFlow(null);
  }

  const styling = v.phase === 'style';
  const ended = v.phase === 'ended';
  const busy = intent.isPending;
  const member = (id: string) => v.members.find(m => m.id === id);
  const action = (key: string) => v.actions.find(a => a.key === key);
  const img = (m: { img: string | null } | undefined) => m?.img ?? PLACEHOLDER;
  /** One reason detail per distinct reason behind a set of changes (rule 5: every change shows its why). */
  const whys = (changes: MetricChange[]) => {
    const seen = new Map<string, { cause: string; rule: string; evidence: string; judgedByAI: boolean }>();
    for (const c of changes) {
      const k = `${c.reason.label}|${c.reason.cause}`;
      if (!seen.has(k)) seen.set(k, { cause: c.reason.cause, rule: c.reason.rule, evidence: c.reason.evidence.map(e => e.quote).join(' '), judgedByAI: c.reason.evidence.some(e => e.judgedByAI) });
    }
    return [...seen.values()];
  };
  const chipName = (c: Chip) => (c.subject === 'team' ? t('board.chip.team') : c.subject === 'group' ? t('board.chip.people', { n: c.count }) : first(member(c.subject)?.name ?? ''));
  const stageName = (key: string) => v.funnel.find(st => st.key === key)?.name ?? key;

  /** Words an engine block reason in the storyline's units. */
  const blockText = (b: Exclude<Block, { reason: 'capacity' }>): string => {
    switch (b.reason) {
      case 'locked': return t('board.block.locked', { unit: periodUnit, n: b.period });
      case 'cooldown': return t('board.block.cooldown', { amount: amount(b.in) });
      case 'away': return t('board.block.away', { kind: b.kind, amount: amount(b.for) });
      case 'rewarded': return t('board.block.rewarded', { amount: amount(b.in) });
      case 'gone': return t('board.block.gone');
      case 'lastInStage': return t('board.block.lastInStage', { stage: stageName(b.stage) });
      case 'noCover': return t('board.block.noCover', { stage: stageName(b.stage) });
      case 'teamFull': return t('board.block.teamFull');
      case 'liveCap': return t('board.block.liveCap', { cap: b.cap, unit: periodUnit });
      case 'stageFull': return t('board.block.stageFull', { stage: stageName(b.stage) });
    }
  };
  const block = (b: Block | null): ActionBlock | undefined => {
    if (!b) return undefined;
    if (b.reason === 'capacity') return { reason: 'days', need: b.need, have: b.have };
    return { reason: b.reason === 'locked' ? 'locked' : 'cooldown', text: blockText(b) };
  };
  const blockLine = (b: Block | null) => (!b ? '' : b.reason === 'capacity' ? t('action.blocked.days', { need: amount(b.need), have: amount(b.have) }) : blockText(b));

  type ActionV = EngineView['actions'][number];
  type Choice = { id: string; option: ActionV['options'][number]; stage: string | null; stageBlocked: Block | null };
  /**
   * What the drawer offers: one card per option, except an option where you pick a stage (reassign,
   * assess), which becomes one card per stage the engine lists for it. Stages the engine says cannot
   * take anyone stay on the list, unavailable, with the reason. The picked person's own stage is not
   * a move, so it is left out.
   */
  const choicesOf = (a: ActionV, picks: string[]): Choice[] => a.options.flatMap(o => o.pickStage
    ? (o.stages ?? v.funnel.map(st => ({ key: st.key, blocked: null }))).filter(st => !picks.some(id => member(id)?.stage === st.key))
        .map(st => ({ id: `${o.key}@${st.key}`, option: o, stage: st.key as string | null, stageBlocked: st.blocked }))
    : [{ id: o.key, option: o, stage: null, stageBlocked: null }]);
  const limits = (a: ActionV, choice: { option: ActionV['options'][number] } | undefined) => choice?.option.targets ?? a.targets;

  /** Remembers how to get back to an action's tile once its drawer closes. */
  const tileFocus = (name: string) => () => Array.from(mainRef.current?.querySelectorAll<HTMLButtonElement>('aside button') ?? []).find(b => b.textContent?.includes(name));

  const pick = (key: string, memberId: string | null) => {
    const a = action(key);
    if (!a || styling || ended) return;
    ui.openPanel('none');
    const picks = memberId ? [memberId] : [];
    const choices = choicesOf(a, picks).filter(c => !c.stageBlocked);
    setFlow({ key, choice: choices.length === 1 ? choices[0].id : null, picks, nudgeOk: false });
  };
  // Sponsor rewards in hand, per action from the engine (`action.perk`): the hire on the extra budget
  // costs nothing and may take one seat past a full team; a team activity skips its cooldown.
  const hireFree = (a: ActionV) => a.perk === 'hireBudget';
  const freeActivity = (a: ActionV) => a.perk === 'noCooldown';
  const perkLine = (a: ActionV) => (hireFree(a) ? t('actions.perk.hire', { unit }) : freeActivity(a) ? t('actions.perk.activity') : undefined);
  const tile = (key: string, memberId: string | null): ActionTileProps => {
    const a = action(key)!;
    const b = ended ? { reason: 'locked' as const, text: t('board.ended.locked') }
      : styling ? { reason: 'locked' as const, text: t('board.error', { code: 'wrongPhase' }) }
      // In the demo, conversations are left to the Week 0 practice (D92).
      : demo && a.kind !== 'static' ? { reason: 'locked' as const, text: t('board.demo.live') }
      : block(memberId ? a.blockedFor[memberId] ?? null : a.blocked);
    return { name: a.name, kind: a.kind, days: hireFree(a) ? 0 : a.cost, block: b, perk: b ? undefined : perkLine(a), actionKey: a.key, onPick: () => { if (!b) pick(key, memberId); } };
  };

  const f = flow, fa = f ? action(f.key) : undefined;
  const choices = f && fa ? choicesOf(fa, f.picks) : [];
  const choice = f && f.choice !== null ? choices.find(c => c.id === f.choice) : undefined;
  const [minPick, maxPick] = fa ? limits(fa, choice) : [0, 0];
  const picking = !!(f && fa && maxPick > 0 && (fa.scope === 'team' || maxPick > 1 || f.picks.length === 0));
  const selected = ui.selectedIds[0] ?? null;

  /** Why someone cannot be picked for the action being planned, worded, or undefined. */
  const ineligible = (m: MemberView): string | undefined => {
    if (!f || !fa) return undefined;
    const b = fa.scope === 'member' ? fa.blockedFor[m.id] ?? null : m.away ? { reason: 'away' as const, kind: m.awayReason ?? 'leave', for: m.away } : null;
    if (b) return blockLine(b);
    if (choice?.option.distinctStages && !f.picks.includes(m.id)) {
      const same = f.picks.map(id => member(id)).find(p => p?.stage === m.stage);
      if (same) return t('board.pick.sameStage', { name: first(same.name) });
    }
    return undefined;
  };

  const closeFlow = () => {
    if (fa) focusHint.current = tileFocus(fa.name);
    setFlow(null);
  };

  const clickCard = (m: MemberView) => {
    if (picking && f && fa && (!tablet || lowered)) {
      if (ineligible(m)) return;
      const has = f.picks.includes(m.id);
      let picks = has ? f.picks.filter(x => x !== m.id) : [...f.picks, m.id];
      if (picks.length > maxPick) picks = picks.slice(picks.length - maxPick);
      setFlow({ ...f, picks, nudgeOk: false });
      return;
    }
    setFlow(null);
    if (tablet) {
      // On a tablet a tap selects the person and opens the actions drawer for them (D73).
      if (selected !== m.id) ui.toggleMember(m.id);
      ui.openPanel('none');
      setLowered(false);
      setSheet('member');
      return;
    }
    ui.toggleMember(m.id);
  };

  /** Closes the tablet's actions drawer: the flow, the profile and the selection go with it. */
  const closeSheet = () => {
    setSheet(null);
    setLowered(false);
    setFlow(null);
    if (ui.panel === 'profile') ui.openPanel('none');
    if (selected) ui.toggleMember(selected);
  };
  const sheetTab = (tab: SheetTab) => {
    setFlow(null);
    setSheet(tab);
    if (tab === 'profile' && selected) openProfile(selected);
    else if (ui.panel === 'profile') ui.openPanel('none');
  };

  const styleOf = (m: MemberView) => (styling ? draft[m.id] ?? null : m.style);
  const columns: StageColumn[] = v.funnel.map(st => ({
    key: st.key, name: st.name, count: st.members, ideal: st.ideal, bottleneck: st.bottleneck, about: st.about, suits: st.suits,
    cards: v.members.filter(m => m.stage === st.key).map(m => ({
      id: m.id, name: m.name, title: m.title, img: img(m), mood: m.mood, away: m.away > 0,
      // The engine sends no stats until the profile is opened; the card shows its hidden state then.
      skill: m.skill ?? 0, morale: m.morale ?? 0, result: m.result ?? 0, trust: m.trust ?? 0, statsHidden: !m.statsRevealed || m.skill === null,
      style: styleOf(m), unread: m.unread, promise: m.promise ?? undefined,
      selected: picking && f ? f.picks.includes(m.id) : selected === m.id,
      unavailableReason: picking ? ineligible(m) : undefined,
      onSelect: () => clickCard(m),
      onOpenProfile: () => openProfile(m.id),
      onStyleChange: (k: StyleKey) => { if (styling) setDraft(d => ({ ...d, [m.id]: k })); },
      // Outside style setting the letters stay focusable but read as locked, with the reason.
      styleDisabled: !styling,
      styleDisabledReason: styling ? undefined : t('board.style.locked', { unit: periodUnit }),
      onStyleDisabledPick: () => say(t('board.style.locked', { unit: periodUnit }))
    }))
  }));

  const openProfile = (id: string) => {
    setFlow(null);
    if (selected !== id) ui.toggleMember(id);
    ui.openPanel('profile', id);
    if (!member(id)?.statsRevealed) void send({ type: 'openProfile', memberId: id });
  };

  // ---- profile: everything the engine logged with this person, newest first ----
  // The profile opens once the engine has revealed this person's stats.
  const pm = ui.panel === 'profile' && ui.profileId ? member(ui.profileId) : undefined;
  let profile: ProfilePanelProps | null = null;
  if (pm && pm.skill !== null && pm.morale !== null && pm.result !== null && pm.trust !== null) {
    const fact = (x: string | null | undefined) => (x && x.trim() ? x : null);
    profile = {
      name: pm.name, title: pm.title, img: img(pm), mood: pm.mood, away: pm.away > 0,
      stats: { skill: pm.skill, morale: pm.morale, result: pm.result, trust: pm.trust }, style: pm.style,
      facts: [
        { key: 'previous', value: fact(pm.profile.previous) }, { key: 'tenure', value: fact(pm.profile.tenure) },
        { key: 'experience', value: fact(pm.profile.experience) }, { key: 'skills', value: fact(pm.profile.skills) },
        { key: 'remarks', value: fact(pm.profile.remarks) }, { key: 'careerGoal', value: pm.careerGoal },
        { key: 'relationships', value: fact(pm.profile.relations) }
      ],
      shared: pm.shared, periodUnit, subPeriodUnit: unit,
      timeline: v.history.filter(l => l.memberIds.includes(pm.id) || (l.memberIds.length === 0 && l.kind !== 'periodEnd')).slice().reverse().map(l => {
        const mine = l.changes.filter((c): c is typeof c & { metric: MetricKey } => c.subject === pm.id && c.metric !== 'confidence');
        const net = mine.reduce((a, c) => a + c.delta, 0);
        return { id: l.id, when: { period: l.period, sub: Math.min(l.sub + 1, v.clock.capacity) }, title: l.title, quote: l.quote, tone: net > 0 ? 'pos' : net < 0 ? 'neg' : 'neutral', changes: mine.map(c => ({ metric: c.metric, delta: c.delta })) };
      }),
      promises: v.promises.filter(x => x.memberId === pm.id).map(x => ({ text: x.text, status: x.state })),
      actions: v.actions.filter(a => a.scope === 'member').map(a => tile(a.key, pm.id)),
      // The result trend (D96): the result at the start, at the end of each period, and now.
      trend: v.trends[pm.id] ? resultColumns(v.clock, v.phase).map((c, i) => ({
        label: c.kind === 'start' ? t('profile.trend.start') : c.kind === 'now' ? t('profile.trend.now') : t('profile.trend.end', { period: t('time.period', { unit: periodUnit, n: c.period }) }),
        value: v.trends[pm.id][i] ?? null
      })) : undefined,
      onClose: () => ui.openPanel('none')
    };
    if (pm.profile.attitude) profile.facts.push({ key: 'attitude', value: fact(pm.profile.attitude) });
    if (pm.profile.awareness) profile.facts.push({ key: 'awareness', value: fact(pm.profile.awareness) });
    if (pm.profile.responsibilities) profile.facts.push({ key: 'responsibilities', value: fact(pm.profile.responsibilities) });
  }

  const chosen = v.members.filter(m => draft[m.id]).length;
  const confirmStyles = () => {
    if (chosen !== v.members.length) return;
    const given = Object.fromEntries(Object.entries(notes).filter(([, n]) => n.trim()));
    void send({ type: 'confirmStyles', styles: draft, notes: Object.keys(given).length ? given : undefined });
  };

  // ---- action drawer ----
  let drawer: ActionDrawerProps | null = null;
  if (f && fa) {
    const names = f.picks.map(id => first(member(id)?.name ?? ''));
    const list = names.length > 1 ? t('action.list.pair', { rest: names.slice(0, -1).join(', '), last: names[names.length - 1] }) : names[0] ?? '';
    const cost = hireFree(fa) ? 0 : choice?.option.cost ?? fa.cost;
    const label = (c: Choice) => (c.stage ? t(fa.rule === 'assess' ? 'board.option.assessFor' : 'board.option.moveTo', { stage: stageName(c.stage) }) : c.option.label);
    const detail = (c: Choice) => [
      c.stageBlocked ? blockLine(c.stageBlocked) : '',
      c.option.blocked ? blockLine(c.option.blocked) : '',
      c.option.cost !== fa.cost ? t('board.option.cost', { cost: amount(c.option.cost) }) : '',
      c.option.away ? t('board.option.away', { amount: amount(c.option.away) }) : '',
      c.option.targets ? t('board.option.people', { n: c.option.targets[1], distinct: c.option.distinctStages ? 'yes' : 'no' }) : ''
    ].filter(Boolean).join(' ');

    // Prerequisite nudge (spec): where each picked person would move, and whether they were assessed for it.
    const pre = fa.prerequisite ? action(fa.prerequisite) : undefined;
    const destination = (id: string): string | null => {
      if (choice?.stage) return choice.stage;
      if (choice?.option.distinctStages && f.picks.length === 2) return member(f.picks.find(x => x !== id)!)?.stage ?? null;
      return null;
    };
    const unassessed = pre && !f.nudgeOk ? f.picks.map(id => ({ m: member(id)!, to: destination(id) })).find(x => x.m && x.to && !x.m.assessedStages.includes(x.to)) : undefined;

    const isStatic = fa.kind !== 'live';
    drawer = {
      name: fa.name, kind: fa.kind, days: cost, description: fa.description,
      perk: hireFree(fa) ? t('actions.perk.drawer', { perk: 'hire', unit }) : freeActivity(fa) ? t('actions.perk.drawer', { perk: 'activity', unit }) : undefined,
      options: choices.length > 1 ? choices.map(c => ({ name: label(c), detail: detail(c), disabled: !!c.stageBlocked })) : undefined,
      option: choice ? choices.indexOf(choice) : null,
      onOption: i => { if (!choices[i].stageBlocked) setFlow({ ...f, choice: choices[i].id, nudgeOk: false }); },
      people: picking ? { mode: 'pick', max: maxPick, limit: minPick === maxPick ? t('board.pick.exact', { n: maxPick }) : t('board.pick.range', { min: minPick, max: maxPick }) } : f.picks.length ? { mode: 'with' } : { mode: 'who' },
      picks: f.picks.map(id => { const m = member(id); return { id, name: m?.name ?? '', img: img(m) }; }),
      nudge: unassessed && pre ? {
        name: first(unassessed.m.name), area: stageName(unassessed.to!), days: pre.cost,
        onAssess: async () => {
          const r = await send({ type: 'planAction', action: pre.key, memberIds: [unassessed.m.id], stage: unassessed.to! });
          if (r) say(t('action.toast.assessed', { name: first(unassessed.m.name), area: stageName(unassessed.to!), cost: amount(pre.cost) }));
        },
        onContinue: () => setFlow({ ...f, nudgeOk: true })
      } : undefined,
      summary: t('board.summary', { action: fa.name, option: isStatic && choice && choices.length > 1 ? label(choice) : 'none', list: list || 'none', cost: cost === 0 ? t('actions.costNothing') : amount(cost) }),
      cta: fa.kind === 'static' ? 'confirm' : fa.format === 'email' ? 'composer' : 'start',
      canConfirm: !busy && !unassessed && f.picks.length >= minPick && f.picks.length <= maxPick && (choices.length <= 1 || !!choice) && !choice?.option.blocked && !choice?.stageBlocked,
      onConfirm: async () => {
        const r = await send({ type: 'planAction', action: fa.key, option: choice?.option.key, memberIds: f.picks, stage: choice?.stage ?? undefined });
        if (!r) return;
        setFlow(null);
        // On a tablet the drawer closes with it, and the selection goes.
        if (tablet) { setSheet(null); setLowered(false); if (selected) ui.toggleMember(selected); }
        // A decision shows its outcome panel (with reasons); a toast only when the engine sent none.
        if (!r.interactionId && !r.view.outcome) say(t('board.planned', { action: fa.name }));
      },
      onBack: closeFlow
    };
  }

  // ---- inbox ----
  const stamp = `${v.clock.period}:${v.clock.subPeriod}`;
  /** Later sets a message aside until the next sub-period, never past the point it is due. */
  const canLater = (x: EngineView['inbox'][number]) => x.dueInSubPeriods === null || x.dueInSubPeriods >= 1;
  const inbox = v.inbox.filter(x => !readIds.includes(x.id) && !(snoozed[x.id] === stamp && canLater(x)));
  const sender = (from: string): InboxSender => (from === 'sponsor' ? { kind: 'sponsor', initials: v.sponsor.name.split(' ').map(w => w[0]).join('').slice(0, 2) } : from === 'news' ? { kind: 'news' } : { kind: 'member', img: img(member(from)) });
  const openMessage = async (id: string) => {
    const msg = v.inbox.find(x => x.id === id);
    ui.openPanel('none');
    if (!msg || ended) return;
    if (msg.kind === 'news') { setReadIds(r => [...r, id]); return; }
    const r = await send({ type: 'openConversation', kind: msg.briefing ? 'sponsor' : 'reply', messageId: id });
    if (r?.interactionId) setFlow(null);
  };
  const later = (id: string) => {
    const msg = v.inbox.find(x => x.id === id);
    if (!msg || !canLater(msg)) return;
    setSnoozed(s => ({ ...s, [id]: stamp }));
    say(t('board.snoozed', { unit }));
  };
  const railItems: InboxRailItem[] = inbox.map(x => ({ id: x.id, label: x.title, sender: sender(x.from), urgent: x.urgent }));
  const drawerItems: InboxDrawerItem[] = inbox.map(x => ({
    id: x.id, sender: sender(x.from), title: x.title, preview: x.body, meta: '', urgent: x.urgent,
    due: x.dueInSubPeriods === null ? null : x.dueInSubPeriods === 0 ? t('inbox.dueNow', { unit }) : t('board.due', { amount: amount(x.dueInSubPeriods) }),
    tag: t('inbox.tag', { type: x.kind, name: x.from === 'sponsor' ? first(v.sponsor.name) : x.from === 'news' ? '' : first(member(x.from)?.name ?? '') }),
    // News (a CEO check in) needs no answer: it is marked as read, and never set aside.
    cta: x.kind === 'news' ? 'read' : 'reply', later: x.kind !== 'news' && canLater(x)
  }));

  // ---- HUD and strip ----
  const periods = v.clock.periods;
  const lastPeriod = v.periods[v.periods.length - 1];
  const streak = streakText(t, { count: v.streak, next: lastPeriod ? lastPeriod.streak.next : undefined, periodUnit, rule: v.gamification.streak });
  // ---- the game menu (D89) ----
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const openPanel = (p: PlayPanel) => { ui.openPanel('none'); setScoreOpen(false); setPanel(p); };
  const menuItems: GameMenuItem[] = [
    { key: 'objectives', onSelect: () => openPanel({ kind: 'objectives' }) },
    { key: 'tutorial', onSelect: () => openPanel({ kind: 'tutorial' }) },
    { key: 'history', onSelect: () => openPanel({ kind: 'history' }) },
    { key: 'overview', onSelect: () => openPanel({ kind: 'overview' }) },
    ...(v.gamification.leaderboard.enabled ? [{ key: 'leaderboard' as const, onSelect: () => openPanel({ kind: 'leaderboard' }) }] : []),
    { key: 'actions', onSelect: () => openPanel({ kind: 'actions' }) },
    { key: 'tour', onSelect: () => { ui.openPanel('none'); setTour('board'); } },
    { key: 'settings', onSelect: app.onSettings },
    ...(canFullscreen ? [{
      key: fullscreen ? 'exitFullscreen' as const : 'fullscreen' as const,
      onSelect: () => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => say(t('board.fullscreen.failed'))); }
    }] : []),
    ...(app.onExit ? [{ key: 'exit' as const, onSelect: app.onExit }] : [])
  ];

  const hud: HudProps = {
    menu: demo ? undefined : <GameMenu items={menuItems} />,
    nav: [], onNav: () => undefined,
    clock: { period: v.clock.period, periodUnit, subPeriod: v.clock.subPeriod, periods: v.clock.periods, subPeriodUnit: unit, capacity: v.clock.capacity, capacityLeft: v.clock.capacityLeft },
    sessionClock: app.showClock === false ? null : <SessionClockText />, alwaysPause: true, onPause: app.onPause,
    // Pillars are 0 to 100 each, the total 0 to `max` (scoring-and-report.md 6).
    score: { total: v.score.total, business: v.score.business, people: v.score.people, leadership: v.score.leadership },
    breakdown: (
      <ScoreBreakdown
        total={v.score.total} max={v.score.max}
        pillars={(['business', 'people', 'leadership'] as const).map(k => ({ key: k, value: v.score[k], weight: v.gamification.weights[k] }))}
        capability={v.score.capability} live={v.score.live} bonus={v.score.bonus} bonusCap={v.gamification.streak.cap}
        streak={streak} tiers={v.gamification.tiers} tier={v.score.tier}
        badges={{ earned: v.badges.filter(b => b.earned).length, total: v.badges.length }}
        onBadges={() => { setScoreOpen(false); setBadgesOpen(true); }}
        rank={v.gamification.leaderboard.enabled ? <Suspense fallback={null}><CohortRank view={v} /></Suspense> : undefined}
      />
    ),
    scoreOpen, onScoreOpenChange: setScoreOpen,
    streak: v.streak, streakLabel: streak, onPalette: () => { setQuery(''); setPal(true); }, onSettings: app.onSettings,
    onEndPeriod: demo ? undefined : () => { if (!styling && !ended && !busy) void send({ type: 'endPeriod' }); },
    endEmphasis: f || styling || ended ? 'secondary' : 'primary'
  };
  const strip: MetricsStripProps = {
    kpis: v.kpis.map(k => ({ metric: k.metric, value: k.value, trend: { kind: 'direction', direction: k.trend } })),
    pulse: { ...v.pulse, periodUnit },
    target: { label: t('board.target', { n: periods, unit: periodUnit }), value: v.money.value, target: v.money.target, pace: v.clock.runShare, pacePeriod: { unit: periodUnit, n: v.clock.period } },
    sponsor: { level: v.sponsor.level, causes: v.sponsor.causes, open: sponsorOpen, onToggle: () => setSponsorOpen(o => !o),
      meter: { value: v.sponsor.value, unlockAt: v.sponsor.unlockAt, checkInBelow: v.sponsor.checkInBelow, sponsorName: first(v.sponsor.name), subPeriodUnit: unit } }
  };

  // ---- outcome ----
  const oc = v.outcome;
  const person = (id: string): OutcomePerson | null => {
    const m = member(id);
    if (m) return { id, name: m.name, shortName: first(m.name), img: img(m) };
    // Someone who is no longer on the team (or a candidate): the engine resolved them as the speaker.
    if (oc && oc.from.id === id) return { id, name: oc.from.name, shortName: first(oc.from.name), img: oc.from.img ?? PLACEHOLDER };
    return null;
  };
  const revealed = oc && reveal?.outcome === oc.id ? reveal.id : null;
  const outcome = oc && (() => {
    // The engine resolves who is speaking: a member, someone who left, a candidate or the sponsor.
    const who: OutcomePerson = { id: oc.from.id, name: oc.from.name, shortName: first(oc.from.name), img: oc.from.img ?? PLACEHOLDER };
    const shown = oc.changes.filter((c): c is typeof c & { metric: MetricKey } => c.metric !== 'confidence' && !!member(c.subject));
    const affected = oc.affected.map(person).filter((p): p is OutcomePerson => !!p);
    const reactor = revealed ? person(revealed) : null;
    // Each person's own reply and changes (D98): the speaker first, then everyone else who reacted.
    const own = (id: string) => {
      const sums = new Map<MetricKey, number>();
      for (const c of shown) if (c.subject === id) sums.set(c.metric, (sums.get(c.metric) ?? 0) + c.delta);
      return [...sums].filter(([, d]) => d !== 0).map(([metric, delta]) => ({ name: first(member(id)?.name ?? ''), metric, delta }));
    };
    const replies: OutcomeReply[] = [
      ...(oc.reply && member(who.id) ? [{ person: who, text: oc.reply, changes: own(who.id) }] : []),
      ...affected.filter(a => a.id !== who.id && oc.reactions[a.id]).map(a => ({ person: a, text: oc.reactions[a.id], changes: own(a.id) }))
    ];
    const step = Math.max(0, replies.findIndex(r => r.person.id === revealed));
    return (
      <div ref={outcomeRef} className="contents">
        <OutcomePanel
          person={who} headline={oc.headline} reply={oc.reply} headingLevel={2}
          why={whys(oc.changes)}
          whyOpen={ui.whyOpen === oc.id} onToggleWhy={() => ui.setWhy(ui.whyOpen === oc.id ? null : oc.id)}
          affected={affected} revealed={revealed}
          reaction={revealed && reactor && oc.reactions[revealed] ? { name: first(reactor.name), text: oc.reactions[revealed] } : undefined}
          onReveal={id => setReveal(r => (r?.outcome === oc.id && r.id === id ? null : { outcome: oc.id, id }))}
          changes={teamChips(shown, v.members.length).map(c => ({ name: chipName(c), metric: c.metric, delta: c.delta }))}
          showNumbers={ui.showNumbers} onToggleNumbers={() => ui.setShowNumbers(!ui.showNumbers)}
          ripple={oc.ripple ?? ''} changed={oc.changed}
          onDismiss={() => { void send({ type: 'clearOutcome' }); }}
          // View history (D95): the team's history, on this person's story when the reply is someone's.
          onOpenHistory={demo ? undefined : () => openPanel({ kind: 'history', filter: member(oc.from.id) ? { person: oc.from.id } : {} })}
          replies={replies} step={step} onStep={i => { const r = replies[i]; if (r) setReveal({ outcome: oc.id, id: r.person.id }); }}
        />
      </div>
    );
  })();

  // ---- palette ----
  const needle = query.trim().toLowerCase();
  const palette: PaletteResult[] = [
    ...v.members.map(m => ({ id: 'member:' + m.id, name: m.name, detail: m.title, img: img(m), tone: (m.away ? 'away' : m.mood === 'concerned' || m.mood === 'frustrated' ? 'warm' : 'calm') as PaletteResult['tone'],
      onRun: () => { setPal(false); setFlow(null); if (selected !== m.id) ui.toggleMember(m.id); } })),
    ...v.actions.filter(a => a.scope === 'team').map(a => ({ id: 'action:' + a.key, name: a.name, detail: amount(a.cost), tone: 'brand' as const,
      onRun: () => { setPal(false); tile(a.key, null).onPick(); } }))
  ].filter(i => !needle || i.name.toLowerCase().includes(needle)).slice(0, 9);

  const sm = selected ? member(selected) : undefined;
  const actionNotes = v.phase === 'board' ? [
    ...(v.perks.bonusDay ? [{ text: t('actions.note.bonusDay', { unit, period: periodUnit }), tone: 'gain' as const }] : []),
    ...(v.perks.checkIn ? [{ text: t('actions.note.checkIn', { unit, period: periodUnit }), tone: 'neutral' as const }] : [])
  ] : undefined;
  const hint: TeamBoardHint = picking ? { kind: 'picking' } : sm ? { kind: 'selected', name: sm.name } : { kind: 'idle' };

  // One modal at a time: an event card first (after the outcome has been read), then the period end.
  // A sponsor call is not a modal: it rings over the board until it is answered or put off.
  const card = !oc ? v.cards.find(c => c.delivery === 'modal') : undefined;
  const callCard = v.phase === 'board' ? v.cards.find(c => c.delivery === 'sponsorCall' && (c.messageId === null || v.inbox.some(m => m.id === c.messageId))) : undefined;
  // The week end replaces the board at a period end, and once more at the end of the run before the end screen.
  const weekEnd = !card && !v.live && !reacting && (v.phase === 'periodEnd' || (ended && !lastWeekSeen));
  // Then the end screen (or the report opened from it) takes the whole page; the board stays reachable, read only.
  const endScreen = !card && !weekEnd && ended && lastWeekSeen && endView !== 'board';
  const plainBoard = !v.live && !reacting && !styling && !card && !endScreen && !weekEnd;
  // The session clock runs while the plain board is in front (where the HUD shows it), never while paused (D13),
  // nor while a panel or the tour is open, nor in the demo (D89, D92, D94).
  useSessionTicker(!app.paused && !ended && plainBoard && !panel && !tour && !demo);

  // ---- the guided tours (D94): each starts on its own the first time its screen shows, unless switched off ----
  const tourArea: TourArea | null = demo || card || endScreen || weekEnd || reacting ? null : v.live ? (v.live.practice ? null : 'live') : styling ? 'style' : plainBoard ? 'board' : null;
  useEffect(() => {
    if (!tourArea || tour || panel || app.paused || !v.guide.tour.enabled || guideOff() || guideSeen(`tour:${tourArea}`)) return;
    // A moment after the screen settles, so its targets are on screen.
    const id = setTimeout(() => setTour(cur => cur ?? tourArea), 600);
    return () => clearTimeout(id);
  }, [tourArea, tour, panel, app.paused, v.guide.tour.enabled]);
  const endTour = (how: TourEnd) => {
    if (tour) markGuideSeen(`tour:${tour}`);
    if (how === 'never') turnGuideOff();
    setTour(null);
    focusHint.current = () => h1Ref.current;
  };

  // ---- notices (D93, D99): milestones as the engine reaches them, and tips at key moments, once each ----
  const notices: Notice[] = demo || !plainBoard ? [] : [
    ...newMilestones(v, dismissed),
    ...(guideOff() ? [] : dueTips(v).filter(n => !dismissed.has(n.key) && (shown.has(n.key) || !guideSeen(n.key))))
  ];
  const freshKeys = notices.filter(n => !shown.has(n.key)).map(n => n.key).join('|');
  useEffect(() => {
    if (!freshKeys) return;
    const fresh = freshKeys.split('|');
    // A tip is remembered as seen once it is on screen, so a reload does not repeat it (D99).
    for (const k of fresh) if (k.startsWith('tip:')) markGuideSeen(k);
    // A notice on screen stays until it is dismissed, even after its tip is marked seen (D78 keeps this pattern).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(s => new Set([...s, ...fresh]));
  }, [freshKeys]);
  const nameOf = (id: string) => names.get(id) ?? null;
  /** Whether each action can be taken now, in words, for the list of every action (D97). */
  const availability: Record<string, string> = Object.fromEntries(v.actions.map(a => {
    if (a.scope === 'team') { const b = tile(a.key, null).block; return [a.key, b ? actionSub(t, amount, { kind: a.kind, block: b }) : t('board.available.now')]; }
    const open = v.members.filter(m => !a.blockedFor[m.id]).length;
    const firstBlock = v.members.map(m => a.blockedFor[m.id]).find(Boolean) ?? null;
    return [a.key, ended || styling ? actionSub(t, amount, { kind: a.kind, block: tile(a.key, null).block }) : open ? t('board.available.people', { n: open }) : blockLine(firstBlock)];
  }));
  // The Actions panel folds only on a narrow board, and opens while someone is selected or an action is being planned.
  const foldable = narrow && !!app.onActionsCollapsed;
  const peek = !!selected && selected !== foldedFor;
  const folded = foldable && !!app.actionsCollapsed && !peek && !f;

  // ---- sponsor call ----
  let call: ReactNode = null;
  if (callCard) {
    const msg = callCard.messageId ? v.inbox.find(m => m.id === callCard.messageId) : undefined;
    const due = msg?.dueInSubPeriods ?? null;
    call = (
      <SponsorCall
        name={v.sponsor.name} initials={initials(v.sponsor.name)} img={v.sponsor.img}
        line={t('events.call.line', { title: v.sponsor.title, about: callCard.title })}
        laterLabel={due !== null && due >= 1 ? t('events.call.later', { amount: amount(due) }) : t('events.call.laterNow')}
        // Answer: the conversation opens as for any reply (then the live screen), and the call is done.
        onAnswer={async () => {
          ui.openPanel('none');
          if (callCard.messageId) {
            const r = await send({ type: 'openConversation', kind: 'reply', messageId: callCard.messageId });
            if (!r) return;
            setFlow(null);
          }
          await send({ type: 'dismissCard', cardId: callCard.id });
        }}
        // Later: the call stops ringing; its message stays in the inbox, urgent, with its due.
        onLater={async () => {
          focusHint.current = () => h1Ref.current;
          if (await send({ type: 'dismissCard', cardId: callCard.id })) say(t('events.call.waiting', { name: first(v.sponsor.name) }));
        }}
      />
    );
  }

  // ---- live interactions: the board owns "The team is reacting" ----
  const finishLive: FinishLive = async (i, people) => {
    if (inFlight.current) return false;
    const id = i.interactionId;
    setReacting({ id, people });
    const started = Date.now();
    const r = await send(i);
    if (!r) { setReacting(null); return false; }
    await new Promise(res => setTimeout(res, Math.max(0, REACTING_MS - (Date.now() - started))));
    setReacting(cur => (cur?.id === id ? null : cur));
    return true;
  };

  // ---- focus ----
  /**
   * When the focused control disappears (Confirm styles, Go back, Got it, Start week, the end of a
   * conversation), focus would fall to the page. Put it somewhere sensible instead: a hint if one
   * was left, the outcome headline, or the screen's heading. A modal handles its own focus.
   */
  const rescue = useCallback((closing = false) => {
    const main = mainRef.current;
    if (!main) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const lost = lastFocus.current;
    if (!lost || (lost.isConnected && (lost as HTMLElement).checkVisibility?.() !== false)) return;
    if (main.querySelector('[role="dialog"][aria-modal="true"]')) return;
    const dialog = lastDialog.current;
    if (dialog?.isConnected) { dialog.focus({ preventScroll: true }); return; }
    // A modal that just closed puts focus back itself (Radix), unless it hands that to us (`closing`).
    if (!closing && dialog?.getAttribute('aria-modal') === 'true') return;
    const hinted = focusHint.current?.();
    focusHint.current = null;
    (hinted ?? headlineIn(outcomeRef.current) ?? h1Ref.current)?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const onFocusIn = (e: FocusEvent) => {
      lastFocus.current = e.target as Element;
      lastDialog.current = (e.target as Element).closest?.<HTMLElement>('[role="dialog"]') ?? null;
    };
    document.addEventListener('focusin', onFocusIn);
    // Removals by child components (a stage switching, a dialog closing) are caught here.
    const mo = new MutationObserver(() => rescue());
    mo.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    return () => { document.removeEventListener('focusin', onFocusIn); mo.disconnect(); };
  }, [rescue]);

  // A new outcome takes focus, so it is read out; while an action is being planned it is announced instead.
  const shownOutcome = useRef<string | null>(null);
  useEffect(() => {
    // The tablet board loads on demand: wait until it is on screen to focus its outcome.
    if (!oc || reacting || v.live || styling || (tablet && !tabletReady)) return;
    if (shownOutcome.current === oc.id) return;
    shownOutcome.current = oc.id;
    // A new outcome from the engine is announced when focus cannot move to it (D78 keeps this finding).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (flow || card || endScreen) { setAnnounce(oc.headline); return; }
    const h = headlineIn(outcomeRef.current);
    h?.focus({ preventScroll: true });
  }, [oc, reacting, v.live, styling, flow, card, endScreen, tablet, tabletReady]);

  useEffect(() => { paletteOk.current = plainBoard && !demo; }, [plainBoard, demo]);

  // ---- what the screen shows ----
  const h1 = v.live
    ? t('liveshell.title', { format: v.live.format, name: v.live.speaker.name })
    : t('board.h1', { view: styling ? 'style' : 'board', unit: periodUnit, n: v.clock.period });

  let body: ReactNode;
  if (v.live || reacting) {
    // A live interaction takes the whole screen (spec, Live interaction screens). It stays mounted
    // behind "The team is reacting", so nothing written is lost if the engine refuses the end.
    body = (
      <>
        {v.live && (
          <div className={reacting ? 'hidden' : 'flex flex-1 flex-col'}>
            <Suspense fallback={<div role="status" className="flex flex-1 items-center justify-center text-14 text-fg-secondary">{t('board.loading')}</div>}>
              <EngineLive key={v.live.id} view={v} live={v.live} voiceConsent={!!app.voiceConsent} input={app.input ?? 'ptt'} captions={app.captions !== false}
                suspended={!!reacting} held={!!app.paused} layout={tablet ? 'tablet' : 'desk'} onPause={app.onPause} onFinish={finishLive}
                onDone={tip => { if (tip) say(t('board.practice.done', { tip })); }} onError={code => say(t('board.error', { code }))} />
            </Suspense>
          </div>
        )}
        {reacting && <ReactingScreen people={reacting.people} />}
      </>
    );
  } else if (weekEnd) {
    body = (
      <Suspense fallback={<div role="status" className="flex flex-1 items-center justify-center text-14 text-fg-secondary">{t('board.loading')}</div>}>
        <EngineWeekEnd key={`${v.phase}:${v.periods.length}`} view={v} busy={busy} send={async i => !!(await send(i))} onResults={() => setLastWeekSeen(true)} />
      </Suspense>
    );
  } else if (endScreen) {
    body = (
      <Suspense fallback={<div role="status" className="flex flex-1 items-center justify-center text-14 text-fg-secondary">{t('board.loading')}</div>}>
        {endView === 'end'
          ? <EngineEnd view={v} voiceConsent={!!app.voiceConsent} send={async i => !!(await send(i))} say={say}
              onViewReport={print => setEndView(print ? 'print' : 'report')} onLookAtBoard={() => setEndView('board')} />
          : <EngineReport view={v} print={endView === 'print'} onBack={() => setEndView('end')} participantName={profileName} getPdf={() => api.reportPdf()} getHistory={() => api.getHistory()}
              onEmail={() => { void api.emailReport().then(() => say(t('board.report.emailSent')), () => say(t('board.report.emailFailed'))); }} />}
      </Suspense>
    );
  } else if (styling) {
    // Weekly style setting opens before any action (spec), as its own screen. Before week 1, the
    // practice conversation is offered above it (D16, D84).
    const partner = !demo && ui.practiceOffer && v.practice.available && v.practice.partner ? member(v.practice.partner) : undefined;
    body = (
      <>
      {partner && (
        <PracticeOffer name={first(partner.name)} busy={busy}
          onStart={() => { void send({ type: 'startPractice' }); }}
          onSkip={async () => { focusHint.current = () => h1Ref.current; if (await send({ type: 'skipPractice' })) say(t('board.practice.skipped')); }} />
      )}
      <StyleSettingView
        embedded
        periodUnit={periodUnit} period={v.clock.period} periodCount={v.clock.periods}
        sponsorName={v.sponsor.name} sponsorLine={v.sponsor.styleLine}
        view={styleView.summary ? 'summary' : styleView.layout} summaryOver={styleView.layout}
        onViewChange={m => setStyleView(x => (m === 'summary' ? { ...x, summary: true } : { layout: m, summary: false }))}
        members={v.members.map(m => ({
          id: m.id, name: m.name, title: v.funnel.find(st => st.key === m.stage)?.name ?? m.title, img: img(m), mood: m.mood,
          away: m.away > 0, awayReason: m.awayReason ?? undefined, pronoun: m.pronoun,
          stats: m.skill !== null && m.morale !== null && m.trust !== null ? { skill: m.skill, morale: m.morale, trust: m.trust } : null,
          lastStyle: m.lastStyle, lastReaction: m.lastReaction, style: draft[m.id] ?? null, rationale: notes[m.id] ?? ''
        }))}
        onStyle={(id, k) => setDraft(d => ({ ...d, [id]: k }))}
        onRationale={(id, text) => setNotes(n => ({ ...n, [id]: text }))}
        onConfirm={confirmStyles}
        onBack={() => setStyleView(x => ({ ...x, summary: false }))}
        confirmDisabled={busy || chosen < v.members.length}
      />
      </>
    );
  } else {
    const top = (
      <>
        {demo?.banner}
        <Hud {...hud} />
        {call}
        <MetricsStrip {...strip} />
        <BoardNotices notices={notices} view={v} onDismiss={key => setDismissed(d => new Set([...d, key]))}
          onLeaderboard={() => openPanel({ kind: 'leaderboard' })} />
        {ended && lastWeekSeen && endView === 'board' && (
          <div className="mx-6 mb-3.5 flex items-center gap-3 rounded-16 border border-line-strong bg-surface-material px-4 py-2.5 text-13 tablet-portrait:mt-3.5 tablet-portrait:mb-0">
            <span className="flex-1">{t('board.ended.readOnly')}</span>
            <Button variant="secondary" size="sm" onClick={() => setEndView('end')}>{t('board.ended.reopen')}</Button>
          </div>
        )}
      </>
    );
    const inboxDrawer = <InboxDrawer open={ui.panel === 'inbox'} subPeriodUnit={unit} items={drawerItems} sponsorName={first(v.sponsor.name)}
      onClose={() => ui.openPanel('none')} onOpen={id => void openMessage(id)} onLater={later} />;
    const due = sm && inbox.find(x => x.from === sm.id && x.dueInSubPeriods !== null);
    const tab: SheetTab = sm && sheet ? sheet : 'team';
    const openActions = v.actions.filter(a => a.scope === 'team' && !tile(a.key, null).block).length;
    const left = t('time.left', { amount: amount(v.clock.capacityLeft) });
    // The drawer and pick bar props carry handlers that read refs when they run, not while rendering (D78 keeps this finding).
    /* eslint-disable react-hooks/refs */
    body = (
      <>
        {tablet ? (
          // ---- the portrait tablet board (D73): HUD, KPI tiles, the team, the outcome, then the dock ----
          <Suspense fallback={null}>
            <TabletBoardView onReady={() => setTabletReady(true)} top={top} team={{ columns, hint, periodUnit }} outcome={oc && outcome}
              dock={{ unread: inbox.length, inboxOpen: ui.panel === 'inbox', onInbox: () => ui.openPanel(ui.panel === 'inbox' ? 'none' : 'inbox'),
                open: openActions, left, onActions: () => { ui.openPanel('none'); setLowered(false); setSheet(sm ? 'member' : 'team'); } }}
              pick={lowered && f && fa && picking ? { action: fa.name, limit: drawer?.people.mode === 'pick' ? drawer.people.limit : '', picks: drawer?.picks ?? [], onDone: () => setLowered(false), onCancel: closeSheet } : null}
              sheet={sheet && !lowered && !card ? {
                person: sm ? { name: sm.name, img: img(sm), mood: sm.mood, away: sm.away > 0, stage: stageName(sm.stage), trust: sm.statsRevealed ? sm.trust : null } : null,
                tab, onTab: sheetTab, left,
                due: due ? { title: due.title, in: due.dueInSubPeriods!, onReply: () => { closeSheet(); void openMessage(due.id); } } : undefined,
                rows: tab === 'profile' ? [] : v.actions.filter(a => a.scope === (tab === 'member' ? 'member' : 'team')).map(a => ({ key: a.key, tile: tile(a.key, tab === 'member' ? sm!.id : null) })),
                chosen: f?.key ?? null, flow: drawer, profile, subPeriodUnit: unit,
                onClose: closeSheet, onPickOnBoard: () => setLowered(true),
                opener: () => mainRef.current?.querySelector<HTMLElement>(sm ? '[data-member-card][aria-pressed="true"]' : '[data-dock="actions"]')
              } : null} />
          </Suspense>
        ) : (
          <>
            {top}
            {outcome}
            <div className={`relative grid min-h-0 flex-1 ${folded ? 'grid-cols-(--il-board-columns-collapsed)' : 'grid-cols-(--il-board-columns)'}`}>
              {/* Tab order follows the spec: HUD, team board, actions, then inbox. The grid places the rail first. */}
              <TeamScroll stages={columns.length} label={t('board.teamScroll')}>
                <TeamBoard hint={hint} legendOpen={legend} onToggleLegend={() => setLegend(l => !l)} periodUnit={periodUnit} columns={columns}
                  onOverview={demo ? undefined : () => openPanel({ kind: 'overview' })} />
              </TeamScroll>
              {/*
                * The board's first render is split (D87): the HUD, the KPIs and the team (where the largest
                * paint is) come first; the actions panel and the inbox follow once that has painted, built
                * in their own render inside a transition, so the board is not one long task.
                */}
              <div className="col-start-3 row-start-1 flex min-h-0 flex-col"><Deferred>{() => <ActionsPanel
                capacityLeft={v.clock.capacityLeft} capacity={v.clock.capacity} subPeriodUnit={unit} periodUnit={periodUnit} outOfCapacity={!styling && v.clock.capacityLeft <= 0}
                notes={actionNotes}
                team={v.actions.filter(a => a.scope === 'team').map(a => tile(a.key, null))}
                member={sm ? { firstName: first(sm.name), tiles: v.actions.filter(a => a.scope === 'member').map(a => tile(a.key, sm.id)) } : null}
                drawer={drawer ? <ActionDrawer {...drawer} /> : undefined}
                onAbout={demo ? undefined : () => openPanel({ kind: 'actions' })}
                collapse={foldable ? {
                  collapsed: folded,
                  open: openActions,
                  onToggle: () => { setFoldedFor(folded ? null : selected); app.onActionsCollapsed?.(!folded); }
                } : undefined}
              />}</Deferred></div>
              <div className="col-start-1 row-start-1 flex min-h-0 flex-col"><Deferred>{() => <InboxRail unread={inbox.length} items={railItems} onToggle={() => ui.openPanel(ui.panel === 'inbox' ? 'none' : 'inbox')} onOpen={id => void openMessage(id)} />}</Deferred></div>
              {profile && <ProfilePanel {...profile} />}
              {inboxDrawer}
            </div>
          </>
        )}
        {tablet && inboxDrawer}
        {card && <EventCard key={card.id} card={card} busy={busy} nameOf={chipName} everyone={v.members.length} img={card.memberId ? member(card.memberId)?.img ?? null : null} onDismiss={() => { if (!busy) void send({ type: 'dismissCard', cardId: card.id }); }} onCloseFocus={() => rescue(true)} />}
        <Suspense fallback={null}>
          {badgesOpen && <BadgeShelfDialog badges={v.badges} periodUnit={periodUnit} onClose={() => setBadgesOpen(false)}
            returnFocus={() => mainRef.current?.querySelector<HTMLElement>('header button[aria-expanded]')} />}
          {pal && plainBoard && <CommandPalette open onClose={() => setPal(false)} query={query} onQueryChange={setQuery} results={palette} />}
          {panel && <PlayPanels panel={panel} view={v} nameOf={nameOf} availability={availability} onClose={() => setPanel(null)}
            onTour={() => { setPanel(null); setTour('board'); }}
            returnFocus={() => mainRef.current?.querySelector<HTMLElement>('header [data-tour="menu"] button') ?? h1Ref.current} />}
        </Suspense>
      </>
    );
    /* eslint-enable react-hooks/refs */
  }

  return (
    <main ref={mainRef} aria-label={plainBoard || card ? t('board.aria') : undefined} data-celebration={v.gamification.celebration} data-tablet={tablet ? '' : undefined} className="relative flex flex-1 flex-col">
      {/* The week end, the end screen and the report bring their own headings. */}
      {!weekEnd && !endScreen && <h1 ref={h1Ref} tabIndex={-1} className="sr-only">{h1}</h1>}
      {body}
      {tour && <Suspense fallback={null}><Tour key={tour} area={tour} view={v} onEnd={endTour} /></Suspense>}
      <div role="status" className="sr-only">{announce}</div>
      <Toast message={toast} />
    </main>
  );
}
