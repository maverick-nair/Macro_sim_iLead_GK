import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Flow: set styles, run a 1:1 on the engine, read the outcome, end the week and start the next. */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

async function dismissEvents(page: Page) {
  for (let i = 0; i < 4; i++) {
    const b = page.getByRole('button', { name: 'Got it' });
    if (!(await b.count())) return;
    await b.click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
}

async function setStyles(page: Page, index = 1) {
  await expect(page.getByRole('button', { name: 'Confirm styles' })).toBeDisabled();
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(index).click();
  await page.getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByRole('button', { name: 'Confirm styles' })).toHaveCount(0);
}

test('a week on the engine, from styles to the next week', async ({ page }) => {
  await page.goto('/?start=board');
  await expect(page.getByText('Open the profile to see stats').first()).toBeVisible();
  await expect(page.getByText('Set everyone’s style first.').first().or(page.getByText("Set everyone's style first.").first())).toBeVisible();
  await setStyles(page);

  // Actions open once styles are set; costs read in days.
  // Keyboard selection: the card's toggle is visually hidden, the card draws its focus ring.
  await page.getByRole('button', { name: /^Kent Goldberg/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Kent Goldberg/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Meet face to face/ }).click();
  await page.getByText('Energize the person').click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  await dismissEvents(page);

  await page.getByLabel('What you say').fill('I hear you, thanks for being honest. Here is the plan, step by step. What is getting in the way?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('How it landed')).toBeVisible();
  await expect(page.getByText(/Kent (skill|morale|result|trust) (up|down)/).first()).toBeVisible();
  await expect(page.getByText(/4 days left/).first()).toBeVisible();
  await dismissEvents(page);

  // Opening a profile reveals stats on the card.
  await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).click();
  await expect(page.getByRole('button', { name: /^Kent Goldberg.*Skill \d+/ })).toBeVisible();

  // @axe-core/playwright is typed against a slightly different Playwright version.
  const a11y = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(a11y.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await page.getByRole('button', { name: /End week/ }).click();
  await expect(page.getByRole('heading', { name: 'Week 1 is done' })).toBeVisible();
  const reward = page.getByText('Your sponsor offers you something');
  if (await reward.count()) await page.getByRole('dialog').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Start week 2' }).click();
  await expect(page.getByText(/^Week 2/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm styles' })).toBeVisible();
});
