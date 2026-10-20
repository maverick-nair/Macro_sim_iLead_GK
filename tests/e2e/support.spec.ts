import { expect, test } from '@playwright/test';

/**
 * The browser floor (index.html, player.html): a browser without native light-dark() gets one plain notice
 * and the app does not boot, instead of every colour rendering wrong.
 */
test('a browser under the floor sees the notice and nothing else', async ({ page }) => {
  await page.addInitScript(() => { CSS.supports = () => false; });
  await page.goto('/?start=board');
  await expect(page.getByRole('alert')).toContainText('This browser is too old for iLead');
  await expect(page.getByRole('heading', { level: 1, name: 'This browser is too old for iLead' })).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('a supported browser boots as before', async ({ page }) => {
  await page.goto('/?start=board');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ }).first()).toBeVisible({ timeout: 20000 });
});
