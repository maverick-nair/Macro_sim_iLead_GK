import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Flow: set styles, run a 1:1 on the engine, read the outcome, end the week and start the next. */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** Axe on what is on screen now. @axe-core/playwright is typed against a slightly different Playwright version. */
async function axe(page: Page) {
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.length}`);
}

/** Dismisses the outcome panel and waits for it to go (event cards wait behind it). */
async function dismissOutcome(page: Page) {
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
}

/** Closes event cards one at a time, waiting for each to go. */
async function dismissEvents(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

/**
 * Clicks through the week end (banner, report, badges, the reward if offered, news) to its last
 * button. The week end has its own keyboard and axe walk in weekend.spec.ts.
 */
async function throughWeekEnd(page: Page, last: string) {
  await expect(page.getByText(/ · Week end$/)).toBeVisible();
  await page.getByRole('button', { name: /^See your week$/ }).click();
  const step = page.getByRole('button', { name: new RegExp(`^(Continue|Nice|Take this reward|Next|${last})$`) });
  for (;;) {
    if (await page.getByRole('radiogroup', { name: 'Rewards' }).count()) await page.getByRole('radio').first().click();
    const name = (await step.first().textContent())?.trim();
    await step.first().click();
    if (name === last) return;
    if (!(await page.getByText(/ · Week end$/).count())) return;
  }
}

/** Weekly style setting: pick on every card, a reason for one, review the summary, confirm. */
async function setStyles(page: Page, index = 1) {
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(index).click();
  await page.getByRole('button', { name: 'Add a reason' }).first().click();
  await page.keyboard.type('Kent is new and unsure');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  const summary = page.getByRole('dialog');
  await expect(summary.getByRole('table')).toBeVisible();
  await summary.getByRole('button', { name: 'Confirm styles' }).click();
  // The team's reaction is an outcome; focus moves to its headline so it is read out.
  await expect(page.getByRole('heading', { name: /Styles are set for week/ })).toBeFocused();
}

test('a week on the engine, from styles to the next week', async ({ page }) => {
  await page.goto('/?start=board');
  await expect(page.getByText('Stats show once you open their profile on the board').first()).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Set your leadership styles for week 1');
  await setStyles(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your team board, week 1');

  // Actions open once styles are set; costs read in days.
  // Keyboard selection: the card's toggle is visually hidden, the card draws its focus ring.
  await page.getByRole('button', { name: /^Kent Goldberg, Lead/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Kent Goldberg, Lead/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Meet face to face/ }).click();
  await expect(page.getByRole('heading', { name: 'Meet face to face' })).toBeFocused();
  await page.getByText('Energize the person').click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();

  await expect(page.getByText('1:1 with Kent Goldberg').first()).toBeVisible();
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await expect(box).toBeFocused();
  await box.fill('I hear you, thanks for being honest. Here is the plan, step by step. What is getting in the way?');
  await box.press('Enter');
  // The words leave the box once the engine has them.
  await expect(box).toHaveValue('');
  await page.getByRole('button', { name: /^(End|Finish)/ }).first().click();
  // The board owns "The team is reacting" and holds the outcome behind it.
  await expect(page.getByText('The team is reacting')).toBeVisible();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('region', { name: 'Outcome' }).getByRole('heading', { level: 2 })).toBeFocused();
  await expect(page.getByText(/Kent (skill|morale|result|trust) (up|down)/).first()).toBeVisible();
  await expect(page.getByText(/4 days left/).first()).toBeVisible();
  await dismissOutcome(page);
  await dismissEvents(page);

  // Opening a profile reveals stats on the card.
  await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).click();
  await expect(page.getByRole('button', { name: /^Kent Goldberg.*Skill \d+/ })).toBeVisible();

  expect(await axe(page)).toEqual([]);

  await page.getByRole('button', { name: /End week/ }).click();
  await dismissEvents(page);
  // The week end replaces the board, focus on its headline.
  await expect(page.getByText('End of week 1')).toBeVisible();
  await expect(page.locator('h1')).toBeFocused();
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);
  await throughWeekEnd(page, 'Set styles for week 2');
  await expect(page.getByRole('button', { name: 'Review and confirm' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Set your leadership styles for week 2' })).toBeFocused();
});

test('style summary: focus is trapped, the page behind is inert, Go back returns to Review', async ({ page }) => {
  await page.goto('/?start=board');
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  const review = page.getByRole('button', { name: 'Review and confirm' });
  await review.click();
  const summary = page.getByRole('dialog', { name: 'Confirm styles' });
  await expect(summary).toBeFocused();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await summary.evaluate(d => d.contains(document.activeElement))).toBe(true);
  }
  expect(await review.evaluate(b => !!b.closest('[inert]'))).toBe(true);
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(summary).toHaveCount(0);
  await expect(review).toBeFocused();
  expect(await review.evaluate(b => !!b.closest('[inert]'))).toBe(false);
});

test('toasts hide on time, even when the board changes underneath', async ({ page }) => {
  await page.goto('/?start=board');
  await setStyles(page);
  // Styles are locked on the board: a toast says so. Selecting people changes the UI store meanwhile.
  await page.getByRole('radiogroup', { name: /^Leadership style for Kent/ }).getByRole('radio').nth(2).click({ force: true }); // Locked letters are aria-disabled; picking one still explains why.
  const toast = page.getByRole('status').filter({ hasText: /Styles are set until the next week/ });
  await expect(toast).toBeVisible();
  await page.getByText('Beth Killiney', { exact: true }).click();
  await page.getByText('Justin Keel', { exact: true }).click();
  await expect(toast).toHaveCount(0, { timeout: 6000 });
});

test('a static decision shows its outcome with reasons; a double click sends it once', async ({ page }) => {
  await page.goto('/?start=board');
  await setStyles(page);
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.getByRole('button', { name: /Energize the team/ }).click();
  await page.getByRole('radio', { name: 'Team Lunch' }).click();
  await page.getByRole('button', { name: /^Confirm/ }).dblclick();
  const headline = page.getByRole('heading', { name: 'Energize the team: Team Lunch' });
  await expect(headline).toBeFocused();
  await expect(page.getByText(/4 days left/).first()).toBeVisible();
  const outcome = page.getByRole('region', { name: /How it landed|Outcome/i });
  await expect(outcome.getByText(/people morale (up|down)|morale (up|down)/).first()).toBeVisible();
  await outcome.getByRole('button', { name: 'See why' }).click();
  await expect(outcome.getByText('The rule').first()).toBeVisible();
  // No quote marks around an empty reply.
  await expect(outcome.getByText('“”')).toHaveCount(0);
});

test('the engine cannot load: the error in words and Retry', async ({ page }) => {
  // The mock engine stands in for the server: its view fails with a network error until told otherwise.
  await page.addInitScript(() => { (globalThis as Record<string, unknown>).__viewFails = true; });
  await page.route('**/src/engine/mock.ts*', async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace('async view() {', 'async view() { if (globalThis.__viewFails) throw new EngineError("Network error", "network", true);');
    await route.fulfill({ response: res, body });
  });
  await page.goto('/?start=board');
  await expect(page.getByRole('alert')).toContainText('You seem to be offline. Try again in a moment.');
  await page.evaluate(() => { (globalThis as Record<string, unknown>).__viewFails = false; });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
});

test('inbox: focus moves in, Later sets the briefing aside until the next day, Escape returns focus', async ({ page }) => {
  await page.goto('/?start=board&period=4');
  await setStyles(page);
  const rail = page.getByRole('button', { name: /^Inbox/ });
  await rail.click();
  const inbox = page.getByRole('dialog', { name: 'Inbox' });
  await expect(inbox).toBeFocused();
  // Other messages (news such as the CEO check in) can sit in the inbox too: set the briefing aside.
  await inbox.locator('div').filter({ has: page.getByText('Briefing with Paula', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Later' }) }).last().getByRole('button', { name: 'Later' }).click();
  await expect(page.getByText('Briefing with Paula')).toHaveCount(0);
  await expect(inbox).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(inbox).toHaveCount(0);
  await expect(rail).toBeFocused();
  // A day passes: the briefing is back.
  // (A CEO check in, when the sponsor's confidence fell, takes a day of this week, so read the days left first.)
  const left = page.getByText(/^\d+ days? left$/).first();
  const before = (await left.textContent()) ?? '';
  await page.getByRole('button', { name: /Energize the team/ }).click();
  await page.getByRole('radio', { name: 'Team Lunch' }).click();
  await page.getByRole('button', { name: /^Confirm/ }).click();
  // Sponsor confidence fell below the check in line in week 3 of this run: the CEO check in took a day of week 4.
  await expect(left).not.toHaveText(before);
  await expect(page.getByText('The CEO check in took a day this week')).toBeVisible();
  await expect(page.getByRole('button', { name: /Briefing with Paula/ })).toBeVisible();
});

test('palette: Ctrl K on the plain board only', async ({ page }) => {
  await page.goto('/?start=board');
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  await page.keyboard.press('Control+k');
  await setStyles(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the end of the run: the last week end, one modal, then the board read only', async ({ page }) => {
  await page.goto('/?start=board&period=8');
  await setStyles(page);
  await page.getByRole('button', { name: /End week/ }).click();
  await dismissEvents(page);
  await expect(page.getByText('End of week 8')).toBeVisible();
  await throughWeekEnd(page, 'See your results');
  const panel = page.getByRole('dialog', { name: 'The run is over' });
  await expect(panel).toBeVisible();
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(1);
  await expect(panel.getByText(/Leadership Score \d{1,3}(,\d{3})* of 1,000/)).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await panel.getByRole('button', { name: 'Look at the board' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByText(/The board is read only now/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Energize the team/ })).toContainText('The run is over');
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'See your results' }).click();
  await expect(page.getByRole('dialog', { name: 'The run is over' })).toBeVisible();
});

test('light theme: no accessibility issues, contrast included', async ({ page }) => {
  await page.goto('/?start=board&theme=light');
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  expect(await axe(page)).toEqual([]);
  await setStyles(page);
  expect(await axe(page)).toEqual([]);
});

test('a whole week by keyboard only', async ({ page }) => {
  await page.goto('/?start=board');
  const focused = () => page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    return `${a.tagName}|${a.getAttribute('role') ?? ''}|${(a.getAttribute('aria-label') ?? a.textContent ?? '').trim()}|${a.closest('[role=radiogroup]')?.getAttribute('aria-label') ?? ''}`;
  });
  const tabTo = async (rx: RegExp, back = false) => {
    for (let i = 0; i < 200; i++) {
      if (rx.test(await focused())) return;
      await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    }
    throw new Error(`Tab never reached ${rx}`);
  };
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  const names = await page.getByRole('radiogroup', { name: /^Leadership style for/ }).evaluateAll(gs => gs.map(g => g.getAttribute('aria-label')!.replace('Leadership style for ', '')));
  expect(names).toHaveLength(10);
  for (const n of names) {
    await tabTo(new RegExp(`radio\\|.*Leadership style for ${n}`));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    // Wait for the pick to land before tabbing on, so a fast run cannot skip a card.
    await expect(page.getByRole('radiogroup', { name: `Leadership style for ${n}` }).getByRole('radio', { checked: true })).toHaveCount(1);
  }
  await expect(page.getByText('10 of 10 styles set')).toBeAttached();
  await tabTo(/Review and confirm/, true);
  await page.keyboard.press('Enter');
  await tabTo(/^BUTTON\|\|Confirm styles/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Styles are set for week 1' })).toBeFocused();
  await tabTo(/Dismiss outcome/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

  await tabTo(/^BUTTON\|\|Kent Goldberg/);
  await page.keyboard.press('Enter');
  await tabTo(/Meet face to face/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Meet face to face' })).toBeFocused();
  await tabTo(/radio\|.*Choose an option/);
  await page.keyboard.press('ArrowDown');
  await tabTo(/Confirm and start/);
  await page.keyboard.press('Enter');
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await expect(box).toBeFocused();
  await page.keyboard.type('I hear you. What is getting in the way this week?');
  await page.keyboard.press('Enter');
  await expect(box).toHaveValue('');
  await tabTo(/^BUTTON\|\|End/, true);
  await page.keyboard.press('Enter');
  await expect(page.getByText('The team is reacting')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Meet face to face with Kent/ })).toBeFocused({ timeout: 10000 });
  await tabTo(/Dismiss outcome/);
  await page.keyboard.press('Enter');
  await expect(page.getByText('How it landed')).toHaveCount(0);

  // Event cards: focus on the title; Escape is Got it.
  while (await page.getByRole('button', { name: 'Got it' }).count()) {
    const card = page.getByRole('dialog');
    await expect(card.getByRole('heading')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
  }
  await tabTo(/End week/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').first().or(page.getByText('End of week 1'))).toBeVisible();
  while (await page.getByRole('button', { name: 'Got it' }).count()) {
    const card = page.getByRole('dialog', { name: (await page.getByRole('dialog').getByRole('heading').first().textContent()) ?? '' });
    await expect(card.getByRole('heading')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
  }
  // The week end, by keyboard (walked step by step with axe in weekend.spec.ts).
  await expect(page.getByText('End of week 1')).toBeVisible();
  await expect(page.locator('h1')).toBeFocused();
  await tabTo(/^BUTTON\|\|See your week\|/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Week 1 report' })).toBeFocused();
  for (;;) {
    if (await page.getByRole('radiogroup', { name: 'Rewards' }).count()) {
      await tabTo(/^BUTTON\|radio\|/);
      await page.keyboard.press('Space');
    }
    await tabTo(/^BUTTON\|\|(Continue|Nice|Take this reward|Next|Set styles for week 2)\|/);
    const last = /Set styles for week 2/.test(await focused());
    await page.keyboard.press('Enter');
    if (last) break;
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Set your leadership styles for week 2' })).toBeFocused();
});
