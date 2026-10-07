import { sign } from 'hono/jwt';
import { afterEach, describe, expect, it } from 'vitest';
import { mintLaunchToken, verifyLaunchToken } from '../src/auth/launch';
import { landing } from '../src/routes/launch';
import { ADMIN_TOKEN, SECRET, testServer, type TestServer } from './helpers';

let s: TestServer;
afterEach(async () => { await s?.close(); s = undefined as unknown as TestServer; });

describe('launch links', () => {
  it('opens an HTTP only session and lands in the app as the participant', async () => {
    s = await testServer();
    const token = await mintLaunchToken({ sub: 'p-1', name: 'Jordan Lee', cohort: 'c-1', email: 'jordan@example.com' }, SECRET);
    const res = await s.req(`/launch?token=${token}`);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/?participant=p-1');
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/ilead_session=[\w-]{40,}/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const me = await s.json<{ id: string; roles: string[] }>('/auth/me', { cookie: cookie.split(';')[0] });
    expect(me).toMatchObject({ id: 'p-1', roles: ['participant'], cohort: 'c-1' });
    expect(await s.ctx.repo.getParticipant('p-1')).toMatchObject({ name: 'Jordan Lee', email: 'jordan@example.com', cohortId: 'c-1' });
    expect(await s.ctx.repo.getCohort('c-1')).toMatchObject({ id: 'c-1' });
  });

  it('accepts the token as a POSTed form field (LMS)', async () => {
    s = await testServer();
    const token = await mintLaunchToken({ sub: 'p-2' }, SECRET);
    const res = await s.req('/launch', { method: 'POST', body: new URLSearchParams({ token }), headers: { origin: 'https://lms.example.com' } });
    expect(res.status).toBe(303);
  });

  it('refuses expired, forged, wrong audience and unsigned links', async () => {
    s = await testServer();
    const now = Math.floor(Date.now() / 1000);
    const expired = await sign({ sub: 'p', roles: ['participant'], aud: 'ilead', iat: now - 7200, exp: now - 3600 }, SECRET, 'HS256');
    const forged = await mintLaunchToken({ sub: 'p' }, 'another-secret-another-secret-another-secret');
    const audience = await mintLaunchToken({ sub: 'p' }, SECRET, { audience: 'someone-else' });
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'p', exp: now + 600, aud: 'ilead' })).toString('base64url')}.`;
    for (const t of [expired, forged, audience, none, 'garbage', '']) {
      const res = await s.req(`/launch?token=${t}`);
      expect(res.status, t.slice(0, 20)).toBe(401);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
    expect(await (await s.req(`/launch?token=${expired}`)).text()).toMatch(/expired/);
  });

  it('refuses links that live too long and bad claims', async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(verifyLaunchToken(await sign({ sub: 'p', aud: 'ilead', iat: now, exp: now + 30 * 86400 }, SECRET, 'HS256'), [SECRET], { audience: 'ilead', issuers: [] })).rejects.toThrow(/too long/);
    await expect(verifyLaunchToken(await sign({ sub: 'bad id with spaces', aud: 'ilead', exp: now + 60 }, SECRET, 'HS256'), [SECRET], { audience: 'ilead', issuers: [] })).rejects.toThrow(/not valid/);
    await expect(verifyLaunchToken(await sign({ sub: 'p', aud: 'ilead', exp: now + 60, roles: ['root'] }, SECRET, 'HS256'), [SECRET], { audience: 'ilead', issuers: [] })).rejects.toThrow(/roles/);
    await expect(verifyLaunchToken(await mintLaunchToken({ sub: 'p' }, SECRET, { issuer: 'other' }), [SECRET], { audience: 'ilead', issuers: ['genie'] })).rejects.toThrow(/issuer/);
  });

  it('accepts a previous secret during rotation', async () => {
    s = await testServer({ env: { LAUNCH_SECRET_PREVIOUS: 'the-previous-secret-the-previous-secret-00' } });
    const token = await mintLaunchToken({ sub: 'p-3' }, 'the-previous-secret-the-previous-secret-00');
    expect((await s.req(`/launch?token=${token}`)).status).toBe(303);
  });

  it('only redirects to paths on this site', async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const redirect of ['//evil.example.com', 'https://evil.example.com', '/\\evil.example.com']) {
      await expect(verifyLaunchToken(await sign({ sub: 'p', aud: 'ilead', exp: now + 60, redirect }, SECRET, 'HS256'), [SECRET], { audience: 'ilead', issuers: [] })).rejects.toThrow();
    }
    expect(landing({ sub: 'p', roles: ['participant'], attempt: 'resume', exp: 0, redirect: '/?participant=p&start=board' }, '/')).toBe('/?participant=p&start=board');
    expect(landing({ sub: 'a', roles: ['cohort_admin'], attempt: 'resume', exp: 0, cohort: 'c 1' }, '/')).toBe('/group?cohort=c%201');
    expect(landing({ sub: 'a', roles: ['author'], attempt: 'resume', exp: 0 }, '/')).toBe('/author');
    expect(landing({ sub: 'p', roles: ['participant'], attempt: 'resume', exp: 0 }, '/play?x=1')).toBe('/play?x=1&participant=p');
  });

  it('logs out: the session is gone server side', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-4' });
    expect((await s.req('/auth/me', { cookie })).status).toBe(200);
    expect((await s.req('/auth/logout', { method: 'POST', cookie })).status).toBe(204);
    expect((await s.req('/auth/me', { cookie })).status).toBe(401);
  });
});

describe('roles', () => {
  it('keeps each role to its own routes', async () => {
    s = await testServer();
    const participant = await s.launch({ sub: 'p-1', cohort: 'c-1' });
    const assessor = await s.launch({ sub: 'a-1', roles: ['assessor'], cohort: 'c-1' });
    const admin = await s.launch({ sub: 'adm-1', roles: ['cohort_admin'], cohorts: ['c-1'] });
    const otherAdmin = await s.launch({ sub: 'adm-2', roles: ['cohort_admin'], cohorts: ['c-2'] });
    const author = await s.launch({ sub: 'au-1', roles: ['author'] });

    // Not signed in.
    expect((await s.req('/engine/sessions/p-1/view')).status).toBe(401);
    expect((await s.req('/api/profile')).status).toBe(401);
    // A participant plays only their own session and never reads cohort or author routes.
    expect((await s.req('/engine/sessions/p-1/view', { cookie: participant })).status).toBe(200);
    expect((await s.req('/engine/sessions/p-2/view', { cookie: participant })).status).toBe(403);
    expect((await s.req('/api/cohort/c-1/report', { cookie: participant })).status).toBe(403);
    expect((await s.req('/genie/author/turn', { method: 'POST', cookie: participant, json: { brief: {}, asked: [], answers: {} } })).status).toBe(403);
    expect((await s.req('/api/admin/storylines', { cookie: participant })).status).toBe(403);
    // Staff have no engine session of their own.
    expect((await s.req('/engine/sessions/adm-1/view', { cookie: admin })).status).toBe(403);
    // Cohort admins read their cohorts only.
    expect((await s.req('/api/cohort/c-1/report', { cookie: admin })).status).toBe(200);
    expect((await s.req('/api/cohort/c-1/report', { cookie: otherAdmin })).status).toBe(403);
    expect((await s.req('/api/cohort/c-1/report', { cookie: assessor })).status).toBe(200);
    // Assessors review runs in their cohort.
    const run = (await s.ctx.repo.listRuns('p-1'))[0];
    expect((await s.req(`/engine/runs/${run.id}/records`, { cookie: assessor })).status).toBe(200);
    expect((await s.req(`/engine/runs/${run.id}/records`, { cookie: otherAdmin })).status).toBe(403);
    expect((await s.req(`/engine/runs/${run.id}/review`, { method: 'POST', cookie: admin, json: { recordId: 'r1', band: 'strong' } })).status).toBe(403);
    // Authors draft.
    expect((await s.req('/genie/author/turn', { method: 'POST', cookie: author, json: { brief: {}, asked: [], answers: {} } })).status).toBe(200);
    expect((await s.req('/api/admin/storylines', { cookie: author })).status).toBe(200);
  });

  it('takes a launch JWT as a bearer token, and the admin token', async () => {
    s = await testServer();
    const token = await mintLaunchToken({ sub: 'svc', roles: ['cohort_admin'], cohorts: ['c-9'] }, SECRET);
    expect((await s.req('/api/cohort/c-9/report', { headers: { authorization: `Bearer ${token}` } })).status).toBe(404);
    expect((await s.req('/api/cohort/c-8/report', { headers: { authorization: `Bearer ${token}` } })).status).toBe(403);
    expect((await s.req('/api/cohort/c-8/report', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    expect((await s.req('/api/admin/benchmarks/refresh', { method: 'POST', headers: { authorization: `Bearer ${ADMIN_TOKEN}` } })).status).toBe(200);
  });

  it('refuses state changes from another origin', async () => {
    s = await testServer({ env: { CORS_ORIGINS: 'https://cdn.example.com' } });
    const cookie = await s.launch({ sub: 'p-1' });
    const intent = { type: 'openProfile', memberId: 'kent' };
    expect((await s.req('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: intent, headers: { origin: 'https://evil.example.com' } })).status).toBe(403);
    expect((await s.req('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: intent, headers: { origin: 'https://cdn.example.com' } })).status).toBe(200);
    expect((await s.req('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: intent, headers: { origin: 'http://ilead.test' } })).status).toBe(200);
    // CORS preflight from the configured origin, with credentials.
    const pre = await s.req('/engine/sessions/p-1/intents', { method: 'OPTIONS', headers: { origin: 'https://cdn.example.com', 'access-control-request-method': 'POST' } });
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://cdn.example.com');
    expect(pre.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('rate limits launches and AI calls', async () => {
    s = await testServer({ env: { RATE_LIMIT_LAUNCH_PER_MIN: '2', RATE_LIMIT_AI_PER_MIN: '1' } });
    const token = await mintLaunchToken({ sub: 'p-1', roles: ['participant', 'author'] }, SECRET);
    expect((await s.req(`/launch?token=${token}`)).status).toBe(303);
    const second = await s.req(`/launch?token=${token}`);
    expect(second.status).toBe(303);
    const cookie = second.headers.get('set-cookie')!.split(';')[0];
    const third = await s.req(`/launch?token=${token}`);
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toMatch(/^\d+$/);
    const body = { brief: {}, asked: [], answers: {} };
    expect((await s.req('/genie/author/turn', { method: 'POST', cookie, json: body })).status).toBe(200);
    const limited = await s.req('/genie/author/turn', { method: 'POST', cookie, json: body });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ code: 'rateLimited' });
  });
});

describe('security headers and validation', () => {
  it('sends security headers and a request id, and validates input with the schemas', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1' });
    const res = await s.req('/engine/sessions/p-1/view', { cookie, headers: { 'x-request-id': 'abc-123' } });
    expect(res.headers.get('x-request-id')).toBe('abc-123');
    expect(res.headers.get('content-security-policy')).toMatch(/frame-ancestors 'self'/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const bad = await s.req('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'launchMissiles' } });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ code: 'badRequest' });
    expect((await s.req('/engine/sessions/p-1/intents', { method: 'POST', cookie, body: '{not json', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect((await s.req('/api/session/settings', { method: 'PUT', cookie, json: { text: 'big' } })).status).toBe(400);
    expect((await s.req('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'submitReflection', answers: ['x'.repeat(600_000)], rating: 3 } })).status).toBe(413);
  });
});
