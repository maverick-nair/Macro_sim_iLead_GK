import fs from 'node:fs';
import path from 'node:path';
import { expect, type FrameLocator, type Page } from '@playwright/test';

/**
 * The mock LMS for the SCORM specs (D209), shared by tests/e2e/scorm.spec.ts and tests/e2e/lifecycle.spec.ts: an
 * unzipped package served under http://lms.test/pkg/ beside the harness page (tests/e2e/fixtures/scorm-harness.html),
 * which offers the LMS API and records every call, plus the steps a participant takes inside the package.
 */
export const ORIGIN = 'http://lms.test';
const HARNESS = path.resolve('tests/e2e/fixtures/scorm-harness.html');
const TYPES: Record<string, string> = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', xml: 'application/xml', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', webm: 'video/webm', vtt: 'text/vtt' };

export type ScormVersion = 'scorm12' | 'scorm2004';
export interface LmsWatch { errors: string[]; missing: string[] }

/** Serves the package's files and the harness; returns the page errors and the package files that were asked for and missing. */
export async function serveLms(page: Page, files: () => Record<string, Uint8Array>): Promise<LmsWatch> {
  const watch: LmsWatch = { errors: [], missing: [] };
  page.on('pageerror', e => watch.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') watch.errors.push(m.text()); });
  // Tours and tips off, in the package's frame too, as GUIDE_OFF does on the dev server.
  await page.addInitScript(() => { try { localStorage.setItem('ilead.guide', JSON.stringify({ never: true })); } catch { /* none */ } });
  await page.route(`${ORIGIN}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/harness.html') return route.fulfill({ path: HARNESS, contentType: 'text/html' });
    if (url.pathname === '/blank') return route.fulfill({ body: '<!doctype html><title>Blank</title>', contentType: 'text/html' });
    const file = url.pathname.startsWith('/pkg/') ? decodeURIComponent(url.pathname.slice(5)) : '';
    const body = files()[file];
    if (!body) { watch.missing.push(url.pathname); return route.fulfill({ status: 404, body: 'Not found' }); }
    return route.fulfill({ body: Buffer.from(body), contentType: TYPES[file.split('.').pop() ?? ''] ?? 'application/octet-stream' });
  });
  return watch;
}

/** GenieKreator's packager reads the site's player as a build left it (`npm run build:player [out]`, dist by default). */
export async function servePlayerFromDist(page: Page, out = 'dist') {
  await page.route('**/player-manifest.json', route => route.fulfill({ path: path.resolve(out, 'player-manifest.json'), contentType: 'application/json' }));
  await page.route('**/player/**', route => {
    const file = path.resolve(out, 'player', decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/player\//, '')));
    return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: 'Not found' });
  });
}

export const api = (version: string) => (version === 'scorm12' ? '12' : '2004');
export const launch = (page: Page, version: string) => page.goto(`${ORIGIN}/harness.html?api=${api(version)}&pkg=/pkg/index.html`);
export const lmsData = (page: Page) => page.evaluate(() => (window as unknown as { lms: { data: Record<string, string> } }).lms.data);
export const lmsCalls = (page: Page) => page.evaluate(() => (window as unknown as { lms: { calls: Array<{ fn: string; args: string[]; result: string }> } }).lms.calls);
/** Leaves the course, as closing the LMS's player does: the package terminates on its way out. */
export async function leave(page: Page) {
  await page.goto(`${ORIGIN}/blank`);
}
/** What the LMS kept, read from its storage between launches. */
export const stored = (page: Page, version: string) => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{}') as Record<string, string>, `scorm-harness-${api(version)}`);
/** Writes the LMS's suspend data between launches, as earlier sessions would have left it. */
export const storeSuspend = (page: Page, version: string, suspend: string) => page.evaluate(([k, s]) => {
  const d = JSON.parse(localStorage.getItem(k) ?? '{}');
  d['cmi.suspend_data'] = s;
  localStorage.setItem(k, JSON.stringify(d));
}, [`scorm-harness-${api(version)}`, suspend]);

/** Sets every person's style for the week and confirms. */
export async function setStyles(sco: FrameLocator) {
  const groups = sco.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups.first()).toBeVisible({ timeout: 20_000 });
  for (const g of await groups.all()) await g.getByRole('radio').nth(1).click();
  await sco.getByRole('button', { name: 'Review and confirm' }).click();
  await sco.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(sco.getByText(/Styles are set for week \d/)).toBeVisible();
  await sco.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(sco.getByText('How it landed')).toHaveCount(0);
  await dismissEvents(sco);
}

export async function dismissEvents(sco: FrameLocator) {
  const gotIt = sco.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await sco.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.first().click();
    await expect(sco.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

/** From the last week end to the end screen. */
export async function toResults(sco: FrameLocator) {
  await sco.getByRole('button', { name: /^See your week$/ }).click();
  const step = sco.getByRole('button', { name: /^(Continue|Nice|See your results)$/ });
  const h1 = sco.getByRole('heading', { level: 1, name: /^You finished at (Bronze|Silver|Gold|Platinum)\.$/ });
  for (;;) {
    await expect(step.first().or(h1)).toBeVisible();
    if (await h1.count()) break;
    await step.first().click();
  }
}
