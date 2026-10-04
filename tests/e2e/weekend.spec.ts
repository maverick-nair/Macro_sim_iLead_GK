import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** M5: the week end on the engine, walked by keyboard, with axe at every step. */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function axe(page: Page) {
  // Steps rise in; colour contrast is measured once they have landed (finite animations only).
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.length} ${v.nodes.map(n => `${n.target.join(' ')} (${n.any.map(a => a.message).join(' ')})`).join(', ')}`);
}

/** Tag, role and name of the focused element. */
const focused = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement;
  return `${a.tagName}|${a.getAttribute('role') ?? ''}|${(a.getAttribute('aria-label') ?? a.textContent ?? '').trim()}`;
});
async function tabTo(page: Page, rx: RegExp) {
  for (let i = 0; i < 80; i++) {
    if (rx.test(await focused(page))) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached ${rx}`);
}

/** Sets the same style for everyone and confirms, then dismisses the team's reaction. */
async function setStyles(page: Page) {
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByText(/Styles are set for week \d/)).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  // Event cards wait behind the outcome.
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

/** Ends the period from the board by keyboard and closes any event cards with Escape. */
async function endWeek(page: Page) {
  await page.getByRole('button', { name: /End week/ }).focus();
  await page.keyboard.press('Enter');
  for (;;) {
    await expect(page.getByRole('button', { name: 'Got it' }).or(page.getByText(/^End of week \d$/))).toBeVisible({ timeout: 10000 });
    if (!(await page.getByRole('button', { name: 'Got it' }).count())) break;
    const card = page.getByRole('dialog');
    await expect(card.getByRole('heading')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
  }
  // The week end replaces the board; focus starts on the banner's headline.
  await expect(page.locator('h1')).toBeFocused();
}

/** After a step's button: true once the week end has gone, false once the next step's heading has focus. */
async function left(page: Page) {
  const header = page.getByText(/ · Week end$/);
  await expect.poll(async () => (await header.count()) === 0 || ['H1', 'H2'].includes(await page.evaluate(() => document.activeElement?.tagName ?? ''))).toBe(true);
  return (await header.count()) === 0;
}

/** Walks the week end from the banner by keyboard. Returns the steps it went through. */
async function walk(page: Page, week: number) {
  const seen: string[] = ['banner'];
  expect(await axe(page)).toEqual([]);
  await tabTo(page, new RegExp(`^BUTTON\\|\\|See your week$`));
  await page.keyboard.press('Enter');

  // The report: focus on its heading; funnel, team, stars, streak, sponsor and Team Pulse.
  await expect(page.getByRole('heading', { level: 1, name: `Week ${week} report` })).toBeFocused();
  seen.push('report');
  await expect(page.getByRole('heading', { name: 'Funnel this week' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Team over the week' }).getByRole('row')).toHaveCount(5);
  await expect(page.getByRole('img', { name: /^Leads: [\d.]+, ideal [\d.]+/ })).toBeVisible();
  await expect(page.getByText(/^(First|Second|Third) star at \d+/)).toHaveCount(3);
  await expect(page.getByText(/^Weeks in a row at 2 stars or more\./)).toBeVisible();
  await expect(page.getByText(/^Team Pulse \d+, (up \d+|down \d+|no change)$/)).toBeVisible();
  await expect(page.getByRole('img', { name: /^Team mood: \d+ upbeat, \d+ steady, \d+ struggling$/ })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  if (week > 1) {
    // The funnel can show the run so far against the cumulative ideal.
    await tabTo(page, /^BUTTON\|\|So far$/);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Funnel so far' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'So far' })).toHaveAttribute('aria-pressed', 'true');
  }
  await tabTo(page, /^BUTTON\|\|(Continue|Set styles for week \d|See your results)$/);
  await page.keyboard.press('Enter');
  if (await left(page)) return seen;

  for (;;) {
    const heading = page.locator(':focus');
    await expect(heading).toHaveCount(1);
    const tag = await heading.evaluate(el => el.tagName);
    expect(['H1', 'H2']).toContain(tag);
    expect(await axe(page)).toEqual([]);
    if (await page.getByRole('dialog', { name: 'Badge earned' }).count()) {
      seen.push('badge');
      await expect(page.getByText(/^Badge earned · \d+ of \d+$/)).toBeVisible();
      await tabTo(page, /^BUTTON\|\|Nice$/);
    } else if (await page.getByRole('radiogroup', { name: 'Rewards' }).count()) {
      seen.push('unlock');
      await expect(page.getByRole('button', { name: 'Take this reward' })).toBeDisabled();
      await tabTo(page, /^BUTTON\|radio\|/);
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
      await tabTo(page, /^BUTTON\|\|Take this reward$/);
    } else {
      seen.push('news');
      await expect(page.getByRole('heading', { level: 1, name: /^Week \d+ news · \d+ of \d+$/ })).toBeFocused();
      const impact = page.getByRole('button', { name: 'See impact' });
      if (await impact.count()) {
        await tabTo(page, /^BUTTON\|\|See impact$/);
        await page.keyboard.press('Enter');
        await expect(impact).toHaveAttribute('aria-expanded', 'true');
        expect(await axe(page)).toEqual([]);
      }
      await tabTo(page, /^BUTTON\|\|(Next|Set styles for week \d+)$/);
    }
    await page.keyboard.press('Enter');
    if (await left(page)) return seen;
  }
}

test('a week end by keyboard: banner, report, news, then style setting for the next week', async ({ page }) => {
  await page.goto('/?start=board');
  await setStyles(page);
  await endWeek(page);
  await expect(page.getByText('End of week 1')).toBeVisible();
  await expect(page.getByText('Week 1 of 8 · Week end')).toBeVisible();
  await expect(page.getByRole('img', { name: /^\d of 3 stars this week$/ })).toBeVisible();
  const seen = await walk(page, 1);
  expect(seen).toContain('news');
  expect(seen.slice(0, 2)).toEqual(['banner', 'report']);
  await expect(page.getByRole('heading', { level: 1, name: 'Set your leadership styles for week 2' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Review and confirm' })).toBeVisible();
});

test('a later week end in the light theme: so far view of the funnel, every step passes axe', async ({ page }) => {
  await page.goto('/?start=board&period=3&theme=light');
  await setStyles(page);
  await endWeek(page);
  expect(await walk(page, 3)).toContain('news');
  await expect(page.getByRole('heading', { level: 1, name: 'Set your leadership styles for week 4' })).toBeFocused();
});

test('the end of the run: banner, report and the new badges, then the results', async ({ page }) => {
  await page.goto('/?start=board&period=8');
  await setStyles(page);
  await endWeek(page);
  await expect(page.getByText('End of week 8')).toBeVisible();
  const seen = await walk(page, 8);
  // No conversation went badly in the whole run: Steady Hand. No unlock or news after the last week.
  expect(seen).toContain('badge');
  expect(seen).not.toContain('unlock');
  expect(seen).not.toContain('news');
  const panel = page.getByRole('dialog', { name: 'The run is over' });
  await expect(panel.getByRole('heading', { name: 'The run is over' })).toBeFocused();
  expect(await axe(page)).toEqual([]);
});

test('the reward picker is a radio group: arrows choose, the reward must be taken to go on', async ({ page }) => {
  await page.goto('/screens#w4');
  const frame = page.locator('#w4');
  const group = frame.getByRole('radiogroup', { name: 'Rewards' });
  await expect(group).toBeVisible();
  const take = frame.getByRole('button', { name: 'Take this reward' });
  await expect(take).toBeDisabled();
  await group.getByRole('radio').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(group.getByRole('radio').nth(1)).toBeFocused();
  await expect(group.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('End');
  await expect(group.getByRole('radio').nth(2)).toHaveAttribute('aria-checked', 'true');
  await expect(take).toBeEnabled();
  await take.focus();
  await page.keyboard.press('Enter');
  await expect(frame.getByRole('heading', { level: 1, name: 'Week 3 news · 1 of 2' })).toBeFocused();
});
