import { expect, test, type Page } from '@playwright/test';

/** M3 paths: the hybrid drawer with pick rules and the assess nudge, the profile, keyboard order. */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

async function toBoard(page: Page) {
  await page.goto('/?start=board');
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByText(/Styles are set for week 1/)).toBeVisible();
}

test('swap roles: different stages only, assess nudge, then the conversation', async ({ page }) => {
  await toBoard(page);
  await page.getByText('Justin Keel', { exact: true }).click();
  await page.getByRole('button', { name: /Swap roles/ }).click();
  await page.getByText('Swap role', { exact: true }).click();

  // Derick shares Justin's stage, so he is dimmed with the reason and cannot be picked.
  await expect(page.getByRole('button', { name: /^Derick Kaynes.*Not available: Same stage as Justin/ })).toBeVisible();
  await page.getByText('Derick Kaynes', { exact: true }).click();
  await expect(page.getByText('PEOPLE · 1 OF 2', { exact: false }).or(page.getByText(/People · 1 of 2/i))).toBeVisible();

  await page.getByText('Ruth Ether', { exact: true }).click();
  await expect(page.getByText(/You have not assessed Justin for Conversion/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirm and start/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Assess first' }).click();
  await expect(page.getByText(/4 days left/).first()).toBeVisible();
  await expect(page.getByText(/You have not assessed Ruth for Qualify/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  await expect(page.getByLabel('What you say')).toBeVisible();
});

test('profile: stats revealed, timeline from the engine, actions for that person', async ({ page }) => {
  await toBoard(page);
  await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).click();
  const dialog = page.getByRole('dialog', { name: /Profile for Kent Goldberg/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Styles set for the period')).toBeVisible();
  await expect(dialog.getByText('Career goal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Kent Goldberg.*Skill \d+/ })).toBeVisible();
});

test('keyboard: the inbox comes after the actions in tab order', async ({ page }) => {
  await toBoard(page);
  const order = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('button, [tabindex="0"]')).filter(el => !el.hasAttribute('disabled'));
    const actions = all.findIndex(el => el.closest('aside[aria-label="Actions"]'));
    const inbox = all.findIndex(el => /inbox/i.test(el.getAttribute('aria-label') ?? ''));
    return { actions, inbox };
  });
  expect(order.actions).toBeGreaterThan(-1);
  expect(order.inbox).toBeGreaterThan(order.actions);
});
