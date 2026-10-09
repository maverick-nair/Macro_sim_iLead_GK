import type { ScormVersion } from './settings';

/**
 * The SCORM runtime adapter (D202): finds the LMS's API object, then speaks SCORM 1.2 (`API`) or SCORM 2004
 * 4th edition (`API_1484_11`) behind one version neutral interface. Without an LMS it is a no-op adapter, so
 * the package also plays opened on its own (a reviewer's laptop, a file share).
 */
export interface Scorm12Api {
  LMSInitialize(arg: ''): unknown;
  LMSFinish(arg: ''): unknown;
  LMSGetValue(key: string): unknown;
  LMSSetValue(key: string, value: string): unknown;
  LMSCommit(arg: ''): unknown;
  LMSGetLastError(): unknown;
  LMSGetErrorString?(code: string): unknown;
}
export interface Scorm2004Api {
  Initialize(arg: ''): unknown;
  Terminate(arg: ''): unknown;
  GetValue(key: string): unknown;
  SetValue(key: string, value: string): unknown;
  Commit(arg: ''): unknown;
  GetLastError(): unknown;
  GetErrorString?(code: string): unknown;
}

export type Completion = 'completed' | 'incomplete';
export type Success = 'passed' | 'failed' | 'unknown';
export interface Score { raw: number; min: number; max: number; scaled: number }
export interface Objective { id: string; description: string; score: Score | null; completion: Completion; success: Success }

export interface LmsAdapter {
  /** The SCORM version spoken, or null for the no-op adapter. */
  readonly version: ScormVersion | null;
  /** The longest suspend data the LMS must keep: 4096 characters in SCORM 1.2, 64000 in 2004. */
  readonly suspendLimit: number;
  initialize(): boolean;
  learner(): { id: string; name: string } | null;
  suspendData(): string;
  setSuspendData(data: string): void;
  setLocation(location: string): void;
  setStatus(completion: Completion, success: Success): void;
  setScore(score: Score): void;
  /** 0 to 1, SCORM 2004 only. */
  setProgress(fraction: number): void;
  /** SCORM 2004 only: one objective per skill. */
  setObjectives(objectives: Objective[]): void;
  setSessionTime(ms: number): void;
  setExit(exit: 'suspend' | 'normal'): void;
  commit(): void;
  terminate(): void;
  /** Calls the LMS refused, as `key: code`, for diagnostics. */
  readonly errors: string[];
}

type Win = { parent?: Win | null; opener?: Win | null; API?: unknown; API_1484_11?: unknown; top?: Win | null };

const KEY: Record<ScormVersion, 'API' | 'API_1484_11'> = { scorm12: 'API', scorm2004: 'API_1484_11' };

function own(w: Win, key: 'API' | 'API_1484_11'): unknown {
  try { return w[key] ?? null; } catch { return null; /* another origin's frame */ }
}

/**
 * The SCORM discovery walk: this window and up through its parents (at most 10 levels, as ADL's sample
 * does with 7 and LMSs nest deeper), then the opener and its parents, for a package opened in a new window.
 */
export function findApi(win: Win, key: 'API' | 'API_1484_11'): unknown {
  const climb = (start: Win | null | undefined) => {
    let w = start;
    for (let i = 0; w && i < 10; i++) {
      const api = own(w, key);
      if (api) return api;
      let up: Win | null | undefined;
      try { up = w.parent; } catch { up = null; }
      if (!up || up === w) break;
      w = up;
    }
    return null;
  };
  let opener: Win | null | undefined;
  try { opener = win.opener; } catch { opener = null; }
  return climb(win) ?? climb(opener);
}

/** The package's version first; the other one if the LMS only offers that (a mislabelled import). */
export function discover(win: Win, prefer: ScormVersion): { version: ScormVersion; api: unknown } | null {
  for (const v of [prefer, prefer === 'scorm12' ? 'scorm2004' : 'scorm12'] as ScormVersion[]) {
    const api = findApi(win, KEY[v]);
    if (api) return { version: v, api };
  }
  return null;
}

/** SCORM 1.2's CMITimespan: HHHH:MM:SS.SS. */
export function timespan12(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.min(9999, Math.floor(cs / 360000)), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60, c = cs % 100;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}.${p(c)}`;
}

/** SCORM 2004's ISO 8601 duration: PT1H2M3.4S. */
export function duration2004(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = (cs % 6000) / 100;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s || (!h && !m) ? `${Number(s.toFixed(2))}S` : ''}`;
}

const ok = (r: unknown) => r === true || String(r) === 'true';
const num = (n: number) => String(Math.round(n * 10000) / 10000);

export function noopAdapter(): LmsAdapter {
  let data = '';
  return {
    version: null, suspendLimit: 64000, errors: [],
    initialize: () => true, learner: () => null, suspendData: () => data, setSuspendData: d => { data = d; },
    setLocation: () => undefined, setStatus: () => undefined, setScore: () => undefined, setProgress: () => undefined, setObjectives: () => undefined,
    setSessionTime: () => undefined, setExit: () => undefined, commit: () => undefined, terminate: () => undefined
  };
}

/** The adapter for SCORM 1.2's `API`. */
export function scorm12Adapter(api: Scorm12Api): LmsAdapter {
  let live = false;
  const errors: string[] = [];
  const get = (k: string) => (live ? String(api.LMSGetValue(k) ?? '') : '');
  const set = (k: string, v: string) => {
    if (!live) return;
    if (!ok(api.LMSSetValue(k, v))) errors.push(`${k}: ${String(api.LMSGetLastError())}`);
  };
  return {
    version: 'scorm12', suspendLimit: 4096, errors,
    initialize() {
      if (live) return true;
      // 101 is "already initialized" in 1.2: an LMS that started the session itself.
      live = ok(api.LMSInitialize('')) || String(api.LMSGetLastError()) === '101';
      if (live && ['', 'not attempted'].includes(get('cmi.core.lesson_status'))) set('cmi.core.lesson_status', 'incomplete');
      return live;
    },
    learner: () => (live ? { id: get('cmi.core.student_id'), name: get('cmi.core.student_name') } : null),
    suspendData: () => get('cmi.suspend_data'),
    setSuspendData: d => set('cmi.suspend_data', d),
    setLocation: l => set('cmi.core.lesson_location', l.slice(0, 255)),
    // 1.2 has one status: passed or failed once the pass rule decides, else completed or incomplete.
    setStatus: (c, s) => set('cmi.core.lesson_status', s !== 'unknown' ? s : c),
    setScore: s => { set('cmi.core.score.min', num(s.min)); set('cmi.core.score.max', num(s.max)); set('cmi.core.score.raw', num(s.raw)); },
    setProgress: () => undefined,
    setObjectives: () => undefined,
    setSessionTime: ms => set('cmi.core.session_time', timespan12(ms)),
    setExit: e => set('cmi.core.exit', e === 'suspend' ? 'suspend' : ''),
    commit() { if (live && !ok(api.LMSCommit(''))) errors.push(`commit: ${String(api.LMSGetLastError())}`); },
    terminate() { if (!live) return; api.LMSFinish(''); live = false; }
  };
}

/** The adapter for SCORM 2004's `API_1484_11`. */
export function scorm2004Adapter(api: Scorm2004Api): LmsAdapter {
  let live = false;
  const errors: string[] = [];
  const get = (k: string) => (live ? String(api.GetValue(k) ?? '') : '');
  const set = (k: string, v: string) => {
    if (!live) return;
    if (!ok(api.SetValue(k, v))) errors.push(`${k}: ${String(api.GetLastError())}`);
  };
  /** Where each objective id sits in the LMS's list: existing ones (a resumed attempt) keep their index. */
  const slots = new Map<string, number>();
  return {
    version: 'scorm2004', suspendLimit: 64000, errors,
    initialize() {
      if (live) return true;
      // 103 is "already initialized" in 2004.
      live = ok(api.Initialize('')) || String(api.GetLastError()) === '103';
      if (!live) return false;
      const n = Number(get('cmi.objectives._count')) || 0;
      for (let i = 0; i < n; i++) slots.set(get(`cmi.objectives.${i}.id`), i);
      if (['', 'unknown', 'not attempted'].includes(get('cmi.completion_status'))) set('cmi.completion_status', 'incomplete');
      return true;
    },
    learner: () => (live ? { id: get('cmi.learner_id'), name: get('cmi.learner_name') } : null),
    suspendData: () => get('cmi.suspend_data'),
    setSuspendData: d => set('cmi.suspend_data', d),
    setLocation: l => set('cmi.location', l.slice(0, 1000)),
    setStatus: (c, s) => { set('cmi.completion_status', c); set('cmi.success_status', s); },
    setScore: s => { set('cmi.score.min', num(s.min)); set('cmi.score.max', num(s.max)); set('cmi.score.raw', num(s.raw)); set('cmi.score.scaled', num(s.scaled)); },
    setProgress: f => set('cmi.progress_measure', num(Math.min(1, Math.max(0, f)))),
    setObjectives(objectives) {
      for (const o of objectives) {
        let i = slots.get(o.id);
        if (i === undefined) { i = slots.size; slots.set(o.id, i); set(`cmi.objectives.${i}.id`, o.id); }
        set(`cmi.objectives.${i}.description`, o.description.slice(0, 250));
        if (o.score) {
          set(`cmi.objectives.${i}.score.min`, num(o.score.min)); set(`cmi.objectives.${i}.score.max`, num(o.score.max));
          set(`cmi.objectives.${i}.score.raw`, num(o.score.raw)); set(`cmi.objectives.${i}.score.scaled`, num(o.score.scaled));
        }
        set(`cmi.objectives.${i}.completion_status`, o.completion);
        set(`cmi.objectives.${i}.success_status`, o.success);
      }
    },
    setSessionTime: ms => set('cmi.session_time', duration2004(ms)),
    setExit: e => set('cmi.exit', e),
    commit() { if (live && !ok(api.Commit(''))) errors.push(`commit: ${String(api.GetLastError())}`); },
    terminate() { if (!live) return; api.Terminate(''); live = false; }
  };
}

/** The LMS's adapter for this window, or the no-op adapter when no LMS API is found. */
export function connectLms(win: Win, prefer: ScormVersion): LmsAdapter {
  const found = discover(win, prefer);
  if (!found) return noopAdapter();
  const a = found.version === 'scorm12' ? scorm12Adapter(found.api as Scorm12Api) : scorm2004Adapter(found.api as Scorm2004Api);
  return a.initialize() ? a : noopAdapter();
}
