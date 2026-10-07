import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Every screen fits the window (D101, D102). Each state is reached once, then the window is resized
 * through every target size: laptops from 1280 by 720 to 2560 by 1440 (the owner's 1513 by 745 among
 * them) and tablets both ways up. At each size:
 * - nothing scrolls sideways;
 * - the play screens (onboarding, the demo, style setting, the board and its panels, the live shell, the
 *   event card, the sponsor call, the week end) do not scroll the page: what can grow scrolls in its region;
 * - the state's primary actions are on screen, not below the fold;
 * - no button, heading or tab clips its text sideways (scrollWidth against clientWidth).
 * Documents (the end screen, the report, the group report) may scroll, with their actions kept in reach.
 * Visual baselines at 1513 by 745 and 1366 by 768 are at the end of this file.
 */

const LAPTOPS = [[1280, 720], [1366, 768], [1440, 800], [1513, 745], [1536, 864], [1680, 1050], [1920, 1080], [2560, 1440]] as const;
const TABLETS = [[1024, 768], [1180, 820], [834, 1194], [768, 1024], [744, 1133]] as const;
const SIZES = [...LAPTOPS, ...TABLETS];
/** Sideways tablets play the laptop layouts at 1024 (D73); upright ones play the tablet layouts. */
const LANDSCAPE = SIZES.filter(([w, h]) => w > h);
const PORTRAIT = SIZES.filter(([w, h]) => w < h);

/** play: fits the window; panes: fits, and the step's action is in a pane that scrolls on its own (/author); document: scrolls as a page. */
type Kind = 'play' | 'panes' | 'document';
type Primary = (page: Page) => Locator[];

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
test.use({ contextOptions: { reducedMotion: 'reduce' } });

/** Measures the page at one size: the problems found, each named with the size. */
async function measure(page: Page, kind: Kind, primary: Locator[], where: string): Promise<string[]> {
  const found: string[] = [];
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    const clipped = Array.from(document.querySelectorAll<HTMLElement>('button, h1, h2, h3, [role="tab"], [role="radio"], a'))
      .filter(el => el.checkVisibility() && !el.closest('[inert], .sr-only') && el.clientWidth > 0)
      .filter(el => {
        const s = getComputedStyle(el);
        if (s.textOverflow === 'ellipsis' || s.overflowX === 'visible') return false;
        return el.scrollWidth > el.clientWidth + 1;
      })
      .map(el => (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 40));
    return { sideways: d.scrollWidth - d.clientWidth, down: d.scrollHeight - d.clientHeight, clipped };
  });
  if (m.sideways > 0) found.push(`${where}: scrolls sideways by ${m.sideways}`);
  if (kind !== 'document' && m.down > 0) found.push(`${where}: page scrolls down by ${m.down}`);
  for (const c of m.clipped) found.push(`${where}: clips "${c}"`);
  const vp = page.viewportSize()!;
  for (const l of primary) {
    // No waiting: a primary action missing at this size is a finding, not something to wait for.
    if (kind === 'panes' && (await l.count())) await l.first().scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined);
    const box = (await l.count()) ? await l.first().boundingBox({ timeout: 2000 }).catch(() => null) : null;
    if (!box) { found.push(`${where}: not shown ${l.toString()}`); continue; }
    if (box.y < -1 || box.x < -1 || box.y + box.height > vp.height + 1 || box.x + box.width > vp.width + 1) found.push(`${where}: off screen ${l.toString()} at ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`);
  }
  return found;
}

/** Resizes through the sizes, measuring each; reports everything at the end so one run shows it all. */
async function across(page: Page, sizes: readonly (readonly [number, number])[], kind: Kind, primary: Primary, name: string) {
  const found: string[] = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    found.push(...await measure(page, kind, primary(page), `${name} at ${width}x${height}`));
  }
  expect(found).toEqual([]);
}

const styles = (page: Page) => page.getByRole('radiogroup', { name: /^Leadership style for/ });
const gotIt = (page: Page) => page.getByRole('button', { name: 'Got it' });

async function confirmStyles(page: Page) {
  await expect(styles(page)).toHaveCount(10, { timeout: 20_000 });
  for (const g of await styles(page).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByRole('heading', { name: /Styles are set for week \d/ })).toBeVisible();
}

async function dismissOutcome(page: Page) {
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
}

async function dismissCards(page: Page) {
  while (await gotIt(page).count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt(page).click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

/** The board of week 1 (or another week), styles confirmed, outcome and cards dismissed. */
async function toBoard(page: Page, period = 1) {
  await page.goto(period > 1 ? `/?start=board&period=${period}` : '/?start=board');
  await confirmStyles(page);
  await dismissOutcome(page);
  await dismissCards(page);
}

const tablet = (page: Page) => page.viewportSize()!.width < page.viewportSize()!.height;
const drawer = (page: Page) => page.getByRole('dialog', { name: /^(Actions for|Team actions)/ });

async function memberAction(page: Page, who: string, action: RegExp, option?: RegExp | 'first') {
  const pick = (scope: Page | Locator) => option === 'first' ? scope.getByRole('radiogroup', { name: 'Choose an option' }).getByRole('radio').first() : scope.getByRole('radio', { name: option });
  if (tablet(page)) {
    await page.getByRole('button', { name: new RegExp(`^${who}, `) }).click();
    await drawer(page).getByRole('radio', { name: action }).click();
    if (option) await pick(drawer(page)).click();
    await drawer(page).getByRole('button', { name: /^(Confirm and start|Open composer|Confirm)/ }).click();
  } else {
    await page.getByText(who, { exact: true }).click();
    await page.getByRole('button', { name: action }).click();
    if (option) await pick(page).click();
    await page.getByRole('button', { name: /^(Confirm and start|Open composer|Confirm)/ }).click();
  }
}

async function quiet(page: Page) {
  await expect(page.getByText('AI persona').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/is speaking/)).toHaveCount(0, { timeout: 15_000 });
}

async function say(page: Page, text: string) {
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await box.fill(text);
  await box.press('Enter');
  await expect(box).toHaveValue('');
  await quiet(page);
}

const endLive = (page: Page) => page.getByRole('button', { name: /^(End|End and see how it lands)$/ });
const reply = (page: Page) => page.getByRole('textbox', { name: 'Your reply' });
const endWeek = (page: Page) => page.getByRole('button', { name: /End week/ });
const menu = (page: Page) => page.getByRole('button', { name: 'Menu' });

/** Plays the last week (opened at week 8) to the end screen. */
async function finishRun(page: Page) {
  await toBoard(page, 8);
  await endWeek(page).click();
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

/** Each test reaches its state sideways at 1440 by 900 and measures the landscape sizes, then upright at 834 by 1194. */
function both(name: string, kind: Kind, reach: (page: Page) => Promise<void>, primary: Primary) {
  test(`${name}, landscape`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await reach(page);
    await across(page, LANDSCAPE, kind, primary, name);
  });
  test(`${name}, portrait`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 834, height: 1194 });
    await reach(page);
    await across(page, PORTRAIT, kind, primary, name);
  });
}

test.describe('onboarding and the demo', () => {
  const steps: [string, (page: Page) => Locator][] = [
    ['language', page => page.getByRole('button', { name: "Let's begin" })],
    ['sponsor', page => page.getByRole('button', { name: 'Next' })],
    ['consent', page => page.getByRole('button', { name: 'Accept and use voice' })],
    ['voice', page => page.getByRole('button', { name: 'Start mic test' })],
    ['how to play', page => page.getByRole('button', { name: 'Meet your team' })],
    ['team', page => page.getByRole('button', { name: 'Start week 1' })]
  ];
  for (const [label, sizes] of [['landscape', LANDSCAPE], ['portrait', PORTRAIT]] as const) {
    test(`every onboarding step, ${label}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: sizes[0][0], height: sizes[0][1] });
      await page.goto('/');
      const found: string[] = [];
      for (const [step, primary] of steps) {
        await expect(primary(page)).toBeVisible({ timeout: 15_000 });
        for (const [width, height] of sizes) {
          await page.setViewportSize({ width, height });
          found.push(...await measure(page, 'play', [primary(page)], `onboarding ${step} at ${width}x${height}`));
        }
        await page.setViewportSize({ width: sizes[0][0], height: sizes[0][1] });
        if (step === 'sponsor') await expect(primary(page)).toBeEnabled({ timeout: 10_000 });
        if (step === 'voice') {
          await primary(page).click();
          await page.getByRole('button', { name: 'Sounds good' }).click({ timeout: 10_000 });
        } else if (step === 'team') {
          for (const name of ['Kent Goldberg', 'Green Bell', 'Ruth Ether']) await page.getByRole('button', { name: new RegExp(`^${name}, `) }).click();
          await primary(page).click();
        } else await primary(page).click();
      }
      // The demo offer, then the demo's first step.
      await expect(page.getByRole('heading', { level: 1, name: 'Try the demo first?' })).toBeVisible();
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        found.push(...await measure(page, 'play', [page.getByRole('button', { name: 'Play the demo' }), page.getByRole('button', { name: 'Skip to the simulation' })], `demo offer at ${width}x${height}`));
      }
      await page.setViewportSize({ width: sizes[0][0], height: sizes[0][1] });
      await page.getByRole('button', { name: 'Play the demo' }).click();
      await expect(page.getByRole('button', { name: 'Exit demo' })).toBeVisible();
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        found.push(...await measure(page, 'play', [page.getByRole('button', { name: 'Exit demo' }), page.getByRole('button', { name: 'Review and confirm' })], `demo style step at ${width}x${height}`));
      }
      expect(found).toEqual([]);
    });
  }
});

test.describe('style setting and the board', () => {
  both('style setting', 'play', async page => {
    await page.goto('/?start=board');
    await expect(styles(page)).toHaveCount(10, { timeout: 20_000 });
  }, page => [page.getByRole('button', { name: 'Review and confirm' })]);

  both('board', 'play', page => toBoard(page), page => [endWeek(page), menu(page)]);

  both('board with the outcome', 'play', async page => {
    await page.goto('/?start=board');
    await confirmStyles(page);
  }, page => [page.getByRole('button', { name: 'Dismiss outcome' }), endWeek(page)]);

  both('event card', 'play', async page => {
    await page.goto('/?start=board&period=3');
    await confirmStyles(page);
    await dismissOutcome(page);
    await expect(gotIt(page)).toBeVisible();
  }, page => [gotIt(page)]);

  both('inbox', 'play', async page => {
    await toBoard(page, 4);
    await page.getByRole('button', { name: /^Inbox/ }).click();
    await expect(page.getByRole('dialog', { name: 'Inbox' })).toBeVisible();
  }, page => [page.getByRole('dialog', { name: 'Inbox' }).getByRole('heading').first()]);

  both('profile', 'play', async page => {
    await toBoard(page);
    if (tablet(page)) {
      await page.getByRole('button', { name: /^Kent Goldberg, / }).click();
      await drawer(page).getByRole('tab', { name: 'Profile' }).click();
    } else await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).click();
    await expect(page.getByRole('heading', { name: 'Your interactions' })).toBeAttached();
  }, page => [page.getByRole('heading', { name: 'Kent Goldberg' }).first()]);

  both('action drawer', 'play', async page => {
    await toBoard(page);
    if (tablet(page)) {
      await page.getByRole('button', { name: /^Kent Goldberg, / }).click();
      await drawer(page).getByRole('radio', { name: /Meet face to face/ }).click();
    } else {
      await page.getByText('Kent Goldberg', { exact: true }).click();
      await page.getByRole('button', { name: /Meet face to face/ }).click();
    }
    await expect(page.getByRole('button', { name: /^Confirm and start/ })).toBeVisible();
  }, page => [page.getByRole('button', { name: /^Confirm and start/ })]);

  both('menu', 'play', async page => {
    await toBoard(page);
    await menu(page).click();
  }, page => [page.getByRole('list', { name: 'Game menu' }).getByRole('button', { name: 'Full screen' })]);

  for (const item of ['Objectives', 'Tutorial and video', 'History', 'Results and stages', 'About these actions'] as const) {
    both(`${item} panel`, 'play', async page => {
      await toBoard(page);
      if (item === 'About these actions' && !tablet(page)) await page.getByRole('button', { name: 'About these actions' }).click();
      else {
        await menu(page).click();
        await page.getByRole('button', { name: item }).or(page.getByRole('menuitem', { name: item })).first().click();
      }
      await expect(page.getByRole('dialog', { name: item })).toBeVisible();
    }, page => [page.getByRole('dialog', { name: item }).getByRole('button', { name: 'Close' })]);
  }

  both('sponsor call', 'play', async page => {
    await toBoard(page, 3);
    if (tablet(page)) {
      await page.getByRole('button', { name: /^Actions ·/ }).click();
      await drawer(page).getByRole('radio', { name: /Energize the team/ }).click();
      await drawer(page).getByRole('radio', { name: /Team building/ }).click();
      await drawer(page).getByRole('button', { name: /^Confirm · / }).click();
    } else {
      await page.getByRole('button', { name: /Energize the team/ }).click();
      await page.getByRole('radio', { name: /Team building/ }).click();
      await page.getByRole('button', { name: /^Confirm/ }).click();
    }
    await dismissOutcome(page);
    await dismissCards(page);
    await memberAction(page, 'Kent Goldberg', /Assess member/, 'first');
    await expect(page.getByRole('alert').filter({ hasText: 'Paula Jacob is calling' })).toBeVisible({ timeout: 15_000 });
  }, page => [page.getByRole('button', { name: 'Take the call' })]);

  both('week end', 'play', async page => {
    await toBoard(page);
    await endWeek(page).click();
    const see = page.getByRole('button', { name: /^See your week$/ });
    for (let i = 0; i < 6; i++) {
      await expect(see.or(gotIt(page)).first()).toBeVisible();
      if (!(await gotIt(page).count())) break;
      await dismissCards(page);
    }
  }, page => [page.getByRole('button', { name: /^See your week$/ })]);

  both('week end report', 'document', async page => {
    await toBoard(page);
    await endWeek(page).click();
    await dismissCards(page);
    await page.getByRole('button', { name: /^See your week$/ }).click();
  }, page => [page.getByRole('button', { name: /^(Continue|Nice|Next)$/ })]);
});

test.describe('live formats', () => {
  both('1:1', 'play', async page => {
    await toBoard(page);
    await memberAction(page, 'Kent Goldberg', /Meet face to face/, /Energize the person/);
    await quiet(page);
    await say(page, 'I am sorry it has been rough. What is on your mind?');
  }, page => [reply(page), endLive(page)]);

  both('email', 'play', async page => {
    await toBoard(page);
    await memberAction(page, 'Beth Killiney', /Send email/, /Send congratulatory mail/);
    await expect(page.getByRole('textbox', { name: /subject/i })).toBeVisible();
  }, page => [page.getByRole('button', { name: /^Send/ }).last()]);

  both('chat', 'play', async page => {
    await toBoard(page);
    await memberAction(page, 'Justin Keel', /Give feedback/, /Collaboratively assess/);
    await quiet(page);
    await say(page, 'How do you think this week went? What would you change?');
  }, page => [reply(page), endLive(page)]);

  both('team meeting', 'play', async page => {
    await toBoard(page);
    if (tablet(page)) {
      await page.getByRole('button', { name: /^Actions ·/ }).click();
      await drawer(page).getByRole('radio', { name: /Meet the team/ }).click();
      await drawer(page).getByRole('radio', { name: /Ask the team to brainstorm/ }).click();
      await drawer(page).getByRole('button', { name: /^Confirm and start/ }).click();
    } else {
      await page.getByRole('button', { name: /Meet the team/ }).click();
      await page.getByRole('radio', { name: /Ask the team to brainstorm/ }).click();
      await page.getByRole('button', { name: /^Confirm and start/ }).click();
    }
    await quiet(page);
  }, page => [reply(page), endLive(page)]);

  both('written plan', 'play', async page => {
    await toBoard(page);
    await memberAction(page, 'Derick Kaynes', /Set goals/, /Seek buy/);
    await expect(page.getByText(/Written plan with Derick/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit plan' })).toBeVisible({ timeout: 15_000 });
  }, page => [page.getByRole('button', { name: 'Submit plan' })]);

  both('sponsor briefing', 'play', async page => {
    await toBoard(page, 4);
    const direct = page.getByRole('button', { name: /Briefing with Paula/ });
    if (await direct.count()) await direct.first().click();
    else {
      await page.getByRole('button', { name: /^Inbox/ }).click();
      const inbox = page.getByRole('dialog', { name: 'Inbox' });
      const item = inbox.locator('div').filter({ has: page.getByText('Briefing with Paula', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Later' }) }).last();
      await item.getByRole('button').last().click();
    }
    await quiet(page);
  }, page => [reply(page), endLive(page)]);

  both('interviews', 'play', async page => {
    await toBoard(page, 4);
    await memberAction(page, 'Derick Kaynes', /^Let go/);
    await quiet(page);
    await say(page, 'Derick, I am sorry, this is a hard conversation. Thank you for your work here.');
    await endLive(page).click();
    await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10_000 });
    await dismissOutcome(page);
    await dismissCards(page);
    if (tablet(page)) {
      await page.getByRole('button', { name: /^Actions ·/ }).click();
      await drawer(page).getByRole('radio', { name: /Hire member/ }).click();
      await drawer(page).getByRole('button', { name: /^Confirm and start/ }).click();
    } else {
      await page.getByRole('button', { name: /Hire member/ }).click();
      await page.getByRole('button', { name: /Confirm and start/ }).click();
    }
    for (let i = 0; i < 2; i++) {
      await quiet(page);
      await say(page, 'Tell me about a time you turned around a difficult client.');
      await endLive(page).click();
    }
    await expect(page.getByRole('table')).toBeVisible();
  }, page => [page.getByRole('button', { name: /^Hire |^(End|End and see how it lands)$/ }).first()]);
});

test.describe('documents', () => {
  both('end screen', 'document', finishRun, page => [page.getByRole('button', { name: 'View my report' })]);

  both('report', 'document', async page => {
    await finishRun(page);
    await page.getByRole('button', { name: 'View my report' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your development report' })).toBeVisible({ timeout: 20_000 });
    await page.mouse.wheel(0, 3000);
  }, page => [page.getByRole('button', { name: /Download/ }).first()]);

  both('group report', 'document', async page => {
    await page.goto('/group');
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 60_000 });
    await page.mouse.wheel(0, 3000);
  }, page => [page.getByRole('button', { name: 'Download PDF' })]);
});

/**
 * /author (D105): laptops and tablets down to 1024 by 768 and 834 wide (no phones). The chat, the
 * recording, the lens step, First draft ready, every workspace tab, the character editor, Add an
 * action, the framework sheet and the library admin page. Panes scroll on their own; the page never does.
 */
test.describe('/author', () => {
  const LAND = [...LAPTOPS, [1024, 768], [1180, 820]] as const;
  const UPRIGHT = [[834, 1194], [834, 1112]] as const;
  function author(name: string, reach: (page: Page) => Promise<void>, primary: Primary) {
    test(`${name}, landscape`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await reach(page);
      await across(page, LAND, 'panes', primary, name);
    });
    test(`${name}, portrait`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 834, height: 1194 });
      await reach(page);
      await across(page, UPRIGHT, 'panes', primary, name);
    });
  }
  const chip = (page: Page, name: string | RegExp) => page.getByRole('group', { name: 'Suggested answers' }).getByRole('button', { name });
  const composer = (page: Page) => [page.getByRole('textbox', { name: 'Your answer' }), page.getByRole('button', { name: 'Send', exact: true })];
  const top = (page: Page) => [page.getByRole('button', { name: 'Review and publish' }), page.getByRole('button', { name: 'Play a week' })];
  async function toLens(page: Page) {
    await page.goto('/author');
    await chip(page, 'First time managers').click();
    await chip(page, 'Manufacturing').click();
    for (const c of ['Hitting targets without burning out the team', 'Fictional company', /^10/, /^Sales Elevator funnel/, 'Standard', 'English, India', 'No framework', 'Professional']) await chip(page, c).click();
    await expect(page.getByRole('button', { name: 'Use this lens' }).first()).toBeVisible();
  }
  async function workspace(page: Page, tab: string) {
    await page.goto('/author');
    await page.getByRole('button', { name: 'Skip to the workspace' }).click();
    await page.goto(`/author/workspace/${tab}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }

  author('author chat', async page => {
    await page.goto('/author');
    await expect(page.getByText(/^Question 1 of about \d+$/)).toBeVisible();
  }, composer);
  author('author recording', async page => {
    await page.goto('/author');
    await page.getByRole('button', { name: 'Record your answer' }).click();
  }, page => [page.getByRole('button', { name: 'Stop and review' })]);
  author('author lens', toLens, page => [page.getByRole('button', { name: 'Use this lens' }).first(), page.getByRole('button', { name: 'Send', exact: true })]);
  author('author first draft ready', async page => {
    await toLens(page);
    await page.getByRole('button', { name: 'Use this lens' }).first().click();
  }, page => [page.getByRole('button', { name: 'Open the workspace' })]);
  for (const tab of ['overview', 'brief', 'story', 'process', 'team', 'lens', 'actions', 'events', 'scoring', 'brand', 'calibrate', 'publish']) {
    author(`author workspace ${tab}`, page => workspace(page, tab), tab === 'publish' ? page => [...top(page), page.getByRole('button', { name: 'Publish', exact: true })] : top);
  }
  author('author character editor', async page => {
    await workspace(page, 'team');
    await page.getByRole('button', { name: 'Edit profile' }).click();
  }, page => [page.getByRole('button', { name: 'Save changes' }), page.getByRole('button', { name: 'Cancel' })]);
  author('author add an action', async page => {
    await workspace(page, 'actions');
    await page.getByRole('button', { name: 'Add an action' }).click();
  }, page => [page.getByRole('button', { name: 'Add to this simulation' })]);
  author('author skills framework', async page => {
    await workspace(page, 'scoring');
    await page.getByRole('button', { name: 'Use your own skills framework instead' }).click();
  }, page => [page.getByRole('button', { name: /^Confirm \d+ skills$/ })]);
  author('author library admin', async page => {
    await page.goto('/author/library');
    await expect(page.getByRole('heading', { level: 1, name: 'Action library' })).toBeVisible();
  }, page => [page.getByRole('button', { name: 'Save as beta' })]);
});

/**
 * Visual baselines at the owner's laptop (1513 by 745) and a common one (1366 by 768): the main play
 * screens and /author, in the dark theme. `npx playwright test viewport --update-snapshots` refreshes them.
 */
test.describe('baselines', () => {
  async function still(page: Page, name: string) {
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined)));
    });
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002, mask: [page.getByRole('button', { name: /^Pause/ })] });
  }
  for (const [width, height] of [[1513, 745], [1366, 768]] as const) {
    test.describe(`${width}x${height}`, () => {
      test.use({ viewport: { width, height } });
      const at = `${width}x${height}`;

      test(`style setting at ${at}`, async ({ page }) => {
        await page.goto('/?start=board');
        await expect(styles(page)).toHaveCount(10, { timeout: 20_000 });
        await still(page, `fit-${at}-styles`);
      });
      test(`board at ${at}`, async ({ page }) => {
        await toBoard(page);
        await still(page, `fit-${at}-board`);
      });
      test(`board with the outcome at ${at}`, async ({ page }) => {
        await page.goto('/?start=board');
        await confirmStyles(page);
        await still(page, `fit-${at}-outcome`);
      });
      test(`action drawer at ${at}`, async ({ page }) => {
        await toBoard(page);
        await page.getByText('Kent Goldberg', { exact: true }).click();
        await page.getByRole('button', { name: /Meet face to face/ }).click();
        await page.getByRole('radio', { name: /Energize the person/ }).click();
        await still(page, `fit-${at}-drawer`);
      });
      test(`1:1 at ${at}`, async ({ page }) => {
        await toBoard(page);
        await memberAction(page, 'Kent Goldberg', /Meet face to face/, /Energize the person/);
        await quiet(page);
        await expect(reply(page)).toBeEditable();
        await still(page, `fit-${at}-live`);
      });
      test(`event card at ${at}`, async ({ page }) => {
        await page.goto('/?start=board&period=3');
        await confirmStyles(page);
        await dismissOutcome(page);
        await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
        await still(page, `fit-${at}-event`);
      });
      test(`author at ${at}`, async ({ page }) => {
        await page.goto('/author');
        await expect(page.getByText(/^Question 1 of about \d+$/)).toBeVisible();
        await expect(page.getByText('Saved just now')).toBeVisible();
        await still(page, `fit-${at}-author`);
      });
      test(`author workspace at ${at}`, async ({ page }) => {
        await page.goto('/author');
        await page.getByRole('button', { name: 'Skip to the workspace' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
        await expect(page.getByText('Saved just now')).toBeVisible();
        await still(page, `fit-${at}-author-workspace`);
      });
    });
  }
});
