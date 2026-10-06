import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * M7 (D72): a client theme loaded at runtime. The mock API serves a theme JSON from `?themeUrl=`
 * (standing in for `GET /theme`); here it is Brightwater, a deliberately bad palette, which the loader
 * corrects to WCAG AA. The board and the report must then be axe clean, in dark and light.
 */

const BRIGHTWATER = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/theme/samples/brightwater.json'), 'utf8');
const THEME_URL = '/e2e/theme.json';

const errors: string[] = [];
const warnings: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  warnings.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
});
test.afterEach(() => expect(errors).toEqual([]));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function axe(page: Page) {
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.length} ${v.nodes.slice(0, 3).map(n => `${n.target.join(' ')} (${n.any.map(a => a.message).join(' ')})`).join(', ')}`);
}

/** Serves the theme JSON at THEME_URL (matched on the path: the page's own address carries it in its query). Call again to change it. */
const served = new WeakMap<Page, { body: string; status: number }>();
async function serve(page: Page, body: string, status = 200) {
  const first = !served.has(page);
  served.set(page, { body, status });
  if (first) await page.route(u => u.pathname === THEME_URL, r => r.fulfill({ ...served.get(page)!, contentType: 'application/json' }));
}
const themeOn = (page: Page) => page.waitForFunction(() => document.documentElement.dataset.ilTheme).then(h => h.jsonValue());
const rootVar = (page: Page, name: string) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

async function toBoard(page: Page) {
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    await gotIt.first().click();
    await page.waitForTimeout(150);
  }
}

for (const mode of ['dark', 'light'] as const) {
  test(`a custom theme from the mock API is corrected, shows its brand, and the board passes axe (${mode})`, async ({ page }) => {
    await serve(page, BRIGHTWATER);
    await page.goto(`/?start=board&themeUrl=${THEME_URL}${mode === 'light' ? '&theme=light' : ''}`);
    expect(await themeOn(page)).toBe('brightwater');
    // Corrected colours are written as oklch(); the pale yellow accent did not survive as is.
    expect(await rootVar(page, '--il-theme-color-accent-default')).toMatch(/^light-dark\(oklch\([\d. ]+\), /);
    expect(await rootVar(page, '--il-radius-6')).toBe('3px');
    expect(await rootVar(page, '--il-font-family-sans')).toBe('system-ui, sans-serif');
    expect(warnings.some(w => /^iLead theme "brightwater": \d+ contrast correction\(s\)/.test(w))).toBe(true);
    await toBoard(page);
    await expect(page.getByRole('main').getByText('Brightwater', { exact: true })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test(`the report carries the client brand and passes axe in a corrected theme (${mode})`, async ({ page }) => {
    test.setTimeout(120_000);
    await serve(page, BRIGHTWATER);
    await page.goto(`/?report=1&themeUrl=${THEME_URL}${mode === 'light' ? '&theme=light' : ''}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Jordan Lee' })).toBeVisible({ timeout: 60_000 });
    expect(await themeOn(page)).toBe('brightwater');
    await expect(page.locator('header').getByText('Brightwater', { exact: true })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
}

test('an invalid theme falls back field by field, a broken one to the default theme, never a broken screen', async ({ page }) => {
  await serve(page, JSON.stringify({ version: 1, name: 'Acme', colors: { accent: 'very blue', accentSecondary: { light: 'oklch(0.45 0.15 150)', dark: 'oklch(0.82 0.13 150)' } }, font: 'Papyrus' }));
  await page.goto(`/?start=board&themeUrl=${THEME_URL}`);
  expect(await themeOn(page)).toBe('client');
  expect(await rootVar(page, '--il-theme-color-accent-default')).toBe('');
  expect(await rootVar(page, '--il-theme-color-accent-secondary')).toBe('light-dark(oklch(0.45 0.15 150), oklch(0.82 0.13 150))');
  expect(warnings.some(w => w.includes('colors.accent: ') && w.includes('font: '))).toBe(true);
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);

  for (const body of ['{"version": 1, "colors": ', '{"version": 7}', '"just a string"']) {
    await serve(page, body);
    await page.goto(`/?start=board&themeUrl=${THEME_URL}`);
    expect(await themeOn(page)).toBe('default');
    await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  }
  await serve(page, '{}', 500);
  await page.goto(`/?start=board&themeUrl=${THEME_URL}`);
  expect(await themeOn(page)).toBe('default');
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  // The browser logs the failed request itself; that one is expected.
  errors.splice(0, errors.length, ...errors.filter(e => !/status of 500/.test(e)));
});

test('an inline theme in the launch payload wins over the API', async ({ page }) => {
  await page.route(u => u.pathname === '/', async route => {
    const res = await route.fetch();
    const launch = JSON.stringify({ participant: 'p1', theme: { version: 1, id: 'inline', name: 'Inline Co', logo: { text: 'Inline Co' } } });
    await route.fulfill({ response: res, body: (await res.text()).replace('<body>', `<body><script type="application/json" id="il-launch">${launch}</script>`) });
  });
  await page.goto('/?client=halden');
  expect(await themeOn(page)).toBe('inline');
  await expect(page.getByText('Inline Co', { exact: true })).toBeVisible();
  await expect(page.getByText('Halden Group logo')).toHaveCount(0);
});

test('Halden loads through the same path, and its prototype nav reads Objective, History and More (D17)', async ({ page }) => {
  await page.goto('/?client=halden&engine=off&start=board');
  expect(await themeOn(page)).toBe('halden');
  expect(await rootVar(page, '--il-theme-color-accent-default')).toBe('light-dark(oklch(0.5 0.17 0), oklch(0.72 0.17 0))');
  const nav = page.getByRole('navigation', { name: 'Game menu' });
  await expect(nav.getByRole('button')).toHaveText(['Objective', 'History', 'More']);
  await expect(page.getByText('Halden Group logo')).toBeVisible();
});
