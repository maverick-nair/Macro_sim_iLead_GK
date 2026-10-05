import { expect, test, type Page } from '@playwright/test';

/**
 * Visual regression for the screens the engine renders (the design frames are held by `npm run parity`).
 * Every screen at 1440 and 1024, in dark, light and the sample client theme. Phones do not play
 * (D69): at 390 the small screen notice covers the app. The mock engine is seeded, so the same
 * intents give the same pixels. `npx playwright test visual --update-snapshots` refreshes the baselines.
 */

const THEMES = { dark: '', light: 'theme=light', client: 'client=halden' } as const;
const url = (...q: string[]) => `/?${q.filter(Boolean).join('&')}`;
const DESK = [1440, 1024] as const;

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))));
  });
}

async function shot(page: Page, name: string, fullPage = false) {
  await settle(page);
  // The session clock in the HUD's Pause button counts real seconds: masked, so the shot is stable.
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002, fullPage, mask: [page.getByRole('button', { name: 'Pause the simulation' })] });
}

async function confirmStyles(page: Page) {
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  // Confirming styles shows its outcome; dismiss it so the shot is the plain board.
  await expect(page.getByRole('heading', { name: /Styles are set for week 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByRole('region', { name: 'Outcome' })).toHaveCount(0);
}

/** Plays the last week on the mock engine (opened at week 8) and walks its week end to the end screen. */
async function finishRun(page: Page) {
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  // Event cards wait behind the outcome.
  await expect(page.getByText('How it landed')).toHaveCount(0);
  await dismissCards(page);
  await page.getByRole('button', { name: /End week/ }).click();
  await dismissCards(page);
  await page.getByRole('button', { name: /^See your week$/ }).click();
  const step = page.getByRole('button', { name: /^(Continue|Nice)$/ });
  const h1 = page.getByRole('heading', { level: 1, name: /^You finished at / });
  for (;;) {
    await expect(step.first().or(h1)).toBeVisible();
    if (await h1.count()) return;
    await step.first().click();
  }
}

/** Event cards one after another: each goes before the next shows. */
async function dismissCards(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

async function dismissEvents(page: Page) {
  for (let i = 0; i < 4; i++) {
    const b = page.getByRole('button', { name: 'Got it' });
    if (!(await b.count())) return;
    await b.click();
    await expect(b).toHaveCount(0);
  }
}

for (const [theme, q] of Object.entries(THEMES)) {
  test.describe(theme, () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('small screen notice at 390', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url('start=board', q));
      await expect(page.getByRole('heading', { level: 1, name: 'iLead works best on a bigger screen' })).toBeVisible();
      await shot(page, `${theme}-390-notice`);
    });

    for (const width of DESK) {
      test(`onboarding at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(url(q));
        await expect(page.getByRole('heading').first()).toBeVisible();
        await shot(page, `${theme}-${width}-onboarding`);
      });

      test(`style setting at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(url('start=board', q));
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
        await shot(page, `${theme}-${width}-styles`);
      });
    }

    for (const width of DESK) {
      test(`board at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(url('start=board', q));
        await confirmStyles(page);
        await dismissEvents(page);
        await shot(page, `${theme}-${width}-board`);
      });

      test(`1:1 at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(url('start=board', q));
        await confirmStyles(page);
        await page.getByText('Kent Goldberg', { exact: true }).click();
        await page.getByRole('button', { name: /Meet face to face/ }).click();
        await page.getByText('Energize the person').click();
        await page.getByRole('button', { name: /Confirm and start/ }).click();
        await dismissEvents(page);
        await expect(page.getByText('1:1 with Kent Goldberg')).toBeVisible();
        // The opening line has finished streaming once the reply box takes input.
        await expect(page.getByRole('textbox').last()).toBeEditable({ timeout: 15_000 });
        // And the opening line has finished: the speaking hint gives way to the reply prompt.
        await expect(page.getByText(/is speaking\. Talk to interrupt/)).toHaveCount(0, { timeout: 15_000 });
        await shot(page, `${theme}-${width}-live`);
      });

      test(`end screen at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(url('start=board', 'period=8', q));
        await finishRun(page);
        await shot(page, `${theme}-${width}-end`, true);
      });
    }
  });
}
