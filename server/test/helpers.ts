import { mintLaunchToken } from '../src/auth/launch';
import type { LaunchInput } from '../src/auth/principal';
import { createApp, type AppDeps } from '../src/app';
import { DEV_LAUNCH_SECRET, loadConfig } from '../src/config';
import { createLogger } from '../src/log';
import { mockPorts, type AiPorts } from '../src/ports';
import type { PdfRenderer } from '../src/report/pdf';
import { openRepository } from '../src/store';
import type { EngineView, IntentResult } from '../../src/engine/contract';

export const SECRET = 'test-launch-secret-0123456789-abcdefghijklmnop';
export const ADMIN_TOKEN = 'test-admin-token-0123456789-abcdefghijklmnopqrs';

/** A fake PDF renderer: counts renders, returns a tiny PDF. */
export function fakePdf(): PdfRenderer & { renders: string[] } {
  const renders: string[] = [];
  return {
    renders,
    async render({ url }) { renders.push(url); return Buffer.from('%PDF-1.4\n% fake report\n%%EOF\n'); },
    async close() { /* nothing */ }
  };
}

export interface TestServer {
  app: ReturnType<typeof createApp>['app'];
  ctx: ReturnType<typeof createApp>['ctx'];
  close(): Promise<void>;
  /** A launch: returns the session cookie header value. */
  launch(claims: Omit<LaunchInput, 'exp'>, opts?: { secret?: string }): Promise<string>;
  req(path: string, init?: RequestInit & { cookie?: string; json?: unknown }): Promise<Response>;
  json<T = unknown>(path: string, init?: RequestInit & { cookie?: string; json?: unknown }): Promise<T>;
}

export async function testServer(opts: { env?: Record<string, string>; ai?: AiPorts; pdf?: PdfRenderer | null; mailer?: AppDeps['mailer']; sqlitePath?: string } = {}): Promise<TestServer> {
  const config = loadConfig({ NODE_ENV: 'test', LAUNCH_SECRET: SECRET, ADMIN_TOKEN, PUBLIC_URL: 'http://ilead.test', STREAM_TOKENS_PER_SEC: '0', LOG_LEVEL: 'silent', BENCHMARK_REFRESH_HOURS: '0', ...opts.env });
  const log = createLogger('silent');
  const { repo } = await openRepository({ sqlitePath: opts.sqlitePath ?? ':memory:' });
  const server = createApp({ config, log, repo, ai: opts.ai ?? mockPorts(), pdf: opts.pdf === undefined ? fakePdf() : opts.pdf, mailer: opts.mailer ?? null });
  const req = (path: string, init: RequestInit & { cookie?: string; json?: unknown } = {}) => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set('cookie', init.cookie);
    let body = init.body;
    if (init.json !== undefined) { headers.set('content-type', 'application/json'); body = JSON.stringify(init.json); }
    return Promise.resolve(server.app.request(`http://ilead.test${path}`, { ...init, headers, body }));
  };
  return {
    app: server.app, ctx: server.ctx, close: server.close, req,
    async launch(claims, o = {}) {
      const token = await mintLaunchToken(claims, o.secret ?? SECRET);
      const res = await req(`/launch?token=${token}`);
      if (res.status !== 303) throw new Error(`launch failed: ${res.status} ${await res.text()}`);
      const cookie = res.headers.get('set-cookie')!.split(';')[0];
      return cookie;
    },
    async json(path, init) {
      const res = await req(path, init);
      const text = await res.text();
      if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path}: ${res.status} ${text}`);
      return (text ? JSON.parse(text) : undefined) as never;
    }
  };
}

/** Plays the cookie's participant to the end of the run over HTTP: the first style for everyone, then each week ended at once. */
export async function playToEnd(s: TestServer, cookie: string, participant: string, styleIndex = 0): Promise<EngineView> {
  const base = `/engine/sessions/${participant}`;
  const send = (intent: unknown) => s.json<IntentResult>(`${base}/intents`, { method: 'POST', cookie, json: intent });
  let v = await s.json<EngineView>(`${base}/view`, { cookie });
  for (let guard = 0; v.phase !== 'ended' && guard < 100; guard++) {
    if (v.phase === 'style') v = (await send({ type: 'confirmStyles', styles: Object.fromEntries(v.members.map(m => [m.id, v.lens.styles[Math.min(styleIndex, v.lens.styles.length - 1)].key])) })).view;
    else if (v.phase === 'board') v = (await send({ type: 'endPeriod' })).view;
    else if (v.phase === 'periodEnd') {
      if (v.pendingReward?.length) v = (await send({ type: 'chooseReward', reward: v.pendingReward[0] })).view;
      if (v.phase === 'periodEnd') v = (await send({ type: 'startNextPeriod' })).view;
    }
  }
  if (v.phase !== 'ended') throw new Error(`did not end: ${v.phase}`);
  return v;
}

export { DEV_LAUNCH_SECRET };
