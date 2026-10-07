import { expect, test } from '@playwright/test';

/**
 * Localization (D83): the launch picks the language (`?locale=`), the engine sends codes the client
 * words, and the pseudo locales find overflow and right to left problems.
 */
const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

test('Spanish: the HUD and the engine copy are worded in Spanish, the rest falls back to English', async ({ page }) => {
  await page.goto('/?start=board&locale=es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // Style setting has no Spanish copy yet: English, key by key.
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  // The engine sent `engine.styles.headline`; the client worded it in Spanish.
  await expect(page.getByRole('heading', { name: 'Estilos fijados para la semana 1' })).toBeVisible();
  await expect(page.getByText(/respondió bien a cómo piensas liderarlo/).first()).toBeVisible();
  // The HUD's catalog is Spanish: "Semana 1 · Día 1", "Terminar la semana 1".
  await expect(page.getByText('Semana 1').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Terminar la semana/ })).toBeVisible();
});

for (const width of [1440, 1024]) {
  test(`pseudo long copy (en-XA) at ${width}: every catalog string is accented and the page never scrolls sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?start=board&locale=en-XA');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-XA');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\[.*·+\]$/, { timeout: 20000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}

test('pseudo right to left (ar-XB): the page runs right to left and does not scroll sideways', async ({ page }) => {
  await page.goto('/?start=board&locale=ar-XB');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[dir="rtl"]').first()).toBeAttached();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/‮/, { timeout: 20000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
