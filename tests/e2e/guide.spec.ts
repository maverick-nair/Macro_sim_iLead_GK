import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The original flow gaps (D89 to D99): the guided tours on a first run, the demo round, the in play menu
 * and its panels, History from the outcome, the result trend, stage info, the actions list, stepping
 * through replies, milestones and tips, Exit and full screen. Axe on each new surface.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function axe(page: Page, where: string) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))));
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  expect(r.violations.map(v => `${where}: ${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

const styles = (page: Page) => page.getByRole('radiogroup', { name: /^Leadership style for/ });
async function setStyles(page: Page) {
  await expect(styles(page)).toHaveCount(10, { timeout: 20_000 });
  for (const g of await styles(page).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByRole('heading', { name: /Styles are set for week \d/ })).toBeVisible();
}
async function dismissCards(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  // Cards wait behind the outcome: once it has gone, give the next card a moment to show.
  await expect(page.getByText('How it landed')).toHaveCount(0);
  await gotIt.first().waitFor({ timeout: 1500 }).catch(() => undefined);
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}
async function toBoard(page: Page, url = '/?start=board') {
  await page.goto(url);
  await setStyles(page);
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  await dismissCards(page);
}
const menu = (page: Page) => page.getByRole('button', { name: 'Menu' });
async function openFromMenu(page: Page, item: string) {
  await menu(page).click();
  await page.getByRole('navigation', { name: 'Game menu' }).or(page.getByRole('list', { name: 'Game menu' })).getByRole('button', { name: item, exact: true }).click();
}

test.describe('a first run', () => {
  // No storage: tours offer themselves, as they do for a new participant.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the style setting tour, then the board tour: keyboard, focus on each tip, Escape ends it, never again sticks', async ({ page }) => {
    await page.goto('/?start=board');
    const tip = page.getByRole('dialog', { name: 'Your leadership styles' });
    await expect(tip).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Style setting · 1 of 4')).toBeVisible();
    await expect.poll(() => tip.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await axe(page, 'style tour');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);

    await setStyles(page);
    // The board's tour starts once the board shows (the outcome band is not a dialog, so it does not wait
    // for it): Next walks it, Back returns, the counter follows.
    const first = page.getByRole('dialog', { name: 'Objectives and Tutorial' });
    await expect(first).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/^Board tour · 1 of \d+$/)).toBeVisible();
    await axe(page, 'board tour');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Tick tock' })).toBeVisible();
    await expect.poll(() => page.getByRole('dialog', { name: 'Tick tock' }).evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(first).toBeVisible();
    await page.getByRole('button', { name: 'Do not show tips again' }).click();
    await expect(first).toHaveCount(0);
    await page.getByRole('button', { name: 'Dismiss outcome' }).click();
    await dismissCards(page);

    // A reload does not offer it again; the menu replays it.
    await page.reload();
    await setStyles(page);
    await page.getByRole('button', { name: 'Dismiss outcome' }).click();
    await dismissCards(page);
    await page.waitForTimeout(1200);
    await expect(page.getByRole('dialog', { name: 'Objectives and Tutorial' })).toHaveCount(0);
    await openFromMenu(page, 'Guided tour');
    await expect(page.getByRole('dialog', { name: 'Objectives and Tutorial' })).toBeVisible();
    // Walk to the end with Next; skipped steps (no target on screen) do not stop it.
    for (let i = 0; i < 20; i++) {
      const done = page.getByRole('button', { name: 'Done', exact: true });
      if (await done.count()) { await done.click(); break; }
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await expect(page.getByText(/^Board tour ·/)).toHaveCount(0);
  });
});

test.describe('the demo round', () => {
  test('played through from onboarding: guided steps, the impact, then the real run as it was', async ({ page }) => {
    await page.goto('/?start=demo');
    await expect(page.getByRole('heading', { level: 1, name: 'Try the demo first?' })).toBeVisible();
    await axe(page, 'demo offer');
    await page.getByRole('button', { name: 'Play the demo' }).click();
    await expect(page.getByText('Demo: nothing here counts toward your run.')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Set a style' })).toBeVisible();
    await axe(page, 'demo style step');
    // Everyone but the demo person has a style; pick one for them.
    const open = page.getByRole('radiogroup', { name: /^Leadership style for/ }).filter({ hasNot: page.getByRole('radio', { checked: true }) });
    await expect(open).toHaveCount(1);
    await open.getByRole('radio').nth(1).click();
    await page.getByRole('button', { name: 'Review and confirm' }).click();
    await page.getByRole('button', { name: 'Confirm styles' }).click();
    await expect(page.getByRole('dialog', { name: 'Select a person' })).toBeVisible({ timeout: 10_000 });
    // A live action is not in the demo.
    await page.getByText('Kent Goldberg', { exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Take an action' })).toBeVisible();
    await page.getByRole('button', { name: /Send for training/ }).click();
    const option = page.getByRole('radiogroup', { name: 'Choose an option' }).getByRole('radio').first();
    if (await option.count()) await option.click();
    await page.getByRole('button', { name: /^Confirm/ }).click();
    await expect(page.getByRole('dialog', { name: 'See the impact' })).toBeVisible({ timeout: 10_000 });
    await axe(page, 'demo impact');
    await page.getByRole('button', { name: 'Finish the demo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'You are ready' })).toBeVisible();
    await page.getByRole('button', { name: 'Play simulation' }).click();
    // The real run starts untouched: week 1, nobody's style set, no days spent.
    await expect(styles(page)).toHaveCount(10, { timeout: 20_000 });
    await expect(styles(page).getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(page.getByText('Demo: nothing here counts toward your run.')).toHaveCount(0);
  });

  test('Exit demo asks first; staying keeps the demo, leaving goes to the run', async ({ page }) => {
    await page.goto('/?start=demo');
    await page.getByRole('button', { name: 'Play the demo' }).click();
    await page.getByRole('button', { name: 'Exit demo' }).click();
    const confirm = page.getByRole('dialog', { name: 'Leave the demo?' }).or(page.getByRole('alertdialog', { name: 'Leave the demo?' }));
    await expect(confirm).toBeVisible();
    await axe(page, 'exit demo');
    await confirm.getByRole('button', { name: 'Stay in the demo' }).click();
    await expect(page.getByText('Demo: nothing here counts toward your run.')).toBeVisible();
    await page.getByRole('button', { name: 'Exit demo' }).click();
    await confirm.getByRole('button', { name: 'Leave the demo' }).click();
    await expect(styles(page)).toHaveCount(10, { timeout: 20_000 });
    await expect(page.getByText('Demo: nothing here counts toward your run.')).toHaveCount(0);
  });
});

test.describe('the menu and its panels', () => {
  test('Objectives, Tutorial and video (with the transcript), Results and stages, About these actions', async ({ page }) => {
    await page.goto('/?start=board&video=1');
    await setStyles(page);
    await page.getByRole('button', { name: 'Dismiss outcome' }).click();
    await dismissCards(page);

    await menu(page).click();
    await axe(page, 'menu');
    await page.getByRole('button', { name: 'Objectives', exact: true }).click();
    const objectives = page.getByRole('dialog', { name: 'Objectives' });
    await expect(objectives).toBeVisible();
    await expect(objectives.getByText('Welcome to Innov8 Elevators. I am glad you are here.')).toBeVisible();
    await objectives.getByRole('tab', { name: 'Your targets' }).click();
    await expect(objectives.getByText('Reach $240,000 in revenue over eight weeks.')).toBeVisible();
    await objectives.getByRole('tab', { name: 'Stages' }).click();
    await expect(objectives.getByText('Suits:').first()).toBeVisible();
    await axe(page, 'objectives');
    await page.keyboard.press('Escape');
    await expect(objectives).toHaveCount(0);
    await expect(menu(page)).toBeFocused();

    await openFromMenu(page, 'Tutorial and video');
    const tutorial = page.getByRole('dialog', { name: 'Tutorial and video' });
    await expect(tutorial.locator('video')).toHaveCount(1);
    await tutorial.getByRole('tab', { name: 'Transcript' }).click();
    await expect(tutorial.getByRole('tabpanel')).not.toBeEmpty();
    await tutorial.getByRole('tab', { name: 'How to lead' }).click();
    await expect(tutorial.getByRole('heading', { name: 'Worked examples' })).toBeVisible();
    await axe(page, 'tutorial');
    await tutorial.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Results and stages' }).first().click();
    const overview = page.getByRole('dialog', { name: 'Results and stages' });
    await expect(overview.getByRole('table').first()).toBeVisible();
    await overview.getByRole('tab', { name: 'Stage overview' }).click();
    await expect(overview.getByText(/Run so far|Week 1 so far/).first()).toBeVisible();
    await axe(page, 'overview');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'About these actions' }).click();
    const actions = page.getByRole('dialog', { name: 'About these actions' });
    await expect(actions.getByText('Hire member', { exact: true })).toBeVisible();
    await expect(actions.getByText('Unlocks in week 3').first()).toBeVisible();
    await axe(page, 'actions list');
    await page.keyboard.press('Escape');

    // Stage info: what the stage does and which skills suit it.
    await page.getByRole('button', { name: 'About Leads' }).click();
    await expect(page.getByText('Suits:').first()).toBeVisible();
    await axe(page, 'stage info');
    await page.keyboard.press('Escape');
  });

  test('History from the outcome, filtered by person, and from the menu', async ({ page }) => {
    await page.goto('/?start=board');
    await setStyles(page);
    await page.getByRole('button', { name: 'Dismiss outcome' }).click();
    await dismissCards(page);
    await page.getByText('Kent Goldberg', { exact: true }).click();
    await page.getByRole('button', { name: /Send for training/ }).click();
    const option = page.getByRole('radiogroup', { name: 'Choose an option' }).getByRole('radio').first();
    if (await option.count()) await option.click();
    await page.getByRole('button', { name: /^Confirm/ }).click();
    await expect(page.getByText('How it landed')).toBeVisible();
    await page.getByRole('button', { name: 'Open in History' }).click();
    const history = page.getByRole('dialog', { name: 'History' });
    await expect(history).toBeVisible();
    await expect(history.getByRole('combobox', { name: 'Person' })).toHaveValue(/kent/i);
    await expect(history.getByRole('region', { name: 'History' }).getByText(/training/i).first()).toBeVisible();
    await axe(page, 'history');
    // Clearing the filters shows everyone; an action filter narrows the entries.
    const shown = history.getByRole('status').filter({ hasText: /shown$/ });
    const count = async () => Number((await shown.textContent())?.match(/\d+/)?.[0] ?? 0);
    const forKent = await count();
    await history.getByRole('button', { name: 'Clear filters' }).click();
    await expect(history.getByRole('combobox', { name: 'Person' })).toHaveValue('');
    expect(await count()).toBeGreaterThanOrEqual(forKent);
    const all = await count();
    await history.getByRole('combobox', { name: 'Action' }).selectOption({ label: 'Send for training' });
    await expect.poll(count).toBeLessThan(all);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Dismiss outcome' }).click();
    await dismissCards(page);
    await openFromMenu(page, 'History');
    await expect(page.getByRole('dialog', { name: 'History' })).toBeVisible();
  });

  test('the result trend in the profile, with a table version', async ({ page }) => {
    await toBoard(page, '/?start=board&period=3');
    await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).click();
    await expect(page.getByRole('heading', { name: 'Result trend' })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Result from \d+ to \d+, \d+ points$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Show as table' }).click();
    await expect(page.getByRole('table').filter({ hasText: 'End of' })).toBeVisible();
    await axe(page, 'trend');
  });

  test('Exit asks first and returns to the launch\'s address', async ({ page }) => {
    await page.route('https://lms.example.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>LMS</title><h1>Back in the LMS</h1>' }));
    await toBoard(page, '/?start=board&exit=https%3A%2F%2Flms.example.com%2Freturn');
    await openFromMenu(page, 'Exit');
    const dialog = page.getByRole('dialog', { name: 'Exit the simulation?' }).or(page.getByRole('alertdialog', { name: 'Exit the simulation?' }));
    await expect(dialog).toBeVisible();
    await axe(page, 'exit');
    await dialog.getByRole('button', { name: 'Stay' }).click();
    await expect(dialog).toHaveCount(0);
    await openFromMenu(page, 'Exit');
    await dialog.getByRole('button', { name: 'Exit' }).click();
    await expect(page).toHaveURL('https://lms.example.com/return');
  });

  test('Full screen toggles, or says why it cannot', async ({ page }) => {
    await toBoard(page);
    await openFromMenu(page, 'Full screen');
    await expect.poll(async () => (await page.evaluate(() => !!document.fullscreenElement)) || (await page.getByRole('status').filter({ hasText: /full screen/i }).count()) > 0).toBe(true);
  });
});

test.describe('replies, milestones and tips', () => {
  test('an outcome with several replies steps through them', async ({ page }) => {
    await page.goto('/?start=board');
    await setStyles(page);
    // Confirming styles answers from several people.
    const count = page.getByText(/^Reply 1 of \d+$/);
    await expect(count).toBeVisible();
    await page.getByRole('button', { name: 'Next reply' }).click();
    await expect(page.getByText(/^Reply 2 of \d+$/)).toBeVisible();
    await page.getByRole('button', { name: 'Previous reply' }).click();
    await expect(count).toBeVisible();
    await axe(page, 'replies');
  });

  test.describe('with tours seen and tips on', () => {
    test.use({ storageState: { cookies: [], origins: [{ origin: `http://localhost:${process.env.E2E_PORT ?? 5198}`, localStorage: [{ name: 'ilead.guide', value: JSON.stringify({ seen: { 'local:tour:board': true, 'local:tour:style': true, 'local:tour:live': true } }) }] }] } });

    test('a milestone and the hire tip show once, under the team strip', async ({ page }) => {
      await toBoard(page, '/?start=board&period=4');
      const milestone = page.getByText('Milestone reached.').first();
      const tip = page.getByText(/Hire member is now open/);
      await expect(milestone.or(tip).first()).toBeVisible();
      await axe(page, 'notices');
      // Dismiss every notice; a reload does not bring the tip back.
      for (let i = 0; i < 12; i++) {
        const b = page.getByRole('button', { name: /^(Keep going|Hide tip)$/ });
        if (!(await b.count())) break;
        await b.first().click();
      }
      await expect(tip).toHaveCount(0);
      await page.reload();
      await setStyles(page).catch(() => undefined);
      await page.getByRole('button', { name: 'Dismiss outcome' }).click().catch(() => undefined);
      await dismissCards(page);
      await page.waitForTimeout(800);
      await expect(tip).toHaveCount(0);
    });
  });
});
