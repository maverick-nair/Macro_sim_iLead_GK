import { expect, test, type Locator, type Page } from '@playwright/test';

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
  await expect(page.getByRole('heading', { name: /Styles are set for week \d/ })).toBeVisible();
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

/** Every width the participant app is drawn at (D69, D73): the design, the folded panel, a portrait tablet. */
const ALL = [1440, 1024, 834] as const;
type Width = (typeof ALL)[number];
const size = (w: Width) => ({ width: w, height: w < 1000 ? 1194 : 1000 });
const isTablet = (w: Width) => w < 1000;

/** Dates on screen (the report's) are read from a fixed day, so the shots do not move with the calendar. */
async function fixDate(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-06T10:00:00'));
}

/** Waits for finite animations to land, then the shot; nondeterministic parts masked. */
async function still(page: Page, name: string, extraMask: Locator[] = []) {
  await settle(page);
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))));
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002, mask: [page.getByRole('button', { name: /^Pause/ }), ...extraMask] });
}

/** Spends three days of week 3 (a team activity and an assessment): the sponsor rings. */
async function spendThreeDays(page: Page, w: Width) {
  if (isTablet(w)) {
    await page.getByRole('button', { name: /^Actions ·/ }).click();
    const d = page.getByRole('dialog', { name: 'Team actions' });
    await d.getByRole('radio', { name: /Energize the team/ }).click();
    await d.getByRole('radio', { name: /Team building/ }).click();
    await d.getByRole('button', { name: /^Confirm · / }).click();
  } else {
    await page.getByRole('button', { name: /Energize the team/ }).click();
    await page.getByRole('radio', { name: /Team building/ }).click();
    await page.getByRole('button', { name: /^Confirm/ }).click();
  }
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  await dismissCards(page);
  if (isTablet(w)) {
    await page.getByRole('button', { name: /^Kent Goldberg, / }).click();
    const d = page.getByRole('dialog', { name: 'Actions for Kent Goldberg' });
    await d.getByRole('radio', { name: /Assess member/ }).click();
    await d.getByRole('radiogroup', { name: 'Choose an option' }).getByRole('radio').first().click();
    await d.getByRole('button', { name: /^Confirm/ }).click();
  } else {
    await page.getByText('Kent Goldberg', { exact: true }).click();
    await page.getByRole('button', { name: /Assess member/ }).click();
    await page.getByRole('radiogroup', { name: 'Choose an option' }).getByRole('radio').first().click();
    await page.getByRole('button', { name: /^Confirm/ }).click();
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

    // M8 (D78): the participant screens that had no baseline, at every width, and the group report and
    // the author chat at 1440 and 834.
    for (const w of ALL) {
      test.describe(`more at ${w}`, () => {
        test.use({ viewport: size(w) });

        test(`event card at ${w}`, async ({ page }) => {
          // Week 3 opens with the cards of the weeks before it.
          await page.goto(url('start=board', 'period=3', q));
          await confirmStyles(page);
          const card = page.getByRole('dialog');
          await expect(card.getByRole('button', { name: 'Got it' })).toBeVisible();
          await expect(card).toHaveCSS('opacity', '1');
          await still(page, `${theme}-${w}-event`);
        });

        test(`inbox at ${w}`, async ({ page }) => {
          // Week 4: the sponsor's briefing and the news are waiting.
          await page.goto(url('start=board', 'period=4', q));
          await confirmStyles(page);
          await dismissCards(page);
          await page.getByRole('button', { name: /^Inbox/ }).click();
          await expect(page.getByRole('dialog', { name: 'Inbox' })).toBeVisible();
          await still(page, `${theme}-${w}-inbox`);
        });

        test(`profile at ${w}`, async ({ page }) => {
          await page.goto(url('start=board', q));
          await confirmStyles(page);
          await dismissCards(page);
          if (isTablet(w)) {
            await page.getByRole('button', { name: /^Kent Goldberg, / }).click();
            await page.getByRole('dialog', { name: 'Actions for Kent Goldberg' }).getByRole('tab', { name: 'Profile' }).click();
          } else {
            await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).click();
          }
          await expect(page.getByRole('heading', { name: 'Your interactions' })).toBeVisible();
          await still(page, `${theme}-${w}-profile`);
        });

        test(`sponsor call at ${w}`, async ({ page }) => {
          await page.goto(url('start=board', 'period=3', q));
          await confirmStyles(page);
          await dismissCards(page);
          await spendThreeDays(page, w);
          const call = page.getByRole('alert').filter({ hasText: 'Paula Jacob is calling' });
          await expect(call).toHaveCSS('opacity', '1', { timeout: 15_000 });
          // The board behind it is held mid week; the call is what matters, the toast that may sit beside it is not.
          await still(page, `${theme}-${w}-sponsor-call`, [page.getByRole('status')]);
        });

        test(`week end at ${w}`, async ({ page }) => {
          await page.goto(url('start=board', q));
          await confirmStyles(page);
          await dismissCards(page);
          await page.getByRole('button', { name: /End week/ }).click();
          // Cards for the week's end can still come in: close each until the week end shows.
          const see = page.getByRole('button', { name: /^See your week$/ });
          const gotIt = page.getByRole('button', { name: 'Got it' });
          for (let i = 0; i < 6; i++) {
            await expect(see.or(gotIt).first()).toBeVisible();
            if (!(await gotIt.count())) break;
            await dismissCards(page);
          }
          await expect(see).toBeVisible();
          await still(page, `${theme}-${w}-weekend`);
          await page.getByRole('button', { name: /^See your week$/ }).click();
          await expect(page.getByRole('button', { name: /^(Continue|Nice|Next)$/ }).first()).toBeVisible();
          await still(page, `${theme}-${w}-weekend-report`);
        });

        if (isTablet(w)) {
          test(`end screen at ${w}`, async ({ page }) => {
            await page.goto(url('start=board', 'period=8', q));
            await finishRun(page);
            await shot(page, `${theme}-${w}-end`, true);
          });
        }

        test(`report first page at ${w}`, async ({ page }) => {
          await fixDate(page);
          await page.goto(url('start=board', 'period=8', q));
          await finishRun(page);
          await page.getByRole('button', { name: 'View my report' }).click();
          await expect(page.getByRole('heading', { level: 1, name: 'Your development report' })).toBeVisible({ timeout: 20_000 });
          await still(page, `${theme}-${w}-report`);
        });
      });
    }

    for (const w of [1440, 834] as const) {
      test.describe(`group and author at ${w}`, () => {
        test.use({ viewport: size(w) });

        test(`group report at ${w}`, async ({ page }) => {
          await fixDate(page);
          await page.goto(`/group?${q}`);
          await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 60_000 });
          await still(page, `${theme}-${w}-group`);
        });

        // /author is light only, whatever the participant theme (D105): one baseline per width.
        if (theme === 'dark') test(`author chat at ${w}`, async ({ page }) => {
          await page.goto('/author');
          await expect(page.getByText(/^Question 1 of about \d+$/)).toBeVisible();
          await expect(page.getByText('Saved just now')).toBeVisible();
          await still(page, `author-${w}`);
        });
      });
    }

    // A tablet held upright, 834 by 1194 (D73): the tablet board, its actions drawer, the 1:1 and style setting.
    test.describe('tablet at 834', () => {
      test.use({ viewport: { width: 834, height: 1194 } });

      test('style setting at 834', async ({ page }) => {
        await page.goto(url('start=board', q));
        await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
        await shot(page, `${theme}-834-styles`);
      });

      test('board at 834', async ({ page }) => {
        await page.goto(url('start=board', q));
        await confirmStyles(page);
        await dismissEvents(page);
        await expect(page.getByRole('navigation', { name: 'Board tools' })).toBeVisible();
        await shot(page, `${theme}-834-board`);
      });

      test('actions drawer at 834', async ({ page }) => {
        await page.goto(url('start=board', q));
        await confirmStyles(page);
        await dismissEvents(page);
        await page.getByRole('button', { name: /^Kent Goldberg, / }).click();
        const drawer = page.getByRole('dialog', { name: 'Actions for Kent Goldberg' });
        await drawer.getByRole('radio', { name: /Meet face to face/ }).click();
        await expect(drawer.getByRole('button', { name: 'Confirm and start · 1 day' })).toBeVisible();
        await shot(page, `${theme}-834-drawer`);
      });

      test('1:1 at 834', async ({ page }) => {
        await page.goto(url('start=board', q));
        await confirmStyles(page);
        await dismissEvents(page);
        await page.getByRole('button', { name: /^Kent Goldberg, / }).click();
        const drawer = page.getByRole('dialog', { name: 'Actions for Kent Goldberg' });
        await drawer.getByRole('radio', { name: /Meet face to face/ }).click();
        await drawer.getByRole('radio', { name: /Energize the person/ }).click();
        await drawer.getByRole('button', { name: /Confirm and start/ }).click();
        await dismissEvents(page);
        await expect(page.getByText('1:1 with Kent Goldberg')).toBeVisible();
        await expect(page.getByRole('textbox').last()).toBeEditable({ timeout: 15_000 });
        await expect(page.getByText(/is speaking\. Talk to interrupt/)).toHaveCount(0, { timeout: 15_000 });
        await shot(page, `${theme}-834-live`);
      });
    });
  });
}
