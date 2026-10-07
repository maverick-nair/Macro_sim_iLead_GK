import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { mintLaunchToken } from '../src/auth/launch';
import type { LaunchInput } from '../src/auth/principal';
import { E2E_SECRET } from '../playwright.config';

/**
 * The app against the real server: launched by a minted link, a week played through the UI (styles, a 1:1
 * with streamed replies, the outcome, the week end), resumed after the browser closes, and the report's
 * PDF rendered by the server's headless Chromium from the app's print view.
 */
const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  // "None" answers (no theme, no saved settings, no history) are 404s by contract; the browser logs them.
  page.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const link = async (claims: Omit<LaunchInput, 'exp'>) => `/launch?token=${await mintLaunchToken(claims, E2E_SECRET)}`;

async function setStyles(page: Page, week: number) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Set your leadership styles for week ${week}`, { timeout: 30_000 });
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByRole('heading', { name: /Styles are set for week/ })).toBeFocused();
}

async function dismissEvents(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

async function throughWeekEnd(page: Page, last: string) {
  await expect(page.getByText(/ · Week end$/)).toBeVisible();
  await page.getByRole('button', { name: /^See your week$/ }).click();
  const step = page.getByRole('button', { name: new RegExp(`^(Continue|Nice|Take this reward|Next|${last})$`) });
  const header = page.getByText(/ · Week end$/);
  for (;;) {
    await expect.poll(async () => (await step.count()) > 0 || (await header.count()) === 0).toBe(true);
    if (!(await step.count())) return;
    if (await page.getByRole('radiogroup', { name: 'Rewards' }).count()) await page.getByRole('radio').first().click();
    const name = (await step.first().textContent())?.trim();
    await step.first().click();
    if (name === last) return;
    if (!(await header.count())) return;
  }
}

test('launches from a signed link and plays a week on the server, then resumes after the browser closes', async ({ page, browser }) => {
  const calls: string[] = [];
  page.on('request', r => { const u = new URL(r.url()); if (/^\/(engine|api)\//.test(u.pathname)) calls.push(`${r.method()} ${u.pathname}`); });
  await page.goto(await link({ sub: 'e2e-1', name: 'Jordan Lee', cohort: 'e2e', redirect: '/?participant=e2e-1&start=board' }));
  expect(new URL(page.url()).search).toBe('?participant=e2e-1&start=board');
  await setStyles(page, 1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your team board, week 1');

  // A 1:1 with Kent: the NPC's words stream from the server (SSE), the outcome comes from the server's engine.
  await page.getByRole('button', { name: /^Kent Goldberg, Lead/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Kent Goldberg, Lead/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Meet face to face/ }).click();
  await page.getByText('Energize the person').click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  await expect(page.getByText('1:1 with Kent Goldberg').first()).toBeVisible();
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await expect(box).toBeFocused();
  await box.fill('I hear you, thanks for being honest. Here is the plan, step by step. What is getting in the way?');
  await box.press('Enter');
  await expect(box).toHaveValue('');
  await page.getByRole('button', { name: /^(End|Finish)/ }).first().click();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Kent (skill|morale|result|trust) (up|down)/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  // Event cards wait behind the outcome and may land a moment later.
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(400); await dismissEvents(page); }

  await page.getByRole('button', { name: /End week/ }).click();
  await dismissEvents(page);
  await expect(page.getByText('End of week 1')).toBeVisible();
  await throughWeekEnd(page, 'Set styles for week 2');
  await expect(page.getByRole('heading', { level: 1, name: 'Set your leadership styles for week 2' })).toBeVisible();

  expect(calls).toEqual(expect.arrayContaining(['GET /engine/sessions/e2e-1/view', 'POST /engine/sessions/e2e-1/intents', 'GET /api/profile']));
  expect(calls.some(c => /^GET \/engine\/sessions\/e2e-1\/interactions\/.+\/turns\/.+\/stream$/.test(c))).toBe(true);

  // Reload: the server's run, not the browser's memory.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/week 2/, { timeout: 30_000 });

  // A new browser (the old one closed): without a session the server refuses; a new launch resumes the same run.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const fresh = await context.newPage();
  const res = await fresh.request.get('/engine/sessions/e2e-1/view');
  expect(res.status()).toBe(401);
  await fresh.goto(await link({ sub: 'e2e-1', redirect: '/?participant=e2e-1&start=board' }));
  await expect(fresh.getByRole('heading', { level: 1 })).toHaveText('Set your leadership styles for week 2', { timeout: 30_000 });
  await context.close();
});

/** Plays a run to its end over HTTP as the participant (bearer launch token), as fast as the engine allows. */
async function playToEnd(request: APIRequestContext, token: string, id: string) {
  const headers = { authorization: `Bearer ${token}` };
  const send = async (intent: unknown) => {
    const r = await request.post(`/engine/sessions/${id}/intents`, { headers, data: intent });
    expect(r.status(), JSON.stringify(intent)).toBe(200);
    return (await r.json()).view;
  };
  let v = await (await request.get(`/engine/sessions/${id}/view`, { headers })).json();
  for (let i = 0; v.phase !== 'ended' && i < 100; i++) {
    if (v.phase === 'style') v = await send({ type: 'confirmStyles', styles: Object.fromEntries(v.members.map((m: { id: string }) => [m.id, 'G'])) });
    else if (v.phase === 'board') v = await send({ type: 'endPeriod' });
    else {
      if (v.pendingReward?.length) v = await send({ type: 'chooseReward', reward: v.pendingReward[0] });
      if (v.phase === 'periodEnd') v = await send({ type: 'startNextPeriod' });
    }
  }
  await send({ type: 'submitReflection', answers: ['Asking first changed how people answered me.'], rating: 4 });
}

test('renders the report as a PDF from the app\'s print view, once, then from the cache', async ({ page, request }) => {
  const token = await mintLaunchToken({ sub: 'e2e-pdf', name: 'Priya Nair', cohort: 'e2e' }, E2E_SECRET);
  const headers = { authorization: `Bearer ${token}` };
  expect((await request.get('/api/report.pdf', { headers })).status()).toBe(404);
  await playToEnd(request, token, 'e2e-pdf');

  // The print view itself, as the renderer sees it.
  await page.goto(await link({ sub: 'e2e-pdf', name: 'Priya Nair', redirect: '/report/print?participant=e2e-pdf' }));
  await expect(page.locator('[data-print-state="ready"]')).toBeVisible({ timeout: 30_000 });
  // The report's title is the participant's name, from the launch.
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('Priya Nair');

  const started = Date.now();
  const first = await request.get('/api/report.pdf', { headers, timeout: 60_000 });
  const firstMs = Date.now() - started;
  expect(first.status()).toBe(200);
  expect(first.headers()['content-type']).toBe('application/pdf');
  const pdf = await first.body();
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(30_000);
  // Several pages: a new page per section.
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThan(3);
  const again = Date.now();
  const second = await request.get('/api/report.pdf', { headers });
  expect((await second.body()).equals(pdf)).toBe(true);
  expect(Date.now() - again).toBeLessThan(firstMs);
});

test('serves the group report to the cohort admin through the app', async ({ page }) => {
  await page.goto(await link({ sub: 'e2e-admin', roles: ['cohort_admin'], cohorts: ['e2e'], cohort: 'e2e' }));
  expect(new URL(page.url()).pathname).toBe('/group');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/participants?/i).first()).toBeVisible();
});
