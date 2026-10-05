import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * M6: the development report from a real ended run on the mock engine (`/?report=1`, dev only: the good
 * player plays all eight weeks, then the report opens). Chart to table by keyboard, the print view and
 * window.print, with axe in dark, light and print.
 */

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // The browser's print dialog is the browser's; count the calls instead.
  await page.addInitScript(() => {
    const w = window as unknown as { printed: number; print: () => void };
    w.printed = 0;
    w.print = () => { w.printed++; };
  });
});
test.afterEach(() => expect(errors).toEqual([]));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function axe(page: Page) {
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.length} ${v.nodes.slice(0, 3).map(n => `${n.target.join(' ')} (${n.any.map(a => a.message).join(' ')})`).join(', ')}`);
}

const focused = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement;
  return `${a.tagName}|${(a.getAttribute('aria-label') ?? a.textContent ?? '').trim()}`;
});
async function tabTo(page: Page, rx: RegExp) {
  for (let i = 0; i < 120; i++) {
    if (rx.test(await focused(page))) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached ${rx}`);
}

async function open(page: Page, query = '') {
  await page.goto(`/?report=1${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Jordan Lee' })).toBeVisible({ timeout: 30000 });
}

test('report from an ended run: sections, chart to table by keyboard, print view, axe in dark', async ({ page }) => {
  await open(page);
  // Focus starts on the name, the page's only h1.
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  for (const h of ['Your team over eight weeks', 'Style fit, week by week', 'Intent and action', 'Your leadership skills', 'Key moments', 'Your people over the run', 'Business results', 'How you talked', 'Your plan for next week', 'How this report was made']) {
    await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  }
  await expect(page.getByText('Built from your reflection: “Kent taught me that the loudest problem is not always the real one.”')).toBeVisible();
  await expect(page.getByText('Not yet reviewed by an assessor')).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // The small multiples become a table, by keyboard.
  await tabTo(page, /^BUTTON\|Show as table$/);
  const toggle = page.getByRole('button', { name: 'Show as table' }).first();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const table = page.getByRole('table', { name: 'Your team over eight weeks' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Week 8' })).toBeVisible();
  await expect(table.getByRole('rowheader', { name: 'Team trust' })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('img', { name: /^Team trust from \d+ to \d+$/ })).toBeVisible();

  // Download PDF opens the letter pages and the print dialog.
  await tabTo(page, /^BUTTON\|Download PDF$/);
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await expect(page.getByRole('button', { name: /Back to the report/ })).toBeFocused();
  // Every page is a letter page with its footer, and charts that would not read on paper are tables.
  const pages = page.getByRole('article', { name: /^Development report, page \d+$/ });
  const total = await pages.count();
  expect(total).toBeGreaterThan(2);
  await expect(page.getByText(`Page ${total} of ${total}`)).toBeVisible();
  await expect(page.getByRole('table', { name: 'Kent Goldberg: Morale, Trust and Result' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show as table' })).toHaveCount(0);
  expect(await axe(page)).toEqual([]);

  await page.getByRole('button', { name: 'Print or save as PDF' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(2);
  await page.getByRole('button', { name: /Back to the report/ }).press('Enter');
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeFocused();
  await expect(page.getByText(/^Page 1 of/)).toHaveCount(0);
});

test('report in the light theme, and its print view, pass axe', async ({ page }) => {
  await open(page, '&theme=light');
  expect(await axe(page)).toEqual([]);
  await open(page, '&theme=light&print=1');
  await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test('a passive run has no overall level, shows every skill without enough evidence, and is axe clean in the client theme', async ({ page }) => {
  await open(page, '&policy=passive&seed=2&client=halden');
  await expect(page.getByText('Not enough evidence for an overall level')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Your leadership skills' })).toBeVisible();
  await expect(page.getByRole('img', { name: /: not enough evidence for a level$/ })).toHaveCount(8);
  expect(await axe(page)).toEqual([]);
});

test('print media lays the pages out one per letter sheet', async ({ page }) => {
  await open(page, '&print=1');
  await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();
  const total = await page.getByRole('article', { name: /^Development report, page \d+$/ }).count();
  await page.emulateMedia({ media: 'print' });
  const sheets = await page.evaluate(() => Array.from(document.querySelectorAll('article[aria-label^="Development report, page"]')).map(a => {
    const r = (a.parentElement as HTMLElement).getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  }));
  expect(sheets).toHaveLength(total);
  // 8.5 by 11 inches at 96 px per inch.
  for (const s of sheets) expect(s).toEqual([816, 1056]);
  await expect(page.getByRole('button', { name: /Back to the report/ })).toBeHidden();
});
