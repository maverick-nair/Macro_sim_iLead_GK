import { afterEach, describe, expect, it } from 'vitest';
import salesElevator from '../../src/engine/storylines/sales-elevator.json';
import { CalibrationJob, Playthrough } from '../../src/author/calibrate/logic/schema';
import { templateSpeaker, type SpeakerContext } from '../../src/engine/sim/syntheticSpeech';
import { CalibrationJobs } from '../src/calibration/jobs';
import { createLogger } from '../src/log';
import { mockPorts } from '../src/ports';
import { testServer, type TestServer } from './helpers';

let s: TestServer;
afterEach(async () => { await s?.close(); s = undefined as unknown as TestServer; });

const small = { storyline: salesElevator, personas: { beginner: 1, developing: 1, proficient: 1, expert: 1 }, seed: 4, probes: false };

async function until(cookie: string, id: string, ms = 30_000): Promise<CalibrationJob> {
  const end = Date.now() + ms;
  for (;;) {
    const job = CalibrationJob.parse(await s.json(`/genie/calibrations/${id}`, { cookie }));
    if (job.status !== 'queued' && job.status !== 'running') return job;
    if (Date.now() > end) throw new Error(`still ${job.status}`);
    await new Promise(r => setTimeout(r, 20));
  }
}

describe('synthetic player calibrations', () => {
  it('start a job, report progress, and give results and playthroughs', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'au', roles: ['author'] });
    const res = await s.req('/genie/calibrations', { method: 'POST', cookie, json: small });
    expect(res.status).toBe(202);
    const started = CalibrationJob.parse(await res.json());
    expect(res.headers.get('location')).toBe(`/genie/calibrations/${started.id}`);
    expect(['queued', 'running']).toContain(started.status);
    const job = await until(cookie, started.id);
    expect(job.status).toBe('done');
    expect(job.progress).toEqual({ done: 4, total: 4 });
    expect(job.results?.ranOn).toBe('server');
    expect(job.results?.personas.map(p => p.persona)).toEqual(['beginner', 'developing', 'proficient', 'expert']);
    expect(job.results?.checks.find(c => c.key === 'ordered')?.status).toBe('pass');
    const p = Playthrough.parse(await s.json(`/genie/calibrations/${started.id}/playthroughs/expert/0`, { cookie }));
    expect(p.persona).toBe('expert');
    expect(p.conversations.length).toBeGreaterThan(0);
    expect((await s.req(`/genie/calibrations/${started.id}/playthroughs/expert/3`, { cookie })).status).toBe(404);
    expect((await s.req(`/genie/calibrations/${started.id}/playthroughs/nobody/0`, { cookie })).status).toBe(400);
  });

  it('answer a repeated Idempotency-Key with the same job, and refuse the key for another body', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'au', roles: ['author'] });
    const headers = { 'idempotency-key': 'calibrate-1' };
    const a = await s.req('/genie/calibrations', { method: 'POST', cookie, headers, json: small });
    const b = await s.req('/genie/calibrations', { method: 'POST', cookie, headers, json: small });
    expect([a.status, b.status]).toEqual([202, 200]);
    const [ja, jb] = [CalibrationJob.parse(await a.json()), CalibrationJob.parse(await b.json())];
    expect(jb.id).toBe(ja.id);
    const c = await s.req('/genie/calibrations', { method: 'POST', cookie, headers, json: { ...small, seed: 5 } });
    expect(c.status).toBe(422);
    expect(await c.json()).toMatchObject({ code: 'idempotencyMismatch' });
    expect((await s.req('/genie/calibrations', { method: 'POST', cookie, headers: { 'idempotency-key': 'x'.repeat(201) }, json: small })).status).toBe(400);
    // Another author's key is their own, and they cannot read this job.
    const other = await s.launch({ sub: 'au-2', roles: ['author'] });
    const d = await s.req('/genie/calibrations', { method: 'POST', cookie: other, headers, json: small });
    expect(d.status).toBe(202);
    expect((await s.req(`/genie/calibrations/${ja.id}`, { cookie: other })).status).toBe(404);
    await until(cookie, ja.id);
  });

  it('refuse a draft that does not play, bad settings, and callers who are not authors', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'au', roles: ['author'] });
    const bad = await s.req('/genie/calibrations', { method: 'POST', cookie, json: { ...small, storyline: { ...salesElevator, members: [] } } });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ code: 'badStoryline', issues: expect.arrayContaining([expect.stringMatching(/^members/)]) });
    expect((await s.req('/genie/calibrations', { method: 'POST', cookie, json: { ...small, personas: { expert: 40 } } })).status).toBe(400);
    expect((await s.req('/genie/calibrations', { method: 'POST', cookie, json: { personas: {} } })).status).toBe(400);
    const participant = await s.launch({ sub: 'p-1' });
    expect((await s.req('/genie/calibrations', { method: 'POST', cookie: participant, json: small })).status).toBe(403);
    expect((await s.req('/genie/calibrations', { method: 'POST', json: small })).status).toBe(401);
  });

  it('run in process with a concurrency limit and a queue, and cancel', async () => {
    s = await testServer({ env: { CALIBRATION_CONCURRENCY: '1', CALIBRATION_QUEUE: '1' } });
    const cookie = await s.launch({ sub: 'au', roles: ['author'] });
    const big = { ...small, personas: { expert: 6 } };
    const first = CalibrationJob.parse(await s.json('/genie/calibrations', { method: 'POST', cookie, json: big }));
    const second = CalibrationJob.parse(await s.json('/genie/calibrations', { method: 'POST', cookie, json: { ...big, seed: 9 } }));
    expect(second.status).toBe('queued');
    const third = await s.req('/genie/calibrations', { method: 'POST', cookie, json: { ...big, seed: 10 } });
    expect(third.status).toBe(503);
    expect(await third.json()).toMatchObject({ code: 'busy' });
    expect(s.ctx.routes.defs.some(d => d.path === '/genie/calibrations')).toBe(true);
    expect((await s.req(`/genie/calibrations/${second.id}`, { method: 'DELETE', cookie })).status).toBe(204);
    expect((await until(cookie, second.id)).status).toBe('cancelled');
    expect((await until(cookie, first.id)).status).toBe('done');
    expect((await s.req(`/genie/calibrations/${second.id}/playthroughs/expert/0`, { cookie })).status).toBe(409);
  });

  it('play with the AI players when the ai module gives them, scored by the server\'s evaluator', async () => {
    const said: SpeakerContext[] = [];
    let evaluations = 0;
    const ai = mockPorts();
    const evaluate = ai.evaluator.evaluate.bind(ai.evaluator);
    s = await testServer({ ai: { ...ai, evaluator: { ...ai.evaluator, evaluate: i => { evaluations++; return evaluate(i); } }, synthetic: { say: ctx => { said.push(ctx); return templateSpeaker.say(ctx); } } } });
    const cookie = await s.launch({ sub: 'au', roles: ['author'] });
    const job = CalibrationJob.parse(await s.json('/genie/calibrations', { method: 'POST', cookie, json: { ...small, personas: { expert: 1 }, describe: { expert: 'Warm and direct.' } } }));
    const done = await until(cookie, job.id);
    expect(done.results?.players).toBe('ai');
    expect(said.length).toBeGreaterThan(5);
    expect(said[0].describe).toBe('Warm and direct.');
    expect(evaluations).toBeGreaterThan(5);
  });

  it('are in the OpenAPI document', async () => {
    s = await testServer();
    const doc = await s.json<{ paths: Record<string, Record<string, { responses: Record<string, unknown>; requestBody?: unknown }>>; components: { schemas: Record<string, unknown> } }>('/openapi.json');
    expect(doc.paths['/genie/calibrations'].post.requestBody).toMatchObject({ content: { 'application/json': { schema: { $ref: '#/components/schemas/CalibrationRequest' } } } });
    expect(Object.keys(doc.paths['/genie/calibrations'].post.responses)).toEqual(expect.arrayContaining(['200', '202', '400', '422', '503']));
    expect(doc.paths['/genie/calibrations/{id}'].get).toBeDefined();
    expect(doc.paths['/genie/calibrations/{id}'].delete).toBeDefined();
    expect(doc.paths['/genie/calibrations/{id}/playthroughs/{persona}/{index}'].get).toBeDefined();
    expect(Object.keys(doc.components.schemas)).toEqual(expect.arrayContaining(['CalibrationRequest', 'CalibrationJob', 'Playthrough']));
  });
});

describe('calibration limits (D120)', () => {
  const owned: CalibrationJobs[] = [];
  afterEach(() => { for (const j of owned.splice(0)) j.close(); });
  const jobsWith = (o: Partial<ConstructorParameters<typeof CalibrationJobs>[2]> = {}) => {
    const j = new CalibrationJobs(mockPorts(), createLogger('silent'), { concurrency: 1, queue: 10, ...o });
    owned.push(j);
    return j;
  };
  const settle = async (jobs: CalibrationJobs, owner: string, id: string) => {
    for (let i = 0; i < 1500; i++) {
      const j = jobs.get(owner, id);
      if (j.status !== 'queued' && j.status !== 'running') return j;
      await new Promise(r => setTimeout(r, 10));
    }
    throw new Error('still running');
  };

  it('cap each author at CALIBRATION_PER_OWNER queued or running', async () => {
    const jobs = jobsWith({ perOwner: 2 });
    const a = jobs.start('au', { ...small, personas: { expert: 3 } }).job;
    jobs.start('au', { ...small, personas: { expert: 3 }, seed: 9 });
    expect(() => jobs.start('au', { ...small, seed: 10 })).toThrow(expect.objectContaining({ status: 429, code: 'tooManyCalibrations' }));
    // Another author is not held back.
    expect(jobs.start('au-2', small).created).toBe(true);
    jobs.cancel('au', a.id);
    await settle(jobs, 'au', a.id);
    expect(jobs.start('au', { ...small, seed: 10 }).created).toBe(true);
  });

  it('stop a job at its time limit as failed, and prune finished jobs on a timer', async () => {
    const jobs = jobsWith({ timeLimitMs: 30, keepMs: 0, pruneEveryMs: 20 });
    const { job } = jobs.start('au', { ...small, personas: { expert: 25 } });
    const done = await settle(jobs, 'au', job.id);
    expect(done.status).toBe('failed');
    expect(done.error).toMatchObject({ code: 'timeLimit' });
    await new Promise(r => setTimeout(r, 80));
    expect(() => jobs.get('au', job.id)).toThrow(expect.objectContaining({ status: 404 }));
  });
});
