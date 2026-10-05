import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Onboarding on the engine, by keyboard only: from `/` through the six steps to the board. The
 * sponsor and team come from the Sales Elevator storyline, and a profile read during onboarding
 * shows its stats on the board.
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
  // Each step fades in; check contrast once it has finished, not mid fade.
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))));
  // @axe-core/playwright is typed against a slightly different Playwright version.
  const r = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map(v => `${where}: ${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function setStyles(page: Page) {
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByText(/Styles are set for week/)).toBeVisible();
}

for (const theme of ['dark', 'light'] as const) {
  test(`onboarding by keyboard to the board, ${theme}`, async ({ page }) => {
    await page.goto(theme === 'light' ? '/?theme=light' : '/');

    // 1. Language and play mode. One language is configured, so there is no picker.
    await expect(page.getByRole('heading', { level: 1, name: 'Lead a sales team of ten, for eight weeks.' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Language' })).toHaveCount(0);
    await axe(page, 'language');
    await press(page, page.getByRole('button', { name: "Let's begin" }));

    // 2. The storyline's sponsor, not the design fixture's.
    const sponsor = page.getByRole('heading', { level: 1, name: 'Paula Jacob' });
    await expect(sponsor).toBeVisible();
    await expect(sponsor).toBeFocused();
    await expect(page.getByText('Regional Sales Director, Innov8 Elevators')).toBeVisible();
    await expect(page.getByText('Welcome to Innov8 Elevators. I am glad you are here.')).toBeVisible();
    await expect(page.getByText(/Priya|Northwind|GenieKreator/)).toHaveCount(0);
    // The letter's tabs follow the arrow keys.
    await press(page, page.getByRole('tab', { name: 'Welcome' }), 'ArrowRight');
    await expect(page.getByRole('tab', { name: 'About the product' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Deals move through five stages: Leads, Qualify, Proposal, Negotiation, and Conversion/)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Reach $240,000 in revenue over eight weeks.')).toBeVisible();
    await axe(page, 'sponsor');
    const next = page.getByRole('button', { name: 'Next' });
    await expect(next).toBeEnabled({ timeout: 8000 });
    await press(page, next);

    // 3. Consent.
    await expect(page.getByText('You, and your program manager at Innov8 Elevators. Never your real colleagues.')).toBeVisible();
    await axe(page, 'consent');
    await press(page, page.getByRole('button', { name: 'Accept and use voice' }));

    // 4. Voice check.
    await press(page, page.getByRole('button', { name: 'Start mic test' }));
    await expect(page.getByRole('heading', { level: 1, name: 'We heard you clearly' })).toBeVisible({ timeout: 6000 });
    // The speech layer's transcript (the mock voice in dev reads the test line).
    await expect(page.getByText(/^We heard: .I'm ready to lead my team\..$/)).toBeVisible();
    // The sample voice streams a line with captions, as NPC speech does in a conversation.
    await press(page, page.getByRole('button', { name: 'Play a sample voice' }));
    await expect(page.getByText(/^Hi, good to meet you\. I am glad you are here/)).toBeVisible({ timeout: 10000 });
    // Finished: the whole line is on screen, and read out once from the polite region.
    await expect(page.getByText(/how this week is going\.$/)).toHaveCount(2, { timeout: 15000 });
    await axe(page, 'voice');
    await press(page, page.getByRole('button', { name: 'Sounds good' }));

    // 5. How to play.
    await expect(page.getByText('Each week, set a style for each person, spend your 5 days on actions, then see how the team responds.')).toBeVisible();
    await axe(page, 'how to play');
    await press(page, page.getByRole('button', { name: 'Meet your team' }));

    // 6. Meet the team: reading a profile reveals its stats, from the engine.
    const start = page.getByRole('button', { name: 'Start week 1' });
    await expect(start).toBeDisabled();
    for (const name of ['Kent Goldberg', 'Green Bell', 'Ruth Ether']) {
      const card = page.getByRole('button', { name: new RegExp(`^${name}, `) });
      await press(page, card);
      await expect(card).toHaveAccessibleName(new RegExp(`^${name}, .+, read$`));
      await expect(card.getByText(/^Skill \d+ · Morale \d+ · Result \d+$/)).toBeVisible();
    }
    await expect(page.getByRole('complementary', { name: 'Profile' }).getByText('Ruth Ether')).toBeVisible();
    await expect(page.getByText('3 of 3 profiles read')).toBeVisible();
    await axe(page, 'team');
    await press(page, start);

    // Style setting, then the board: the profiles read in onboarding show their stats on the cards.
    await setStyles(page);
    await expect(page.getByRole('button', { name: /^Kent Goldberg, .*Skill \d+/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ruth Ether, .*Skill \d+/ })).toBeVisible();
    await expect(page.getByText('Open the profile to see stats').first()).toBeVisible();
  });
}

test('settings dialog: focus moves in, stays in, Escape closes it and focus returns', async ({ page }) => {
  await page.goto('/?start=board');
  await setStyles(page);
  const opener = page.getByRole('button', { name: 'Settings' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await axe(page, 'settings');
  // Tab cycles inside the dialog.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);
  }
  // Voice consent is offered and saved.
  const consent = dialog.getByRole('switch', { name: /Use my voice/ });
  await expect(consent).toHaveAttribute('aria-checked', 'false');
  await consent.focus();
  await page.keyboard.press('Space');
  await expect(consent).toHaveAttribute('aria-checked', 'true');
  // Text size scales the font, not the layout.
  const before = await page.getByText('Open the profile to see stats').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await dialog.getByRole('radio', { name: '200%' }).click();
  const after = await page.getByText('Open the profile to see stats').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(after).toBe(before * 2);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
