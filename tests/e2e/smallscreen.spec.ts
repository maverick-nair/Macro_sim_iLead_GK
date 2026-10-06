import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Laptops, desktops and tablets only (D69). Under 744 wide, or under 500 tall on a touch screen (a
 * phone held sideways), a notice covers the app. The app stays mounted underneath, so widening the
 * window or turning the device brings it back where it was. Tablets (744 to 1023) play: upright the tablet layouts (D73), sideways the 1024 layouts.
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

const title = (page: Page) => page.getByRole('heading', { level: 1, name: 'iLead works best on a bigger screen' });
const styles = (page: Page) => page.getByRole('radiogroup', { name: /^Leadership style for/ });
/** Visible controls under 44 by 44, by name. */
const tooSmall = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('main :is(button, [role="radio"], [role="button"], select, input:not([type="checkbox"], [type="radio"]), textarea):not(.sr-only)'))
  .filter(b => b.checkVisibility() && !b.closest('[inert]'))
  .filter(b => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
  .map(b => (b.getAttribute('aria-label') ?? b.textContent ?? b.tagName).slice(0, 40)));
/** The document is no wider than the window: nothing scrolls sideways. */
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [theme, q] of [['dark', ''], ['light', '&theme=light'], ['client', '&client=halden']] as const) {
  test(`a phone sees the notice, not the simulation (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?start=board${q}`);
    await expect(title(page)).toBeVisible();
    await expect(title(page)).toBeFocused();
    await expect(page.getByText('Open this link on a laptop, desktop or tablet to play. Your progress is saved, so you can pick up where you left off.')).toBeVisible();
    await expect(page.getByText('Tablets work in portrait and landscape.')).toBeVisible();
    // The app is mounted underneath but out of reach: one main, nothing of the board for screen readers or Tab.
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(styles(page)).toHaveCount(0);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeFocused();
    // Tab never reaches the app behind.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[inert]'))).toBe(false);
    expect(await axe(page)).toEqual([]);
    if (theme === 'client') await expect(page.getByText('Halden Group logo')).toBeVisible();
  });
}

test('Copy link copies this page’s address and says so', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?start=board&participant=p7');
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});

test('narrowing the window and widening it again keeps the run where it was', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/?start=board');
  await expect(styles(page)).toHaveCount(10);
  // A half set style draft lives only in the app's state.
  const kent = styles(page).first();
  await kent.getByRole('radio').nth(2).click();
  await expect(kent.getByRole('radio').nth(2)).toHaveAttribute('aria-checked', 'true');

  await page.setViewportSize({ width: 600, height: 900 });
  await expect(title(page)).toBeVisible();
  await expect(styles(page)).toHaveCount(0);

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(title(page)).toHaveCount(0);
  await expect(styles(page)).toHaveCount(10);
  await expect(styles(page).first().getByRole('radio').nth(2)).toHaveAttribute('aria-checked', 'true');
  // Focus goes back to where it was.
  await expect(styles(page).first().getByRole('radio').nth(2)).toBeFocused();
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a phone held sideways sees the notice; turning it to a tablet size brings the app back', async ({ page }) => {
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/?start=board');
    await expect(title(page)).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.setViewportSize({ width: 1112, height: 834 });
    await expect(title(page)).toHaveCount(0);
    await expect(styles(page)).toHaveCount(10);
  });

  for (const [width, height] of [[744, 1133], [834, 1194], [1023, 768]] as const) {
    test(`a tablet at ${width} by ${height} plays, with 44px controls and nothing scrolling sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/?start=board');
      await expect(title(page)).toHaveCount(0);
      await expect(styles(page)).toHaveCount(10);
      expect(await sideways(page)).toBe(0);
      expect(await tooSmall(page)).toEqual([]);
      // And the board itself, once the styles are set.
      for (const g of await styles(page).all()) await g.getByRole('radio').nth(1).tap();
      await page.getByRole('button', { name: 'Review and confirm' }).tap();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).tap();
      await page.getByRole('button', { name: 'Dismiss outcome' }).tap();
      await expect(page.getByRole('heading', { name: 'Your team', exact: true })).toBeVisible();
      expect(await sideways(page)).toBe(0);
      expect(await tooSmall(page)).toEqual([]);
    });
  }
});

test('a laptop window shorter than 500 still plays: only touch screens that short get the notice', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 460 });
  await page.goto('/?start=board');
  await expect(styles(page)).toHaveCount(10);
  await expect(title(page)).toHaveCount(0);
});

for (const width of [744, 834, 900, 1023]) {
  test(`the board at ${width} wide (upright, the tablet layout, D73) plays without scrolling sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?start=board');
    await expect(styles(page)).toHaveCount(10);
    expect(await sideways(page)).toBe(0);
    for (const g of await styles(page).all()) await g.getByRole('radio').nth(1).click();
    await page.getByRole('button', { name: 'Review and confirm' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
    await page.getByRole('button', { name: 'Dismiss outcome' }).click();
    const gotIt = page.getByRole('button', { name: 'Got it' });
    while (await gotIt.count()) { await gotIt.click(); await page.waitForTimeout(300); }
    await expect(page.getByRole('heading', { name: 'Your team', exact: true })).toBeVisible();
    expect(await sideways(page)).toBe(0);
  });
}
