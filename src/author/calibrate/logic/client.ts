import { CalibrationJob, Playthrough, type CalibrationResults, type CalibrationSettingsInput, type PersonaKey } from './schema';

/**
 * Where a calibration runs (D116): on the server when GenieKreator configures one (`apiBase`, the base of
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

const cancelled = () => new CalibrateClientError('The test was cancelled.', 'cancelled');

/** In the page, a playthrough at a time with the thread given back in between. */
export function createChunkedRunner(): CalibrationRunner {
  return {
    async run(draft, settings, opts = {}) {
      const { runCalibration, CalibrationError } = await import('./run');
      try {
        const out = await runCalibration(draft, settings, { ranOn: 'browser', onProgress: opts.onProgress, signal: opts.signal });
        return { results: out.results, playthrough: async (p, i) => find(out.playthroughs, p, i) };
      } catch (e) {
        if (e instanceof CalibrationError) throw e.code === 'cancelled' ? cancelled() : new CalibrateClientError(e.message, e.code, e.issues);
        throw e;
      }
    }
  };
}

function find(list: Playthrough[], persona: PersonaKey, index: number) {
  const p = list.find(x => x.persona === persona && x.index === index);
  if (!p) throw new CalibrateClientError('No such playthrough.', 'notFound');
  return p;
}

/** In a Web Worker; the chunked runner when the browser cannot start one. */
export function createWorkerRunner(make: () => Worker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'calibration' })): CalibrationRunner {
  return {
    run(draft, settings, opts = {}) {
      let worker: Worker;
      try {
        worker = make();
      } catch {
        return createChunkedRunner().run(draft, settings, opts);
      }
      return new Promise<CalibrationRun>((resolve, reject) => {
        const stop = () => { worker.terminate(); reject(cancelled()); };
        if (opts.signal?.aborted) return stop();
        opts.signal?.addEventListener('abort', stop, { once: true });
        worker.onerror = e => {
          // A worker that cannot load (an old browser, a strict policy): run in the page instead.
          e.preventDefault();
          worker.terminate();
          opts.signal?.removeEventListener('abort', stop);
          createChunkedRunner().run(draft, settings, opts).then(resolve, reject);
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

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(cancelled()); }, { once: true });
});

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
          if (o.signal?.aborted) throw cancelled();
          if (attempt === 2) throw new CalibrateClientError('The server could not be reached.', 'network');
          void e;
        }
        await wait(500 * (attempt + 1), o.signal);
      }
      if (!res || res.status === 404 || res.status === 501) throw new CalibrateClientError('This server does not run calibrations.', 'notOffered');
      let job = CalibrationJob.parse(await json(res));
      const onAbort = () => { void f(`${base}/calibrations/${job.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => undefined); };
      o.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        while (job.status === 'queued' || job.status === 'running') {
          if (job.progress.total) o.onProgress?.(job.progress.done, job.progress.total);
          await wait(opts.pollMs ?? 800, o.signal);
          job = CalibrationJob.parse(await json(await f(`${base}/calibrations/${job.id}`, { credentials: 'include', signal: o.signal })));
        }
      } finally {
        o.signal?.removeEventListener('abort', onAbort);
      }
      if (job.status === 'cancelled') throw cancelled();
      if (job.status !== 'done' || !job.results) throw new CalibrateClientError(job.error?.message ?? 'The test could not run.', job.error?.code ?? 'failed');
      o.onProgress?.(job.progress.total, job.progress.total);
      const id = job.id;
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
