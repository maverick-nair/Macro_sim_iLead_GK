import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * A week on the engine on a phone (390 by 844), by touch: style setting, an action through the
 * bottom sheet, a 1:1 by text, the outcome card, an event card, End week and the week end. Axe runs
 * at each screen, and the board is checked for 44px targets and no sideways page scroll.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function axe(page: Page) {
  // Contrast is measured once things have risen in (sheets and dialogs fade up over 220ms).
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => null))));
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.length} ${v.nodes.slice(0, 2).map(n => `${n.target.join(' ')} ${n.failureSummary ?? ''}`).join(', ')}`);
}

/** No sideways page scroll at 390 (the KPI scroller scrolls inside itself). */
async function noSideways(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
}

/**
 * Every visible button, link and field inside `scope` is at least 44 by 44 (the design's phone target).
 * Reason chips keep the design's size (frame m6: 30px, the WCAG 2.5.8 minimum of 24 is met): held to 24.
 */
async function targets(scope: Locator) {
  const small = await scope.evaluate(root => Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input:not([type="radio"]), textarea, [role="radio"]'))
    .filter(el => el.checkVisibility() && !el.classList.contains('sr-only') && !el.closest('[data-design-frame]'))
    .map(el => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => { const min = el.hasAttribute('aria-pressed') && /^[▲▼]/.test(el.textContent ?? '') ? 24 : 44; return r.width > 0 && (r.width < min || r.height < min); })
    .map(({ el, r }) => `${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`));
  return small;
}

async function tapEvents(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  let seen = 0;
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.tap();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
    seen++;
  }
  return seen;
}

async function backToTeam(page: Page) {
  await page.getByRole('button', { name: 'Back to my team' }).tap();
  await expect(page.getByText('How it landed')).toHaveCount(0);
}

async function setStyles(page: Page) {
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  await noSideways(page);
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).tap();
  // The definitions open from a button on a phone.
  await page.getByRole('button', { name: 'What the four styles mean' }).tap();
  await expect(page.getByRole('list', { name: /style/i }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add a reason' }).first().tap();
  await page.keyboard.type('Kent is new and unsure');
  await page.keyboard.press('Enter');
  expect(await targets(page.locator('main'))).toEqual([]);
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'Review and confirm' }).tap();
  const summary = page.getByRole('dialog', { name: 'Confirm styles' });
  await expect(summary.getByRole('table')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await summary.getByRole('button', { name: 'Confirm styles' }).tap();
  await expect(page.getByRole('heading', { name: /Styles are set for week/ })).toBeFocused();
}

test('a week on the engine by touch, at 390', async ({ page }) => {
  await page.goto('/?start=board');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Set your leadership styles for week 1');
  await setStyles(page);

  // The outcome card (frame m6's language) over the team list.
  const outcome = page.getByRole('region', { name: 'Outcome' });
  await expect(outcome).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await backToTeam(page);
  await tapEvents(page);

  // The phone board: compact HUD, KPI scroller, the team as a list by stage, the dock.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your team board, week 1');
  await expect(page.getByRole('region', { name: 'Team KPIs, scroll sideways for more' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
  await noSideways(page);
  expect(await targets(page.locator('main'))).toEqual([]);
  expect(await axe(page)).toEqual([]);

  // An action through the sheet: tap Kent, his actions open; training is an instant decision.
  await page.getByRole('button', { name: /^Kent Goldberg, Lead/ }).tap();
  let sheet = page.getByRole('dialog', { name: 'Actions' });
  await expect(sheet.getByRole('heading', { name: 'For Kent' })).toBeVisible();
  expect(await targets(sheet)).toEqual([]);
  expect(await axe(page)).toEqual([]);
  await sheet.getByRole('button', { name: /^Assess member/ }).tap();
  sheet = page.getByRole('dialog', { name: 'Plan an action' });
  await expect(sheet.getByRole('heading', { name: 'Assess member' })).toBeFocused();
  const firstStage = sheet.getByRole('radio').first();
  if (await firstStage.count()) await firstStage.tap();
  expect(await targets(sheet)).toEqual([]);
  expect(await axe(page)).toEqual([]);
  await sheet.getByRole('button', { name: 'Confirm' }).tap();
  await expect(page.getByRole('dialog', { name: 'Plan an action' })).toHaveCount(0);
  await expect(outcome).toBeVisible();
  await backToTeam(page);
  await tapEvents(page);

  // The inbox as a sheet.
  await page.getByRole('button', { name: /^Inbox, / }).tap();
  const inbox = page.getByRole('dialog', { name: 'Inbox' });
  await expect(inbox).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await inbox.getByRole('button', { name: 'Close inbox' }).tap();
  await expect(inbox).toHaveCount(0);

  // A 1:1 by text, on the design's phone live screen.
  await page.getByRole('button', { name: /^Kent Goldberg, Lead/ }).tap();
  await page.getByRole('dialog', { name: 'Actions' }).getByRole('button', { name: /^Meet face to face/ }).tap();
  sheet = page.getByRole('dialog', { name: 'Plan an action' });
  await sheet.getByText('Energize the person').tap();
  await sheet.getByRole('button', { name: /Confirm and start/ }).tap();
  await expect(page.getByText('1:1 with Kent Goldberg').first()).toBeVisible();
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await expect(box).toBeEditable({ timeout: 15000 });
  await noSideways(page);
  expect(await axe(page)).toEqual([]);
  await box.fill('I hear you, thanks for being honest. Here is the plan, step by step. What is getting in the way?');
  await box.press('Enter');
  await expect(box).toHaveValue('');
  await page.getByRole('button', { name: /^(End|Finish)/ }).first().tap();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Kent (skill|morale|result|trust) (up|down)/).first()).toBeVisible();
  await backToTeam(page);
  await tapEvents(page);

  // End week, then the week end at 390.
  await page.getByRole('button', { name: /End week/ }).tap();
  await tapEvents(page);
  await expect(page.getByText('End of week 1')).toBeVisible();
  await noSideways(page);
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: /^See your week$/ }).tap();
  await expect(page.getByRole('heading', { name: /Funnel/ })).toBeVisible();
  await noSideways(page);
  expect(await axe(page)).toEqual([]);
  const step = page.getByRole('button', { name: /^(Continue|Nice|Take this reward|Next|Set styles for week 2)$/ });
  for (;;) {
    await expect.poll(async () => (await step.count()) > 0 || (await page.getByText(/ · Week end$/).count()) === 0).toBe(true);
    if (!(await step.count())) break;
    if (await page.getByRole('radiogroup', { name: 'Rewards' }).count()) await page.getByRole('radio').first().tap();
    const name = (await step.first().textContent())?.trim();
    await step.first().tap();
    if (name === 'Set styles for week 2') break;
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Set your leadership styles for week 2' })).toBeFocused();
});

test('people are picked on the list with the sheet lowered', async ({ page }) => {
  await page.goto('/?start=board');
  await setStyles(page);
  await backToTeam(page);
  await tapEvents(page);
  await page.getByRole('button', { name: /^Kent Goldberg, Lead/ }).tap();
  await page.getByRole('dialog', { name: 'Actions' }).getByRole('button', { name: /^Send for training/ }).tap();
  const sheet = page.getByRole('dialog', { name: 'Plan an action' });
  await sheet.getByRole('radio').first().tap();
  await sheet.getByRole('button', { name: /Change people, 1 picked/ }).tap();
  await expect(sheet).toHaveCount(0);
  // Justin, from another stage, so Leads keeps someone to cover.
  const justin = page.getByRole('button', { name: /^Justin Keel/ });
  await expect(justin).toHaveAttribute('aria-pressed', 'false');
  await justin.tap();
  await expect(justin).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Picking people for Send for training' })).toContainText('2 of 3 picked');
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'Done' }).tap();
  await expect(page.getByRole('dialog', { name: 'Plan an action' }).getByText('Justin Keel')).toBeVisible();
  await page.getByRole('dialog', { name: 'Plan an action' }).getByRole('button', { name: 'Confirm' }).tap();
  await expect(page.getByRole('region', { name: 'Outcome' })).toBeVisible();
});

test('an event card and the end of the run on a phone', async ({ page }) => {
  await page.goto('/?start=board&period=8');
  await setStyles(page);
  await backToTeam(page);
  // Week 8 opens with event cards: each is a modal dialog with 48px buttons.
  const card = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Got it' }) });
  await expect(card).toBeVisible();
  expect(await targets(card)).toEqual([]);
  expect(await axe(page)).toEqual([]);
  expect(await tapEvents(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: /End week/ }).tap();
  await tapEvents(page);
  await page.getByRole('button', { name: /^See your week$/ }).tap();
  const step = page.getByRole('button', { name: /^(Continue|Nice|See your results)$/ });
  const h1 = page.getByRole('heading', { level: 1, name: /^You finished at / });
  for (;;) {
    await expect(step.first().or(h1)).toBeVisible();
    if (await h1.count()) break;
    await step.first().tap();
  }
  await noSideways(page);
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'View my report' }).tap();
  await expect(page.getByRole('heading', { level: 1, name: 'Your development report' })).toBeVisible({ timeout: 15000 });
  await noSideways(page);
});

for (const [theme, q] of [['light', 'theme=light'], ['client', 'client=halden']] as const) {
  test(`axe at 390 in the ${theme} theme: styles, outcome, board and sheets`, async ({ page }) => {
    await page.goto(`/?start=board&${q}`);
    await setStyles(page);
    expect(await axe(page)).toEqual([]);
    await backToTeam(page);
    await tapEvents(page);
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: /^Kent Goldberg, Lead/ }).tap();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('dialog', { name: 'Actions' }).getByRole('button', { name: /^Meet face to face/ }).tap();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('dialog', { name: 'Plan an action' }).getByRole('button', { name: 'Close' }).tap();
    await page.getByRole('button', { name: /^Inbox, / }).tap();
    expect(await axe(page)).toEqual([]);
  });
}

test('?engine=off still opens the prototype phone board', async ({ page }) => {
  await page.goto('/?start=board&engine=off');
  await expect(page.getByText('Your team', { exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(0);
});
