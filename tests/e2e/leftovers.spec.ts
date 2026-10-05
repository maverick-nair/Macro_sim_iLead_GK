import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Desktop leftovers from M0 to M6: Pause on the engine board (nothing in the run moves while paused),
 * the welcome back recap from the engine, and the Actions panel that folds on a 1024 wide board.
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
  return r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
}

async function toBoard(page: Page, q = '') {
  await page.goto(`/?start=board${q}`);
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

test('Pause in the HUD stops the session clock until Resume', async ({ page }) => {
  await toBoard(page);
  const pause = page.getByRole('button', { name: 'Pause the simulation' });
  await expect(pause).toHaveText(/^\d+:\d\d$/);
  const start = await pause.textContent();
  await expect.poll(() => pause.textContent(), { timeout: 4000 }).not.toBe(start);

  await pause.click();
  const dialog = page.getByRole('dialog', { name: 'You are paused' });
  await expect(dialog).toBeVisible();
  expect(await axe(page)).toEqual([]);
  const held = await pause.textContent();
  await page.waitForTimeout(2500);
  expect(await pause.textContent()).toBe(held);

  await dialog.getByRole('button', { name: 'Resume' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(pause).toBeFocused();
  await expect.poll(() => pause.textContent(), { timeout: 4000 }).not.toBe(held);
});

test('with the clock hidden the HUD keeps a Pause button', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ilead.settings.local', JSON.stringify({ text: 100, captions: true, reduced: false, input: 'ptt', clock: false, voiceConsent: false })));
  await toBoard(page);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'You are paused' })).toBeVisible();
});

test('pausing a conversation holds the streamed line and its clock', async ({ page }) => {
  await toBoard(page);
  await page.getByText('Kent Goldberg', { exact: true }).click();
  await page.getByRole('button', { name: /Meet face to face/ }).click();
  await page.getByText('Energize the person').click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  const timer = page.getByRole('button', { name: /^Pause\. \d+:\d\d left$/ });
  await timer.click();
  const dialog = page.getByRole('dialog', { name: 'You are paused' });
  await expect(dialog).toBeVisible();
  const main = page.getByRole('main');
  const before = await main.innerText();
  await page.waitForTimeout(2500);
  // Nothing moved: not the NPC's words, not the clock.
  expect(await main.innerText()).toBe(before);
  await dialog.getByRole('button', { name: 'Resume' }).click();
  await expect(dialog).toHaveCount(0);
  // The line carries on to the end and the conversation goes on.
  await expect(page.getByRole('textbox').last()).toBeEditable({ timeout: 15_000 });
  await expect(page.getByText(/is speaking\. Talk to interrupt/)).toHaveCount(0, { timeout: 15_000 });
});

test('a run in progress opens on the board with the welcome back recap from the engine, once per load', async ({ page }) => {
  // A new run starts at onboarding.
  await page.goto('/');
  await expect(page.getByRole('button', { name: "Let's begin" })).toBeVisible();

  // The mock opens at week 3 with two weeks played: the app skips onboarding and says where things stand.
  await page.goto('/?period=3');
  const dialog = page.getByRole('dialog', { name: 'You are in week 3, day 1' });
  await expect(dialog).toBeVisible({ timeout: 20000 });
  await expect(dialog.getByText('Welcome back')).toBeVisible();
  await expect(dialog.getByText(/^\d+(½)? days? left$/)).toBeVisible();
  // Back in style setting, what changed is last week, from its summary; the last outcome is the newest log entry.
  await expect(dialog.getByRole('heading', { name: 'Over last week' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Last outcome' })).toBeVisible();
  await expect(dialog.getByText('Team skill')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /(is|are) waiting|Nothing is waiting/ })).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await dialog.getByRole('button', { name: 'Back to my team' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  await page.waitForTimeout(800);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('at 1024 the Actions panel folds to a rail, opens for a selected person, and stays folded after a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await toBoard(page);
  const team = page.getByRole('heading', { name: /^Your team/ }).locator('xpath=ancestor::*[contains(@class, "col-start-2")][1]');
  const wide = (await team.boundingBox())!.width;

  await page.getByRole('button', { name: 'Hide actions, to give the team board more room' }).click();
  const rail = page.getByRole('button', { name: /^Show actions\. .* open now, .* left$/ });
  await expect(rail).toBeVisible();
  await expect(rail).toHaveAttribute('aria-expanded', 'false');
  expect((await team.boundingBox())!.width).toBeGreaterThan(wide + 200);
  expect(await axe(page)).toEqual([]);

  // Selecting someone opens the panel for them; deselecting folds it again.
  await page.getByText('Kent Goldberg', { exact: true }).click();
  await expect(page.getByText('For Kent', { exact: true })).toBeVisible();
  await page.getByText('Kent Goldberg', { exact: true }).click();
  await expect(rail).toBeVisible();

  // The choice is a setting, kept per participant.
  await toBoard(page);
  await expect(page.getByRole('button', { name: /^Show actions\./ })).toBeVisible();
  await page.getByRole('button', { name: /^Show actions\./ }).click();
  await expect(page.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
});

test('at 1440 the Actions panel has no fold', async ({ page }) => {
  await toBoard(page);
  await expect(page.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hide actions/ })).toHaveCount(0);
});

for (const [theme, q] of [['light', '&theme=light'], ['client', '&client=halden']] as const) {
  test(`axe in the ${theme} theme: the recap, the folded Actions panel and the paused board`, async ({ page }) => {
    await page.goto(`/?period=3${q}`);
    const recap = page.getByRole('dialog', { name: /^You are in week 3/ });
    await expect(recap).toBeVisible({ timeout: 20000 });
    expect(await axe(page)).toEqual([]);
    await recap.getByRole('button', { name: 'Back to my team' }).click();

    await page.setViewportSize({ width: 1024, height: 900 });
    await toBoard(page, q);
    await page.getByRole('button', { name: 'Hide actions, to give the team board more room' }).click();
    await expect(page.getByRole('button', { name: /^Show actions\./ })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Pause the simulation' }).click();
    await expect(page.getByRole('dialog', { name: 'You are paused' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
}
