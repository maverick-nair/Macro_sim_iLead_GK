import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The portrait tablet layouts (D73): a week played at 834 by 1194 by touch, in dark, light and the
 * client theme. Style setting, the board with its dock, the actions drawer (a modal: focus moves in,
 * Escape closes it, focus returns to the card), people picked on the board, a 1:1 by text, a team
 * action, then the week end into week 2. Axe at every screen, and nothing scrolls sideways.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

test.use({ viewport: { width: 834, height: 1194 }, hasTouch: true, contextOptions: { reducedMotion: 'reduce' } });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function axe(page: Page) {
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  expect(r.violations.map(v => `${v.id}: ${v.nodes.length} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Visible controls under 44 by 44 inside the app, by name. */
const tooSmall = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('main :is(button, [role="radio"], [role="tab"], [role="button"], select, textarea):not(.sr-only)'))
  .filter(b => b.checkVisibility() && !b.closest('[inert]'))
  .filter(b => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
  .map(b => (b.getAttribute('aria-label') ?? b.textContent ?? b.tagName).slice(0, 40)));
const card = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}, `) });
const drawer = (page: Page) => page.getByRole('dialog', { name: /^(Actions for|Team actions)/ });

async function check(page: Page) {
  expect(await sideways(page)).toBe(0);
  await axe(page);
}

async function dismissEvents(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.tap();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

async function dismissOutcome(page: Page) {
  await page.getByRole('button', { name: 'Dismiss outcome' }).tap();
  await expect(page.getByText('How it landed')).toHaveCount(0);
}

async function setStyles(page: Page) {
  const groups = page.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups).toHaveCount(10, { timeout: 20000 });
  await check(page);
  expect(await tooSmall(page)).toEqual([]);
  for (const g of await groups.all()) await g.getByRole('radio').nth(1).tap();
  // The confirm bar sits at the bottom, in reach.
  const review = page.getByRole('button', { name: 'Review and confirm' });
  await expect(review).toHaveCount(1);
  const box = await review.boundingBox();
  expect(box!.y).toBeGreaterThan(1000);
  await review.tap();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).tap();
  await expect(page.getByText(/Styles are set for week \d/)).toBeVisible();
}

for (const [theme, q] of [['dark', ''], ['light', '&theme=light'], ['client', '&client=halden']] as const) {
  test(`a week on a portrait tablet by touch (${theme})`, async ({ page }) => {
    test.setTimeout(150_000);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await page.goto(`/?start=board${q}`);
    await setStyles(page);
    await dismissOutcome(page);
    await dismissEvents(page);

    // The board: HUD, eight tiles, the team in stage columns and the dock.
    await expect(page.getByRole('navigation', { name: 'Board tools' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your team by stage' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Actions · \d+ open · 5 days left$/ })).toBeVisible();
    await check(page);
    expect(await tooSmall(page)).toEqual([]);

    // Tapping a person opens the actions drawer for them, a modal with focus inside.
    await card(page, 'Kent Goldberg').tap();
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page)).toHaveAccessibleName('Actions for Kent Goldberg');
    await expect(drawer(page).getByRole('tab', { name: 'For Kent' })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await check(page);
    expect(await tooSmall(page)).toEqual([]);
    // Escape closes it and focus goes back to Kent's card.
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
    await expect(card(page, 'Kent Goldberg')).toBeFocused();

    // The profile tab reveals the stats.
    await card(page, 'Kent Goldberg').tap();
    await drawer(page).getByRole('tab', { name: 'Profile' }).tap();
    await expect(drawer(page).getByRole('heading', { name: 'Your interactions' })).toBeVisible();
    await check(page);

    if (theme === 'dark') {
      // People are picked on the board: the drawer lowers, the pick bar stands in for it.
      await drawer(page).getByRole('tab', { name: 'For Kent' }).tap();
      await drawer(page).getByRole('radio', { name: /Swap roles/ }).tap();
      await drawer(page).getByRole('button', { name: 'Pick people on the board' }).tap();
      await expect(drawer(page)).toHaveCount(0);
      const bar = page.getByRole('region', { name: 'Picking people for Swap roles' });
      await expect(bar).toBeFocused();
      await card(page, 'Justin Keel').tap();
      await expect(card(page, 'Justin Keel')).toHaveAttribute('aria-pressed', 'true');
      await expect(bar).toContainText('Picked: Kent Goldberg and Justin Keel.');
      await check(page);
      await bar.getByRole('button', { name: 'Done' }).tap();
      await expect(drawer(page)).toBeVisible();
      await expect(drawer(page).getByText('Swap roles: Swap role, with Kent and Justin. Costs 1 day.')).toBeVisible();
      await drawer(page).getByRole('button', { name: 'Close actions' }).tap();
      await expect(drawer(page)).toHaveCount(0);
      await card(page, 'Kent Goldberg').tap();
    } else {
      await drawer(page).getByRole('tab', { name: 'For Kent' }).tap();
    }

    // A 1:1 by text, from the drawer.
    await drawer(page).getByRole('radio', { name: /Meet face to face/ }).tap();
    await drawer(page).getByRole('radio', { name: /Energize the person/ }).tap();
    await drawer(page).getByRole('button', { name: 'Confirm and start · 1 day' }).tap();
    await expect(page.getByText('1:1 with Kent Goldberg').first()).toBeVisible();
    await expect(page.getByText('AI persona').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/is speaking/)).toHaveCount(0, { timeout: 15000 });
    await check(page);
    expect(await tooSmall(page)).toEqual([]);
    const reply = page.getByRole('textbox', { name: 'Your reply' });
    await reply.fill('I am sorry it has been rough. What is on your mind?');
    await page.getByRole('button', { name: 'Send' }).tap();
    await expect(reply).toHaveValue('');
    await expect(page.getByText(/is speaking/)).toHaveCount(0, { timeout: 15000 });
    await page.getByRole('button', { name: /^(End|End and see how it lands)$/ }).tap();
    await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
    await check(page);
    await dismissOutcome(page);
    await dismissEvents(page);

    // A team action from the dock.
    await page.getByRole('button', { name: /^Actions ·/ }).tap();
    await expect(drawer(page)).toHaveAccessibleName('Team actions');
    await drawer(page).getByRole('radio', { name: /Energize the team/ }).tap();
    await drawer(page).getByRole('radio', { name: 'Team Lunch' }).tap();
    await drawer(page).getByRole('button', { name: /^Confirm · / }).tap();
    await expect(drawer(page)).toHaveCount(0);
    await expect(page.getByText('How it landed')).toBeVisible();
    await dismissOutcome(page);
    await dismissEvents(page);

    // The inbox opens from the dock.
    await page.getByRole('button', { name: /^Inbox, / }).tap();
    await expect(page.getByRole('dialog', { name: 'Inbox' })).toBeVisible();
    await check(page);
    await page.keyboard.press('Escape');

    // The week end, then week 2's style setting.
    await page.getByRole('button', { name: /End week/ }).tap();
    await dismissEvents(page);
    await page.getByRole('button', { name: /^See your week$/ }).tap();
    await check(page);
    const step = page.getByRole('button', { name: /^(Continue|Nice|Set styles for week 2)$/ });
    const week2 = page.getByRole('radiogroup', { name: /^Leadership style for/ });
    for (let i = 0; i < 12; i++) {
      await expect(step.first().or(week2.first())).toBeVisible();
      if (await week2.count()) break;
      await check(page);
      // The last step swaps the screen as it is tapped: a tap on a button already gone is fine.
      await step.first().tap({ timeout: 5000 }).catch(() => undefined);
    }
    await expect(week2).toHaveCount(10);
    await expect(page.getByText(/Week 2/).first()).toBeVisible();
    expect(await sideways(page)).toBe(0);
  });
}

test('a landscape tablet keeps the 1024 layout', async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 768 });
  await page.goto('/?start=board');
  await setStylesQuick(page);
  await expect(page.getByRole('navigation', { name: 'Board tools' })).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Actions' })).toBeVisible();
});

async function setStylesQuick(page: Page) {
  const groups = page.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups).toHaveCount(10, { timeout: 20000 });
  for (const g of await groups.all()) await g.getByRole('radio').nth(1).tap();
  await page.getByRole('button', { name: 'Review and confirm' }).tap();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).tap();
  await dismissOutcome(page);
}
