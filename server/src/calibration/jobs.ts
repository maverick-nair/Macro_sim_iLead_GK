import { createHash, randomUUID } from 'node:crypto';
import { CalibrationError, parseDraft, runCalibration } from '../../../src/author/calibrate/logic/run';
import { CalibrationSettings, type CalibrationJob, type CalibrationResults, type Playthrough, type PersonaKey } from '../../../src/author/calibrate/logic/schema';
import { HttpError } from '../http/errors';
import type { Logger } from '../log';
import type { AiPorts } from '../ports';

/**
 * Synthetic player calibrations on the server (D115): jobs run in this process, `concurrency` at a time,
 * with up to `queue` waiting (more answer 503 `busy`). Each job plays the draft with the server's NPC model
 * and evaluator, and, with AI configured, the `ai/` module's synthetic players, so the scoring pipeline the
 * participants will meet is what is tested. Jobs live in memory: finished ones are kept for `keepMs` (the
 * newest `keep` of them), and a restart forgets them (the author runs the test again).
 *
 * `Idempotency-Key`: the same caller and key answer the job already started, so a retried POST never
 * starts a second calibration; the same key with a different body is 422 `idempotencyMismatch`.
 */

interface Job {
  id: string;
  owner: string;
  key: string | null;
  bodyHash: string;
  status: CalibrationJob['status'];
  progress: { done: number; total: number };
  results: CalibrationResults | null;
  playthroughs: Playthrough[];
  error: { code: string; message: string } | null;
  createdAt: number;
  finishedAt: number | null;
  controller: AbortController;
  draft: Record<string, unknown>;
  settings: CalibrationSettings;
}

export interface JobOptions { concurrency: number; queue: number; keep?: number; keepMs?: number }

export class CalibrationJobs {
  private readonly jobs = new Map<string, Job>();
  private readonly keys = new Map<string, string>();
  private readonly waiting: Job[] = [];
  private running = 0;

  constructor(private readonly ai: AiPorts, private readonly log: Logger, private readonly opts: JobOptions) {}

  /** Starts a calibration, or answers the one this caller already started with the same key. */
  start(owner: string, body: { storyline: Record<string, unknown> } & Record<string, unknown>, key?: string): { job: CalibrationJob; created: boolean } {
    this.prune();
    const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    if (key) {
      const known = this.jobs.get(this.keys.get(`${owner}\n${key}`) ?? '');
      if (known) {
        if (known.bodyHash !== bodyHash) throw new HttpError(422, 'idempotencyMismatch', 'This Idempotency-Key was used for a different calibration.');
        return { job: this.view(known), created: false };
      }
    }
    const { storyline, ...rest } = body;
    const settings = CalibrationSettings.safeParse(rest);
    if (!settings.success) throw new HttpError(400, 'badSettings', 'These settings cannot run.', { issues: settings.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
    try {
      parseDraft(storyline);
    } catch (e) {
      if (e instanceof CalibrationError) throw new HttpError(400, 'badStoryline', e.message, { issues: e.issues });
      throw e;
    }
    if (this.waiting.length >= this.opts.queue) throw new HttpError(503, 'busy', 'Too many calibrations are waiting. Try again in a few minutes.');
    const job: Job = {
      id: randomUUID(), owner, key: key ?? null, bodyHash, status: 'queued', progress: { done: 0, total: 0 }, results: null, playthroughs: [], error: null,
      createdAt: Date.now(), finishedAt: null, controller: new AbortController(), draft: storyline, settings: settings.data
    };
    this.jobs.set(job.id, job);
    if (key) this.keys.set(`${owner}\n${key}`, job.id);
    this.waiting.push(job);
    this.pump();
    return { job: this.view(job), created: true };
  }

  get(owner: string, id: string): CalibrationJob {
    return this.view(this.mine(owner, id));
  }

  playthrough(owner: string, id: string, persona: PersonaKey, index: number): Playthrough {
    const job = this.mine(owner, id);
    if (job.status !== 'done') throw new HttpError(409, 'notReady', 'The calibration has not finished.');
    const p = job.playthroughs.find(x => x.persona === persona && x.index === index);
    if (!p) throw new HttpError(404, 'notFound', 'No such playthrough.');
    return p;
  }

  cancel(owner: string, id: string) {
    const job = this.mine(owner, id);
    if (job.status === 'queued' || job.status === 'running') {
      job.controller.abort();
      const i = this.waiting.indexOf(job);
      if (i >= 0) { this.waiting.splice(i, 1); this.finish(job, 'cancelled'); }
    }
  }

  /** Stops every job (the server is closing). */
  close() {
    for (const j of this.jobs.values()) j.controller.abort();
    this.waiting.length = 0;
  }

  get stats() { return { running: this.running, waiting: this.waiting.length, kept: this.jobs.size }; }

  private mine(owner: string, id: string): Job {
    const job = this.jobs.get(id);
    if (!job || job.owner !== owner) throw new HttpError(404, 'notFound', 'No such calibration.');
    return job;
  }

  private view(j: Job): CalibrationJob {
    return { id: j.id, status: j.status, progress: { ...j.progress }, results: j.results, error: j.error, createdAt: new Date(j.createdAt).toISOString(), finishedAt: j.finishedAt ? new Date(j.finishedAt).toISOString() : null };
  }

  private finish(j: Job, status: CalibrationJob['status']) {
    j.status = status;
    j.finishedAt = Date.now();
  }

  private pump() {
    while (this.running < Math.max(1, this.opts.concurrency) && this.waiting.length) {
      const job = this.waiting.shift()!;
      this.running++;
      void this.run(job).finally(() => { this.running--; this.pump(); });
    }
  }

  private async run(job: Job) {
    job.status = 'running';
    const started = Date.now();
    try {
      const out = await runCalibration(job.draft, job.settings, {
        speaker: this.ai.synthetic, evaluator: this.ai.evaluator, npc: this.ai.npc, signal: job.controller.signal, ranOn: 'server',
        onProgress: (done, total) => { job.progress = { done, total }; },
        // Each playthrough gives the event loop back, so other requests are served while a calibration runs.
        yieldEvery: () => new Promise(r => setImmediate(r))
      });
      job.results = out.results;
      job.playthroughs = out.playthroughs;
      this.finish(job, 'done');
      this.log.info('calibration done', { job: job.id, runs: out.results.runs.length, probes: out.results.probes.length, ms: Date.now() - started, failed: out.results.checks.filter(c => c.status === 'fail').map(c => c.key) });
    } catch (e) {
      if (e instanceof CalibrationError && e.code === 'cancelled') { this.finish(job, 'cancelled'); return; }
      job.error = { code: e instanceof CalibrationError ? e.code : 'failed', message: e instanceof CalibrationError ? e.message : 'The calibration failed. Try again.' };
      this.finish(job, 'failed');
      this.log.error('calibration failed', { job: job.id, err: e });
    } finally {
      // The draft is not needed once played.
      job.draft = {};
    }
  }

  private prune() {
    const keepMs = this.opts.keepMs ?? 3600_000;
    const done = [...this.jobs.values()].filter(j => j.finishedAt !== null).sort((a, b) => b.finishedAt! - a.finishedAt!);
    done.forEach((j, i) => {
      if (i >= (this.opts.keep ?? 50) || Date.now() - j.finishedAt! > keepMs) {
        this.jobs.delete(j.id);
        if (j.key) this.keys.delete(`${j.owner}\n${j.key}`);
      }
    });
  }
}
