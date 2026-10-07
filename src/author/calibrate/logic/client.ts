import { CalibrationJob, Playthrough, type CalibrationResults, type CalibrationSettingsInput, type PersonaKey } from './schema';

/**
 * Where a calibration runs (D118): on the server when GenieKreator configures one (`apiBase`, the base of
 * `/genie`), else in this browser, in a Web Worker, or in the page in small chunks when workers are not
 * available. A server that does not offer calibrations (404, 501, no network) falls back to the browser.
 * The engine is only ever loaded with the worker or the chunked runner, never with the screen.
 */

export interface CalibrationRun {
  results: CalibrationResults;
  playthrough(persona: PersonaKey, index: number): Promise<Playthrough>;
}

export interface RunOptions { onProgress?(done: number, total: number): void; signal?: AbortSignal }

export interface CalibrationRunner {
  run(draft: unknown, settings: CalibrationSettingsInput, opts?: RunOptions): Promise<CalibrationRun>;
}

export class CalibrateClientError extends Error {
  constructor(message: string, readonly code: string, readonly issues: string[] = []) { super(message); this.name = 'CalibrateClientError'; }
}

export const cancelled = () => new CalibrateClientError('The test was cancelled.', 'cancelled');

export function find(list: Playthrough[], persona: PersonaKey, index: number) {
  const p = list.find(x => x.persona === persona && x.index === index);
  if (!p) throw new CalibrateClientError('No such playthrough.', 'notFound');
  return p;
}

const noWorker: CalibrationRunner = { run: async () => { throw new CalibrateClientError('This browser cannot run the test in the background. Use a current version of Chrome, Edge, Firefox or Safari.', 'noWorker'); } };

/**
 * In a Web Worker. `fallback` runs when the browser cannot start one: `createChunkedRunner` (./chunked) in
 * tests, Node and Storybook. The screen passes none: importing the engine into the page's graph would split
 * modules out of the participant's first load (D118), and every supported browser has module workers.
 */
export function createWorkerRunner(make: () => Worker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'calibration' }), fallback: CalibrationRunner = noWorker): CalibrationRunner {
  return {
    run(draft, settings, opts = {}) {
      let worker: Worker;
      try {
        worker = make();
      } catch {
        return fallback.run(draft, settings, opts);
      }
      return new Promise<CalibrationRun>((resolve, reject) => {
        const stop = () => { worker.terminate(); reject(cancelled()); };
        if (opts.signal?.aborted) return stop();
        opts.signal?.addEventListener('abort', stop, { once: true });
        worker.onerror = e => {
          // A worker that cannot load (an old browser, a strict policy): the fallback.
          e.preventDefault();
          worker.terminate();
          opts.signal?.removeEventListener('abort', stop);
          fallback.run(draft, settings, opts).then(resolve, reject);
        };
        worker.onmessage = (e: MessageEvent) => {
          const m = e.data as { type: 'progress'; done: number; total: number } | { type: 'done'; results: CalibrationResults; playthroughs: Playthrough[] } | { type: 'error'; code: string; message: string; issues: string[] };
          if (m.type === 'progress') { opts.onProgress?.(m.done, m.total); return; }
          worker.terminate();
          opts.signal?.removeEventListener('abort', stop);
          if (m.type === 'done') resolve({ results: m.results, playthrough: async (p, i) => find(m.playthroughs, p, i) });
          else reject(new CalibrateClientError(m.message, m.code, m.issues));
        };
        worker.postMessage({ draft, settings });
      });
    }
  };
}

/** Waits `ms`, or rejects as cancelled when `signal` aborts; the abort listener goes when either happens. */
const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(cancelled());
  const abort = () => { clearTimeout(t); reject(cancelled()); };
  const t = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  signal?.addEventListener('abort', abort, { once: true });
});

const isAbortError = (e: unknown) => typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';

const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_.:]/g, '');

/** On the server's job endpoint: start once (one Idempotency-Key for every retry), then poll. */
export function createServerRunner(apiBase: string, opts: { fetch?: typeof fetch; pollMs?: number } = {}): CalibrationRunner & { offered(res: Response | null): boolean } {
  const f = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const base = apiBase.replace(/\/$/, '');
  const json = async (res: Response) => {
    const body = await res.json().catch(() => null) as { message?: string; code?: string; issues?: string[] } | null;
    if (!res.ok) throw new CalibrateClientError(body?.message ?? 'The test could not run.', body?.code ?? `http${res.status}`, Array.isArray(body?.issues) ? body.issues.map(String) : []);
    return body;
  };
  return {
    offered: res => !!res && res.status !== 404 && res.status !== 501,
    async run(draft, settings, o = {}) {
      const key = newKey();
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await f(`${base}/calibrations`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify({ ...settings, storyline: draft }), signal: o.signal });
          if (res.status < 500) break;
        } catch (e) {
          if (o.signal?.aborted || isAbortError(e)) throw cancelled();
          if (attempt === 2) throw new CalibrateClientError('The server could not be reached.', 'network');
          void e;
        }
        await wait(500 * (attempt + 1), o.signal);
      }
      if (!res || res.status === 404 || res.status === 501) throw new CalibrateClientError('This server does not run calibrations.', 'notOffered');
      let job = CalibrationJob.parse(await json(res));
      // Cancelling, or losing the job while polling, stops it on the server: nobody is waiting for it.
      const id = job.id;
      const onAbort = () => { void f(`${base}/calibrations/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => undefined); };
      o.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        while (job.status === 'queued' || job.status === 'running') {
          if (job.progress.total) o.onProgress?.(job.progress.done, job.progress.total);
          await wait(opts.pollMs ?? 800, o.signal);
          job = CalibrationJob.parse(await json(await f(`${base}/calibrations/${id}`, { credentials: 'include', signal: o.signal })));
        }
      } catch (e) {
        // The abort listener has already sent the DELETE.
        if (o.signal?.aborted || isAbortError(e)) throw cancelled();
        onAbort();
        // Not `network`: that would start the test again in the browser while the server's copy stops.
        throw e instanceof CalibrateClientError ? e : new CalibrateClientError('The server stopped answering. Run the test again.', 'pollFailed');
      } finally {
        o.signal?.removeEventListener('abort', onAbort);
      }
      if (job.status === 'cancelled') throw cancelled();
      if (job.status !== 'done' || !job.results) throw new CalibrateClientError(job.error?.message ?? 'The test could not run.', job.error?.code ?? 'failed');
      o.onProgress?.(job.progress.total, job.progress.total);
      return {
        results: job.results,
        playthrough: async (p, i) => Playthrough.parse(await json(await f(`${base}/calibrations/${id}/playthroughs/${p}/${i}`, { credentials: 'include' })))
      };
    }
  };
}

/** The server when there is one and it offers calibrations, else this browser. */
export function createRunner(apiBase?: string | null, deps: { fetch?: typeof fetch; local?: CalibrationRunner } = {}): CalibrationRunner & { lastRanOn(): 'server' | 'browser' | null } {
  const local = deps.local ?? createWorkerRunner();
  let where: 'server' | 'browser' | null = null;
  return {
    lastRanOn: () => where,
    async run(draft, settings, opts) {
      if (apiBase) {
        try {
          const out = await createServerRunner(apiBase, { fetch: deps.fetch }).run(draft, settings, opts);
          where = 'server';
          return out;
        } catch (e) {
          if (!(e instanceof CalibrateClientError) || (e.code !== 'notOffered' && e.code !== 'network')) throw e;
        }
      }
      where = 'browser';
      return local.run(draft, settings, opts);
    }
  };
}
