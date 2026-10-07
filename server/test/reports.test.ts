import { SMTPServer } from 'smtp-server';
import { afterEach, describe, expect, it } from 'vitest';
import { GroupReport } from '../../src/engine/groupContract';
import { History } from '../../src/engine/reportContract';
import { loadConfig } from '../src/config';
import { reportEmail, smtpMailer } from '../src/report/email';
import { fakePdf, playToEnd, SECRET, testServer, type TestServer } from './helpers';

let s: TestServer;
afterEach(async () => { await s?.close(); s = undefined as unknown as TestServer; });

/** A cohort: `n` participants played to the end with different styles. */
async function cohort(n: number, cohortId = 'c-1', purpose: 'development' | 'assessment' = 'development') {
  const cookies: string[] = [];
  for (let i = 0; i < n; i++) {
    const cookie = await s.launch({ sub: `p-${i}`, name: `Person ${i}`, cohort: cohortId, purpose, email: `p${i}@example.com` });
    await playToEnd(s, cookie, `p-${i}`, i % 4);
    cookies.push(cookie);
  }
  return cookies;
}

describe('cohort reports', () => {
  it('builds the group report from the cohort\'s stored runs, as the app parses it', async () => {
    s = await testServer();
    await cohort(6);
    // One more who stopped part way: it counts in the completion rate.
    const late = await s.launch({ sub: 'p-late', cohort: 'c-1' });
    await s.json('/engine/sessions/p-late/view', { cookie: late });
    const admin = await s.launch({ sub: 'adm', roles: ['cohort_admin'], cohorts: ['c-1'] });
    const raw = await s.json('/api/cohort/c-1/report', { cookie: admin });
    const report = GroupReport.parse(raw);
    expect(report.participants).toBe(7);
    expect(report.completed).toBe(6);
    expect(report.cohort.purpose).toBe('development');
    expect((await s.req('/api/cohort/nope/report', { cookie: await s.launch({ sub: 'adm2', roles: ['cohort_admin'], cohorts: ['*'] }) })).status).toBe(404);
  });

  it('answers POST /cohort/report from summaries the caller sends', async () => {
    s = await testServer();
    await cohort(2);
    const runs = await s.ctx.repo.listCohortRuns('c-1');
    const admin = await s.launch({ sub: 'adm', roles: ['cohort_admin'], cohorts: ['c-1'] });
    const body = { cohort: { id: 'c-1', name: 'Spring cohort', date: '2026-10-07', purpose: 'assessment' }, runs: runs.map(r => ({ name: r.name ?? '', summary: r.summary })) };
    const report = GroupReport.parse(await s.json('/api/cohort/report', { method: 'POST', cookie: admin, json: body }));
    expect(report.cohort.purpose).toBe('assessment');
    expect((await s.req('/api/cohort/report', { method: 'POST', cookie: admin, json: { cohort: body.cohort } })).status).toBe(400);
  });

  it('ranks the leaderboard from stored runs, not from what the browser claims', async () => {
    s = await testServer();
    const cookies = await cohort(3);
    const board = await s.json<{ entries: Array<{ rank: number; name: string | null; you: boolean; score: number }>; total: number }>('/api/cohort/leaderboard', {
      method: 'POST', cookie: cookies[0], json: { size: 2, anonymous: true, you: { score: 9999, conversions: 99, capability: 100 } }
    });
    expect(board.total).toBe(3);
    const me = board.entries.find(e => e.you)!;
    expect(me.score).toBeLessThan(9999);
    expect(board.entries.filter(e => !e.you).every(e => e.name === null)).toBe(true);
    expect([...board.entries].sort((a, b) => a.rank - b.rank)).toEqual(board.entries);
  });

  it('refreshes the benchmark from every stored run once there are enough', async () => {
    s = await testServer({ env: { BENCHMARK_MIN_RUNS: '3' } });
    const admin = await s.launch({ sub: 'ops', roles: ['cohort_admin'], cohorts: ['*'] });
    const sample = await s.req('/api/admin/benchmarks/readiness_based', { cookie: admin });
    expect(sample.headers.get('x-benchmark-source')).toBe('sample');
    await cohort(3);
    const out = await s.json<Array<{ lens: string; runs: number; stored: boolean }>>('/api/admin/benchmarks/refresh', { method: 'POST', cookie: admin });
    expect(out).toEqual([{ lens: 'readiness_based', runs: 3, stored: true }]);
    const stored = await s.req('/api/admin/benchmarks/readiness_based', { cookie: admin });
    expect(stored.headers.get('x-benchmark-source')).toMatch(/^stored .* \(3 runs\)$/);
    const scoped = await s.launch({ sub: 'ops2', roles: ['cohort_admin'], cohorts: ['c-1'] });
    expect((await s.req('/api/admin/benchmarks/refresh', { method: 'POST', cookie: scoped })).status).toBe(403);
  });

  it('serves the history the report parses', async () => {
    s = await testServer();
    const [cookie] = await cohort(1);
    await s.json('/engine/sessions/p-0/runs', { method: 'POST', cookie });
    expect(History.safeParse(await s.json('/api/history', { cookie })).success).toBe(true);
  });
});

describe('report PDF', () => {
  it('renders the print view once per run version, and only once the run has ended', async () => {
    const pdf = fakePdf();
    s = await testServer({ pdf });
    const cookie = await s.launch({ sub: 'p-1' });
    expect((await s.req('/api/report.pdf', { cookie })).status).toBe(404);
    await playToEnd(s, cookie, 'p-1');
    const res = await s.req('/api/report.pdf', { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toMatch(/development-report\.pdf/);
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    await s.req('/api/report.pdf', { cookie });
    expect(pdf.renders).toEqual(['http://ilead.test/report/print?participant=p-1']);
    // The reflection changes the run, so the next PDF is rendered again.
    await s.json('/engine/sessions/p-1/intents', { method: 'POST', cookie, json: { type: 'submitReflection', answers: ['I will ask before I decide.'], rating: 4 } });
    await s.req('/api/report.pdf', { cookie });
    expect(pdf.renders).toHaveLength(2);
    // The renderer's short session is gone afterwards.
    expect(await s.ctx.repo.getSession('nope')).toBeNull();
  });

  it('answers 501 without a PDF service, so the app opens its print view', async () => {
    s = await testServer({ pdf: null });
    const cookie = await s.launch({ sub: 'p-1' });
    await playToEnd(s, cookie, 'p-1');
    expect((await s.req('/api/report.pdf', { cookie })).status).toBe(501);
  });
});

describe('report email', () => {
  let smtp: SMTPServer | null = null;
  afterEach(() => new Promise<void>(r => (smtp ? smtp.close(() => r()) : r())));

  async function fakeSmtp() {
    const mails: Array<{ from: string; to: string[]; raw: string }> = [];
    smtp = new SMTPServer({
      authOptional: true, disabledCommands: ['STARTTLS'],
      onData(stream, session, cb) {
        let raw = '';
        stream.on('data', d => (raw += d.toString()));
        stream.on('end', () => { mails.push({ from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '', to: session.envelope.rcptTo.map(r => r.address), raw }); cb(); });
      }
    });
    const port = await new Promise<number>(r => smtp!.listen(0, '127.0.0.1', () => r((smtp!.server.address() as { port: number }).port)));
    return { mails, url: `smtp://127.0.0.1:${port}` };
  }

  it('emails the report with the PDF attached, logs it, and caps how often', async () => {
    const { mails, url } = await fakeSmtp();
    const env = { SMTP_URL: url, EMAIL_FROM: 'iLead <reports@example.com>', RATE_LIMIT_EMAIL_PER_HOUR: '3' };
    const mailer = await smtpMailer(loadConfig({ NODE_ENV: 'test', LAUNCH_SECRET: SECRET, ...env }));
    s = await testServer({ env, mailer });
    const cookie = await s.launch({ sub: 'p-1', name: 'Jordan Lee', email: 'jordan@example.com' });
    expect((await s.req('/api/report/email', { method: 'POST', cookie })).status).toBe(409);
    await playToEnd(s, cookie, 'p-1');
    expect((await s.req('/api/report/email', { method: 'POST', cookie })).status).toBe(204);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toEqual(['jordan@example.com']);
    expect(mails[0].from).toBe('reports@example.com');
    expect(mails[0].raw).toMatch(/Subject: Your iLead development report/);
    expect(mails[0].raw).toMatch(/Content-Type: application\/pdf; name=development-report\.pdf/);
    expect(mails[0].raw).toMatch(/Hello Jordan Lee,/);
    expect((await s.req('/api/report/email', { method: 'POST', cookie })).status).toBe(204);
    const limited = await s.req('/api/report/email', { method: 'POST', cookie });
    expect(limited.status).toBe(429);
    const exported = await s.json<{ emails: unknown[] }>('/api/privacy/export', { cookie });
    expect(exported.emails).toHaveLength(2);
  });

  it('needs a work address and an SMTP server', async () => {
    s = await testServer();
    const cookie = await s.launch({ sub: 'p-1' });
    expect((await s.req('/api/report/email', { method: 'POST', cookie })).status).toBe(501);
    await s.close();
    const { url } = await fakeSmtp();
    const mailer = await smtpMailer(loadConfig({ NODE_ENV: 'test', LAUNCH_SECRET: SECRET, SMTP_URL: url }));
    s = await testServer({ mailer });
    const c2 = await s.launch({ sub: 'p-2' });
    await playToEnd(s, c2, 'p-2');
    const res = await s.req('/api/report/email', { method: 'POST', cookie: c2 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'noEmail' });
  });

  it('words the email by the copy rules', () => {
    for (const purpose of ['development', 'assessment'] as const) {
      const m = reportEmail({ name: 'Ana <script>', storyline: 'Sales Elevator, Innov8 Elevators', purpose });
      const all = `${m.subject}\n${m.text}\n${m.html}`;
      expect(all).not.toMatch(/[‒-―]|\s-\s/);
      expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(all).not.toMatch(/competenc/i);
      expect(all).toMatch(/skills/);
      expect(m.html).not.toMatch(/<script>/);
    }
  });
});
