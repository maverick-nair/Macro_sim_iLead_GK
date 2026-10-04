import { expect, test, type Page } from '@playwright/test';

/**
 * Visual regression for the screens the engine renders (the design frames are held by `npm run parity`).
 * Every screen at 1440 and 1024, in dark, light and the sample client theme. Phones keep the prototype
 * board (D43), so 390 covers onboarding and the phone board. The mock engine is seeded, so the same
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

async function shot(page: Page, name: string) {
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 });
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

    for (const width of [...DESK, 390]) {
      test(`onboarding at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.goto(url(q));
        await expect(page.getByRole('heading').first()).toBeVisible();
        await shot(page, `${theme}-${width}-onboarding`);
      });

      test(`style setting at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.goto(url('start=board', q));
        // Phones keep the prototype board (D43), which has no main landmark.
        if (width !== 390) await expect(page.getByRole('main')).toBeVisible();
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
    }
  });
}
