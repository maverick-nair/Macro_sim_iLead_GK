import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Stakeholders outside the team on the board (D160 to D162), on the Client Trust demo storyline in the mock: the
 * stakeholders in the business row, the panel with each relationship and what you can do now, a live conversation
 * with a stakeholder through the usual live screen, a request answered from the board, and a static negotiation.
 * Keyboard only where it matters; axe on the panel at 1024 and on the tablet.
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

/** Week 2 of Client Trust, styles set, the team's reaction read, week 1's cards closed. */
async function week2(page: Page, size = { width: 1024, height: 768 }) {
  await page.setViewportSize(size);
  await page.goto('/?start=board&storyline=client-trust&period=2');
  const groups = page.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups).toHaveCount(10, { timeout: 20000 });
  for (const g of await groups.all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

const bar = (page: Page) => page.getByRole('button', { name: /^Stakeholders: Priya Shah, steady; Helen Brandt, steady; Elena Ruiz, steady\. Open$/ });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Stakeholders' });

test('the stakeholders on the board and in their panel: role, relationship, what you can do now', async ({ page }) => {
  await week2(page);
  await expect(bar(page)).toBeVisible();
  // The board keeps to the window at 1024: the business row does not push the team out of view.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await bar(page).focus();
  await page.keyboard.press('Enter');
  const p = panel(page);
  await expect(p).toBeVisible();
  await expect(p.getByRole('heading', { name: 'Stakeholders' })).toBeFocused();
  await expect(p.getByRole('article')).toHaveCount(3);
  const priya = p.getByRole('article', { name: 'Priya Shah' });
  await expect(priya.getByText('Head of Finance Operations, Halcyon Retail, a customer')).toBeVisible();
  await expect(priya.getByRole('img', { name: /^Trust in you 55/ })).toBeVisible();
  await expect(priya.getByRole('button', { name: /^Meet Priya · 1 day/ })).toBeEnabled();
  // A negotiation that opens in week 3 says so.
  await expect(priya.getByRole('button', { name: /^Negotiate the go live scope/ })).toBeDisabled();
  await expect(priya.getByText('Unlocks in week 3')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(p).toHaveCount(0);
  await expect(bar(page)).toBeFocused();
});

test('a meeting with a stakeholder is a live conversation; it moves the relationship, and they can be met once a week', async ({ page }) => {
  await week2(page);
  await bar(page).click();
  await panel(page).getByRole('article', { name: 'Priya Shah' }).getByRole('button', { name: /^Meet Priya/ }).click();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('1:1 with Priya Shah');
  await expect(page.getByText('AI persona').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/is speaking/)).toHaveCount(0, { timeout: 15000 });
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await box.fill('Thank you for making time. What matters most to you this quarter? I will send you the plan by Friday.');
  await box.press('Enter');
  await expect(box).toHaveValue('');
  await expect(page.getByText(/is speaking/)).toHaveCount(0, { timeout: 15000 });
  await page.getByRole('button', { name: /^(End|End and see how it lands)$/ }).click();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/^Priya: trust \+\d+, satisfaction \+\d+$/)).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await bar(page).or(page.getByRole('button', { name: /^Stakeholders: Priya Shah/ })).first().click();
  const priya = panel(page).getByRole('article', { name: 'Priya Shah' });
  await expect(priya.getByText(/You have engaged Priya this period/)).toBeVisible();
  await expect(priya.getByRole('button', { name: /^Email Priya an update/ })).toBeDisabled();
});

test('a stakeholder\'s request waits on the board with its deadline, and Answer opens the meeting they asked for', async ({ page }) => {
  await week2(page);
  // Two days on team building run days 1 and 2: Priya's request arrives on day 2, with the discount decision.
  await page.getByRole('button', { name: /Energize the team/ }).click();
  await page.getByRole('radio', { name: /Team building/ }).click();
  await page.getByRole('button', { name: /^Confirm/ }).click();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  const decision = page.getByRole('dialog', { name: 'A deep discount to close this week' });
  if (await decision.count()) await decision.getByRole('button', { name: 'Decide later' }).click();
  const request = page.locator('[data-stakeholder-request="client_lead"]');
  await expect(request).toContainText('Priya asks:');
  await expect(request).toContainText('Priya asks for a call about the review');
  await request.getByRole('button', { name: 'Answer Priya Shah' }).click();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('1:1 with Priya Shah');
  await page.getByRole('button', { name: /^(End|Leave)/ }).first().click();
});

test('a negotiation as a decision: the option, and an outcome that depends on the relationship', async ({ page }) => {
  await week2(page);
  await bar(page).click();
  const helen = panel(page).getByRole('article', { name: 'Helen Brandt' });
  await helen.getByRole('button', { name: /^Ask for contractor budget/ }).click();
  await helen.getByRole('radio', { name: /Ask for \$20,000 for a contractor this quarter/ }).check();
  await helen.getByRole('button', { name: 'Confirm' }).click();
  await expect(panel(page)).toHaveCount(0);
  // Helen's trust is under what the ask needs: she says no.
  await expect(page.getByText('Helen says no: show her the numbers first.')).toBeVisible();
});

test('the stakeholders fit the tablet board and their panel passes axe there', async ({ page }) => {
  await week2(page, { width: 834, height: 1112 });
  await expect(bar(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await bar(page).click();
  await expect(panel(page).getByRole('article')).toHaveCount(3);
  expect(await axe(page)).toEqual([]);
});
