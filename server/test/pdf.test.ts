import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../src/log';
import { chromiumRenderer, PdfError, type PdfRenderer } from '../src/report/pdf';

/**
 * The real renderer in headless Chromium, against a page that behaves like the app's print view: it
 * needs the session cookie and marks itself ready (or failed). The full print view is rendered by the
 * server E2E (server/e2e), against the built app.
 */
let server: http.Server;
let base = '';
let renderer: PdfRenderer;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const signedIn = /ilead_session=good/.test(req.headers.cookie ?? '');
    const state = req.url?.includes('fail') ? 'error' : signedIn ? 'ready' : 'error';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><body><div data-print-state="loading"><h1>Development report</h1><p>Jordan Lee</p></div>
      <script>setTimeout(() => document.querySelector('[data-print-state]').setAttribute('data-print-state', '${state}'), 50)</script></body></html>`);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  renderer = chromiumRenderer({ executablePath: process.env.CHROMIUM_PATH, timeoutMs: 20_000, concurrency: 2, log: createLogger('silent') });
});
afterAll(async () => {
  await renderer.close();
  await new Promise(r => server.close(r));
});

describe('PDF renderer (headless Chromium)', () => {
  it('prints the page once it says it is ready, signed in with the cookie', async () => {
    const pdf = await renderer.render({ url: `${base}/report/print?participant=p-1`, cookie: { name: 'ilead_session', value: 'good' } });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('fails when the print view cannot load the report', async () => {
    await expect(renderer.render({ url: `${base}/report/print?participant=p-1`, cookie: { name: 'ilead_session', value: 'bad' } })).rejects.toBeInstanceOf(PdfError);
    await expect(renderer.render({ url: `${base}/fail`, cookie: { name: 'ilead_session', value: 'good' } })).rejects.toBeInstanceOf(PdfError);
  });

  it('renders several at once within its concurrency', async () => {
    const all = await Promise.all([1, 2, 3].map(i => renderer.render({ url: `${base}/report/print?participant=p-${i}`, cookie: { name: 'ilead_session', value: 'good' } })));
    expect(all.every(p => p.subarray(0, 5).toString() === '%PDF-')).toBe(true);
  });
});
