import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The pre-game flow on the engine (D219), by keyboard: landing, the sponsor's video message, the product portfolio
 * (Sales Elevator's four Levo models, D221), the objectives, then week 1. Everything named comes from the
 * storyline: its sponsor, organisation, products, team and target.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

/** Presses Tab until the target has focus, so every control used is reachable by keyboard. */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate(el => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Not reachable by Tab: ${target.toString()}`);
}
async function press(page: Page, target: Locator, key = 'Enter') {
  await tabTo(page, target);
  await page.keyboard.press(key);
}
async function axe(page: Page, where: string) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))));
  const r = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map(v => `${where}: ${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

for (const theme of ['dark', 'light'] as const) {
  test(`four screens by keyboard to week 1, ${theme}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(theme === 'light' ? '/?theme=light' : '/');

    // 1. Landing: one paragraph, three facts, only Log out in the header; the sponsor's message arrives after a moment.
    const h1 = page.getByRole('heading', { level: 1, name: 'Lead a team of ten through eight weeks that count.' });
    await expect(h1).toBeFocused();
    await expect(page.getByText(/^You are the new leader of a team of ten at Innov8 Elevators\./)).toBeVisible();
    await expect(page.getByRole('list', { name: 'What to expect' }).getByRole('listitem')).toHaveCount(3);
    await expect(page.getByRole('banner').getByRole('button')).toHaveText(['Log out']);
    const watch = page.getByRole('button', { name: 'Watch the video message from Paula Jacob' });
    await expect(watch).toHaveCount(0);
    await expect(watch).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('status').filter({ hasText: 'New video message' })).toContainText('Paula Jacob, Regional Sales Director');
    await axe(page, 'landing');
    await press(page, watch);

    // 2. The message: Mute in the header, captions on and read out, CC, three chapters, play and position.
    await expect(page.getByRole('heading', { level: 1, name: 'A message from Paula Jacob' })).toBeAttached();
    const mute = page.getByRole('button', { name: 'Mute video' });
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await press(page, mute);
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    const captions = page.getByRole('region', { name: 'Captions' });
    await expect(captions.locator('[aria-live="polite"]')).toHaveText('Welcome to Innov8 Elevators. I am glad you are here.');
    const cc = page.getByRole('button', { name: 'Captions', exact: true });
    await expect(cc).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('list').filter({ hasText: 'The challenge' }).getByRole('button')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /^Part 3, Your goal, from / })).toBeVisible();
    await axe(page, 'message');
    await press(page, page.getByRole('button', { name: /^Part 2, What I expect/ }));
    await expect(captions.locator('[aria-live="polite"]')).toHaveText(/^Deals move through five stages/);
    await press(page, cc);
    await expect(cc).toHaveAttribute('aria-pressed', 'false');
    await press(page, page.getByRole('slider', { name: 'Position in the message' }), 'End');
    // The end card: the storyline has a portfolio, so the products are next; Watch again starts over.
    await expect(page.getByRole('heading', { name: 'First, get to know what your team sells.' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Watch again' })).toBeVisible();
    await axe(page, 'message end');
    await press(page, page.getByRole('button', { name: 'Explore products' }));

    // 3. The product portfolio (D221): the storyline's four models, kind and number, tagline, who it is for, the
    // features as tabs and as spots placed on the photo, the specs with the typical deal.
    await expect(page.getByRole('heading', { level: 1, name: 'Product portfolio' })).toBeAttached();
    const models = page.getByRole('navigation', { name: 'Product portfolio' }).getByRole('listitem');
    await expect(models).toHaveCount(4);
    await expect(page.getByText('Commercial / 01')).toBeVisible();
    await expect(page.getByText('Engineered to fit. Built to move.')).toBeVisible();
    await expect(page.getByText('Mid rise offices, clinics, hotels and mixed use buildings.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Levo B10: a steel and glass passenger lift car in a grey studio' })).toBeVisible();
    const panel = page.getByRole('tabpanel');
    // The panel names the point, then says it (D232).
    await expect(panel).toHaveText(/Built modular\s*Ships in modules and installs in nine days/);
    await expect(page.getByRole('tab', { name: /Built modular$/ })).toHaveAttribute('aria-selected', 'true');
    await press(page, page.getByRole('tab', { name: /Built modular$/ }), 'ArrowRight');
    await expect(page.getByRole('tab', { name: /Made to last$/ })).toBeFocused();
    await expect(panel).toHaveText(/Made to last\s*A 25 year structural warranty/);
    await press(page, page.getByRole('button', { name: 'Point 4: Winning the deal' }));
    await expect(panel).toHaveText(/Winning the deal\s*Clients buy uptime, not steel\./);
    await expect(page.getByText('Rated load 1,000 kg')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Typical deal' })).toHaveText('Typical deal $30K');
    await expect(page.getByRole('img', { name: 'Explored 1 of 4 models' })).toBeAttached();
    await axe(page, 'products');
    await press(page, page.getByRole('button', { name: 'Next: Levo H4' }));
    await expect(page.getByRole('heading', { name: 'Levo H4' })).toBeFocused();
    await expect(page.getByText('Residential / 02')).toBeVisible();
    await expect(page.getByText('Quiet enough for home.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Explored 2 of 4 models' })).toBeAttached();
    await press(page, page.getByRole('button', { name: 'See your objectives' }));

    // 4. Objectives from the storyline: eight weeks, the target, ten people and how you win; no How you are scored (D220).
    await expect(page.getByRole('heading', { level: 1, name: 'Eight weeks to lead your team at Innov8 Elevators.' })).toBeFocused();
    await expect(page.getByText('8 weeks', { exact: true })).toBeVisible();
    await expect(page.getByText('$240K', { exact: true })).toBeVisible();
    await expect(page.getByText('10 people', { exact: true })).toBeVisible();
    await expect(page.getByText('Have 2 live conversations a week.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How you are scored' })).toHaveCount(0);
    // Start simulation shows after five seconds, and cannot be reached before.
    const start = page.getByRole('button', { name: 'Start simulation' });
    await expect(start).toBeHidden();
    await expect(start).toBeVisible({ timeout: 8000 });
    // The optional microphone test (the mock voice answers), then text instead.
    await press(page, page.getByRole('button', { name: 'Test your microphone' }));
    await expect(page.getByText('We heard you. Voice is on.')).toBeVisible({ timeout: 10_000 });
    await axe(page, 'objectives');
    await press(page, page.getByRole('button', { name: 'Prefer typing? Use text instead' }));
    await expect(page.getByText('Text it is. You can switch to voice in Settings.')).toBeVisible();
    await press(page, start);

    // Week 1 starts with style setting; no practice offer above it on this path.
    await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Skip practice' })).toHaveCount(0);
  });
}

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('Start simulation shows at once, and Skip to your objectives goes straight there', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Played before? Skip to your objectives' }).click();
    await expect(page.getByRole('button', { name: 'Start simulation' })).toBeVisible();
  });
});

test('Log out saves and signs out, and Sign back in returns to the landing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'You are signed out.' })).toBeFocused();
  await axe(page, 'signed out');
  await page.getByRole('button', { name: 'Sign back in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Lead a team of ten/ })).toBeVisible();
});
