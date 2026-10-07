/**
 * Web Vitals budgets (M8, D78). Builds the app for production, serves it with `vite preview`, and loads
 * the participant's first screen, the board, the report and the group report in Chromium with the CPU
 * slowed 4x and a Fast 3G like network (Lighthouse's throttling, 150 ms round trip, 1.6 Mbps down and
 * 750 Kbps up, at the 90% DevTools applies). Fails when a median is over budget.
 *
 *   npm run vitals                  build, then measure (3 runs per page, the median counts)
 *   npm run vitals -- --skip-build  reuse the last vitals build
 *   npm run vitals -- --runs 5 --json vitals.json
 *
 * The build talks to a stub server through the HTTP adapters (`VITE_ILEAD_API_URL=/api`,
 * `VITE_ILEAD_ENGINE_URL=/engine`), as production does: the stub runs the same engine code in Node
 * (src/engine) and the mock API's data (src/api/mock), so the browser measures the app, not the mock
 * engine. Static files are served gzipped, like a CDN would.
 *
 * Metrics, per page:
 * - LCP: largest contentful paint of the cold load. The report opens from the end screen, so its
 *   "LCP" is the time from the click to the report's title painted (a soft navigation).
 * - CLS: the sum of layout shifts without recent input (an upper bound of the session window score).
 * - TBT: total blocking time, the time long tasks run past 50 ms, from the navigation (or the click)
 *   until the page is quiet. It stands in for INP, which needs real users.
 * - INP: the slowest interaction of a few clicks and keys on the board (event timing), for the record.
 * - Transfer: bytes over the network (encoded, headers included) until the page is quiet.
 */
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium, type CDPSession, type Page } from '@playwright/test';
import { build, preview, type Plugin } from 'vite';
import { createMockApi } from '../src/api/mock';
import { defaultStoryline } from '../src/engine/mock';
import { createEngine } from '../src/engine/sim/engine';
import { neededStyles, play } from '../src/engine/sim/policies';

type Metric = 'lcp' | 'cls' | 'tbt' | 'inp' | 'kb';
/**
 * Budgets per page (D78, tightened in D87). LCP, TBT and INP in ms, transfer in KB. The participant's
 * first load holds the usual targets (LCP 2.5 s, CLS 0.1, TBT 300 ms). The board's and the group report's
 * first renders are split (D87), so the group report holds TBT 300 ms and the board 400 ms (measured
 * 230 to 310 ms: the view's parse and the first commit are still one task each). Their largest paint
 * stays at 3 s: at this network the first load's bytes alone take about 2 s, and the board's largest
 * paint is a portrait that follows them. Medians of 3 runs, with room for CI noise.
 */
export const BUDGETS: Record<string, Partial<Record<Metric, number>>> = {
  'first load': { lcp: 2500, cls: 0.1, tbt: 300, kb: 450 },
  board: { lcp: 3000, cls: 0.1, tbt: 400, inp: 200, kb: 450 },
  report: { lcp: 2500, cls: 0.1, tbt: 300, kb: 100 },
  'group report': { lcp: 3000, cls: 0.1, tbt: 300, kb: 450 }
};

const NETWORK = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8 * 0.9, uploadThroughput: (750 * 1024) / 8 * 0.9 };
const CPU_SLOWDOWN = 4;

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, '.visual-cache/vitals-dist');
const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const RUNS = Number(arg('--runs') ?? 3);
/** `--verbose` lists every response and its size. */
const VERBOSE = args.includes('--verbose');

// ---- The stub server: the engine and the API over HTTP, as the production adapters expect. ----

type Engine = ReturnType<typeof createEngine>;
const engines = new Map<string, Promise<Engine>>();

/** A session's engine, made on first use from its name: `vfirst-*` fresh, `vboard-*` on the board, `vreport-*` ended. */
function engineFor(session: string): Promise<Engine> {
  let e = engines.get(session);
  if (!e) {
    e = (async () => {
      const config = defaultStoryline();
      if (session.startsWith('vreport')) {
        const { engine } = await play(config, 'good', 3);
        await engine.dispatch({ type: 'submitReflection', answers: ['Kent taught me that the loudest problem is not always the real one.'], rating: 4 });
        return engine;
      }
      const engine = createEngine(config, { seed: 1 });
      if (session.startsWith('vboard')) {
        await engine.dispatch({ type: 'confirmStyles', styles: await neededStyles(engine, config.thresholds.high, config.lens) });
        await engine.dispatch({ type: 'clearOutcome' });
        for (const c of engine.view().cards) await engine.dispatch({ type: 'dismissCard', cardId: c.id });
      }
      return engine;
    })();
    engines.set(session, e);
  }
  return e;
}

const api = createMockApi({ latencyMs: 0, participant: 'vitals' });
/** The cohort's report, built once before measuring: a server stores it, it does not play 37 runs per request. */
const groupReport = api.getGroupReport('3');

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise(resolve => {
    let s = '';
    req.on('data', c => (s += c));
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : undefined); } catch { resolve(undefined); } });
  });
}

function send(req: IncomingMessage, res: ServerResponse, status: number, body: Buffer | string, type: string) {
  const buf = typeof body === 'string' ? Buffer.from(body) : body;
  const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? '')) && /json|javascript|css|html|svg/.test(type) && buf.length > 512;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...(gzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) });
  res.end(gzip ? zlib.gzipSync(buf, { level: 6 }) : buf);
}
const json = (req: IncomingMessage, res: ServerResponse, v: unknown, status = 200) => (v === undefined ? (res.writeHead(204), res.end()) : send(req, res, status, JSON.stringify(v), 'application/json'));

async function stub(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x');
  const p = url.pathname;
  const m = p.match(/^\/engine\/sessions\/([^/]+)\/(view|intents)$/);
  if (m) {
    const engine = await engineFor(decodeURIComponent(m[1]));
    if (m[2] === 'view') json(req, res, engine.view());
    else {
      try { json(req, res, await engine.dispatch((await readBody(req)) as never)); } catch (e) { json(req, res, { message: String(e), code: 'refused' }, 409); }
    }
    return true;
  }
  if (!p.startsWith('/api/')) return false;
  const route = p.slice(4);
  if (route === '/scenario') json(req, res, await api.getScenario());
  else if (route === '/profile') json(req, res, { name: 'Jordan Lee', cohort: null });
  else if (route === '/cohort/leaderboard') json(req, res, await api.getLeaderboard((await readBody(req)) as never));
  else if (/^\/cohort\/[^/]+\/report$/.test(route)) json(req, res, await groupReport);
  else if (req.method === 'GET') json(req, res, { message: 'none' }, 404); // session, theme, history: none
  else json(req, res, undefined);
  return true;
}

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

/** Serves the build gzipped (vite preview sends files as they are), with the SPA fallback. */
function staticGzip(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'GET') return false;
  const p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let f = path.join(outDir, p);
  if (!f.startsWith(outDir)) return false;
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    if (path.extname(p)) return false;
    f = path.join(outDir, 'index.html');
  }
  send(req, res, 200, fs.readFileSync(f), TYPES[path.extname(f)] ?? 'application/octet-stream');
  return true;
}

const stubPlugin: Plugin = {
  name: 'ilead-vitals-stub',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      stub(req, res).then(done => { if (!done && !staticGzip(req, res)) next(); }, e => { res.writeHead(500); res.end(String(e)); });
    });
  }
};

// ---- Measuring ----

/**
 * Runs in the page before anything else: observers for LCP, CLS, long tasks and event timing. Kept as
 * plain JavaScript text: a function compiled by tsx can carry helpers the page does not have.
 */
const OBSERVE = `
  window.__vitals = { lcp: 0, cls: 0, tasks: [], events: [], fcp: 0 };
  const v = window.__vitals;
  const on = (type, cb, extra = {}) => {
    try { new PerformanceObserver(l => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra }); } catch (e) { /* unsupported */ }
  };
  new MutationObserver((_, o) => { const h = document.querySelector('h1'); if (h && !v.h1) { v.h1 = performance.now() + ' ' + h.textContent.slice(0, 30); } }).observe(document, { subtree: true, childList: true });
  on('largest-contentful-paint', e => { v.lcp = e.startTime; v.lcpEl = e.element ? e.element.tagName + ' ' + (e.element.textContent || e.url || '').slice(0, 40) + ' ' + getComputedStyle(e.element).fontWeight : e.url; });
  on('paint', e => { if (e.name === 'first-contentful-paint') v.fcp = e.startTime; });
  on('layout-shift', e => { if (!e.hadRecentInput) v.cls += e.value; });
  on('longtask', e => { v.tasks.push([e.startTime, e.duration]); });
  on('event', e => { if (e.interactionId > 0) v.events.push([e.startTime, e.duration]); }, { durationThreshold: 16 });
`;

interface Vitals { lcp: number; cls: number; tbt: number; inp: number | null; kb: number }

async function throttle(page: Page): Promise<{ cdp: CDPSession; bytes: () => number; reset: () => void; idle: (quietMs?: number) => Promise<void> }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  let total = 0;
  let inflight = 0;
  let last = Date.now();
  const urls = new Map<string, string>();
  cdp.on('Network.requestWillBeSent', e => { inflight++; last = Date.now(); urls.set(e.requestId, e.request.url); });
  cdp.on('Network.loadingFinished', e => {
    total += e.encodedDataLength; inflight = Math.max(0, inflight - 1); last = Date.now();
    if (VERBOSE) console.log(`    ${String(Math.round(e.encodedDataLength / 1024)).padStart(6)} KB  ${urls.get(e.requestId)?.replace(/^https?:\/\/[^/]+/, '')}`);
  });
  cdp.on('Network.loadingFailed', () => { inflight = Math.max(0, inflight - 1); last = Date.now(); });
  return {
    cdp,
    bytes: () => total,
    reset: () => { total = 0; },
    // Quiet: nothing on the network for `quietMs` (long tasks show up in the observer on their own).
    idle: async (quietMs = 2000) => { while (inflight > 0 || Date.now() - last < quietMs) await new Promise(r => setTimeout(r, 100)); }
  };
}

/** `--verbose`: when each response ended, first and largest paint, and the long tasks. */
async function timeline(page: Page, v: { lcp: number; fcp: number; tasks: Array<[number, number]> }) {
  const rows = (await page.evaluate(`performance.getEntriesByType('resource').map(e => [Math.round(e.startTime), Math.round(e.responseEnd), e.name.replace(location.origin, '')])`)) as Array<[number, number, string]>;
  for (const [s0, e, n] of rows) console.log(`    ${String(s0).padStart(6)} → ${String(e).padStart(6)} ms  ${n}`);
  console.log(`    FCP ${Math.round(v.fcp)} ms, LCP ${Math.round(v.lcp)} ms (${(v as { lcpEl?: string }).lcpEl}), first h1 at ${(v as { h1?: string }).h1}; long tasks ${v.tasks.map(([a, d]) => `${Math.round(a)}+${Math.round(d)}`).join(', ')}`);
}

/** TBT of the long tasks that start at or after `from` (ms on the page's clock). */
const tbtOf = (tasks: Array<[number, number]>, from: number) => tasks.filter(([s]) => s >= from).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
const read = (page: Page) => page.evaluate('window.__vitals') as Promise<{ lcp: number; cls: number; tasks: Array<[number, number]>; events: Array<[number, number]>; fcp: number }>;

async function measure(base: string, name: string, run: number): Promise<Vitals> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript({ content: OBSERVE });
  if (VERBOSE) page.on('console', m => console.log(`    page: ${m.text()}`));
  const net = await throttle(page);
  try {
    if (name === 'first load') {
      await page.goto(`${base}/?participant=vfirst-${run}`);
      await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60_000 });
      await net.idle();
      const v = await read(page);
      if (VERBOSE) await timeline(page, v);
      return { lcp: v.lcp, cls: v.cls, tbt: tbtOf(v.tasks, 0), inp: null, kb: net.bytes() / 1024 };
    }
    if (name === 'board') {
      await page.goto(`${base}/?start=board&participant=vboard-${run}`);
      await page.getByRole('heading', { level: 1, name: /^Your team board/ }).waitFor({ timeout: 60_000 });
      await net.idle();
      const loaded = await read(page);
      if (VERBOSE) await timeline(page, loaded);
      const kb = net.bytes() / 1024;
      // A few interactions for INP: select a person, open and close the inbox.
      await page.getByText('Kent Goldberg', { exact: true }).click();
      await page.getByRole('button', { name: /^Inbox/ }).click();
      await page.getByRole('dialog', { name: 'Inbox' }).waitFor();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
      const v = await read(page);
      return { lcp: loaded.lcp, cls: loaded.cls, tbt: tbtOf(loaded.tasks, 0), inp: Math.max(0, ...v.events.map(([, d]) => d)), kb };
    }
    if (name === 'report') {
      await page.goto(`${base}/?participant=vreport-${run}`);
      // The last week end comes before the end screen.
      const h1 = page.getByRole('heading', { level: 1, name: /^You finished at / });
      const step = page.getByRole('button', { name: /^(See your week|Continue|Nice|See your results)$/ });
      for (;;) {
        await step.first().or(h1).waitFor({ timeout: 60_000 });
        if (await h1.count()) break;
        await step.first().click();
      }
      await net.idle();
      net.reset();
      const before = await read(page);
      const t0 = (await page.evaluate('performance.now()')) as number;
      await page.getByRole('button', { name: 'View my report' }).click();
      const title = page.getByRole('heading', { level: 1, name: /^(Your development report|Your assessment report|Jordan Lee)$/ });
      await title.waitFor({ timeout: 60_000 });
      // The title painted: the next frame after it is in the DOM.
      const painted = (await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now()))))')) as number;
      await net.idle();
      const v = await read(page);
      return { lcp: painted - t0, cls: v.cls - before.cls, tbt: tbtOf(v.tasks, t0), inp: null, kb: net.bytes() / 1024 };
    }
    // The group report.
    await page.goto(`${base}/group`);
    await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60_000 });
    await page.getByRole('heading', { level: 2 }).first().waitFor({ timeout: 60_000 });
    await net.idle();
    const v = await read(page);
    if (VERBOSE) await timeline(page, v);
    return { lcp: v.lcp, cls: v.cls, tbt: tbtOf(v.tasks, 0), inp: null, kb: net.bytes() / 1024 };
  } finally {
    await browser.close();
  }
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

async function main() {
  if (!args.includes('--skip-build') || !fs.existsSync(path.join(outDir, 'index.html'))) {
    process.env.VITE_ILEAD_API_URL = '/api';
    process.env.VITE_ILEAD_ENGINE_URL = '/engine';
    await build({ root, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
  }
  await groupReport;
  const server = await preview({ root, logLevel: 'warn', plugins: [stubPlugin], build: { outDir }, preview: { port: 0, strictPort: false, open: false } });
  const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:4173';
  console.log(`Production build on ${base}; CPU ${CPU_SLOWDOWN}x slower, network ${NETWORK.latency} ms RTT, ${(NETWORK.downloadThroughput * 8 / 1024 / 1024).toFixed(2)} Mbps down. ${RUNS} runs per page, medians.\n`);
  const results: Record<string, Vitals & { runs: Vitals[] }> = {};
  let over = 0;
  const fmt = (m: Metric, x: number | null) => (x === null ? '–' : m === 'cls' ? x.toFixed(3) : m === 'kb' ? `${Math.round(x)} KB` : `${Math.round(x)} ms`);
  // `--page board` measures one page (while working on it); the gate measures them all.
  for (const name of Object.keys(BUDGETS).filter(n => !arg('--page') || n === arg('--page'))) {
    const runs: Vitals[] = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(base, name, i));
    const med: Vitals = {
      lcp: median(runs.map(r => r.lcp)), cls: median(runs.map(r => r.cls)), tbt: median(runs.map(r => r.tbt)),
      inp: runs[0].inp === null ? null : median(runs.map(r => r.inp ?? 0)), kb: median(runs.map(r => r.kb))
    };
    results[name] = { ...med, runs };
    const cells = (['lcp', 'cls', 'tbt', 'inp', 'kb'] as Metric[]).map(m => {
      const budget = BUDGETS[name][m];
      const x = med[m];
      const bad = budget !== undefined && x !== null && x > budget;
      if (bad) over++;
      return `${m.toUpperCase()} ${fmt(m, x)}${budget !== undefined ? ` / ${fmt(m, budget)}` : ''}${bad ? ' OVER' : ''}`;
    });
    console.log(`${name.padEnd(13)} ${cells.join('   ')}`);
  }
  const out = arg('--json');
  if (out) fs.writeFileSync(out, JSON.stringify(results, null, 2));
  await new Promise<void>(r => server.httpServer.close(() => r()));
  if (over) {
    console.error(`\n${over} metric(s) over budget.`);
    process.exit(1);
  }
  console.log('\nAll within budget.');
}

await main();
