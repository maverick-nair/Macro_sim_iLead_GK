import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The lens drives the simulation (D70). `?lens=six_styles` plays Sales Elevator with the Six Leadership
 * Styles test lens: six styles in every style control, style setting and the board, a week played to its
 * end. Nothing names Directing, Guiding, Partnering or Entrusting; nothing scrolls sideways at 1440 or
 * 1024; every letter is a 44px target on a touch screen; axe finds nothing.
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
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.length} ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
}

const SIX = ['Vision Setter', 'Coach', 'Harmoniser', 'Collaborator', 'Pace Setter', 'Commander'];
const OLD = /Directing|Guiding|Partnering|Entrusting/;
const styles = (page: Page) => page.getByRole('radiogroup', { name: /^Leadership style for/ });
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Visible style letters under 44 by 44. */
const smallLetters = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('main [role="radiogroup"] [role="radio"]'))
  .filter(b => b.checkVisibility() && !b.closest('[inert]'))
  .filter(b => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length);

for (const width of [1440, 1024]) {
  test(`six styles at ${width}: set styles with the six letter control and end the week`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?start=board&lens=six_styles');
    await expect(styles(page)).toHaveCount(10, { timeout: 20000 });

    // Style setting: the six definitions, six letters per person, nothing of the default lens.
    const defs = page.getByRole('list', { name: /style/i }).getByRole('listitem');
    await expect(defs).toHaveCount(6);
    for (const name of SIX) await expect(defs.filter({ hasText: name })).toHaveCount(1);
    for (const g of await styles(page).all()) await expect(g.getByRole('radio')).toHaveCount(6);
    await expect(styles(page).first().getByRole('radio').first()).toHaveAccessibleName(/^Vision Setter\. /);
    expect(await page.locator('main').innerText()).not.toMatch(OLD);
    expect(await sideways(page)).toBe(0);
    expect(await axe(page)).toEqual([]);
    await page.screenshot({ path: `test-results/lens-six-stylesetting-${width}.png`, fullPage: true });

    // The list view: one radio column per style, headed by its letter, named in full for screen readers.
    await page.getByRole('radio', { name: 'List' }).click();
    const table = page.getByRole('table', { name: 'Styles for every team member' });
    await expect(table.getByRole('columnheader', { name: 'Harmoniser' })).toBeVisible();
    await expect(table.getByRole('radio', { name: 'Pace Setter for Kent Goldberg' })).toBeVisible();
    expect(await sideways(page)).toBe(0);
    expect(await axe(page)).toEqual([]);
    await page.getByRole('radio', { name: 'Cards' }).click();
    await expect(styles(page)).toHaveCount(10);

    // Pick a different letter for different people, by click and by keyboard.
    const all = await styles(page).all();
    for (const [i, g] of all.entries()) await g.getByRole('radio').nth(i % 6).click();
    await all[0].getByRole('radio').nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(all[0].getByRole('radio').nth(1)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(all[0].getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText(/^Coach\.$/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Review and confirm' }).click();
    const summary = page.getByRole('dialog');
    await expect(summary.getByText('Commander').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await summary.getByRole('button', { name: 'Confirm styles' }).click();
    await expect(page.getByText(/Styles are set for week 1/)).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss outcome' }).click();
    const gotIt = page.getByRole('button', { name: 'Got it' });
    while (await gotIt.count()) {
      const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
      await gotIt.click();
      await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
    }

    // The board: the six letter control on every card, locked for the week, with the lens's names.
    await expect(page.getByRole('heading', { name: 'Your team', exact: true })).toBeVisible();
    await expect(styles(page)).toHaveCount(10);
    for (const g of await styles(page).all()) await expect(g.getByRole('radio')).toHaveCount(6);
    await expect(styles(page).first().getByRole('radio', { checked: true })).toHaveText('CO');
    expect(await sideways(page)).toBe(0);
    expect(await axe(page)).toEqual([]);
    await page.screenshot({ path: `test-results/lens-six-board-${width}.png`, fullPage: true });

    // End the week.
    await page.getByRole('button', { name: /End week/ }).click();
    for (;;) {
      await expect(page.getByRole('button', { name: 'Got it' }).or(page.getByText(/^End of week 1$/))).toBeVisible({ timeout: 10000 });
      if (!(await gotIt.count())) break;
      await page.keyboard.press('Escape');
    }
    await expect(page.getByText(/^End of week 1$/)).toBeVisible();
    expect(await page.locator('main').innerText()).not.toMatch(OLD);
    expect(await axe(page)).toEqual([]);
  });
}

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('six letters wrap to rows of three, each a 44px target', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/?start=board&lens=six_styles');
    await expect(styles(page)).toHaveCount(10, { timeout: 20000 });
    expect(await smallLetters(page)).toBe(0);
    expect(await sideways(page)).toBe(0);
    for (const g of await styles(page).all()) await g.getByRole('radio').nth(5).tap();
    await page.getByRole('button', { name: 'Review and confirm' }).tap();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).tap();
    await page.getByRole('button', { name: 'Dismiss outcome' }).tap();
    await expect(page.getByRole('heading', { name: 'Your team', exact: true })).toBeVisible();
    expect(await smallLetters(page)).toBe(0);
    expect(await sideways(page)).toBe(0);
  });
});
