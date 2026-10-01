import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApi } from '../api';
import type { LiveVariant, MetricKey, Outcome, Scenario, StyleKey, EventType } from '../data/types';
import { NoWrapButton } from '../ds/Button';
import { Switch } from '../ds/Switch';
import { css } from '../lib/css';
import { Board } from '../screens/Board';
import { End } from '../screens/End';
import { Live } from '../screens/Live';
import { Onboarding } from '../screens/Onboarding';
import { Report } from '../screens/Report';
import { StyleSetting } from '../screens/StyleSetting';
import { WeekEnd } from '../screens/WeekEnd';
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
  settings: { text: 100, captions: true, reduced: false, input: 'ptt', clock: true }, toast: null, opened: [], week: 2, day: 3, secs: 2292, planned: []
};

const REACTING_MS = 3200;
const TOAST_MS = 3400;

function applyMoves(stats: Stats, outcome: Outcome): Stats {
  const next: Stats = structuredClone(stats);
  for (const mv of outcome.moves) if (next[mv.id]) next[mv.id][mv.k] += mv.d;
  return next;
}

/** Layout of the themed root. Colors come from the generated `.il-theme` token layers. */
const THEME_ROOT = css(`color:var(--ik-text); font-family:var(--font-sans); font-size:14px; line-height:1.5; font-variant-numeric:tabular-nums; position:relative; min-height:inherit; overflow:hidden; display:flex; flex-direction:column`);

/** Halden Group sample client theme. The client brand color maps only to accent tokens. */
const CLIENT_THEME: Record<string, string> = {
  '--client-acc': 'light-dark(oklch(0.5 0.17 0), oklch(0.72 0.17 0))',
  '--client-acc-2': 'light-dark(oklch(0.58 0.15 30), oklch(0.8 0.12 30))',
  '--client-acc-soft': 'light-dark(oklch(0.95 0.025 0), oklch(0.6 0.18 0 / 0.18))',
  '--client-grad': 'linear-gradient(135deg, oklch(0.66 0.19 2), oklch(0.78 0.13 30))'
};

const DIALOG = `max-width:100%; border-radius:24px; background:var(--ik-mat); border:1px solid var(--ik-line-strong); animation:ilIn 240ms ease`;

const RECAP = [
  { img: '/assets/npc/beth.png', t: '1:1 with Beth went well', d: 'Morale +6', c: 'var(--ik-pos)' },
  { img: '/assets/npc/lowe.png', t: 'Feedback to Lowe felt public', d: 'Trust −3', c: 'var(--ik-neg)' },
  { img: '/assets/npc/green.png', t: 'Ashcroft moved to proposal', d: 'Result +4', c: 'var(--ik-pos)' }
];

export function App(p: AppProps) {
  const api = useApi();
  const [s, setS] = useState<State>(INITIAL);
  const sRef = useRef(s);
  sRef.current = s;
  const reactTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingOutcome = useRef<Promise<Outcome> | null>(null);
  const frozen = !!p.frozen;
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
      if (session) Object.assign(st, { week: session.week, day: session.day, capacity: session.capacity, secs: session.secs, settings: session.settings, styles: { ...st.styles, ...session.styles } });
      if (p.outcome) {
        stats = applyMoves(stats, D.outcome);
        st.applied = true;
      }
      st.stats = stats;
      if (p.capacity !== undefined) st.capacity = p.capacity;
      set(st);
      if (st.screen === 'reacting' && p.uiState !== 'slow' && !frozen) reactTimer.current = setTimeout(() => void toBoard(), REACTING_MS);
    });
    return () => { live = false; };
    // Opening props are read once, like the prototype's componentDidMount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // Session clock. Runs on the board only, stops while an overlay (pause, settings) is open.
  useEffect(() => {
    const tick = setInterval(() => {
      if (frozen) return;
      const st = sRef.current;
      if (st.screen === 'board' && !st.overlay) set(x => ({ secs: Math.max(0, x.secs - 1) }));
    }, 1000);
    return () => clearInterval(tick);
  }, [frozen, set]);

  useEffect(() => () => { clearTimeout(reactTimer.current); clearTimeout(toastTimer.current); }, []);

  const say = useCallback((t: string) => {
    clearTimeout(toastTimer.current);
    set({ toast: t });
    toastTimer.current = setTimeout(() => set({ toast: null }), TOAST_MS);
  }, [set]);

  const persist = useCallback((work: Promise<unknown>) => {
    if (frozen) return;
    work.catch(() => say('We could not save that. We will retry when you are back online.'));
  }, [frozen, say]);

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
    overlay: o => set({ overlay: o })
  }), [api, go, persist, say, set]);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...sRef.current.settings, ...patch };
    set({ settings: next });
    persist(api.saveSettings(next));
  };

  const D = s.scenario;
  const dark = (p.theme ?? 'dark') === 'dark';
  const mobile = !!p.mobile;
  const minH = p.minHeight ?? (mobile ? '844px' : '900px');
  const rootVars: CSSProperties & Record<string, string | number> = {
    colorScheme: dark ? 'dark' : 'light', minHeight: minH, zoom: s.settings.text / 100,
    background: dark ? '#0A081B url(/assets/bg-1.png) center / cover no-repeat' : 'radial-gradient(1200px 600px at 85% 100%, oklch(0.9 0.06 230), transparent 70%), oklch(0.97 0.012 270)',
    ...(p.clientTheme ? CLIENT_THEME : null)
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

  const settingRows: Array<{ label: string; hint: string; key: 'text' | 'input'; opts: Array<[Settings['text'] | Settings['input'], string]> }> = [
    { label: 'Text size', hint: 'Up to 200% without losing content', key: 'text', opts: [[100, '100%'], [125, '125%'], [150, '150%'], [200, '200%']] },
    { label: 'How you respond', hint: 'Switch any time, even mid conversation', key: 'input', opts: [['text', 'Text'], ['ptt', 'Push to talk'], ['open', 'Hands free']] }
  ];
  const closeOverlay = () => set({ overlay: null });

  return (
    <div style={rootVars} className={s.settings.reduced ? 'il-reduced-motion' : undefined}>
      <div className="il-theme" style={THEME_ROOT}>
        {isLoading && (
          <div style={css('flex:1; min-height:inherit; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px')}>
            <span style={css('font-size:28px; font-weight:700; letter-spacing:-0.03em; background:var(--grad-brand); -webkit-background-clip:text; background-clip:text; color:transparent')}>iLead</span>
            <div style={css('width:220px; height:6px; border-radius:3px; background:linear-gradient(90deg, var(--ik-track) 0%, var(--ik-acc-soft) 50%, var(--ik-track) 100%); background-size:400px 6px; animation:ilShimmer 1.4s linear infinite')} />
            <span style={css('font-size:13px; color:var(--ik-text-2)')}>Setting up your office</span>
          </div>
        )}

        {screenProps && (
          <>
            {scr === 'onboarding' && p.uiState !== 'loading' && <div><Onboarding {...screenProps} step={step} uiState={uiState} /></div>}
            {scr === 'style' && <div><StyleSetting {...screenProps} view={step} /></div>}
            {scr === 'board' && p.uiState !== 'loading' && <div><Board {...screenProps} uiState={uiState} eventType={p.eventType ?? ''} mobile={mobile} /></div>}
            {scr === 'live' && <div><Live {...screenProps} variant={s.variant} uiState={uiState} mobile={mobile} /></div>}
            {scr === 'weekend' && <div><WeekEnd {...screenProps} step={step} /></div>}
            {scr === 'end' && <div><End {...screenProps} /></div>}
            {scr === 'report' && <div><Report {...screenProps} print={!!p.print} mobile={mobile} /></div>}
          </>
        )}

        {scr === 'reacting' && (
          <div role="status" aria-live="polite" style={css('flex:1; min-height:inherit; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:28px; padding:32px; text-align:center')}>
            <div style={css('display:flex; gap:20px')}>
              {['kent', 'beth', 'jack'].map((id, i) => {
                const size = i === 0 ? '120px' : '88px';
                return (
                  <div key={id} style={css(`position:relative; width:${size}; height:${size}`)}>
                    <div style={css(`position:absolute; inset:-6px; border-radius:50%; border:2px solid var(--ik-acc-2); animation:ilRing 1.6s ease-out infinite; animation-delay:${i * 0.3}s`)} />
                    <div style={css('width:100%; height:100%; border-radius:50%; overflow:hidden; background:linear-gradient(160deg,#DEE9FF,#9FDCEB); border:2px solid var(--ik-line-strong)')}>
                      <img src={`/assets/npc/${id}.png`} alt={id} style={css('width:100%; height:100%; object-fit:cover; object-position:center top; mix-blend-mode:multiply')} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={css('display:flex; flex-direction:column; gap:6px')}>
              <h2 style={css('margin:0; font-size:28px; font-weight:700; letter-spacing:-0.02em')}>The team is reacting</h2>
              <span style={css('font-size:15px; color:var(--ik-text-2)')}>Kent, Beth and Jack are taking in what you said.</span>
            </div>
            {p.uiState === 'slow' && (
              <div style={css('display:flex; flex-direction:column; align-items:center; gap:12px; padding:16px 20px; border-radius:16px; background:var(--ik-card); border:1px solid var(--ik-line)')}>
                <span style={css('font-size:13px; color:var(--ik-text-2)')}>This is taking longer than usual. Your conversation is saved.</span>
                <div style={css('display:flex; gap:8px')}>
                  <NoWrapButton variant="secondary" size="sm" onClick={() => void toBoard()}>Keep waiting</NoWrapButton>
                  <NoWrapButton variant="primary" size="sm" onClick={() => void toBoard()}>Retry</NoWrapButton>
                </div>
              </div>
            )}
          </div>
        )}

        {s.overlay && (
          <div style={css('position:absolute; inset:0; z-index:50; background:var(--ik-scrim); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:24px')}>
            {s.overlay === 'settings' && (
              <div role="dialog" aria-label="Settings and accessibility" style={css(`width:560px; max-height:100%; overflow-y:auto; overflow-x:hidden; padding:28px; display:flex; flex-direction:column; gap:22px; ${DIALOG}`)}>
                <div style={css('display:flex; justify-content:space-between; align-items:center')}>
                  <h2 style={css('margin:0; font-size:22px; font-weight:700')}>Settings</h2>
                  <button onClick={closeOverlay} aria-label="Close settings" style={css('width:36px; height:36px; border-radius:50%; border:0; background:var(--ik-raised); color:var(--ik-text); cursor:pointer')}>✕</button>
                </div>
                {settingRows.map(r => (
                  <div key={r.key} style={css('display:flex; flex-direction:column; gap:8px')}>
                    <div style={css('display:flex; justify-content:space-between; gap:12px')}>
                      <span style={css('font-weight:700')}>{r.label}</span>
                      <span style={css('font-size:12px; color:var(--ik-text-2)')}>{r.hint}</span>
                    </div>
                    <div role="radiogroup" aria-label={r.label} style={css('display:flex; gap:2px; padding:3px; border-radius:999px; background:var(--ik-raised); border:1px solid var(--ik-line)')}>
                      {r.opts.map(([v, n]) => {
                        const on = s.settings[r.key] === v;
                        return (
                          <button key={String(v)} role="radio" aria-checked={on} onClick={() => updateSettings({ [r.key]: v } as Partial<Settings>)}
                            style={css(`flex:1; height:34px; border:0; border-radius:999px; cursor:pointer; font-size:13px; font-weight:700; background:${on ? 'var(--grad-brand)' : 'transparent'}; color:${on ? '#0A081B' : 'var(--ik-text-2)'}`)}>{n}</button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={css('display:flex; flex-direction:column; gap:14px; padding-top:4px')}>
                  <Switch label="Captions on every NPC voice line" checked={s.settings.captions} onChange={v => updateSettings({ captions: v })} />
                  <Switch label="Reduce motion and celebrations" checked={s.settings.reduced} onChange={v => updateSettings({ reduced: v })} />
                  <Switch label="Show the session clock" checked={s.settings.clock} onChange={v => updateSettings({ clock: v })} />
                </div>
                <p style={css('margin:0; font-size:12px; color:var(--ik-text-2)')}>Changes save automatically. Voice is never required. You can finish every interaction in text.</p>
              </div>
            )}
            {s.overlay === 'paused' && (
              <div role="dialog" aria-label="Paused" style={css(`width:440px; padding:32px; display:flex; flex-direction:column; gap:16px; align-items:center; text-align:center; ${DIALOG}`)}>
                <div style={css('width:64px; height:64px; border-radius:50%; background:var(--grad-brand); display:flex; align-items:center; justify-content:center; gap:6px')}>
                  <span style={css('width:6px; height:22px; border-radius:2px; background:#0A081B')} />
                  <span style={css('width:6px; height:22px; border-radius:2px; background:#0A081B')} />
                </div>
                <h2 style={css('margin:0; font-size:24px; font-weight:700')}>You are paused</h2>
                <p style={css('margin:0; color:var(--ik-text-2); text-wrap:pretty')}>The clock has stopped and your team will wait. Everything is saved, so you can also close this tab and resume on any device.</p>
                <NoWrapButton variant="primary" size="lg" onClick={closeOverlay}>Resume</NoWrapButton>
              </div>
            )}
            {s.overlay === 'resume' && (
              <div role="dialog" aria-label="Welcome back" style={css(`width:520px; padding:28px; display:flex; flex-direction:column; gap:18px; ${DIALOG}`)}>
                <span style={css('font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ik-text-2)')}>Welcome back</span>
                <h2 style={css('margin:0; font-size:24px; font-weight:700')}>You are in week 2, day 3</h2>
                <div style={css('display:flex; flex-direction:column; gap:8px')}>
                  <span style={css('font-size:13px; font-weight:700')}>Last 3 outcomes</span>
                  {RECAP.map(r => (
                    <div key={r.t} style={css('display:flex; gap:10px; align-items:center; padding:10px 12px; border-radius:12px; background:var(--ik-raised)')}>
                      <img src={r.img} alt="" style={css('width:32px; height:32px; border-radius:50%; object-fit:cover; object-position:center top; background:#DEE9FF')} />
                      <span style={css('flex:1; font-size:13px')}>{r.t}</span>
                      <span style={css(`font-size:12px; font-weight:700; color:${r.c}`)}>{r.d}</span>
                    </div>
                  ))}
                </div>
                <span style={css('font-size:13px; color:var(--ik-text-2)')}>2 open messages are waiting: Kent and Priya.</span>
                <div style={css('display:flex; justify-content:flex-end')}>
                  <NoWrapButton variant="primary" size="md" onClick={closeOverlay}>Back to my team</NoWrapButton>
                </div>
              </div>
            )}
            {s.overlay === 'expired' && (
              <div role="dialog" aria-label="Session ended" style={css(`width:440px; padding:32px; display:flex; flex-direction:column; gap:14px; text-align:center; align-items:center; ${DIALOG}`)}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ik-acc-2)" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <h2 style={css('margin:0; font-size:22px; font-weight:700')}>Your session timed out</h2>
                <p style={css('margin:0; color:var(--ik-text-2); text-wrap:pretty')}>You were away for a while, so we signed you out to keep your work safe. Every action and draft is saved. Sign in to pick up exactly where you left off.</p>
                <NoWrapButton variant="primary" size="md" onClick={() => set({ overlay: 'resume' })}>Sign in again</NoWrapButton>
              </div>
            )}
          </div>
        )}

        {s.toast && (
          <div role="status" aria-live="polite" style={css('position:absolute; left:50%; bottom:24px; transform:translateX(-50%); padding:12px 18px; border-radius:999px; background:var(--ik-text); color:light-dark(#fff, #0A081B); font-size:13px; font-weight:600; z-index:60; max-width:90%; text-align:center; animation:ilIn 200ms ease')}>{s.toast}</div>
        )}
      </div>
    </div>
  );
}

