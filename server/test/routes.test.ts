import { afterEach, describe, expect, it } from 'vitest';
import { AuthorDraftResponse, AuthorTurnResponse, Brief } from '../../src/api/author';
import salesElevator from '../../src/engine/storylines/sales-elevator.json';
import halden from '../../src/theme/samples/halden.json';
import { loadConfig } from '../src/config';
import { ADMIN_TOKEN, playToEnd, testServer, type TestServer } from './helpers';

let s: TestServer;
afterEach(async () => { await s?.close(); s = undefined as unknown as TestServer; });

describe('the app API', () => {
  it('serves the profile, scenario, settings and theme', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1', name: 'Jordan Lee', cohort: 'c-1', theme: 'halden' });
    expect(await s.json('/api/profile', { cookie })).toEqual({ name: 'Jordan Lee', cohort: 'c-1' });
    expect(await s.json<{ members: unknown[] }>('/api/scenario', { cookie })).toHaveProperty('members');
    expect((await s.req('/api/session', { cookie })).status).toBe(404);
    const settings = { text: 125, captions: true, reduced: false, input: 'text', clock: true, voiceConsent: false };
    expect((await s.req('/api/session/settings', { method: 'PUT', cookie, json: settings })).status).toBe(204);
    expect(await s.json('/api/session', { cookie })).toMatchObject({ settings });
    // No theme stored yet: none (the iLead theme).
    expect((await s.req('/api/theme', { cookie })).status).toBe(404);
    const author = await s.launch({ sub: 'au', roles: ['author'] });
    expect((await s.req('/api/admin/themes/halden', { method: 'PUT', cookie: author, json: halden })).status).toBe(204);
    expect((await s.req('/api/admin/themes/bad', { method: 'PUT', cookie: author, json: { version: 2 } })).status).toBe(400);
    const { $description: _d, ...stored } = halden;
    expect(await s.json('/api/theme', { cookie })).toEqual(stored);
    // The cohort's theme applies when the launch names none.
    const admin = await s.launch({ sub: 'adm', roles: ['cohort_admin'], cohorts: ['c-2'] });
    await s.json('/api/admin/cohorts/c-2', { method: 'PUT', cookie: admin, json: { name: 'Cohort two', themeId: 'halden' } });
    const other = await s.launch({ sub: 'p-2', cohort: 'c-2' });
    expect(await s.json('/api/theme', { cookie: other })).toEqual(stored);
    expect(await s.json('/api/profile', { cookie: other })).toEqual({ name: null, cohort: 'Cohort two' });
    // The prototype board's writes are not served.
    expect((await s.req('/api/weeks/1/end', { method: 'POST', cookie })).status).toBe(501);
  });

  it('has no leaderboard in an assessment', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1', purpose: 'assessment' });
    await s.json('/engine/sessions/p-1/view', { cookie });
    expect((await s.req('/api/cohort/leaderboard', { method: 'POST', cookie, json: { size: 5, anonymous: true, you: { score: 1, conversions: 1, capability: 1 } } })).status).toBe(403);
  });
});

describe('author chat and storylines', () => {
  it('asks the next question and drafts a storyline, saved as a draft version', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'au', roles: ['author'] });
    const turn = AuthorTurnResponse.parse(await s.json('/genie/author/turn', { method: 'POST', cookie, json: { brief: {}, asked: [], answers: {} } }));
    expect(turn.kind).toBe('question');
    // A lens module as the author chat locks it.
    const brief = Brief.parse({ roleLevel: 'first_line', industry: 'Retail', challenge: 'coaching', client: null, teamSize: 8, process: ['Lead', 'Pitch', 'Close'], duration: 'standard', region: 'global', language: 'en', framework: null, tone: 'warm' });
    const lens = { library_version: 1, primary: { id: 'readiness_based', title: 'Readiness Based Leadership', npc_design: '', event_design: '', action_classification: [], scoring_dimensions: [] }, secondary: null,
      client_model: { used: false, source_document: '', confirmed_dimensions: [] }, context: { industry: 'Retail', role_level: 'first_line', team_size: '8', business_challenge: 'coaching', client_name: '' }, locked: true };
    const res = await s.req('/genie/author/draft', { method: 'POST', cookie, json: { brief, leadership_lens: lens } });
    expect(res.status).toBe(200);
    const draft = AuthorDraftResponse.parse(await res.json());
    const version = res.headers.get('x-storyline-version');
    expect(version).toMatch(/@1$/);
    const stored = await s.json<Array<{ id: string; status: string }>>('/api/admin/storylines', { cookie });
    expect(stored).toEqual([expect.objectContaining({ id: (draft.storyline as { id: string }).id, status: 'draft' })]);
  });

  it('publishes a storyline after the schema and copy checks; new runs play it', async () => {
    s = await testServer();
    const author = await s.launch({ sub: 'au', roles: ['author'] });
    const published = { ...structuredClone(salesElevator), id: 'retail_elevator', name: 'Retail Elevator' };
    const r = await s.json<{ version: number }>('/api/admin/storylines', { method: 'POST', cookie: author, json: { status: 'published', config: published } });
    expect(r.version).toBe(1);
    expect((await s.req('/api/admin/storylines', { method: 'POST', cookie: author, json: { status: 'published', config: { id: 'x' } } })).status).toBe(400);
    const dashed = { ...published, name: 'Retail — Elevator' };
    const refused = await s.req('/api/admin/storylines', { method: 'POST', cookie: author, json: { status: 'published', config: dashed } });
    expect(refused.status).toBe(400);
    expect(JSON.stringify(await refused.json())).toMatch(/em_dash/);
    const p = await s.launch({ sub: 'p-1', storyline: 'retail_elevator' });
    expect((await s.json<{ storyline: { name: string } }>('/engine/sessions/p-1/view', { cookie: p })).storyline.name).toBe('Retail Elevator');
    expect((await s.json<{ storyline: { id: string; version: number } }>('/engine/sessions/p-1/run', { cookie: p })).storyline).toEqual({ id: 'retail_elevator', version: 1 });
  });
});

describe('speech', () => {
  it('runs the chunked transcription contract', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1' });
    const other = await s.launch({ sub: 'p-2' });
    expect((await s.req('/speech/transcriptions', { method: 'POST', cookie, json: { mimeType: 'text/html', mode: 'pushToTalk' } })).status).toBe(400);
    const created = await s.req('/speech/transcriptions', { method: 'POST', cookie, json: { mimeType: 'audio/webm;codecs=opus', mode: 'pushToTalk', language: 'en-US' } });
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    const chunk = (seq: number, who = cookie) => s.req(`/speech/transcriptions/${id}/chunks?seq=${seq}`, { method: 'POST', cookie: who, body: new Uint8Array(100), headers: { 'content-type': 'audio/webm' } });
    expect(await (await chunk(0)).json()).toEqual({ results: [{ kind: 'partial', text: 'Thanks for' }] });
    expect(await (await chunk(0)).json()).toEqual({ results: [] });
    expect((await chunk(2)).status).toBe(409);
    expect((await chunk(1, other)).status).toBe(403);
    expect(await (await chunk(1)).json()).toEqual({ results: [{ kind: 'partial', text: 'Thanks for making time.' }] });
    const end = await s.json<{ results: Array<{ kind: string; text: string }> }>(`/speech/transcriptions/${id}/end`, { method: 'POST', cookie });
    expect(end.results).toEqual([{ kind: 'final', text: expect.stringMatching(/^Thanks for making time\. .* by Friday\.$/) }]);
    expect((await chunk(2)).status).toBe(404);
    const second = await s.json<{ id: string }>('/speech/transcriptions', { method: 'POST', cookie, json: { mimeType: 'audio/webm', mode: 'openMic' } });
    expect((await s.req(`/speech/transcriptions/${second.id}`, { method: 'DELETE', cookie })).status).toBe(204);
  });

  it('answers 501 when speech is off', async () => {
    s = await testServer({ ai: { ...(await import('../src/ports')).mockPorts(), transcriber: null } });
    const cookie = await s.launch({ sub: 'p-1' });
    expect((await s.req('/speech/transcriptions', { method: 'POST', cookie, json: { mimeType: 'audio/webm', mode: 'pushToTalk' } })).status).toBe(501);
  });
});

describe('privacy', () => {
  it('exports and deletes a participant\'s data, by themselves or by staff', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1', cohort: 'c-1', name: 'Ana' });
    await playToEnd(s, cookie, 'p-1');
    const data = await s.json<{ participant: { id: string }; runs: Array<{ events: unknown[] }> }>('/api/privacy/export', { cookie });
    expect(data.participant.id).toBe('p-1');
    expect(data.runs[0].events.length).toBeGreaterThan(10);
    expect((await s.req('/api/privacy/me', { method: 'DELETE', cookie })).status).toBe(204);
    expect((await s.req('/api/profile', { cookie })).status).toBe(401);
    expect(await s.ctx.repo.getParticipant('p-1')).toBeNull();
    expect(await s.ctx.repo.listRuns('p-1')).toEqual([]);

    const p2 = await s.launch({ sub: 'p-2', cohort: 'c-1' });
    await s.json('/engine/sessions/p-2/view', { cookie: p2 });
    const outsider = await s.launch({ sub: 'adm-x', roles: ['cohort_admin'], cohorts: ['c-9'] });
    expect((await s.req('/api/admin/participants/p-2', { method: 'DELETE', cookie: outsider })).status).toBe(403);
    const admin = await s.launch({ sub: 'adm', roles: ['cohort_admin'], cohorts: ['c-1'] });
    expect((await s.json<{ runs: unknown[] }>('/api/admin/participants/p-2/export', { cookie: admin })).runs).toHaveLength(1);
    expect((await s.req('/api/admin/participants/p-2', { method: 'DELETE', cookie: admin })).status).toBe(204);
    expect((await s.req('/api/admin/participants/p-2', { method: 'DELETE', cookie: admin })).status).toBe(404);
    expect((await s.req('/api/admin/retention/run', { method: 'POST', headers: { authorization: `Bearer ${ADMIN_TOKEN}` } })).status).toBe(200);
  });
});

describe('operations', () => {
  it('answers health and readiness, and serves an OpenAPI document of every route', async () => {
    s = await testServer();
    expect(await s.json('/healthz')).toMatchObject({ status: 'ok' });
    expect(await s.json('/readyz')).toMatchObject({ status: 'ok', checks: { database: 'ok', ai: 'mock' } });
    const doc = await s.json<{ openapi: string; paths: Record<string, Record<string, { responses: object; requestBody?: object; security: unknown[] }>>; components: { schemas: Record<string, unknown> } }>('/openapi.json');
    expect(doc.openapi).toBe('3.1.0');
    for (const d of s.ctx.routes.defs) expect(doc.paths[d.path]?.[d.method], `${d.method} ${d.path}`).toBeDefined();
    for (const p of ['/engine/sessions/{session}/intents', '/api/cohort/{id}/report', '/api/report.pdf', '/genie/author/draft', '/speech/transcriptions', '/launch']) expect(doc.paths[p]).toBeDefined();
    expect(Object.keys(doc.components.schemas)).toEqual(expect.arrayContaining(['EngineView', 'Intent', 'IntentResult', 'GroupReport', 'AuthorTurnRequest', 'ThemeConfig']));
    expect(doc.paths['/engine/sessions/{session}/intents'].post.requestBody).toMatchObject({ content: { 'application/json': { schema: { $ref: '#/components/schemas/Intent' } } } });
    expect(doc.paths['/healthz'].get.security).toEqual([]);
    expect((await s.req('/nope')).status).toBe(404);
  });

  it('readiness fails when the database is gone', async () => {
    s = await testServer();
    await s.ctx.repo.close();
    expect((await s.req('/readyz')).status).toBe(503);
  });

  it('reads its configuration from the environment and refuses bad values', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/LAUNCH_SECRET/);
    expect(() => loadConfig({ LAUNCH_SECRET: 'short' })).toThrow(/LAUNCH_SECRET must be at least 32/);
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    const c = loadConfig({ NODE_ENV: 'production', LAUNCH_SECRET: 'x'.repeat(32), CORS_ORIGINS: 'https://a.example.com, https://b.example.com', SMTP_URL: '', APP_URL: '' });
    expect(c.COOKIE_SECURE).toBe(true);
    expect(c.CORS_ORIGINS).toEqual(['https://a.example.com', 'https://b.example.com']);
    expect(c.SMTP_URL).toBeUndefined();
    expect(c.appUrl).toBe('http://localhost:8787');
    expect(loadConfig({}).COOKIE_SECURE).toBe(false);
  });
});
