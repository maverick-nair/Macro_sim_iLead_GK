import { newDb } from 'pg-mem';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { ConflictError, type Db } from '../src/store/db';
import { migrate } from '../src/store/migrations';
import { numbered, openPostgres, postgresDb } from '../src/store/postgres';
import { SqlRepository } from '../src/store/repo';
import { openSqlite } from '../src/store/sqlite';

/**
 * The repository contract, run against both stores: SQLite (node:sqlite, in memory) and Postgres (the
 * real adapter over pg-mem, an in memory Postgres). The SQL is shared, so this is what keeps it portable.
 * pg-mem ignores ROLLBACK, so the assertions that need one run on SQLite, and on a real Postgres when
 * `TEST_DATABASE_URL` names one (its public schema is wiped for each test: use a throwaway database).
 */
type Store = [string, () => Promise<Db>, { rollback: boolean }];
const stores: Store[] = [
  ['sqlite', () => openSqlite(':memory:'), { rollback: true }],
  ['pg-mem', async () => {
    const mem = newDb();
    const { Pool: MemPool } = mem.adapters.createPg();
    return postgresDb(new MemPool() as unknown as Pool);
  }, { rollback: false }]
];
if (process.env.TEST_DATABASE_URL) {
  stores.push(['postgres', async () => {
    const db = await openPostgres(process.env.TEST_DATABASE_URL!);
    await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    return db;
  }, { rollback: true }]);
}

const run = (id: string, participantId: string, attempt = 1) => ({
  id, participantId, cohortId: 'c-1', storylineId: 'sales_elevator', storylineVersion: 0, lensId: 'readiness_based', purpose: 'development' as const,
  config: { id: 'sales_elevator', name: 'Sales Elevator' }, seed: 3_000_000_000, attempt, engineVersion: 'test'
});

describe.each(stores)('repository on %s', (_name, open, { rollback }) => {
  async function repo() {
    const db = await open();
    expect(await migrate(db)).toEqual([1]);
    expect(await migrate(db)).toEqual([]);
    return new SqlRepository(db);
  }

  it('stores participants, cohorts, themes and settings', async () => {
    const r = await repo();
    await r.upsertParticipant({ id: 'p-1', name: 'Jordan', email: 'j@example.com', cohortId: 'c-1' });
    await r.upsertParticipant({ id: 'p-1', name: null, locale: 'en-GB' });
    expect(await r.getParticipant('p-1')).toMatchObject({ name: 'Jordan', email: 'j@example.com', cohortId: 'c-1', locale: 'en-GB' });
    await r.saveSettings('p-1', { text: 125 });
    expect((await r.getParticipant('p-1'))!.settings).toEqual({ text: 125 });
    await r.upsertCohort({ id: 'c-1', name: 'Spring', purpose: 'assessment' });
    await r.upsertCohort({ id: 'c-1', name: 'Spring 2026' });
    expect(await r.getCohort('c-1')).toMatchObject({ name: 'Spring 2026', purpose: 'assessment' });
    await r.putTheme('halden', { version: 1, name: 'Halden' });
    expect(await r.getTheme('halden')).toEqual({ version: 1, name: 'Halden' });
    expect(await r.getTheme('none')).toBeNull();
  });

  it('versions storylines: drafts and published', async () => {
    const r = await repo();
    const a = await r.saveStoryline({ id: 's', status: 'published', name: 'S1', config: { v: 1 } });
    const b = await r.saveStoryline({ id: 's', status: 'draft', name: 'S2', config: { v: 2 } });
    expect([a.version, b.version]).toEqual([1, 2]);
    expect((await r.getStoryline('s'))!.config).toEqual({ v: 1 });
    expect((await r.getStoryline('s', 2))!.status).toBe('draft');
    expect(await r.listStorylines()).toHaveLength(2);
  });

  it('appends events in order and refuses a second writer', async () => {
    const r = await repo();
    await r.upsertParticipant({ id: 'p-1' });
    const created = await r.createRun(run('r-1', 'p-1'));
    expect(created).toMatchObject({ seed: 3_000_000_000, status: 'active', eventCount: 0 });
    await r.appendEvent('r-1', { seq: 1, kind: 'intent', payload: { type: 'endPeriod' }, ai: [{ k: 'npc', out: { text: 'Hi' } }] }, { scoreTotal: 12.5, status: 'active' });
    await expect(r.appendEvent('r-1', { seq: 1, kind: 'intent', payload: {}, ai: [] }, {})).rejects.toBeInstanceOf(ConflictError);
    if (rollback) await expect(r.appendEvent('r-1', { seq: 3, kind: 'intent', payload: {}, ai: [] }, {})).rejects.toBeInstanceOf(ConflictError);
    await r.appendEvent('r-1', { seq: 2, kind: 'review', payload: { recordId: 'r1' }, ai: [] }, { status: 'ended', endedAt: '2026-10-07T00:00:00.000Z', headline: 'Proficient' }, { lensId: 'readiness_based', summary: { completion: 100 } });
    expect((await r.listEvents('r-1')).map(e => [e.seq, e.kind])).toEqual([[1, 'intent'], [2, 'review']]);
    expect((await r.listEvents('r-1'))[0].ai).toEqual([{ k: 'npc', out: { text: 'Hi' } }]);
    expect(await r.getRun('r-1')).toMatchObject({ eventCount: 2, status: 'ended', scoreTotal: 12.5, headline: 'Proficient' });
    expect(await r.getSummary('r-1')).toEqual({ completion: 100 });
    expect(await r.listSummaries('readiness_based')).toEqual([{ completion: 100 }]);
    expect(await r.lensIds()).toEqual(['readiness_based']);
  });

  it('lists a cohort\'s runs with names and summaries, and caches PDFs', async () => {
    const r = await repo();
    await r.upsertParticipant({ id: 'p-1', name: 'Ana' });
    await r.createRun(run('r-1', 'p-1'));
    await r.putSummary('r-1', 'readiness_based', { x: 1 });
    expect(await r.listCohortRuns('c-1')).toEqual([expect.objectContaining({ id: 'r-1', name: 'Ana', summary: { x: 1 } })]);
    await r.putPdf('r-1', '5', new Uint8Array([37, 80, 68, 70]));
    expect((await r.getPdf('r-1', '5'))!.toString()).toBe('%PDF');
    expect(await r.getPdf('r-1', '6')).toBeNull();
    await r.putBenchmark('lens:x', { a: 1 }, 30);
    expect(await r.getBenchmark('lens:x')).toMatchObject({ summary: { a: 1 }, runs: 30 });
  });

  it('deletes a participant and everything about them; retention purges old runs and sessions', async () => {
    const r = await repo();
    await r.upsertParticipant({ id: 'p-1' });
    await r.upsertParticipant({ id: 'p-2' });
    await r.createRun(run('r-1', 'p-1'));
    await r.createRun(run('r-2', 'p-2'));
    await r.appendEvent('r-1', { seq: 1, kind: 'intent', payload: {}, ai: [] }, {});
    await r.putPdf('r-1', '1', new Uint8Array([1]));
    await r.addReview({ runId: 'r-1', recordId: 'r1', band: 'weak', reviewerId: 'a' });
    await r.logEmail({ participantId: 'p-1', runId: 'r-1', to: 'x@example.com', template: 't', status: 'sent', messageId: 'm', error: null });
    await r.createSession({ id: 's-1', participantId: 'p-1', claims: {}, expiresAt: '2999-01-01T00:00:00.000Z' });
    await r.createSession({ id: 's-old', participantId: null, claims: {}, expiresAt: '2000-01-01T00:00:00.000Z' });
    expect((await r.exportParticipant('p-1'))!.runs).toHaveLength(1);
    expect(await r.countEmails('p-1', '2000-01-01')).toBe(1);
    expect(await r.deleteParticipant('p-1')).toBe(true);
    expect(await r.getParticipant('p-1')).toBeNull();
    expect(await r.getRun('r-1')).toBeNull();
    expect(await r.listEvents('r-1')).toEqual([]);
    expect(await r.getPdf('r-1', '1')).toBeNull();
    expect(await r.getSession('s-1')).toBeNull();
    expect(await r.countEmails('p-1', '2000-01-01')).toBe(0);
    expect(await r.getRun('r-2')).not.toBeNull();
    expect(await r.purge(new Date(Date.now() + 1000).toISOString())).toEqual({ sessions: 1, runs: 1 });
    expect(await r.getRun('r-2')).toBeNull();
  });

  it.runIf(rollback)('rolls a transaction back on failure', async () => {
    const r = await repo();
    await expect(r.db.tx(async db => {
      await db.run('INSERT INTO themes (id, config, updated_at) VALUES (?, ?, ?)', ['t', '{}', 'now']);
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(await r.getTheme('t')).toBeNull();
  });
});

it('numbers placeholders for Postgres', () => {
  expect(numbered('SELECT ? , ?, ?')).toBe('SELECT $1 , $2, $3');
});
