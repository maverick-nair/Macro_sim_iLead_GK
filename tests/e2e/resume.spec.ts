import { expect, test } from '@playwright/test';

/** Save and resume on the client (D86): offline banner and queue, and the unsaved work guard. */
test('offline mid run: the action waits with a clear banner, then goes out on reconnect', async ({ page, context }) => {
  await page.goto('/?start=board');
  const groups = page.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups).toHaveCount(10, { timeout: 20000 });
  for (const g of await groups.all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await context.setOffline(true);
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  const banner = page.getByRole('status').filter({ hasText: 'You are offline.' });
  await expect(banner).toHaveText(/1 action is saved here and goes out when you reconnect/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Set your leadership styles for week 1');
  await context.setOffline(false);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your team board, week 1', { timeout: 10000 });
  await expect(banner).toHaveCount(0);
});

test('leaving the page mid conversation with words not sent asks first', async ({ page }) => {
  await page.goto('/?start=board&practice=1');
  await page.getByRole('region', { name: 'Practice before week 1' }).getByRole('button', { name: /^Practice with / }).click({ timeout: 20000 });
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await box.fill('Something I have not sent yet');
  const dialog = new Promise<string>(resolve => page.once('dialog', d => { resolve(d.type()); void d.accept(); }));
  await page.close({ runBeforeUnload: true });
  expect(await dialog).toBe('beforeunload');
});
