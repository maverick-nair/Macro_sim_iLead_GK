import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Choice events and the business on the board (D136, D137), on the Client Trust demo storyline in the mock:
 * the business bar, the decision dialog (what you know, the options, Decide or Decide later), what happened,
 * and the decision waiting on the board. Axe on the dialog in both states.
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
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.length}`);
}

/** Week 2 of Client Trust, styles set, the team's reaction read. */
async function week2(page: Page, size?: { width: number; height: number }) {
  if (size) await page.setViewportSize(size);
  await page.goto('/?start=board&storyline=client-trust&period=2');
  const groups = page.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups).toHaveCount(10, { timeout: 20000 });
  for (const g of await groups.all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  await dismissEvents(page);
}

/** Closes event cards one at a time (week 1's, left open by the fast forward), waiting for each to go. */
async function dismissEvents(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

/** Two days on team building: the week's day 2 runs, and the choice event on it comes up. On the tablet, from the dock. */
async function teamBuilding(page: Page, tablet = false) {
  if (tablet) {
    await page.getByRole('button', { name: /^Actions ·/ }).click();
    const drawer = page.getByRole('dialog', { name: 'Team actions' });
    await drawer.getByRole('radio', { name: /Energize the team/ }).click();
    await drawer.getByRole('radio', { name: /Team building/ }).click();
    await drawer.getByRole('button', { name: /^Confirm · / }).click();
  } else {
    await page.getByRole('button', { name: /Energize the team/ }).click();
    await page.getByRole('radio', { name: /Team building/ }).click();
    await page.getByRole('button', { name: /^Confirm/ }).click();
  }
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
}

test('the business bar shows the variables the participant is shown, and what moved them', async ({ page }) => {
  await week2(page);
  const bar = page.getByRole('region', { name: 'The business' });
  await expect(bar.getByRole('button', { name: /^Budget \$60K/ })).toBeVisible();
  await expect(bar.getByRole('button', { name: /^Customer trust 70%/ })).toBeVisible();
  await expect(bar.getByRole('button', { name: /^Product quality \d+/ })).toBeVisible();
  // Reputation is authored as hidden.
  await expect(bar.getByText('Reputation')).toHaveCount(0);
  await bar.getByRole('button', { name: /^Product quality/ }).click();
  await expect(bar.getByText('A week went by')).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test('a choice event: the options, a decision, what happened and what it changed', async ({ page }) => {
  await week2(page);
  await teamBuilding(page);
  const dialog = page.getByRole('dialog', { name: 'A deep discount to close this week' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'A deep discount to close this week' })).toBeFocused();
  await expect(dialog.getByText('The client\'s budget year ends on Friday.')).toBeVisible();
  const options = dialog.getByRole('group', { name: 'What do you do?' }).getByRole('radio');
  await expect(options).toHaveCount(3);
  // Nothing is decided until an option is picked.
  await expect(dialog.getByRole('button', { name: 'Decide', exact: true })).toBeDisabled();
  expect(await axe(page)).toEqual([]);
  await dialog.getByRole('radio', { name: /Hold the price/ }).check();
  await dialog.getByRole('button', { name: 'Decide', exact: true }).click();
  await expect(dialog.getByText('You chose:')).toBeVisible();
  await expect(dialog.getByText(/goes back with a business case instead of a discount/)).toBeVisible();
  await expect(dialog.getByText('Customer trust +4%')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('region', { name: 'The business' }).getByRole('button', { name: /^Customer trust 74%/ })).toBeVisible();
});

test('decide later: the decision waits on the board with its deadline, and opens again from there', async ({ page }) => {
  await week2(page);
  await teamBuilding(page);
  const dialog = page.getByRole('dialog', { name: 'A deep discount to close this week' });
  await dialog.getByRole('button', { name: 'Decide later' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const bar = page.getByRole('region', { name: 'The business' });
  await expect(bar.getByText(/A deep discount to close this week\s+2 days left/)).toBeVisible();
  await bar.getByRole('button', { name: 'Decide A deep discount to close this week' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const size of [{ width: 1024, height: 768 }, { width: 834, height: 1112 }]) {
  test(`the business bar and the decision fit at ${size.width} wide`, async ({ page }) => {
    await week2(page, size);
    const bar = page.getByRole('region', { name: 'The business' });
    await expect(bar).toBeVisible();
    const box = await bar.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    await teamBuilding(page, size.width < 1000);
    const dialog = page.getByRole('dialog', { name: 'A deep discount to close this week' });
    await expect(dialog.getByRole('button', { name: 'Decide later' })).toBeInViewport();
    expect(await axe(page)).toEqual([]);
  });
}
