import { expect, test, type Page } from '@playwright/test';
import { croppedPortraits } from './fixtures/portraitFit';

/**
 * Every actor portrait shows the whole head, crown to chin, in whatever frame it sits: the style cards, the board,
 * the profile and the 1:1, on a laptop and on a tablet held upright. Wide frames show the whole photo, whose white
 * background disappears into the card through mix-blend-multiply.
 */
async function setStyles(page: Page) {
  const groups = page.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups.first()).toBeVisible({ timeout: 20000 });
  for (const g of await groups.all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
}

async function expectWholeHeads(page: Page, least: number) {
  await expect.poll(() => page.locator('img[src*="/assets/npc/"]').evaluateAll(xs => xs.filter(x => (x as HTMLImageElement).complete && x.getBoundingClientRect().width > 1).length)).toBeGreaterThanOrEqual(least);
  expect(await croppedPortraits(page)).toEqual([]);
}

for (const [width, height, touch] of [[1440, 900, false], [834, 1194, true]] as const) {
  test.describe(`${width}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch });

    test('style cards, the board, the profile and the 1:1 show whole heads', async ({ page }) => {
      await page.goto('/?start=board');
      await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ }).first()).toBeVisible({ timeout: 20000 });
      await expectWholeHeads(page, 10);
      await setStyles(page);
      await expectWholeHeads(page, 10);
      await page.getByRole('button', { name: 'Dismiss outcome' }).click();
      await expectWholeHeads(page, 10);
      await page.getByText('Kent Goldberg', { exact: true }).first().click();
      await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).or(page.getByRole('tab', { name: 'Profile' })).first().click();
      await expectWholeHeads(page, 11);
      await page.goto('/?start=board');
      await setStyles(page);
      await page.getByRole('button', { name: 'Dismiss outcome' }).click();
      await page.getByText('Kent Goldberg', { exact: true }).first().click();
      await page.getByRole('button', { name: /Meet face to face/ }).or(page.getByRole('radio', { name: /Meet face to face/ })).first().click();
      await page.getByRole('radio', { name: /Energize the person/ }).click();
      await page.getByRole('button', { name: /Confirm and start/ }).click();
      await expect(page.getByRole('textbox', { name: 'Your reply' })).toBeVisible({ timeout: 15000 });
      await expectWholeHeads(page, 1);
    });
  });
}
