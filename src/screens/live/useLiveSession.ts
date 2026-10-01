import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveVariant } from '../../data/types';
import type { AppModel } from '../../app/types';
import { initialBody, initialSubject, scriptsFor, type LiveScript } from './content';

/**
 * State and behaviour of the live interaction shell. Port of the `Component`
 * logic class in `project/ilLive.dc.html`.
 *
 * Everything that fakes a speech backend lives in the `simulate*` functions
 * below (NPC caption streaming, mic capture, waveform levels) so a real
 * backend can replace them one by one.
 */
export type LivePhase = 'speaking' | 'listening' | 'review' | 'thinking' | 'idle' | 'done';
export type LiveMode = 'voice' | 'text';

export interface LogEntry {
  who: 'npc' | 'me';
  i: number;
  /** What the user actually sent (falls back to the scripted line). */
  text?: string;
}

export interface LiveState {
  mode: LiveMode;
  phase: LivePhase;
  turn: number;
  /** Words of the current NPC line revealed so far while speaking. */
  words: number;
  log: LogEntry[];
  draft: string;
  wave: number[];
  micDenied: boolean;
  poor: boolean;
  slow: boolean;
  brief: boolean;
  hint: boolean;
  secs: number;
  mood: number;
  subject: string;
  body: string;
  dictating: boolean;
  notes: string[];
  speaker: number;
  called: boolean;
}

export type LivePatch = Partial<LiveState> | ((s: LiveState) => Partial<LiveState>);

export interface LiveSessionProps {
  app: AppModel;
  variant: LiveVariant;
  uiState?: string;
  mobile?: boolean;
}

const defaults: LiveState = {
  mode: 'voice',
  phase: 'speaking',
  turn: 0,
  words: 0,
  log: [],
  draft: '',
  wave: Array<number>(24).fill(4),
  micDenied: false,
  poor: false,
  slow: false,
  brief: true,
  hint: false,
  secs: 372,
  mood: 0,
  subject: initialSubject,
  body: initialBody,
  dictating: false,
  notes: ['Ashcroft is winnable at list price', '', ''],
  speaker: 0,
  called: false
};

/** The design's componentDidMount: seeds state for the requested gallery uiState. */
function initialStateFor(uiState: string | undefined, mobile: boolean | undefined, S: LiveScript): LiveState {
  const st: Partial<LiveState> = {};
  const npc0: LogEntry = { who: 'npc', i: 0 };
  const me0: LogEntry = { who: 'me', i: 0 };
  const u = uiState;
  if (u === 'listening') Object.assign(st, { phase: 'listening', turn: 0, log: [npc0], words: 99, draft: S.user[0].split(' ').slice(0, 9).join(' ') });
  else if (u === 'review') Object.assign(st, { phase: 'review', turn: 0, log: [npc0], words: 99, draft: S.user[0] });
  else if (u === 'thinking') Object.assign(st, { phase: 'thinking', turn: 1, log: [npc0, me0], words: 0 });
  else if (u === 'speaking') Object.assign(st, { phase: 'speaking', turn: 1, log: [npc0, me0], words: 9, mood: 1 });
  else if (u === 'micDenied') Object.assign(st, { phase: 'idle', mode: 'text', micDenied: true, turn: 0, log: [npc0], words: 99 });
  else if (u === 'poorAudio') Object.assign(st, { phase: 'review', poor: true, turn: 0, log: [npc0], words: 99, draft: "I'm sorry I ... it yesterday. I want to hear what's ... mind" });
  else if (u === 'slow') Object.assign(st, { phase: 'thinking', slow: true, turn: 1, log: [npc0, me0] });
  else if (u === 'text') Object.assign(st, { phase: 'idle', mode: 'text', turn: 0, log: [npc0], words: 99, draft: '' });
  else if (u === 'done') Object.assign(st, { phase: 'done', turn: 2, log: [npc0, me0, { who: 'npc', i: 1 }, { who: 'me', i: 1 }, { who: 'npc', i: 2 }], words: 99, mood: 2 });
  else if (u === 'hint') Object.assign(st, { hint: true, phase: 'idle', log: [npc0], words: 99 });
  else if (u === 'dictating') Object.assign(st, { dictating: true });
  else Object.assign(st, { log: [npc0], words: 0 });
  if (mobile) st.brief = false;
  return { ...defaults, ...st };
}

export function useLiveSession(props: LiveSessionProps) {
  const propsRef = useRef(props);
  propsRef.current = props;
  const scripts = useCallback((): LiveScript => scriptsFor(propsRef.current.variant, propsRef.current.app?.who), []);

  const [state, setRaw] = useState<LiveState>(() => initialStateFor(props.uiState, props.mobile, scripts()));
  /** Latest state, read by timers the way the class read `this.state`. */
  const stateRef = useRef(state);
  stateRef.current = state;

  /** Class style setState: shallow merges a patch or an updater result. */
  const setState = useCallback((patch: LivePatch) => {
    setRaw(prev => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      stateRef.current = next;
      return next;
    });
  }, []);

  const listenTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const replyTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  /** Simulated NPC speech: reveals the current line one word every 70 ms (design `stream()`). */
  const simulateNpcSpeechTick = useCallback(() => {
    const s = stateRef.current;
    const S = scripts();
    if (s.phase !== 'speaking') return;
    const line = S.npc[s.turn].t.split(' ');
    if (s.words < line.length) {
      if (propsRef.current.uiState !== 'speaking') setState({ words: s.words + 1 });
    } else setState({ phase: s.turn >= S.npc.length - 1 ? 'done' : 'idle' });
  }, [scripts, setState]);

  /** Simulated mic levels: random bar heights every 100 ms while listening or dictating. */
  const simulateWaveformTick = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === 'listening' || s.dictating) setState({ wave: s.wave.map(() => 4 + Math.round(Math.random() * 30)) });
  }, [setState]);

  /** Simulated speech to text: types the scripted user line one word every 160 ms, then goes to review. */
  const simulateMicCapture = useCallback(
    (words: string[]) => {
      let n = 0;
      clearInterval(listenTimer.current);
      listenTimer.current = setInterval(() => {
        n++;
        setState({ draft: words.slice(0, n).join(' ') });
        if (n >= words.length) {
          clearInterval(listenTimer.current);
          setState({ phase: 'review' });
        }
      }, 160);
    },
    [setState]
  );

  const stopMicCapture = useCallback(() => clearInterval(listenTimer.current), []);

  useEffect(() => {
    const clk = setInterval(() => {
      if (!(propsRef.current.app && propsRef.current.app.frozen)) setState(s => ({ secs: Math.max(0, s.secs - 1) }));
    }, 1000);
    const str = setInterval(simulateNpcSpeechTick, 70);
    const wv = setInterval(simulateWaveformTick, 100);
    const replies = replyTimers.current;
    return () => {
      clearInterval(clk);
      clearInterval(str);
      clearInterval(wv);
      clearInterval(listenTimer.current);
      replies.forEach(t => clearTimeout(t));
      replies.clear();
    };
  }, [setState, simulateNpcSpeechTick, simulateWaveformTick]);

  const startListen = useCallback(() => {
    const S = scripts();
    const s = stateRef.current;
    if (s.micDenied || s.phase === 'done') return;
    if (s.phase === 'speaking') setState({ words: 999 });
    const words = S.user[Math.min(s.turn, S.user.length - 1)].split(' ');
    setState({ phase: 'listening', draft: '', poor: false });
    simulateMicCapture(words);
  }, [scripts, setState, simulateMicCapture]);

  const stopListen = useCallback(() => {
    stopMicCapture();
    setState({ phase: 'review' });
  }, [setState, stopMicCapture]);

  const send = useCallback(() => {
    const s = stateRef.current;
    const S = scripts();
    if (s.phase === 'done') return;
    const ui = s.turn;
    if (ui >= S.user.length) return;
    const text = s.draft.trim() || S.user[ui];
    stopMicCapture();
    setState(x => ({ log: [...x.log, { who: 'me', i: ui, text }], draft: '', phase: 'thinking', poor: false, turn: x.turn + 1, words: 0 }));
    // Simulated reply latency before the NPC starts speaking.
    const t = setTimeout(() => {
      replyTimers.current.delete(t);
      setState(x => ({
        phase: 'speaking',
        log: [...x.log, { who: 'npc', i: x.turn }],
        mood: Math.min(2, x.mood + 1),
        called: propsRef.current.variant === 'meeting' && x.turn === 2
      }));
    }, 1300);
    replyTimers.current.add(t);
  }, [scripts, setState, stopMicCapture]);

  return { state, setState, scripts, startListen, stopListen, send };
}
