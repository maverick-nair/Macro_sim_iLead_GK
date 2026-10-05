import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** M6: the end screen on the engine. Finish a run, reflect, save, open the report slot, look at the board and come back. */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function axe(page: Page) {
  // Steps rise in; colour contrast is measured once they have landed (finite animations only).
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

/** Plays the last week (the mock engine opens at week 8), then walks its week end to the end screen. */
async function finishRun(page: Page, theme = '') {
  await page.goto(`/?start=board&period=8${theme ? `&${theme}` : ''}`);
  await setStyles(page);
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
  return h1;
}

test('the end of a run: reflect by text, rate, save, the report slot, the board and back', async ({ page }) => {
  const h1 = await finishRun(page);
  await expect(page.getByText('Simulation complete')).toBeVisible();
  await expect(page.getByText(/^Eight weeks, \w+ people, one team$/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Moments from your eight weeks' })).toBeVisible();
  const results = page.getByRole('region', { name: 'Results' });
  await expect(results.getByText('Target achieved')).toBeVisible();
  await expect(results.getByText(/^of \$240,000$/)).toBeVisible();
  await expect(results.getByText('Team trust')).toBeVisible();
  // Every badge of the library is on the shelf, earned or not.
  await expect(page.getByRole('heading', { name: 'Badges' }).locator('..').getByRole('listitem')).toHaveCount(10);
  expect(await axe(page)).toEqual([]);

  // A moment opens in SBI form.
  const moment = page.getByRole('list').first().getByRole('button').first();
  await moment.click();
  await expect(moment).toHaveAttribute('aria-expanded', 'true');
  const sbi = page.locator(`[id="${await moment.getAttribute('aria-controls')}"]`);
  await expect(sbi.getByText('Situation', { exact: true })).toBeVisible();
  await expect(sbi.getByText('What you did', { exact: true })).toBeVisible();
  await expect(sbi.getByText('Impact', { exact: true })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await moment.click();
  await expect(moment).toHaveAttribute('aria-expanded', 'false');
  await expect(sbi).toBeHidden();

  // Voice needs consent, which this run never gave.
  await page.getByRole('button', { name: 'Answer by voice' }).first().click();
  await expect(page.getByText('Voice is off. You can turn it on in Settings.')).toBeVisible();

  // Answer by text and rate with the arrow keys.
  const answer = page.getByRole('textbox').first();
  await answer.fill('Asking first changed everything.');
  await expect(page.getByRole('status').filter({ hasText: 'Not saved yet' })).toBeVisible();
  const rating = page.getByRole('radiogroup', { name: 'Rating, 1 to 5' });
  await rating.getByRole('radio', { name: '3 of 5' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(rating.getByRole('radio', { name: '4 of 5' })).toBeFocused();
  await expect(rating.getByRole('radio', { name: '4 of 5' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Save answers' }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();

  // Email goes through the API; the report slot opens from View my report.
  await page.getByRole('button', { name: 'Email to me' }).click();
  await expect(page.getByText('Report sent to your work email.')).toBeVisible();
  await answer.fill('Asking first changed everything. I will check in before I decide.');
  await page.getByRole('button', { name: 'View my report' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your report' })).toBeFocused();
  await expect(page.getByText('The report opens here.')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'Back to your results' }).click();
  await expect(h1).toBeFocused();
  // The answer edited before leaving was saved on the way out, and comes back from the engine.
  await expect(page.getByRole('textbox').first()).toHaveValue('Asking first changed everything. I will check in before I decide.');
  await expect(rating.getByRole('radio', { name: '4 of 5' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();

  // Download PDF opens the report in its print view.
  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect(page.getByText('The print view of your report opens here.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to your results' }).click();
  await expect(h1).toBeFocused();

  // The board, read only, and back.
  await page.getByRole('button', { name: 'Look at the board' }).click();
  await expect(page.getByText('The run is over. The board is read only now.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Energize the team/ })).toContainText('The run is over');
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'See your results' }).click();
  await expect(h1).toBeFocused();
  await expect(page.getByRole('textbox').first()).toHaveValue('Asking first changed everything. I will check in before I decide.');
});

test('light theme: the end screen, the board and the report slot pass axe', async ({ page }) => {
  await finishRun(page, 'theme=light');
  expect(await axe(page)).toEqual([]);
  await page.getByRole('radio', { name: '5 of 5' }).click();
  await page.getByRole('button', { name: 'Look at the board' }).click();
  await expect(page.getByText('The run is over. The board is read only now.')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'See your results' }).click();
  await expect(page.getByRole('radio', { name: '5 of 5' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'View my report' }).click();
  await expect(page.getByText('The report opens here.')).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test('client theme: the end screen passes axe', async ({ page }) => {
  await finishRun(page, 'client=halden');
  expect(await axe(page)).toEqual([]);
});
