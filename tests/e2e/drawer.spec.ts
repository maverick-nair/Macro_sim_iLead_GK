import { expect, test, type Page } from '@playwright/test';

/** M3 paths: the hybrid drawer with pick rules and the assess nudge, the profile, keyboard order. */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

async function toBoard(page: Page, model = '') {
  await page.goto(`/?start=board${model}`);
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByText(/^Styles are set for week \d/)).toBeVisible();
  // How it landed is a pop-up (D242): back to the board.
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) await gotIt.first().click();
}

// One stage each (D243's stage model, `?model=stages`): a stage can be full.
test('move options come from the engine: full stages are shown unavailable, with the reason', async ({ page }) => {
  await toBoard(page, '&period=4&model=stages');
  await page.locator('section[aria-label="Your team"]').getByText('Kent Goldberg', { exact: true }).click();
  await page.getByRole('button', { name: /Swap roles/ }).click();
  // Focus lands on the drawer's heading.
  await expect(page.getByRole('heading', { name: 'Swap roles' })).toBeFocused();
  const options = page.getByRole('radiogroup', { name: 'Choose an option' });
  const qualify = options.getByRole('radio', { name: /Move to Qualify/ });
  await expect(qualify).toHaveAttribute('aria-disabled', 'true');
  await expect(qualify).toContainText('Qualify is full');
  // Kent is in Leads: no move to his own stage.
  await expect(options.getByRole('radio', { name: /Move to Leads/ })).toHaveCount(0);
  await qualify.click({ force: true });
  await expect(qualify).toHaveAttribute('aria-checked', 'false');
  await options.getByRole('radio', { name: /Swap role/ }).click();
  await expect(options.getByRole('radio', { name: /Swap role/ })).toHaveAttribute('aria-checked', 'true');
  // Back returns focus to the action's tile.
  await page.getByRole('button', { name: /All actions/ }).click();
  await expect(page.getByRole('button', { name: /^Swap roles/ })).toBeFocused();
  await page.getByRole('button', { name: /^Assess member/ }).click();
  await expect(page.getByRole('radiogroup', { name: 'Choose an option' }).getByRole('radio', { name: /^Assess for Qualify/ })).toBeVisible();
});

test('swap roles: different stages only, assess nudge, then the conversation', async ({ page }) => {
  await toBoard(page, '&model=stages');
  await page.getByText('Justin Keel', { exact: true }).click();
  await page.getByRole('button', { name: /Swap roles/ }).click();
  await page.getByText('Swap role', { exact: true }).click();

  // Derick shares Justin's stage, so he is dimmed with the reason and cannot be picked.
  await expect(page.getByRole('button', { name: /^Derick Kaynes.*Not available: Same stage as Justin/ })).toBeVisible();
  // The card says it is not available (aria-disabled); a click on it still explains why.
  await page.getByText('Derick Kaynes', { exact: true }).click({ force: true });
  await expect(page.getByText('PEOPLE · 1 OF 2', { exact: false }).or(page.getByText(/People · 1 of 2/i))).toBeVisible();

  await page.getByText('Ruth Ether', { exact: true }).click();
  await expect(page.getByText(/You have not assessed Justin for Conversion/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirm and start/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Assess first' }).click();
  await expect(page.getByText(/4 days left/).first()).toBeVisible();
  await expect(page.getByText(/You have not assessed Ruth for Qualify/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  await expect(page.getByText('1:1 with Justin Keel')).toBeVisible();
});

test('profile: stats revealed, timeline from the engine, actions for that person', async ({ page }) => {
  await toBoard(page);
  // The desk opens a profile from the person's actions (D232): select them first.
  if (!(await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).count())) await page.getByText('Kent Goldberg', { exact: true }).click();
  await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).click();
  const dialog = page.getByRole('dialog', { name: /Profile for Kent Goldberg/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Styles set for the period')).toBeVisible();
  await expect(dialog.getByText('Career goal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Kent Goldberg.*Skill \d+/ })).toBeVisible();
});

test('change focus, selling end to end (D243): every stage is open, the move reads as a focus', async ({ page }) => {
  await toBoard(page, '&period=4');
  await page.getByText('Kent Goldberg', { exact: true }).click();
  await page.getByRole('button', { name: /^Change focus/ }).click();
  await expect(page.getByRole('heading', { name: 'Change focus' })).toBeFocused();
  const options = page.getByRole('radiogroup', { name: 'Choose an option' });
  // Nobody sits in a stage, so none is full.
  await expect(options.getByRole('radio', { name: /^Focus on Qualify/ })).not.toHaveAttribute('aria-disabled', 'true');
  await expect(options.getByText(/is full/)).toHaveCount(0);
});

test('keyboard: the inbox is in the top bar, and nothing jumps the tab order', async ({ page }) => {
  await toBoard(page, '&period=3');
  // The inbox, feedback and milestones open from the envelope (D242), before the team in the tab order.
  const envelope = page.getByRole('button', { name: /^Inbox, \d+ unread$/ });
  await expect(envelope).toBeVisible();
  const order = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'))
      .filter(el => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getClientRects().length > 0);
    const at = (pick: (el: HTMLElement) => boolean) => all.map((el, i) => (pick(el) ? i : -1)).filter(i => i >= 0);
    return {
      envelope: at(el => el.hasAttribute('data-mail-button')),
      team: at(el => el.hasAttribute('data-member-card')),
      actions: at(el => !!el.closest('aside[aria-label="Actions"]')),
      positive: all.filter(el => el.tabIndex > 0).length
    };
  });
  expect(order.positive).toBe(0);
  expect(order.envelope).toHaveLength(1);
  expect(order.envelope[0]).toBeLessThan(Math.min(...order.team));
  expect(Math.max(...order.team)).toBeLessThan(Math.min(...order.actions));
});
