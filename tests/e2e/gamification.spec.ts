import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Game scores and events on the board, on the mock engine: the score breakdown and the badge shelf
 * by keyboard, Team Pulse and sponsor confidence, and the incoming sponsor call (Sales Elevator rings
 * with "Recession strikes" on day 3 of week 3).
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

/** Opens the board at a period, sets every style, and clears the outcome and any event cards. */
async function board(page: Page, query: string) {
  await page.goto(`/?start=board&${query}`);
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByRole('heading', { name: /Styles are set for week/ })).toBeFocused();
  await dismissOutcome(page);
  // Cards from earlier weeks wait behind the outcome; they open one at a time.
  await expect(page.getByRole('dialog')).toHaveCount(1);
  // The event card with its art band and type tag.
  await expect(page.getByRole('dialog').getByText(/^(Impact|Signal|Capacity|Diagnostic|Opportunity|Crisis) event$/)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  expect(await axe(page)).toEqual([]);
  await dismissEvents(page);
}

async function dismissOutcome(page: Page) {
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
}

async function dismissEvents(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

/** Spends the first three days of the week: team building (2 days), then assessing Kent (1 day). */
async function spendThreeDays(page: Page) {
  await page.getByRole('button', { name: /Energize the team/ }).click();
  await page.getByRole('radio', { name: /Team building/ }).click();
  await page.getByRole('button', { name: /^Confirm/ }).click();
  await expect(page.getByText(/3 days left/).first()).toBeVisible();
  await dismissOutcome(page);
  await page.getByText('Kent Goldberg', { exact: true }).click();
  await page.getByRole('button', { name: /Assess member/ }).click();
  await page.getByRole('radiogroup', { name: 'Choose an option' }).getByRole('radio').first().click();
  await page.getByRole('button', { name: /^Confirm/ }).click();
  await expect(page.getByText(/2 days left/).first()).toBeVisible();
}

test('score breakdown and badge shelf, by keyboard', async ({ page }) => {
  await board(page, 'period=3');
  const score = page.getByRole('button', { name: /^Leadership score \d+/ });
  await score.focus();
  await page.keyboard.press('Enter');
  await expect(score).toHaveAttribute('aria-expanded', 'true');
  const pop = page.locator(`[id="${await score.getAttribute('aria-controls')}"]`);
  await expect(pop.getByText(/^\d+ of 1,000$/)).toBeVisible();
  await expect(pop.getByText('Business 30%', { exact: false })).toBeVisible();
  await expect(pop.getByText('Revenue against target')).toBeVisible();
  await expect(pop.getByText('Change in team morale and trust since the start')).toBeVisible();
  await expect(pop.getByText(/^Style fit \d+%/)).toBeVisible();
  // Two weeks with stars so far: the streak says how far the bonus is.
  await expect(pop.getByText('2 weeks in a row. 1 more week for a +25 bonus.')).toBeVisible();
  await expect(pop.getByRole('listitem').filter({ hasText: 'You are here' })).toHaveCount(1);
  // The flame says the same.
  await expect(page.getByRole('img', { name: '2 weeks in a row. 1 more week for a +25 bonus.' })).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // Tab into the breakdown: it stays open while focus is inside, and the badge shelf is the way on.
  const shelfButton = pop.getByRole('button', { name: /^Badges, \d+ of 10$/ });
  for (let i = 0; i < 10 && !(await shelfButton.evaluate(b => b === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(shelfButton).toBeFocused();
  await page.keyboard.press('Enter');
  const shelf = page.getByRole('dialog', { name: 'Badges' });
  await expect(shelf).toHaveCSS('opacity', '1');
  await expect(shelf.getByRole('heading', { name: 'Badges' })).toBeFocused();
  await expect(shelf.getByRole('listitem')).toHaveCount(10);
  await expect(shelf.getByText(/^Earned in week \d$/).first()).toBeVisible();
  await expect(shelf.getByText('Not earned yet').first()).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(shelf).toHaveCount(0);
  await expect(score).toBeFocused();
  // Escape inside the breakdown closes it and returns to the score.
  await page.keyboard.press('Enter');
  await expect(score).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(score).toHaveAttribute('aria-expanded', 'false');
  await expect(score).toBeFocused();
});

test('Team Pulse and sponsor confidence show the engine values', async ({ page }) => {
  await board(page, 'period=3');
  await expect(page.getByRole('group', { name: /^Team pulse \d+, (rising|easing|steady) since the start of the week\. \d+ upbeat, \d+ steady, \d+ struggling$/ })).toBeVisible();
  const sponsor = page.getByRole('button', { name: /Sponsor confidence (Low|Wavering|Steady|Confident|Champion), \d+/ });
  await sponsor.click();
  await expect(page.getByText('Rise to 70 and Paula offers you a reward.')).toBeVisible();
  await expect(page.getByText('Drop below 30 and the CEO asks for a check in. It takes a day of your time.')).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test('a sponsor call: Take the call opens the conversation', async ({ page }) => {
  await board(page, 'period=3');
  await expect(page.getByText('Paula Jacob is calling')).toHaveCount(0);
  await spendThreeDays(page);
  const call = page.getByRole('alert').filter({ hasText: 'Paula Jacob is calling' });
  await expect(call).toBeVisible();
  // Let it finish sliding in, so contrast is checked at full opacity.
  await expect(call).toHaveCSS('opacity', '1');
  await expect(call).toContainText('Regional Sales Director. Recession strikes');
  await expect(call.getByRole('button', { name: 'Call back within 2 days' })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await call.getByRole('button', { name: 'Take the call' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Paula');
  await expect(page.getByRole('textbox', { name: 'Your reply' })).toBeVisible();
  await expect(call).toHaveCount(0);
});

test('a sponsor call: Later leaves it in the inbox, pinned with its due', async ({ page }) => {
  await board(page, 'period=3');
  await spendThreeDays(page);
  const call = page.getByRole('alert').filter({ hasText: 'Paula Jacob is calling' });
  await call.getByRole('button', { name: 'Call back within 2 days' }).click();
  await expect(call).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: "Paula's call is waiting in your inbox" })).toBeVisible();
  await page.getByRole('button', { name: /^Inbox/ }).click();
  const inbox = page.getByRole('dialog', { name: 'Inbox' });
  const item = inbox.locator('div.rounded-16').filter({ hasText: 'Recession strikes' });
  await expect(item.getByText('Pinned · Due in 2 days')).toBeVisible();
  await expect(item.getByRole('button', { name: 'Reply now' })).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

for (const [theme, q] of [['light', 'theme=light'], ['client', 'client=halden']] as const) {
  test(`${theme} theme: breakdown, badge shelf and sponsor call are axe clean`, async ({ page }) => {
    await board(page, `period=3&${q}`);
    const score = page.getByRole('button', { name: /^Leadership score \d+/ });
    await score.focus();
    await page.keyboard.press('Enter');
    await expect(score).toHaveAttribute('aria-expanded', 'true');
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: /^Badges, \d+ of 10$/ }).click();
    await expect(page.getByRole('dialog', { name: 'Badges' })).toHaveCSS('opacity', '1');
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Badges' })).toHaveCount(0);
    await spendThreeDays(page);
    await expect(page.getByRole('alert').filter({ hasText: 'Paula Jacob is calling' })).toHaveCSS('opacity', '1');
    expect(await axe(page)).toEqual([]);
  });
}
