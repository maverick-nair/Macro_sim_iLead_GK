import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** The team on the board: ten, or nine from week 8, opened with `period=8`: the mock's fast forward plays seven weeks with
 * no actions, and with people dynamics (D135) Peter's morale stays so low that he resigns. */
const team = (page: Page) => (/[?&]period=8\b/.test(page.url()) ? 9 : 10);

/**
 * Accessibility, consolidated (M8, D78): axe (WCAG 2.2 AA) on every route and major state of the
 * participant app, the reports, the group report and /author (light only, walked once per width), in the dark, light and client
 * (Halden) themes, at 1440, 1024 and 834 (a portrait tablet, D73), plus the small screen notice at 390
 * and a custom theme through the theme loader (Brightwater, corrected). Then a keyboard only path
 * through a full week and a live conversation.
 *
 * Every test collects all violations of the states it walks and fails at the end with the full list,
 * so one run shows everything. No rule is disabled.
 */

// Many independent tests in one file: let them spread over the workers.
test.describe.configure({ mode: 'parallel' });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const THEMES = { dark: '', light: 'theme=light', client: 'client=halden' } as const;
const WIDTHS = [1440, 1024, 834] as const;
type Width = (typeof WIDTHS)[number];
const BRIGHTWATER = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/theme/samples/brightwater.json'), 'utf8');

const errors: string[] = [];
const found: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  found.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => {
  expect(found).toEqual([]);
  expect(errors).toEqual([]);
});

const url = (base: string, ...q: string[]) => {
  const all = q.filter(Boolean).join('&');
  return all ? `${base}${base.includes('?') ? '&' : '?'}${all}` : base;
};

/** Axe on what is on screen now, once finite animations have landed. Violations are collected, not thrown. */
async function scan(page: Page, where: string) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))));
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  for (const v of r.violations) found.push(`${where}: ${v.id} (${v.impact}) ${v.nodes.length}x ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
}

const tablet = (w: Width) => w < 1000;
const viewport = (w: Width) => ({ width: w, height: tablet(w) ? 1194 : 1000 });

// ---- Flow helpers ----

async function styles(page: Page, where = 'style setting') {
  const groups = page.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups).toHaveCount(team(page), { timeout: 30_000 });
  await scan(page, where);
  for (const g of await groups.all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  const summary = page.getByRole('dialog');
  await expect(summary.getByRole('button', { name: 'Confirm styles' })).toBeVisible();
  await scan(page, 'style summary');
  await summary.getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByRole('heading', { name: /Styles are set for week/ })).toBeVisible();
}

async function outcome(page: Page, where: string) {
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 15_000 });
  await scan(page, `${where} outcome`);
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
}

/** Event cards one at a time; axe on the first. */
async function events(page: Page, where: string) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  let first = true;
  while (await gotIt.count()) {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveCSS('opacity', '1');
    if (first) await scan(page, `${where} event card`);
    first = false;
    const title = await dialog.getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

async function toBoard(page: Page, q: string, extra = '') {
  await page.goto(url('/?start=board', extra, q));
  await styles(page);
  await outcome(page, 'styles');
  await events(page, 'week start');
}

const drawer = (page: Page) => page.getByRole('dialog', { name: /^(Actions for|Team actions)/ });

/** Starts a member's action (desktop: the Actions panel; tablet: the drawer). */
async function memberAction(page: Page, w: Width, who: string, action: RegExp, option?: RegExp | 'first', where?: string) {
  const pick = (scope: Page | Locator) => option === 'first' ? scope.getByRole('radiogroup', { name: 'Choose an option' }).getByRole('radio').first() : scope.getByRole('radio', { name: option });
  if (tablet(w)) {
    await page.getByRole('button', { name: new RegExp(`^${who}, `) }).click();
    const d = drawer(page);
    await d.getByRole('radio', { name: action }).click();
    if (option) await pick(d).click();
    if (where) await scan(page, where);
    await d.getByRole('button', { name: /^(Confirm and start|Open composer|Confirm)/ }).click();
  } else {
    // Select the person, unless they already are (opening a profile selects them).
    if ((await page.getByRole('button', { name: new RegExp(`^${who}, `) }).first().getAttribute('aria-pressed')) !== 'true') await page.getByText(who, { exact: true }).click();
    await page.getByRole('button', { name: action }).click();
    if (option) await pick(page).click();
    if (where) await scan(page, where);
    await page.getByRole('button', { name: /^(Confirm and start|Open composer|Confirm)/ }).click();
  }
}

async function teamAction(page: Page, w: Width, action: RegExp, option?: RegExp) {
  if (tablet(w)) {
    await page.getByRole('button', { name: /^Actions ·/ }).click();
    const d = drawer(page);
    await d.getByRole('radio', { name: action }).click();
    if (option) await d.getByRole('radio', { name: option }).click();
    await d.getByRole('button', { name: /^(Confirm and start|Confirm)/ }).click();
  } else {
    await page.getByRole('button', { name: action }).click();
    if (option) await page.getByRole('radio', { name: option }).click();
    await page.getByRole('button', { name: /^(Confirm and start|Confirm)/ }).click();
  }
}

/** The scheduled sponsor briefing: from the inbox rail where it shows (1440), otherwise from the inbox. */
async function openBriefing(page: Page) {
  const direct = page.getByRole('button', { name: /Briefing with Paula/ });
  if (await direct.count()) return direct.first().click();
  await page.getByRole('button', { name: /^Inbox/ }).click();
  const inbox = page.getByRole('dialog', { name: 'Inbox' });
  const item = inbox.locator('div').filter({ has: page.getByText('Briefing with Paula', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Later' }) }).last();
  await item.getByRole('button').last().click();
}

/** Waits for the NPC's line to finish streaming. */
async function quiet(page: Page) {
  await expect(page.getByText('AI persona').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/is speaking/)).toHaveCount(0, { timeout: 20_000 });
}

async function say(page: Page, text: string) {
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await box.fill(text);
  await box.press('Enter');
  await expect(box).toHaveValue('');
  await quiet(page);
}

async function endLive(page: Page) {
  await page.getByRole('button', { name: /^(End|End and see how it lands)$/ }).click();
}

/** Walks the week end, axe at every step, to `last` or until it is gone. */
async function weekEnd(page: Page, last: RegExp, after?: Locator) {
  await expect(page.getByText(/ · Week end$/)).toBeVisible();
  await scan(page, 'week end banner');
  await page.getByRole('button', { name: /^See your week$/ }).click();
  const step = page.getByRole('button', { name: /^(Continue|Nice|Take this reward|Next)$/ });
  for (let i = 0; i < 15; i++) {
    const done = page.getByRole('button', { name: last });
    await expect(after ? step.first().or(done.first()).or(after) : step.first().or(done.first())).toBeVisible();
    if (after && (await after.count())) return;
    const heading = (await page.getByRole('heading').first().textContent())?.trim();
    await scan(page, `week end: ${heading}`);
    if (await page.getByRole('radiogroup', { name: 'Rewards' }).count()) await page.getByRole('radio').first().click();
    if (await done.count()) return;
    await step.first().click();
  }
}

async function finishRun(page: Page, q: string, extra = '') {
  await page.goto(url('/?start=board&period=8', extra, q));
  const groups = page.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups).toHaveCount(team(page), { timeout: 30_000 });
  for (const g of await groups.all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await expect(page.getByText('How it landed')).toHaveCount(0);
  await events(page, 'week 8');
  await page.getByRole('button', { name: /End week/ }).click();
  await events(page, 'week 8 end');
  const h1 = page.getByRole('heading', { level: 1, name: /^You finished at / });
  await weekEnd(page, /^See your results$/, h1);
  const results = page.getByRole('button', { name: /^See your results$/ });
  if (await results.count()) await results.click();
  await expect(h1).toBeVisible();
}

// ---- The matrix ----

for (const [theme, q] of Object.entries(THEMES)) {
  test.describe(`${theme}`, () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('small screen notice at 390', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url('/?start=board', q));
      await expect(page.getByRole('heading', { level: 1, name: 'iLead works best on a bigger screen' })).toBeVisible();
      await scan(page, 'small screen notice');
      await page.goto(url('/group', q));
      await expect(page.getByRole('heading', { level: 1, name: 'iLead works best on a bigger screen' })).toBeVisible();
      await scan(page, 'small screen notice, group');
    });

    for (const w of WIDTHS) {
      test.describe(`${w}`, () => {
        test.use({ viewport: viewport(w) });

        test('onboarding, every step', async ({ page }) => {
          test.setTimeout(120_000);
          await page.goto(url('/', q));
          await expect(page.getByRole('heading', { level: 1, name: 'Lead a sales team of ten, for eight weeks.' })).toBeVisible();
          await scan(page, 'onboarding: language');
          await page.getByRole('button', { name: "Let's begin" }).click();
          await expect(page.getByRole('heading', { level: 1, name: 'Paula Jacob' })).toBeVisible();
          await scan(page, 'onboarding: sponsor');
          for (const tab of ['About the product', 'Your targets']) {
            const t = page.getByRole('tab', { name: tab });
            if (await t.count()) { await t.click(); await scan(page, `onboarding: sponsor, ${tab}`); }
          }
          const next = page.getByRole('button', { name: 'Next' });
          await expect(next).toBeEnabled({ timeout: 10_000 });
          await next.click();
          await expect(page.getByRole('button', { name: 'Accept and use voice' })).toBeVisible();
          await scan(page, 'onboarding: consent');
          await page.getByRole('button', { name: 'Accept and use voice' }).click();
          await expect(page.getByRole('button', { name: 'Start mic test' })).toBeVisible();
          await scan(page, 'onboarding: voice check');
          await page.getByRole('button', { name: 'Start mic test' }).click();
          await expect(page.getByRole('heading', { level: 1, name: 'We heard you clearly' })).toBeVisible({ timeout: 10_000 });
          await page.getByRole('button', { name: 'Play a sample voice' }).click();
          await expect(page.getByText(/how this week is going\.$/)).toHaveCount(2, { timeout: 20_000 });
          await scan(page, 'onboarding: voice heard');
          await page.getByRole('button', { name: 'Sounds good' }).click();
          await expect(page.getByRole('button', { name: 'Meet your team' })).toBeVisible();
          await scan(page, 'onboarding: how to play');
          await page.getByRole('button', { name: 'Meet your team' }).click();
          await expect(page.getByRole('button', { name: 'Start week 1' })).toBeVisible();
          await scan(page, 'onboarding: team');
          for (const name of ['Kent Goldberg', 'Green Bell', 'Ruth Ether']) await page.getByRole('button', { name: new RegExp(`^${name}, `) }).click();
          await expect(page.getByText('3 of 3 profiles read')).toBeVisible();
          await scan(page, 'onboarding: team, profiles read');
        });

        test('a week: style setting, board, drawer, inbox, profile, dialogs, a 1:1, week end', async ({ page }) => {
          test.setTimeout(180_000);
          await toBoard(page, q);
          await scan(page, 'board');
          // Inbox.
          await page.getByRole('button', { name: /^Inbox/ }).click();
          await expect(page.getByRole('dialog', { name: 'Inbox' })).toBeVisible();
          await scan(page, 'inbox');
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog', { name: 'Inbox' })).toHaveCount(0);
          // Profile.
          if (tablet(w)) {
            await page.getByRole('button', { name: /^Kent Goldberg, / }).click();
            await drawer(page).getByRole('tab', { name: 'Profile' }).click();
            await expect(drawer(page).getByRole('heading', { name: 'Your interactions' })).toBeVisible();
            await scan(page, 'drawer: profile');
            await page.keyboard.press('Escape');
            await expect(drawer(page)).toHaveCount(0);
          } else {
            await page.getByRole('button', { name: 'Open profile for Kent Goldberg' }).click();
            await expect(page.getByRole('heading', { name: 'Your interactions' })).toBeVisible();
            await scan(page, 'profile');
            await page.keyboard.press('Escape');
          }
          // Score breakdown and badges (desktop HUD; the tablet HUD keeps the score).
          const score = page.getByRole('button', { name: /^Leadership score \d+/ });
          if (await score.count()) {
            await score.click();
            await scan(page, 'score breakdown');
            await page.keyboard.press('Escape');
          }
          const badges = page.getByRole('button', { name: /^Badges, \d+ of 10$/ });
          if (await badges.count()) {
            await badges.click();
            await expect(page.getByRole('dialog', { name: 'Badges' })).toHaveCSS('opacity', '1');
            await scan(page, 'badge shelf');
            await page.keyboard.press('Escape');
            await expect(page.getByRole('dialog', { name: 'Badges' })).toHaveCount(0);
          }
          // Settings and pause.
          await page.getByRole('button', { name: 'Settings' }).click();
          await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
          await scan(page, 'settings');
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
          await page.getByRole('button', { name: /^Pause/ }).first().click();
          const paused = page.getByRole('dialog', { name: 'You are paused' });
          await expect(paused).toBeVisible();
          await scan(page, 'paused');
          await paused.getByRole('button', { name: 'Resume' }).click();
          await expect(paused).toHaveCount(0);
          // The action drawer and a 1:1 with a hint.
          await memberAction(page, w, 'Kent Goldberg', /Meet face to face/, /Energize the person/, 'action drawer');
          await expect(page.getByText('1:1 with Kent Goldberg').first()).toBeVisible();
          await quiet(page);
          await scan(page, 'live: 1:1');
          await say(page, 'I am sorry it has been rough. What is on your mind?');
          await page.getByRole('button', { name: 'Hint' }).click();
          await scan(page, 'live: 1:1 with a hint');
          await endLive(page);
          await expect(page.getByText('The team is reacting')).toBeVisible();
          await scan(page, 'the team is reacting');
          await outcome(page, '1:1');
          await events(page, 'after 1:1');
          // The week end, into week 2.
          await page.getByRole('button', { name: /End week/ }).click();
          await events(page, 'week end');
          await weekEnd(page, /^Set styles for week 2$/);
        });

        test('live formats: email and chat', async ({ page }) => {
          test.setTimeout(150_000);
          await toBoard(page, q);
          await memberAction(page, w, 'Beth Killiney', /Send email/, /Send congratulatory mail/);
          await expect(page.getByRole('textbox', { name: /subject/i })).toBeVisible();
          await scan(page, 'live: email');
          await page.getByRole('textbox', { name: /subject/i }).fill('Great work on the Ashcroft leads');
          await page.getByRole('textbox', { name: /body|message/i }).fill('Thank you for the 12 new leads this week, specifically the Ashcroft account. Please keep me posted by Friday.');
          await page.getByRole('button', { name: /^Send/ }).last().click();
          await outcome(page, 'email');
          await events(page, 'after email');
          await memberAction(page, w, 'Justin Keel', /Give feedback/, /Collaboratively assess/);
          await quiet(page);
          await scan(page, 'live: chat');
          await say(page, 'How do you think this week went? What would you change?');
          await scan(page, 'live: chat, a reply');
          await endLive(page);
          await outcome(page, 'chat');
        });

        test('live formats: team meeting and written plan', async ({ page }) => {
          test.setTimeout(150_000);
          await toBoard(page, q);
          await teamAction(page, w, /Meet the team/, /Ask the team to brainstorm/);
          await quiet(page);
          await scan(page, 'live: team meeting');
          await say(page, 'What do you each see as the biggest blocker this week?');
          await endLive(page);
          await outcome(page, 'meeting');
          await events(page, 'after meeting');
          await memberAction(page, w, 'Derick Kaynes', /Set goals/, /Seek buy/);
          await expect(page.getByText(/Written plan with Derick/).first()).toBeVisible();
          await scan(page, 'live: written plan');
          await page.getByRole('textbox', { name: /^Goals/ }).fill('Qualify 12 leads from the Ashcroft list');
          await page.getByRole('textbox', { name: /^Measures/ }).fill('12 qualified leads in the CRM');
          await page.getByRole('textbox', { name: /^Owner/ }).fill('Derick, with me on Friday');
          await page.getByRole('radio').last().check({ force: true });
          await page.getByRole('button', { name: 'Submit plan' }).click();
          await expect(page.getByText(/numbers make it clear/)).toBeVisible({ timeout: 15_000 });
          await scan(page, 'live: written plan, check in');
          await endLive(page);
          await outcome(page, 'plan');
        });

        test('week 3: event card, sponsor call; week 4: sponsor briefing and interviews', async ({ page }) => {
          test.setTimeout(180_000);
          await toBoard(page, q, 'period=3');
          // Spend three days: the sponsor rings.
          await teamAction(page, w, /Energize the team/, /Team building/);
          await outcome(page, 'team building');
          await events(page, 'after team building');
          await memberAction(page, w, 'Kent Goldberg', /Assess member/, 'first');
          await events(page, 'after assess');
          if (await page.getByText('How it landed').count()) await outcome(page, 'assess');
          const call = page.getByRole('alert').filter({ hasText: 'Paula Jacob is calling' });
          await expect(call).toHaveCSS('opacity', '1', { timeout: 15_000 });
          await scan(page, 'sponsor call');
          await call.getByRole('button', { name: 'Take the call' }).click();
          await quiet(page);
          await scan(page, 'live: sponsor call');

          await toBoard(page, q, 'period=4');
          await openBriefing(page);
          await expect(page.getByText(/Sponsor briefing with Paula/).first()).toBeVisible({ timeout: 20_000 });
          await quiet(page);
          await scan(page, 'live: sponsor briefing');
          // The interviews need a place on the team: let someone go first (a live 1:1).
          await toBoard(page, q, 'period=4');
          await memberAction(page, w, 'Derick Kaynes', /^Let go/);
          await quiet(page);
          await scan(page, 'live: letting someone go');
          await say(page, 'Derick, I am sorry, this is a hard conversation. Thank you for your work here.');
          await endLive(page);
          await outcome(page, 'let go');
          await events(page, 'after let go');
          await teamAction(page, w, /Hire member/);
          await expect(page.getByText('Interviews for a new hire').first()).toBeVisible();
          await quiet(page);
          await scan(page, 'live: interview');
          for (let i = 0; i < 2; i++) {
            await say(page, 'Tell me about a time you turned around a difficult client.');
            await endLive(page);
            if (i === 0) await quiet(page);
          }
          await expect(page.getByRole('table')).toBeVisible();
          await scan(page, 'live: interview comparison');
        });

        test('end screen, report and its print view', async ({ page }) => {
          test.setTimeout(180_000);
          await finishRun(page, q);
          await scan(page, 'end screen');
          await page.getByRole('button', { name: 'View my report' }).click();
          await expect(page.getByRole('heading', { level: 1, name: 'Your development report' })).toBeVisible({ timeout: 20_000 });
          await scan(page, 'report: development');
          await page.getByRole('button', { name: 'Download PDF' }).click();
          await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible({ timeout: 20_000 });
          await scan(page, 'report: development, print view');
        });

        test('assessment report, web and print', async ({ page }) => {
          test.setTimeout(150_000);
          await page.goto(url('/?report=1&purpose=assessment&history=1', q));
          await expect(page.getByRole('heading', { level: 1, name: 'Jordan Lee' })).toBeVisible({ timeout: 60_000 });
          await scan(page, 'report: assessment');
          await page.goto(url('/?report=1&purpose=assessment&print=1', q));
          await expect(page.getByRole('heading', { level: 1, name: 'Jordan Lee' })).toBeVisible({ timeout: 60_000 });
          await scan(page, 'report: assessment, print view');
        });

        test('group report, both purposes and print', async ({ page }) => {
          test.setTimeout(150_000);
          for (const [label, extra] of [['development', ''], ['assessment', 'purpose=assessment'], ['development, print', 'print=1'], ['assessment, print', 'purpose=assessment&print=1'], ['under the minimum size', 'size=3']]) {
            await page.goto(url('/group', extra, q));
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
            await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 60_000 });
            await scan(page, `group report: ${label}`);
          }
        });

        // /author is light only (D105), whatever the participant theme: walked once, at each width.
        if (theme === 'dark') test('author: the chat, the lens, first draft, every workspace tab and dialog, the library', async ({ page }) => {
          test.setTimeout(240_000);
          await page.goto('/author');
          await expect(page.getByText(/^Question \d+ of about \d+$/)).toBeVisible();
          await scan(page, 'author: first question');
          const chip = (name: string | RegExp) => page.getByRole('group', { name: 'Suggested answers' }).getByRole('button', { name });
          await chip('First time managers').click();
          await chip('Manufacturing').click();
          await chip('Hitting targets without burning out the team').click();
          await chip('Fictional company').click();
          await page.getByRole('textbox', { name: 'Your answer' }).fill('30');
          await page.getByRole('button', { name: 'Send', exact: true }).click();
          await expect(page.getByRole('alert')).toBeVisible();
          await scan(page, 'author: an answer refused');
          await page.getByRole('textbox', { name: 'Your answer' }).fill('');
          await page.getByRole('button', { name: 'Record your answer' }).click();
          await expect(page.getByText(/^Recording/)).toBeVisible();
          await scan(page, 'author: recording');
          await page.getByRole('button', { name: 'Stop and review' }).click();
          await expect(page.getByText(/Transcribed from your recording/)).toBeVisible();
          await scan(page, 'author: transcript to review');
          await page.getByRole('button', { name: 'Send', exact: true }).click();
          for (const c of [/^Sales Elevator funnel/, 'Standard', 'English, India', 'No framework', 'Professional']) await chip(c).click();
          await expect(page.getByRole('button', { name: 'Use this lens' }).first()).toBeVisible();
          if (w < 1180) await page.getByText('Your simulation so far').click();
          await scan(page, 'author: lens');
          await page.getByRole('button', { name: 'See all 8 lenses, or upload your own framework' }).click();
          await page.getByRole('button', { name: 'More detail' }).first().click();
          await scan(page, 'author: all lenses');
          await page.getByRole('button', { name: 'Use this lens' }).first().click();
          await expect(page.getByRole('heading', { level: 1, name: /Your simulation is playable/ })).toBeVisible();
          await scan(page, 'author: first draft ready');
          await page.getByRole('button', { name: 'Open the workspace' }).click();
          for (const tab of ['Overview', 'Brief', 'Story and world', 'Work process', 'Team', 'Leadership lens', 'Actions and conversations', 'Events', 'Scoring and report', 'Brand and theme', 'Test with synthetic players', 'Review and publish']) {
            await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(tab) }).click();
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
            await page.waitForTimeout(100);
            await scan(page, `author: ${tab}`);
          }
          await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Story and world/ }).click();
          for (const sub of ['Market and competitors', 'Sponsor and intro screens']) { await page.getByRole('tab', { name: sub }).click(); await scan(page, `author: story, ${sub}`); }
          await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Team/ }).click();
          if (w < 1280) await page.getByRole('button', { name: 'Ask Kora' }).click();
          await page.getByRole('complementary', { name: 'Ask Kora' }).getByRole('button', { name: /more defensive/ }).click();
          await expect(page.getByRole('region', { name: 'Proposed change' })).toBeVisible();
          await scan(page, 'author: Kora proposes a change');
          if (w < 1280) await page.getByRole('button', { name: 'Close Ask Kora' }).click();
          await page.getByRole('button', { name: 'Edit profile' }).click();
          for (const t of ['Identity', 'Voice', 'Personality', 'Starting stats']) { await page.getByRole('dialog').getByRole('tab', { name: t }).click(); await scan(page, `author: character editor, ${t}`); }
          await page.keyboard.press('Escape');
          await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Actions and conversations/ }).click();
          await page.getByRole('button', { name: /Send for training/ }).click();
          await scan(page, 'author: a static decision');
          await page.getByRole('button', { name: 'Add an action' }).click();
          await page.getByRole('textbox', { name: 'What should the participant be able to do?' }).fill('Approve or refuse a discount, then explain it.');
          await page.getByRole('button', { name: 'Set it up with Kora' }).click();
          await scan(page, 'author: add an action');
          await page.keyboard.press('Escape');
          await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Leadership lens/ }).click();
          await page.getByRole('button', { name: 'Change lens' }).click();
          await scan(page, 'author: change lens');
          await page.keyboard.press('Escape');
          await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Scoring and report/ }).click();
          await page.getByRole('button', { name: 'Use your own skills framework instead' }).click();
          await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'framework.md', mimeType: 'text/markdown', buffer: Buffer.from('## Builds trust\n- Keeps promises\n- Admits mistakes\n## Coaches for growth\n- Asks before telling\n- Agrees next steps\n## Leads change\n') });
          await expect(page.getByRole('table', { name: 'Skills from your framework' })).toBeVisible();
          await scan(page, 'author: skills framework');
          await page.keyboard.press('Escape');
          await page.goto('/author/library');
          await expect(page.getByRole('heading', { level: 1, name: 'Action library' })).toBeVisible();
          await scan(page, 'author: library admin');
        });

        if (theme !== 'client') {
          test('a custom theme through the theme loader (Brightwater, corrected)', async ({ page }) => {
            await page.route(u => u.pathname === '/e2e/brightwater.json', r => r.fulfill({ body: BRIGHTWATER, contentType: 'application/json' }));
            await page.goto(url('/', q, 'themeUrl=/e2e/brightwater.json'));
            await expect(page.locator('html[data-il-theme="brightwater"]')).toHaveCount(1);
            await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
            await scan(page, 'custom theme: onboarding');
            await toBoard(page, q, 'themeUrl=/e2e/brightwater.json');
            await scan(page, 'custom theme: board');
            await page.goto(url('/group', q, 'themeUrl=/e2e/brightwater.json'));
            await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 60_000 });
            await scan(page, 'custom theme: group report');
          });
        }
      });
    }
  });
}

// ---- Keyboard only ----

/** Event cards, one after another, closed with Enter on Got it (each takes focus as it opens). */
async function cardsByKeyboard(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  for (let i = 0; i < 6 && (await gotIt.count()); i++) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await press(page, gotIt.first());
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

/** Presses Tab until the target has focus (so it is reachable), then a key. */
async function tabTo(page: Page, target: Locator, max = 120) {
  for (let i = 0; i < max; i++) {
    // A short timeout: a locator waits for its element, and a card can close while we look for it.
    if (await target.evaluate(el => el === document.activeElement, undefined, { timeout: 1000 }).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Not reachable by Tab: ${target.toString()}`);
}
/** Presses Tab until focus is inside the group (a radio group takes one Tab stop, on its checked or first radio). */
async function tabInto(page: Page, group: Locator, max = 120) {
  for (let i = 0; i < max; i++) {
    if (await group.evaluate(el => el.contains(document.activeElement), undefined, { timeout: 1000 }).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Not reachable by Tab: ${group.toString()}`);
}

async function press(page: Page, target: Locator, key = 'Enter') {
  await tabTo(page, target);
  await page.keyboard.press(key);
}

test.describe('keyboard only', () => {
  test.use({ viewport: { width: 1440, height: 1000 }, contextOptions: { reducedMotion: 'reduce' } });

  test('a full week and a live conversation, without the mouse', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/?start=board');
    // Style setting: each person's style is a radio group; arrows move within it, Enter picks (D22).
    const groups = page.getByRole('radiogroup', { name: /^Leadership style for/ });
    await expect(groups).toHaveCount(10, { timeout: 30_000 });
    for (const g of await groups.all()) {
      await press(page, g.getByRole('radio').first(), 'ArrowRight');
      await expect(g.getByRole('radio').nth(1)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(g.getByRole('radio').nth(1)).toBeChecked();
    }
    await press(page, page.getByRole('button', { name: 'Review and confirm' }));
    const summary = page.getByRole('dialog');
    await press(page, summary.getByRole('button', { name: 'Confirm styles' }));
    await expect(page.getByRole('heading', { name: /Styles are set for week 1/ })).toBeFocused();
    await press(page, page.getByRole('button', { name: 'Dismiss outcome' }));
    // Event cards take focus; Enter on Got it closes each.
    await cardsByKeyboard(page);

    // Pick Kent by keyboard, then the action, its option, confirm.
    const kent = page.getByRole('button', { name: /^Kent Goldberg, Lead/ });
    await press(page, kent);
    await expect(kent).toHaveAttribute('aria-pressed', 'true');
    await press(page, page.getByRole('button', { name: /Meet face to face/ }));
    await expect(page.getByRole('heading', { name: 'Meet face to face' })).toBeFocused();
    const option = page.getByRole('radio', { name: /Energize the person/ });
    await tabInto(page, page.getByRole('radiogroup', { name: 'Choose an option' }));
    for (let i = 0; i < 6 && !(await option.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(option).toBeChecked();
    await press(page, page.getByRole('button', { name: /Confirm and start/ }));

    // The conversation: the reply box has focus; type, Enter sends; End by keyboard.
    const box = page.getByRole('textbox', { name: 'Your reply' });
    await expect(box).toBeFocused();
    await quiet(page);
    await page.keyboard.type('I hear you, thanks for being honest. What is getting in the way?');
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue('');
    await quiet(page);
    await page.keyboard.type('Here is the plan, step by step, and I will check in on Friday.');
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue('');
    await quiet(page);
    await press(page, page.getByRole('button', { name: /^(End|End and see how it lands)$/ }));
    await expect(page.getByText('How it landed')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'Outcome' }).getByRole('heading', { level: 2 })).toBeFocused();
    await press(page, page.getByRole('button', { name: 'Dismiss outcome' }));
    await cardsByKeyboard(page);

    // A team action by keyboard.
    await press(page, page.getByRole('button', { name: /Energize the team/ }));
    const lunch = page.getByRole('radio', { name: 'Team Lunch' });
    await tabInto(page, page.getByRole('radiogroup', { name: 'Choose an option' }));
    for (let i = 0; i < 4 && !(await lunch.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await press(page, page.getByRole('button', { name: /^Confirm/ }));
    await expect(page.getByText('How it landed')).toBeVisible({ timeout: 15_000 });
    await press(page, page.getByRole('button', { name: 'Dismiss outcome' }));
    await cardsByKeyboard(page);

    // End the week and walk the week end with Enter, into week 2.
    await press(page, page.getByRole('button', { name: /End week/ }));
    await cardsByKeyboard(page);
    await expect(page.getByText('End of week 1')).toBeVisible();
    await press(page, page.getByRole('button', { name: /^See your week$/ }));
    const step = page.getByRole('button', { name: /^(Continue|Nice|Take this reward|Next|Set styles for week 2)$/ });
    for (let i = 0; i < 15 && !(await groups.count()); i++) {
      await expect(step.first().or(groups.first())).toBeVisible();
      if (await groups.count()) break;
      const rewards = page.getByRole('radiogroup', { name: 'Rewards' });
      if (await rewards.count()) await press(page, rewards.getByRole('radio').first(), 'Space');
      await press(page, step.first());
    }
    await expect(groups).toHaveCount(10);
    await expect(page.getByText(/Week 2/).first()).toBeVisible();
  });
});
