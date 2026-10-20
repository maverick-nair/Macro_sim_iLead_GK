import { afterEach, describe, expect, it } from 'vitest';
import salesElevator from '../../src/engine/storylines/sales-elevator.json';
import type { EngineView, IntentResult } from '../../src/engine/contract';
import { ADMIN_TOKEN, playToEnd, testServer, type TestServer } from './helpers';

let s: TestServer;
afterEach(async () => { await s?.close(); s = undefined as unknown as TestServer; });

const draft = () => ({ ...structuredClone(salesElevator), id: 'retail_preview', name: 'Retail Preview' }) as Record<string, unknown>;
const admin = { authorization: `Bearer ${ADMIN_TOKEN}` };

interface Created { id: string; token: string; url: string; expiresAt: string; storyline: { id: string; name: string } }

describe('previews from GenieKreator (D195)', () => {
  it('checks the draft as a version is checked, and only an author may preview', async () => {
    s = await testServer();
    const author = await s.launch({ sub: 'au', roles: ['author'] });
    const participant = await s.launch({ sub: 'p-1' });
    expect((await s.req('/genie/author/preview', { method: 'POST', cookie: participant, json: { config: draft() } })).status).toBe(403);
    expect((await s.req('/genie/author/preview', { method: 'POST', json: { config: draft() } })).status).toBe(401);
    expect((await s.req('/genie/author/preview', { method: 'POST', cookie: author, json: { config: { id: 'x' } } })).status).toBe(400);
    const dashed = await s.req('/genie/author/preview', { method: 'POST', cookie: author, json: { config: { ...draft(), name: 'Retail \u2014 Preview' } } });
    expect(dashed.status).toBe(400);
    expect(JSON.stringify(await dashed.json())).toMatch(/em_dash/);
    expect((await s.req('/genie/author/preview', { method: 'POST', cookie: author, json: { config: draft(), target: 'nowhere' } })).status).toBe(400);

    const res = await s.req('/genie/author/preview', { method: 'POST', cookie: author, json: { config: draft(), draftVersion: 2, savedAt: '2026-10-08T10:00:00.000Z' } });
    expect(res.status).toBe(201);
    const p = (await res.json()) as Created;
    expect(p.token).toBe(p.id);
    expect(p.url).toContain('preview=1');
    expect(p.url).toContain(`previewId=${p.id}`);
    expect(p.storyline).toEqual({ id: 'retail_preview', name: 'Retail Preview' });
    expect(Date.parse(p.expiresAt) - Date.now()).toBeGreaterThan(6.9 * 86400_000);
    // A preview is not a storyline version: the admin listing and the participant's storylines never show it.
    expect(await s.json('/api/admin/storylines', { cookie: author })).toEqual([]);
    expect((await s.req('/api/admin/storylines/retail_preview', { cookie: author })).status).toBe(404);
    // Its engine is the author's, not a participant's.
    expect((await s.req(`/genie/preview/sessions/${p.id}/view`, { cookie: participant })).status).toBe(403);
    const v = await s.json<EngineView>(`/genie/preview/sessions/${p.id}/view`, { cookie: author });
    expect(v.storyline.name).toBe('Retail Preview');
    expect(v.phase).toBe('style');
  });

  it('plays the draft, jumps to a point, restarts and takes a newer save; its runs are flagged and in no report', async () => {
    s = await testServer();
    const author = await s.launch({ sub: 'au', roles: ['author'] });
    // A real cohort with a participant who played to the end, for the reports a preview must stay out of.
    const cohortAdmin = await s.launch({ sub: 'adm', roles: ['cohort_admin'], cohorts: ['*'] });
    const real = await s.launch({ sub: 'p-1', cohort: 'c-1' });
    await playToEnd(s, real, 'p-1');

    const p = await s.json<Created>('/genie/author/preview', { method: 'POST', cookie: author, json: { config: draft(), target: 'board:2' } });
    const base = `/genie/preview/sessions/${p.id}`;
    let v = await s.json<EngineView>(`${base}/view`, { cookie: author });
    expect([v.clock.period, v.phase]).toEqual([2, 'board']);
    v = (await s.json<IntentResult>(`${base}/intents`, { method: 'POST', cookie: author, json: { type: 'endPeriod' } })).view;
    expect(v.phase).toBe('periodEnd');

    const restarted = await s.json<{ view: EngineView; run: { attempt: number } }>(`${base}/restart`, { method: 'POST', cookie: author, json: { target: 'report' } });
    expect(restarted.view.phase).toBe('ended');
    expect(restarted.view.report).not.toBeNull();
    expect(restarted.run.attempt).toBe(2);
    expect((await s.json<{ view: EngineView }>(`${base}/restart`, { method: 'POST', cookie: author, json: {} })).view.clock.period).toBe(1);

    // A newer save replaces the draft; the next run plays it.
    const renamed = { ...draft(), name: 'Retail Preview Two' };
    await s.json(`/genie/author/preview/${p.id}`, { method: 'PUT', cookie: author, json: { config: renamed, draftVersion: 2 } });
    expect((await s.json<{ view: EngineView }>(`${base}/restart`, { method: 'POST', cookie: author, json: {} })).view.storyline.name).toBe('Retail Preview Two');
    expect((await s.req(`/genie/author/preview/nope`, { method: 'PUT', cookie: author, json: { config: renamed } })).status).toBe(404);

    // The store: every preview run is flagged, keeps no summary, and sits in no cohort.
    const runs = await s.ctx.repo.listRuns(`preview.${p.id}`);
    expect(runs.length).toBe(4);
    expect(runs.every(r => r.preview && r.cohortId === null && r.storylineId === `preview:${p.id}`)).toBe(true);
    for (const r of runs) expect(await s.ctx.repo.getSummary(r.id)).toBeNull();
    expect((await s.ctx.repo.listRuns('p-1')).every(r => !r.preview)).toBe(true);

    // Reports read only the real run.
    expect(await s.ctx.repo.listSummaries(runs[0].lensId)).toHaveLength(1);
    expect(await s.ctx.repo.lensIds()).toEqual([runs[0].lensId]);
    const cohortRuns = await s.json<Array<{ participantId: string }>>('/api/admin/cohorts/c-1/runs', { cookie: cohortAdmin });
    expect(cohortRuns.map(r => r.participantId)).toEqual(['p-1']);
    const bench = await s.json<Array<{ lens: string; runs: number }>>('/api/admin/benchmarks/refresh', { method: 'POST', cookie: cohortAdmin });
    expect(bench).toEqual([expect.objectContaining({ runs: 1 })]);
    expect(await s.ctx.reports.history(`preview.${p.id}`, runs.at(-1)!)).toEqual([]);
  });

  it('expires after seven days: refused, then removed with its runs by retention', async () => {
    s = await testServer();
    const author = await s.launch({ sub: 'au', roles: ['author'] });
    const p = await s.json<Created>('/genie/author/preview', { method: 'POST', cookie: author, json: { config: draft() } });
    await s.json(`/genie/preview/sessions/${p.id}/view`, { cookie: author });
    expect(await s.ctx.repo.listRuns(`preview.${p.id}`)).toHaveLength(1);
    const row = (await s.ctx.repo.getPreview(p.id))!;
    await s.ctx.repo.updatePreview(p.id, { ...row, expiresAt: new Date(Date.now() - 1000).toISOString() });
    const gone = await s.req(`/genie/preview/sessions/${p.id}/view`, { cookie: author });
    expect(gone.status).toBe(404);
    expect(((await gone.json()) as { code: string }).code).toBe('unknownPreview');
    expect((await s.req(`/genie/preview/sessions/${p.id}/restart`, { method: 'POST', cookie: author, json: {} })).status).toBe(404);
    expect(await s.json('/api/admin/retention/run', { method: 'POST', headers: admin })).toMatchObject({ previews: 1 });
    expect(await s.ctx.repo.getPreview(p.id)).toBeNull();
    expect(await s.ctx.repo.listRuns(`preview.${p.id}`)).toEqual([]);
    expect(await s.ctx.repo.getParticipant(`preview.${p.id}`)).toBeNull();
  });

  it('is in the OpenAPI document', async () => {
    s = await testServer();
    const doc = await s.json<{ paths: Record<string, unknown> }>('/openapi.json');
    for (const path of ['/genie/author/preview', '/genie/author/preview/{id}', '/genie/preview/sessions/{session}/view', '/genie/preview/sessions/{session}/intents', '/genie/preview/sessions/{session}/restart']) expect(doc.paths).toHaveProperty([path]);
  });
});
