/**
 * Design parity check: renders every gallery frame in the Claude Design prototype (project/*.dc.html)
 * and in the app (/screens, /states), then diffs them pixel by pixel.
 *
 *   npm run parity                 all frames on both pages
 *   npm run parity -- b1 b4 l1     only these frames
 *   npm run parity -- --refresh    re-render the prototype baselines
 *
 * Baselines are cached in .visual-cache/ (git ignored). Diff images for failing frames land in
 * .visual-cache/diff/. A pixel differs when any channel is off by more than 40/255 and no pixel
 * within 1px in the other image matches it.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '../..');
const cache = path.join(root, '.visual-cache');
const deps = path.join(cache, 'deps/node_modules');
const PAGES = [
  { proto: 'iLead Screens.dc.html', app: '/screens', key: 'screens' },
  { proto: 'iLead States.dc.html', app: '/states', key: 'states' }
];
/**
 * Strict by default: 0.05% of a frame is about 650 pixels at 1440x900, less than one short label.
 * Frames that are dynamic by design get 0.4%: p1 is the live prototype (clock running), z5 and z14
 * draw a random voice waveform, and x2 blurs the board behind a dialog, which rasterizes unstably.
 */
const THRESHOLD = 0.0005;
const DYNAMIC: Record<string, number> = { p1: 0.004, z5: 0.004, z14: 0.004, x2: 0.004 };

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const only = new Set(args.filter(a => !a.startsWith('--')));

/** The prototype runtime loads React 18 and Babel from unpkg; serve local copies instead. */
function ensureDeps() {
  if (fs.existsSync(path.join(deps, '@babel/standalone/babel.min.js'))) return;
  fs.mkdirSync(path.join(cache, 'deps'), { recursive: true });
  execSync('npm i --no-save --no-package-lock --prefix . react@18.3.1 react-dom@18.3.1 @babel/standalone@7.29.0', { cwd: path.join(cache, 'deps'), stdio: 'inherit' });
}

function serveStatic(dir: string): Promise<http.Server & { port: number }> {
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return void res.writeHead(404).end();
    const type = ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' } as Record<string, string>)[path.extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }).end(fs.readFileSync(file));
  });
  return new Promise(r => server.listen(0, () => r(Object.assign(server, { port: (server.address() as { port: number }).port }))));
}

async function shoot(page: Page, url: string, outDir: string, ids: string[] | null): Promise<string[]> {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  fs.mkdirSync(outDir, { recursive: true });
  const all = ids ?? (await page.$$eval('.dv-opt', els => els.map(e => e.id)));
  for (const id of all) {
    const el = await page.$(`[id="${id}"] .dv-card`);
    if (!el) continue;
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await el.screenshot({ path: path.join(outDir, `${id}.png`), animations: 'disabled' });
  }
  return all;
}

function diff(a: string, b: string, out: string, limit: number): { frac: number; size: string } {
  const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(b));
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  const D = new PNG({ width: w, height: h });
  // A pixel only counts as different when no pixel within 1px in the other image matches it.
  // That absorbs subpixel compositing offsets (backdrop-filter layers) but not a real 2px shift.
  const same = (ia: number, ib: number) => Math.abs(A.data[ia] - B.data[ib]) <= 40 && Math.abs(A.data[ia + 1] - B.data[ib + 1]) <= 40 && Math.abs(A.data[ia + 2] - B.data[ib + 2]) <= 40;
  const near = (x: number, y: number) => {
    const ia = (y * A.width + x) * 4;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && same(ia, (yy * B.width + xx) * 4)) return true;
    }
    return false;
  };
  let bad = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ia = (y * A.width + x) * 4, ib = (y * B.width + x) * 4, id = (y * w + x) * 4;
    const hit = !same(ia, ib) && !near(x, y);
    if (hit) bad++;
    D.data[id] = hit ? 255 : B.data[ib] / 4; D.data[id + 1] = hit ? 0 : B.data[ib + 1] / 4; D.data[id + 2] = hit ? 0 : B.data[ib + 2] / 4; D.data[id + 3] = 255;
  }
  const sizeMismatch = A.width !== B.width || A.height !== B.height;
  const frac = sizeMismatch ? 1 : bad / (w * h);
  if (frac > limit) fs.writeFileSync(out, PNG.sync.write(D));
  return { frac, size: sizeMismatch ? `size ${A.width}x${A.height} vs ${B.width}x${B.height}` : '' };
}

async function main() {
  ensureDeps();
  const proto = await serveStatic(path.join(root, 'project'));
  const vite = await createServer({ root, server: { port: 0 }, logLevel: 'error' });
  await vite.listen();
  const appUrl = vite.resolvedUrls!.local[0].replace(/\/$/, '');
  const browser: Browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.route('https://unpkg.com/**', r => {
    const u = r.request().url();
    const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : u.includes('babel') ? '@babel/standalone/babel.min.js' : 'react/umd/react.production.min.js';
    return r.fulfill({ body: fs.readFileSync(path.join(deps, f)), contentType: 'text/javascript' });
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  fs.rmSync(path.join(cache, 'diff'), { recursive: true, force: true });
  fs.mkdirSync(path.join(cache, 'diff'), { recursive: true });

  let failed = 0;
  for (const pg of PAGES) {
    const protoDir = path.join(cache, 'proto', pg.key), appDir = path.join(cache, 'app', pg.key);
    if (refresh || !fs.existsSync(protoDir)) await shoot(page, `http://localhost:${proto.port}/${encodeURIComponent(pg.proto)}`, protoDir, null);
    const known = fs.readdirSync(protoDir).map(f => f.replace('.png', ''));
    const ids = only.size ? known.filter(id => only.has(id)) : known;
    if (!ids.length) continue;
    await shoot(page, appUrl + pg.app, appDir, ids);
    for (const id of ids) {
      const limit = DYNAMIC[id] ?? THRESHOLD;
      const r = diff(path.join(protoDir, `${id}.png`), path.join(appDir, `${id}.png`), path.join(cache, 'diff', `${id}.png`), limit);
      const ok = r.frac <= limit;
      if (!ok) failed++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(4)} ${(r.frac * 100).toFixed(2)}% ${r.size}`);
    }
  }
  if (errors.length) console.log('page errors:', errors.slice(0, 5));
  await browser.close();
  await vite.close();
  proto.close();
  console.log(failed ? `${failed} frame(s) differ. Diffs in .visual-cache/diff/` : 'All frames match the design.');
  process.exit(failed || errors.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
