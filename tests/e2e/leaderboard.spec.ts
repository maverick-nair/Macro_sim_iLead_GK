import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The cohort leaderboard (scoring-and-report.md 6) on the mock engine and the mock cohort API: one line
 * in the HUD score breakdown during play, and the "Your cohort" table on the end screen. Selection use
 * hides both; that is covered by `src/components/gamification/leaderboard.test.ts` and the
 * `Components/Cohort leaderboard` stories (the mock engine always runs a development storyline).
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function axe(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.length} ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
}

/** Sets the same style for everyone and confirms, then clears the team's reaction and any event cards. */
async function setStyles(page: Page) {
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByText(/Styles are set for week \d/)).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  await dismissEvents(page);
}

async function dismissEvents(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

/** Walks the last week's week end to the end screen (as tests/e2e/end.spec.ts does). */
async function toEndScreen(page: Page) {
  await page.getByRole('button', { name: /End week/ }).click();
  await dismissEvents(page);
  await expect(page.getByText('End of week 8')).toBeVisible();
  await page.getByRole('button', { name: /^See your week$/ }).click();
  const step = page.getByRole('button', { name: /^(Continue|Nice|See your results)$/ });
  const h1 = page.getByRole('heading', { level: 1, name: /^You finished at (Bronze|Silver|Gold|Platinum)\.$/ });
  for (;;) {
    await expect(step.first().or(h1)).toBeVisible();
    if (await h1.count()) break;
    await step.first().click();
  }
  await expect(h1).toBeFocused();
}

test('the cohort rank in the score breakdown, then the cohort table on the end screen', async ({ page }) => {
  await page.goto('/?start=board&period=8');
  await setStyles(page);
  // The board carries the storyline's celebration level (subtle by default).
  await expect(page.getByRole('main')).toHaveAttribute('data-celebration', 'subtle');

  // During play, by keyboard: the breakdown opens with the rank among the cohort (15 with the mock).
  const score = page.getByRole('button', { name: /^Leadership score \d+/ });
  await score.focus();
  await page.keyboard.press('Enter');
  await expect(score).toHaveAttribute('aria-expanded', 'true');
  const pop = page.locator(`[id="${await score.getAttribute('aria-controls')}"]`);
  await expect(pop.getByText(/^Rank \d+ of 15 in your cohort$/)).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(score).toBeFocused();

  await toEndScreen(page);
  // A region named by its heading, holding a real table named by its caption.
  const panel = page.getByRole('region', { name: 'Your cohort' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/^Rank \d+ of 15$/)).toBeVisible();
  const table = panel.getByRole('table', { name: /^Your cohort by Leadership Score, top 10(, then your own place)?\. Your row is marked You\.$/ });
  await expect(table.getByRole('columnheader')).toHaveText(['Rank', 'Name', 'Score', 'Tier']);
  // The top 10, plus this participant's own row when outside it.
  const rows = table.getByRole('row');
  const count = await rows.count();
  expect([11, 12]).toContain(count);
  // Exactly one row is this participant's, marked in text (You) and as current.
  const mine = table.locator('tr[aria-current="true"]');
  await expect(mine).toHaveCount(1);
  await expect(mine.getByRole('rowheader')).toContainText('You');
  const rank = Number((await panel.getByText(/^Rank \d+ of 15$/).textContent())!.match(/\d+/)![0]);
  await expect(mine.getByRole('cell').first()).toHaveText(String(rank));
  // Every other row has a name and a tier from the engine's tiers; the mock cohort is named, not anonymous.
  await expect(table.getByRole('rowheader').filter({ hasText: 'A colleague' })).toHaveCount(0);
  await expect(table.getByRole('row').filter({ hasText: /Bronze|Silver|Gold|Platinum/ })).toHaveCount(count - 1);

  // By keyboard: the panel holds nothing to tab to, so Tab from the last end screen control leaves the
  // screen's controls without stopping in it, and the panel scrolls into view for reading.
  await page.getByRole('button', { name: 'Email to me' }).focus();
  await page.keyboard.press('Tab');
  await expect(panel.locator(':focus')).toHaveCount(0);
  await panel.scrollIntoViewIfNeeded();
  await expect(table).toBeInViewport();
  expect(await axe(page)).toEqual([]);
});
