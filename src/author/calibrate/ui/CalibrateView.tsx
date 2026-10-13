import '../../author.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkSummary } from '../logic/aggregate';
import { CalibrateClientError, createRunner, type CalibrationRun } from '../logic/client';
import { configHash } from '../logic/hash';
import { DEFAULT_RUNS, isLevelKey, PERSONA_KEYS, type CalibrationResults, type PersonaKey } from '../logic/schema';
import type { CalibrateSlotProps } from '../types';
import { ago, BUTTON, plural } from './parts';
import { PersonaCards, PLAYS, type PersonaSetup } from './Setup';
import { ChecksList, PillarsTable, ResultsTable } from './Results';
import { PlaythroughView } from './PlaythroughView';

/**
 * "Test with synthetic players" (D118; Calibrate.dc.html and CalibrateRun.dc.html): the setup, the results
 * and checks, and one playthrough at a time. Rendered by `<CalibrateSlot>` (../index.ts), lazily.
 */
export default function CalibrateView({ config, apiBase = null, results: kept = null, onResults, onAsk, defaultRuns, headingLevel = 2, heading = true, runner: injected }: CalibrateSlotProps) {
  // The four levels play by default; the player types are off until the author turns them on (D150).
  const [setup, setSetup] = useState<Record<PersonaKey, PersonaSetup>>(() => Object.fromEntries(PERSONA_KEYS.map(p => {
    const n = defaultRuns?.[p] ?? (isLevelKey(p) ? DEFAULT_RUNS : 0);
    return [p, { on: n > 0, runs: Math.max(1, n || DEFAULT_RUNS), plays: PLAYS[p] }];
  })) as Record<PersonaKey, PersonaSetup>);
  const [probes, setProbes] = useState(true);
  const [run, setRun] = useState<CalibrationRun | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<{ message: string; issues: string[] } | null>(null);
  const [watch, setWatch] = useState<{ persona: PersonaKey; index: number } | null>(null);
  const [said, setSaid] = useState('');
  const ctl = useRef<AbortController | null>(null);
  const watchButton = useRef<HTMLDivElement>(null);
  const runner = useMemo(() => injected ?? createRunner(apiBase), [injected, apiBase]);
  const hash = useMemo(() => configHash(config), [config]);
  const results: CalibrationResults | null = run?.results ?? kept;
  const stale = !!results && results.configHash !== hash;
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  useEffect(() => () => ctl.current?.abort(), []);

  const total = PERSONA_KEYS.reduce((n, p) => n + (setup[p].on ? setup[p].runs : 0), 0);
  const draft = config as { lens?: { styles?: unknown[] }; actions?: unknown[] } | null;
  // Roughly the probes' count (D149): three seeds of each style alone and with team energy, two of each action,
  // of six pairs, of busy and idle play, and the four conversation probes.
  const probeCount = probes ? 6 * (draft?.lens?.styles?.length ?? 4) + 2 * (draft?.actions?.length ?? 10) + 12 + 4 + 4 : 0;
  const seconds = Math.max(2, Math.round(total * 0.12 + probeCount * 0.06));
  const estimate = apiBase ? 'On the server: a few seconds, or a few minutes with AI players' : `About ${seconds < 60 ? plural(seconds, 'second') : plural(Math.round(seconds / 60), 'minute')}`;

  async function start() {
    const controller = new AbortController();
    ctl.current = controller;
    setRunning(true);
    setError(null);
    setWatch(null);
    setProgress({ done: 0, total: 0 });
    setSaid(`Running ${plural(total, 'playthrough')}.`);
    const personas = Object.fromEntries(PERSONA_KEYS.map(p => [p, setup[p].on ? setup[p].runs : 0]));
    const describe = Object.fromEntries(PERSONA_KEYS.filter(p => setup[p].on && setup[p].plays.trim() && setup[p].plays !== PLAYS[p]).map(p => [p, setup[p].plays.trim()]));
    try {
      const out = await runner.run(config, { personas, probes, seed: 1, ...(Object.keys(describe).length ? { describe } : {}) }, { signal: controller.signal, onProgress: (done, t) => setProgress({ done, total: t }) });
      setRun(out);
      setSaid(`Test finished: ${checkSummary(out.results.checks)}.`);
      onResults?.(out.results);
    } catch (e) {
      const err = e instanceof CalibrateClientError ? e : null;
      if (err?.code === 'cancelled') setSaid('Test cancelled.');
      else {
        setError({ message: err?.message ?? 'The test could not run. Try again.', issues: err?.issues ?? [] });
        setSaid('The test could not run.');
      }
    } finally {
      if (ctl.current === controller) ctl.current = null;
      setRunning(false);
    }
  }

  const load = useCallback((p: PersonaKey, i: number) => {
    if (!run) return Promise.reject(new Error('No run'));
    return run.playthrough(p, i);
  }, [run]);

  const firstWatchable = () => {
    const p = results?.personas.find(x => x.persona === 'proficient' && x.runs > 0) ?? results?.personas.find(x => x.runs > 0);
    return p ? { persona: p.persona, index: 0 } : null;
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 text-fg-primary">
      {heading ? <div className="flex flex-col gap-1">
        <Heading className="m-0 text-24 font-800">Test with synthetic players</Heading>
        <p className="m-0 text-14 text-fg-secondary">{watch ? 'Every decision and conversation a synthetic player made, with the scoring explained.' : 'Synthetic players at four levels play the whole simulation, conversations included, so you can check it rewards good leadership before real people play.'}</p>
      </div> : watch && <p className="m-0 text-14 text-fg-secondary">Every decision and conversation a synthetic player made, with the scoring explained.</p>}
      <p role="status" className="sr-only">{said}</p>

      {watch && results && run ? (
        <PlaythroughView results={results} load={load} persona={watch.persona} index={watch.index} onPick={(persona, index) => setWatch({ persona, index })}
          onBack={() => { setWatch(null); requestAnimationFrame(() => watchButton.current?.querySelector('button')?.focus()); }} />
      ) : (
        <>
          <PersonaCards setup={setup} disabled={running} aiNote={!apiBase} onChange={(p, next) => setSetup(s => ({ ...s, [p]: next }))} />
          <div className="flex flex-wrap items-center gap-3">
            {running ? (
              <>
                <div className="flex min-w-60 flex-1 flex-col gap-1">
                  <span id="cal-progress-label" className="text-13 font-600">{progress.total ? `Playing ${progress.done} of ${progress.total}` : 'Starting'}</span>
                  <div role="progressbar" aria-labelledby="cal-progress-label" aria-valuemin={0} aria-valuemax={progress.total || 1} aria-valuenow={progress.done} className="h-2 overflow-hidden rounded-pill bg-track">
                    <div className="h-full bg-accent-default transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                  </div>
                </div>
                <button type="button" className={BUTTON.secondary} onClick={() => ctl.current?.abort()}>Cancel</button>
              </>
            ) : (
              <>
                <button type="button" className={BUTTON.primary} disabled={total === 0} onClick={() => void start()}>Run {plural(total, 'playthrough')}</button>
                <span className="text-13 text-fg-secondary">
                  {estimate}, conversations included
                  {results && (stale ? ' · last run was on an earlier version of this draft' : ` · last run ${ago(results.createdAt)} on this draft`)}
                </span>
                <span className="flex-1" />
                <label className="flex items-center gap-2 text-13">
                  <input type="checkbox" checked={probes} onChange={e => setProbes(e.target.checked)} className="size-4 accent-accent-default" />
                  Also try strategies that skip good leadership: one style for everyone, one action every day, routines
                </label>
              </>
            )}
          </div>
          {error && (
            <div role="alert" className="flex flex-col gap-1 rounded-12 border border-solid border-line-strong bg-status-decline-soft px-4 py-3 text-14">
              <b>{error.message}</b>
              {error.issues.length > 0 && <ul className="m-0 pl-5 text-13">{error.issues.slice(0, 8).map(i => <li key={i}>{i}</li>)}</ul>}
            </div>
          )}
          {results && (
            <div className="grid min-w-0 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3 tablet:grid-cols-1">
              <div ref={watchButton} className="flex min-w-0 flex-col gap-3">
                <ResultsTable results={results} canWatch={!!run} onWatch={() => setWatch(firstWatchable())} />
                <PillarsTable results={results} />
              </div>
              <ChecksList results={results} onAsk={onAsk ? c => onAsk(c, results) : undefined} />
            </div>
          )}
          {results && (
            <p className="m-0 text-12 text-fg-secondary">
              Ran {results.ranOn === 'server' ? 'on the server' : 'in this browser'} with {results.players === 'ai' ? 'AI players' : 'the built in players'} and {results.probes.length ? `${results.probes.length} strategy probes` : 'no strategy probes'}, in {Math.max(1, Math.round(results.durationMs / 1000))} s. Target tier: {results.targetTier.name}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
