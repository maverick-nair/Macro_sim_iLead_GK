import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * D77: the organization's group report at /group on the mock API (a cohort played by the AI players,
 * the cached benchmark): both purposes, chart to table, Download PDF through the print view, the minimum
 * cohort notice, axe in dark, light and the client theme at 1440, 1024 and 834.
 */

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
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
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function open(page: Page, query = '', name = /Regional sales managers|Sales manager selection/) {
  await page.goto(`/group${query}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30000 });
}

const SECTIONS = ['About this report', 'Skills', 'Skill levels across the group', 'Completion rate', 'Business results', 'Leadership style adaptability',
  'Leadership styles distribution', 'Consistency in styles', 'Sales funnel', 'Actions', 'Management style', 'Key takeaways'];

test('development: every section, no names or verdicts, chart to table by keyboard, axe in dark', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByText('Group report · Development', { exact: true })).toBeVisible();
  await expect(page.getByText('Based on 37 participants from your organization who played the simulation.')).toBeVisible();
  for (const h of SECTIONS) await expect(page.getByRole('heading', { level: 2, name: h, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Verdicts' })).toHaveCount(0);
  const text = await page.getByRole('main').innerText();
  for (const w of ['the bar', 'Aisha Rahman', 'competency', 'Competency']) expect(text).not.toContain(w);
  await expect(page.getByText('Benchmark: the average of everyone who has played this simulation so far (300 participants).')).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // The skill distribution becomes a table, by keyboard.
  const group = page.getByRole('group', { name: 'Share of the group at each level' });
  const toggle = group.getByRole('button', { name: 'Show as table' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const table = page.getByRole('table', { name: 'Share of the group at each level' });
  await expect(table.getByRole('columnheader', { name: 'Role Model' })).toBeVisible();
  await expect(table.getByRole('rowheader', { name: 'Coaching for growth' })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  // Every chart offers its table: ten in development.
  expect(await page.getByRole('button', { name: 'Show as table' }).count()).toBe(10);
  expect(await noSideways(page)).toBe(true);
});

test('assessment: verdicts first, the participant table by name, Download PDF prints letter pages, axe', async ({ page }) => {
  await open(page, '?purpose=assessment');
  await expect(page.getByText('Group report · Assessment', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Verdicts' })).toBeVisible();
  await expect(page.getByText('The bar: an overall level of Proficient, with no skill below Developing.')).toBeVisible();
  const people = page.getByRole('table', { name: 'Participants', exact: true });
  await expect(people.getByRole('rowheader')).toHaveCount(18);
  await expect(people.getByRole('rowheader').first()).toHaveText('Aisha Rahman');
  await expect(people.getByRole('columnheader', { name: 'Review' })).toBeVisible();
  await expect(people.getByRole('cell', { name: 'AI only' }).first()).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await expect(page.getByRole('button', { name: /Back to the report/ })).toBeFocused();
  const pages = page.getByRole('article', { name: /^Group report, page \d+$/ });
  const total = await pages.count();
  expect(total).toBeGreaterThanOrEqual(13);
  await expect(page.getByText(`Page ${total} of ${total}`)).toBeVisible();
  // Where a chart would not read on paper, the table prints.
  await expect(page.getByRole('table', { name: 'Share of the group at each level' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Deviation, group and benchmark' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show as table' })).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: /Back to the report/ }).press('Enter');
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeFocused();
});

test('print media lays the pages out one per letter sheet, and the light print view passes axe', async ({ page }) => {
  await open(page, '?print=1&theme=light');
  await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();
  expect(await axe(page)).toEqual([]);
  const total = await page.getByRole('article', { name: /^Group report, page \d+$/ }).count();
  await page.emulateMedia({ media: 'print' });
  const sheets = await page.evaluate(() => Array.from(document.querySelectorAll('article[aria-label^="Group report, page"]')).map(a => {
    const r = (a.parentElement as HTMLElement).getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  }));
  expect(sheets).toHaveLength(total);
  for (const s of sheets) expect(s).toEqual([816, 1056]);
  await expect(page.getByRole('button', { name: /Back to the report/ })).toBeHidden();
});

test('under the minimum cohort size the aggregates are withheld with a message', async ({ page }) => {
  await open(page, '?size=3');
  await expect(page.getByRole('heading', { level: 2, name: 'Group results withheld' })).toBeVisible();
  await expect(page.getByText(/needs at least 5 to keep individual results private/)).toBeVisible();
  for (const h of ['Skills', 'Business results', 'Completion rate']) await expect(page.getByRole('heading', { level: 2, name: h, exact: true })).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
});

test('light theme at 1440, the client theme at 1024: axe clean, nothing sideways', async ({ page }) => {
  await open(page, '?theme=light');
  expect(await axe(page)).toEqual([]);
  await page.setViewportSize({ width: 1024, height: 900 });
  await open(page, '?client=halden&purpose=assessment');
  await expect(page.getByText('Halden Group logo')).toBeVisible();
  expect(await noSideways(page)).toBe(true);
  expect(await axe(page)).toEqual([]);
});

test('Six Leadership Styles at 834 in the light theme and in dark: five style rows, axe clean, nothing sideways', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1194 });
  await open(page, '?lens=six_styles&theme=light');
  await expect(page.getByText('Sales Elevator, Innov8 Elevators · Six Leadership Styles lens')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Drive', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Harmonizer' })).toBeVisible();
  expect(await noSideways(page)).toBe(true);
  expect(await axe(page)).toEqual([]);
  await open(page, '?lens=six_styles');
  expect(await noSideways(page)).toBe(true);
  expect(await axe(page)).toEqual([]);
});
