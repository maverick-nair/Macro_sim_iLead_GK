import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApi } from '../api';
import { Toast } from '../components/feedback/Toast';
import { I18nProvider, useI18n } from '../i18n';
import type { LiveVariant, MetricKey, Outcome, Scenario, StyleKey, EventType } from '../data/types';
import { RESUME_FIXTURE } from '../data/fixtures';
import { EngineBoard } from '../components/board/EngineBoard';
import { ReactingScreen } from '../components/liveshell/ReactingScreen';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { PauseDialog, ResumeDialog, SessionExpiredDialog } from '../components/settings/SessionDialogs';
import { LoadingScreen } from '../components/shell/LoadingScreen';
import { Onboarding } from '../screens/Onboarding';
import { HALDEN_THEME } from './clientTheme';
import { EngineOnboarding } from './EngineOnboarding';
import { useEngineView } from '../engine/react';
import { runInProgress, showsRecap } from './resume';
import { useSessionClock } from './sessionClock';
/** The welcome back recap on the engine loads only when a run is resumed. */
const EngineResume = lazy(() => import('./EngineResume'));
/** Screens past onboarding load on demand, so the board's first load stays inside its budget. */
const Board = lazy(() => import('../screens/Board').then(m => ({ default: m.Board })));
const End = lazy(() => import('../screens/End').then(m => ({ default: m.End })));
const Live = lazy(() => import('../screens/Live').then(m => ({ default: m.Live })));
const Report = lazy(() => import('../screens/Report').then(m => ({ default: m.Report })));
const StyleSetting = lazy(() => import('../screens/StyleSetting').then(m => ({ default: m.StyleSetting })));
const WeekEnd = lazy(() => import('../screens/WeekEnd').then(m => ({ default: m.WeekEnd })));

import type { AppActions, AppModel, Overlay, PlannedAction, Screen, Settings } from './types';

/**
 * The iLead participant app. Port of the prototype's `iLeadApp` design component.
 *
 * Props let the screens gallery open the app at any state. In normal play only
 * `theme` and `clientTheme` are set and the app starts at onboarding.
 */
export interface AppProps {
  theme?: 'dark' | 'light';
  clientTheme?: boolean;
  screen?: Screen;
  variant?: LiveVariant;
  uiState?: string;
  step?: string;
  overlay?: Overlay | null;
  /** Open the board with the outcome panel showing and its metric moves applied. */
  outcome?: boolean;
  eventType?: EventType | '';
  mobile?: boolean;
  print?: boolean;
  /** Static gallery snapshot: no clock, no auto advance. */
  frozen?: boolean;
  capacity?: number;
  minHeight?: string;
  /** Play on the engine: after onboarding the board renders engine state, styles are set on it. */
  engine?: boolean;
}

type Stats = Record<string, Record<MetricKey, number>>;

interface State {
  ready: boolean;
  scenario: Scenario | null;
  screen: Screen | null;
  styles: Record<string, StyleKey>;
  stats: Stats;
  capacity: number;
  outcome: boolean;
  applied: boolean;
  variant: LiveVariant;
  who: string;
  overlay: Overlay | null;
  step: string | null;
  settings: Settings;
  toast: string | null;
  opened: string[];
  week: number;
  day: number;
  secs: number;
  planned: PlannedAction[];
}

const INITIAL: State = {
  ready: false, scenario: null, screen: null, styles: {}, stats: {}, capacity: 2.5, outcome: false, applied: false, variant: 'roleplay', who: 'kent', overlay: null, step: null,
  settings: { text: 100, captions: true, reduced: false, input: 'ptt', clock: true, voiceConsent: null }, toast: null, opened: [], week: 2, day: 3, secs: 2292, planned: []
};

const REACTING_MS = 3200;

/** The recap reads the engine view here, so its own chunk stays free of the engine client. */
function EngineResumeHost({ onBack }: { onBack: () => void }) {
  const { data } = useEngineView();
  if (!data) return null;
  return <Suspense><EngineResume view={data} onBack={onBack} returnFocus={() => document.querySelector<HTMLElement>('main h1')} /></Suspense>;
}

/**
 * The start of the playable app. A run already in progress past onboarding (a reload, another
 * device) opens on the board instead, with the welcome back recap when the run is on the board or in
 * style setting with history. Decided once, from the first engine view of this load.
 */
function EngineStart({ act, minHeight, onResume }: { act: AppActions; minHeight: string; onResume: (recap: boolean) => void }) {
  const { data: view } = useEngineView();
  const resumed = !!view && runInProgress(view);
  // Onboarding never logs history, so this holds only for a run that was already under way.
  useEffect(() => { if (view && resumed) onResume(showsRecap(view)); }, [view, resumed, onResume]);
  if (!view || resumed) return null;
  return <EngineOnboarding act={act} minHeight={minHeight} />;
}
const TOAST_MS = 3400;

function applyMoves(stats: Stats, outcome: Outcome): Stats {
  const next: Stats = structuredClone(stats);
  for (const mv of outcome.moves) if (next[mv.id]) next[mv.id][mv.k] += mv.d;
  return next;
}

/** Layout of the themed root. Colors and type come from the generated `.il-theme` token layers. */
const THEME_ROOT = 'il-theme relative flex flex-col overflow-hidden font-sans text-14 leading-(--il-app-leading) text-fg-primary tabular-nums [min-height:inherit]';

export function App(p: AppProps) {
  const api = useApi();
  const [s, setS] = useState<State>(INITIAL);
  const sRef = useRef(s);
  sRef.current = s;
  const reactTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingOutcome = useRef<Promise<Outcome> | null>(null);
  /** What had focus when a dialog opened, so closing it can return there. */
  const opener = useRef<HTMLElement | null>(null);
  // The app's own I18nProvider is below this component; the context default is the same English catalog.
  const { t } = useI18n();
  const frozen = !!p.frozen;
  const engine = !!p.engine;
  const set = useCallback((u: Partial<State> | ((st: State) => Partial<State> | null)) => {
    setS(st => {
      const patch = typeof u === 'function' ? u(st) : u;
      return patch ? { ...st, ...patch } : st;
    });
  }, []);

  /** Leaves "The team is reacting" for the board, with the outcome applied once. */
  const toBoard = useCallback(async () => {
    let outcome: Outcome | null = null;
    try {
      outcome = pendingOutcome.current ? await pendingOutcome.current : null;
    } catch {
      outcome = null;
    }
    pendingOutcome.current = null;
    set(st => {
      if (!st.scenario) return null;
      const scenario = outcome ? { ...st.scenario, outcome } : st.scenario;
      if (st.applied) return { screen: 'board', outcome: true, scenario };
      return { screen: 'board', outcome: true, applied: true, scenario, stats: applyMoves(st.stats, scenario.outcome) };
    });
  }, [set]);

  // Load the scenario (and a saved session, if any), then open at the requested screen.
  useEffect(() => {
    let live = true;
    Promise.all([api.getScenario(), frozen ? Promise.resolve(null) : api.getSession().catch(() => null)]).then(([D, session]) => {
      if (!live) return;
      let stats: Stats = Object.fromEntries(D.members.map(m => [m.id, { skill: m.skill, morale: m.morale, result: m.result, trust: m.trust }]));
      const st: Partial<State> = {
        ready: true, scenario: D, styles: Object.fromEntries(D.members.map(m => [m.id, m.style])), screen: p.screen ?? 'onboarding',
        variant: p.variant ?? 'roleplay', step: p.step ?? null, overlay: p.overlay ?? null, outcome: !!p.outcome
      };
      if (session) Object.assign(st, { week: session.week, day: session.day, capacity: session.capacity, secs: session.secs, settings: { ...INITIAL.settings, ...session.settings }, styles: { ...st.styles, ...session.styles } });
      if (p.outcome) {
        stats = applyMoves(stats, D.outcome);
        st.applied = true;
      }
      st.stats = stats;
      if (p.capacity !== undefined) st.capacity = p.capacity;
      // The engine board's session clock counts down from the saved session (D13).
      if (engine) useSessionClock.getState().set(session?.secs ?? INITIAL.secs);
      set(st);
      if (st.screen === 'reacting' && p.uiState !== 'slow' && !frozen) reactTimer.current = setTimeout(() => void toBoard(), REACTING_MS);
    });
    return () => { live = false; };
    // Opening props are read once, like the prototype's componentDidMount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // Prototype session clock. Runs on the prototype board only, stops while an overlay (pause,
  // settings) is open. The engine board keeps its own clock, so in engine mode nothing ticks here
  // and the app does not re-render every second.
  useEffect(() => {
    if (frozen || engine) return;
    const tick = setInterval(() => {
      const st = sRef.current;
      if (st.screen === 'board' && !st.overlay) set(x => ({ secs: Math.max(0, x.secs - 1) }));
    }, 1000);
    return () => clearInterval(tick);
  }, [frozen, engine, set]);

  useEffect(() => () => { clearTimeout(reactTimer.current); clearTimeout(toastTimer.current); }, []);

  const say = useCallback((t: string) => {
    clearTimeout(toastTimer.current);
    set({ toast: t });
    toastTimer.current = setTimeout(() => set({ toast: null }), TOAST_MS);
  }, [set]);

  const persist = useCallback((work: Promise<unknown>) => {
    if (frozen) return;
    work.catch(() => say(t('app.saveFailed')));
  }, [frozen, say, t]);

  const go = useCallback<AppActions['go']>((screen, extra = {}) => {
    clearTimeout(reactTimer.current);
    const st = sRef.current;
    if (screen === 'reacting' && !frozen) {
      pendingOutcome.current = api.submitInteraction({ variant: st.variant, who: st.who, week: st.week, day: st.day });
      pendingOutcome.current.catch(() => undefined);
    }
    if (screen === 'weekend' && st.screen !== 'weekend') persist(api.endWeek({ week: st.week }));
    set({ screen, step: null, ...extra });
    if (screen === 'reacting') reactTimer.current = setTimeout(() => void toBoard(), REACTING_MS);
  }, [api, frozen, persist, set, toBoard]);

  const act = useMemo<AppActions>(() => ({
    go, say,
    setStyle: (id, k) => {
      set(st => ({ styles: { ...st.styles, [id]: k } }));
      persist(api.setStyle({ week: sRef.current.week, memberId: id, style: k }));
    },
    spend: (c, item) => {
      set(st => ({ capacity: Math.max(0, st.capacity - c), planned: item ? [...st.planned, item] : st.planned }));
      persist(api.planAction({ week: sRef.current.week, day: sRef.current.day, cost: c, item }));
    },
    live: (variant, who) => go('live', { variant, who: who || 'kent' }),
    openProfile: id => set(st => (st.opened.includes(id) ? null : { opened: [...st.opened, id] })),
    clearOutcome: () => set({ outcome: false }),
    overlay: o => {
      if (o && !sRef.current.overlay) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      set({ overlay: o });
    },
    settings: patch => {
      const next = { ...sRef.current.settings, ...patch };
      set({ settings: next });
      persist(api.saveSettings(next));
    }
  }), [api, go, persist, say, set]);

  const D = s.scenario;
  const dark = (p.theme ?? 'dark') === 'dark';
  const mobile = !!p.mobile;
  const minH = p.minHeight ?? (mobile ? 'var(--il-frame-phone-min-height)' : 'var(--il-frame-desktop-min-height)');
  // Text size scales every font size token (and the ported screens' pixel sizes) from the app root,
  // so text grows and wraps while the layout keeps its size. CSS zoom scaled the layout too.
  const rootVars: CSSProperties & Record<string, string | number> = {
    colorScheme: dark ? 'dark' : 'light', minHeight: minH, '--il-text-scale': s.settings.text / 100,
    background: dark ? 'var(--il-backdrop-office)' : 'var(--il-backdrop-daylight)',
    ...(p.clientTheme ? HALDEN_THEME : null)
  };

  const app: AppModel | null = s.ready && D ? {
    members: D.members.map(m => ({ ...m, ...s.stats[m.id], style: s.styles[m.id], img: `/assets/npc/${m.id}.png` })),
    capacity: s.capacity, week: s.week, day: s.day, outcome: s.outcome, who: s.who, opened: s.opened, planned: s.planned, settings: s.settings,
    frozen, minH, clock: `${Math.floor(s.secs / 60)}:${String(s.secs % 60).padStart(2, '0')}`, showClock: s.settings.clock, client: !!p.clientTheme, dark
  } : null;

  const scr = s.ready ? s.screen : null;
  const uiState = p.uiState ?? 'default';
  const step = s.step ?? p.step ?? '';
  const isLoading = !s.ready || p.uiState === 'loading';
  const screenProps = app && D ? { d: D, app, act } : null;

  const closeOverlay = () => set({ overlay: null });
  /** A run in progress was found on load: straight to the board, with the recap. */
  const resume = useCallback((recap: boolean) => set({ screen: 'board', step: null, overlay: recap ? 'resume' : null }), [set]);
  const returnFocus = () => opener.current;

  return (
    <I18nProvider>
    <div style={rootVars} data-text-large={s.settings.text > 100 ? '' : undefined} className={s.settings.reduced ? 'il-reduced-motion' : undefined}>
      <div className={THEME_ROOT}>
        {/* Everything behind an open dialog is inert: no focus, no clicks, hidden from screen readers. */}
        <div className="contents" inert={!!s.overlay}>
          {isLoading && <LoadingScreen />}

          {screenProps && (
            <Suspense>
              {scr === 'onboarding' && p.uiState !== 'loading' && (engine
                ? <div>{p.screen ? <EngineOnboarding act={act} minHeight={minH} /> : <EngineStart act={act} minHeight={minH} onResume={resume} />}</div>
                : <div><Onboarding {...screenProps} step={step} uiState={uiState} /></div>)}
              {engine && (scr === 'style' || scr === 'board') && (
                <div className="flex flex-1 flex-col" style={{ minHeight: minH }}>
                  <EngineBoard phone={mobile} client={!!p.clientTheme} voiceConsent={s.settings.voiceConsent === true} input={s.settings.input} captions={s.settings.captions}
                    paused={!!s.overlay} showClock={s.settings.clock} onPause={() => act.overlay('paused')} onSettings={() => act.overlay('settings')}
                    actionsCollapsed={s.settings.actionsCollapsed === true} onActionsCollapsed={v => act.settings({ actionsCollapsed: v })} />
                </div>
              )}
              {!engine && scr === 'style' && <div><StyleSetting {...screenProps} view={step} /></div>}
              {!engine && scr === 'board' && p.uiState !== 'loading' && <div><Board {...screenProps} uiState={uiState} eventType={p.eventType ?? ''} mobile={mobile} /></div>}
              {scr === 'live' && <div><Live {...screenProps} variant={s.variant} uiState={uiState} mobile={mobile} /></div>}
              {scr === 'weekend' && <div><WeekEnd {...screenProps} step={step} /></div>}
              {scr === 'end' && <div><End {...screenProps} /></div>}
              {scr === 'report' && <div><Report {...screenProps} print={!!p.print} mobile={mobile} /></div>}
            </Suspense>
          )}

          {scr === 'reacting' && D && (
            <ReactingScreen slow={p.uiState === 'slow'} onKeepWaiting={() => void toBoard()} onRetry={() => void toBoard()}
              people={['kent', 'beth', 'jack'].flatMap(id => D.members.filter(m => m.id === id)).map(m => ({ id: m.id, name: m.name, img: `/assets/npc/${m.id}.png` }))} />
          )}
        </div>

        {s.overlay === 'settings' && (
          <SettingsDialog values={s.settings} onChange={act.settings} onClose={closeOverlay} voiceConsent={engine} frozen={frozen} returnFocus={returnFocus} />
        )}
        {s.overlay === 'paused' && <PauseDialog onResume={closeOverlay} frozen={frozen} returnFocus={returnFocus} />}
        {/* On the engine the recap is built from the engine view; the gallery frame (x3) keeps the design fixture. */}
        {s.overlay === 'resume' && engine && (
          <EngineResumeHost onBack={closeOverlay} />
        )}
        {s.overlay === 'resume' && !engine && (
          <ResumeDialog period={s.week} periodUnit="week" sub={s.day} subPeriodUnit="day" recent={RESUME_FIXTURE.recent} waiting={RESUME_FIXTURE.waiting}
            onBack={closeOverlay} frozen={frozen} returnFocus={returnFocus} />
        )}
        {s.overlay === 'expired' && <SessionExpiredDialog onSignIn={() => set({ overlay: 'resume' })} frozen={frozen} returnFocus={returnFocus} />}

        <Toast message={s.toast} />
      </div>
    </div>
    </I18nProvider>
  );
}

