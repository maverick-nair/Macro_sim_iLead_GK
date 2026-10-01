/**
 * Loads every story of a static Storybook build and fails on render errors or console errors.
 *   npx storybook build -o <dir> && npx tsx tests/visual/stories-smoke.ts <dir>
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const dir = path.resolve(process.argv[2] ?? 'storybook-static');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let f = path.join(dir, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] ?? 'application/octet-stream' }).end(fs.readFileSync(f));
}).listen(0);
const port = (server.address() as { port: number }).port;
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) as { entries: Record<string, { type: string; id: string }> };
const stories = Object.values(index.entries).filter(e => e.type === 'story');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
let failed = 0;
for (const theme of ['dark', 'light', 'client']) {
  for (const s of stories) {
    const errors: string[] = [];
    const onErr = (e: Error) => errors.push(e.message);
    const onConsole = (m: { type: () => string; text: () => string }) => { if (m.type() === 'error') errors.push(m.text()); };
    page.on('pageerror', onErr); page.on('console', onConsole);
    await page.goto(`http://localhost:${port}/iframe.html?id=${s.id}&globals=theme:${theme}&viewMode=story`);
    await page.waitForSelector('#storybook-root > *', { timeout: 8000 }).catch(() => errors.push('nothing rendered'));
    page.off('pageerror', onErr); page.off('console', onConsole);
    if (errors.length) { failed++; console.log(`FAIL ${theme} ${s.id}: ${errors[0]}`); }
  }
}
console.log(`${stories.length} stories x 3 themes, ${failed} failed`);
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
