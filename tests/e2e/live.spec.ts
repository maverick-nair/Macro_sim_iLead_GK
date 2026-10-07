import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** M4: live interactions on the engine, by text (no audio consent in these runs unless a test sets it). */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

async function toBoard(page: Page, url = '/?start=board') {
  await page.goto(url);
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10, { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByText(/Styles are set for week \d/)).toBeVisible();
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

/** Opens a member's live action from the board. */
async function start(page: Page, who: string, action: RegExp, option?: RegExp) {
  await page.getByText(who, { exact: true }).click();
  await page.getByRole('button', { name: action }).click();
  if (option) await page.getByRole('radio', { name: option }).click();
  await page.getByRole('button', { name: /Confirm and start|Open composer/ }).click();
}

/** Waits until the NPC has said something and is not speaking any more (its line has streamed in). */
async function quiet(page: Page) {
  await expect(page.getByText('AI persona').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/is speaking/)).toHaveCount(0, { timeout: 15000 });
}

/** Sends a turn and waits for the engine to take it (the reply box empties) and the NPC to answer. */
async function say(page: Page, text: string) {
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await box.fill(text);
  await box.press('Enter');
  await expect(box).toHaveValue('');
  await quiet(page);
}

/** Ends the conversation; the board shows "The team is reacting", then the outcome. */
async function end(page: Page) {
  await page.getByRole('button', { name: /^(End|End and see how it lands)$/ }).click();
  await expect(page.getByText('The team is reacting')).toBeVisible();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
}

test('1:1: the NPC opens, streams labelled AI replies, opens up when asked, and the outcome follows', async ({ page }) => {
  await toBoard(page);
  await start(page, 'Kent Goldberg', /Meet face to face/, /Energize the person/);
  await expect(page.getByText('1:1 with Kent Goldberg').first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your reply' })).toBeFocused();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('1:1 with Kent Goldberg');
  await expect(page.getByText('AI persona').first()).toBeVisible();
  await quiet(page);
  const a11y = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(a11y.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await say(page, 'I am sorry it has been rough. What is on your mind?');
  await expect(page.getByText(/not what I was promised/).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Hint' }).click();
  await expect(page.getByText(/open question/).first()).toBeVisible();
  await end(page);
  await expect(page.getByRole('region', { name: 'Outcome' }).getByRole('heading', { level: 2 })).toBeFocused();
  await expect(page.getByText(/not what I was promised/).first()).toBeVisible();
});

test('the header names the action, and Replay streams an NPC line again', async ({ page }) => {
  await toBoard(page);
  await start(page, 'Peter Higgins', /Coach member/, /Handhold the person/);
  await expect(page.getByText('Coach member · 1 day')).toBeVisible();
  await quiet(page);
  await page.getByRole('button', { name: 'Replay this line' }).first().click();
  await expect(page.getByText(/is speaking/).first()).toBeVisible();
  await quiet(page);
});

test('interrupting the NPC cuts its line where you spoke over it', async ({ page }) => {
  await toBoard(page);
  await start(page, 'Peter Higgins', /Coach member/, /Handhold the person/);
  await expect(page.getByText('1:1 with Peter Higgins').first()).toBeVisible();
  await quiet(page);
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await box.fill('How is the pipeline looking for you this week?');
  await box.press('Enter');
  await expect(page.getByText(/is speaking/).first()).toBeVisible({ timeout: 5000 });
  await page.keyboard.press('Escape');
  await expect(page.getByText('Interrupted').first()).toBeVisible({ timeout: 5000 });
});

test('the clock: a warning at two minutes, then time is up and End leads', async ({ page }) => {
  await page.clock.install();
  await toBoard(page);
  await start(page, 'Kent Goldberg', /Meet face to face/, /Energize the person/);
  await expect(page.getByRole('button', { name: /5:00 left/ })).toBeVisible();
  await page.clock.runFor('03:05');
  await expect(page.getByRole('status').filter({ hasText: 'Two minutes left' })).toBeVisible();
  await page.clock.runFor('02:00');
  await expect(page.getByText(/Time is up/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'End and see how it lands' })).toBeVisible();
});

test('push to talk: Space held speaks, Enter sends (with voice consent)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ilead.settings.local', JSON.stringify({ text: 100, captions: true, reduced: false, input: 'ptt', clock: true, voiceConsent: true })));
  await toBoard(page);
  await start(page, 'Kent Goldberg', /Meet face to face/, /Energize the person/);
  // In voice mode focus goes to the heading, so Space is free for push to talk.
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeFocused();
  await quiet(page);
  await page.keyboard.down('Space');
  await expect(page.getByText('Listening').first()).toBeVisible();
  await expect(page.getByText(/Thanks for making/).first()).toBeVisible();
  await page.keyboard.up('Space');
  await expect(page.getByText('Edit if you like, then send')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('log').getByText(/Thanks for making time/)).toBeVisible();
});

test('a failed send keeps your words; the sponsor briefing pins throughput against the ideal', async ({ page }) => {
  // The mock engine stands in for the server: the next intent of a named type fails with a network error.
  await page.route('**/src/engine/mock.ts*', async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace('async send(intent) {', 'async send(intent) { if (globalThis.__failNext && intent.type === globalThis.__failNext) { globalThis.__failNext = null; throw new EngineError("Network error", "network", true); }');
    await route.fulfill({ response: res, body });
  });
  await toBoard(page, '/?start=board&period=4');
  await page.getByRole('button', { name: /Briefing with Paula/ }).first().click();
  // The fast forward to week 4 runs three weeks of the mock engine first: give it time under parallel load.
  await expect(page.getByText(/Sponsor briefing with Paula/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/^Leads$/).locator('xpath=..')).toContainText(/\d+(\.\d)? \/ \d+(\.\d)?/);
  await page.getByRole('textbox', { name: 'Point 1' }).fill('We are at a quarter of target');
  await quiet(page);
  await page.evaluate(() => { (globalThis as Record<string, unknown>).__failNext = 'sendTurn'; });
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await box.fill('Here is my update.');
  await box.press('Enter');
  await expect(page.getByText(/You seem to be offline/)).toBeVisible({ timeout: 10_000 });
  await expect(box).toHaveValue('Here is my update.');
  await box.press('Enter');
  await expect(box).toHaveValue('');
});

test('email: written once, then the outcome; the live cap blocks a third live action', async ({ page }) => {
  await toBoard(page);
  await start(page, 'Beth Killiney', /Send email/, /Send congratulatory mail/);
  await page.getByRole('textbox', { name: /subject/i }).fill('Great work on the Ashcroft leads');
  await page.getByRole('textbox', { name: /body|message/i }).fill('Thank you for the 12 new leads this week, specifically the Ashcroft account. Please keep me posted by Friday.');
  await page.getByRole('button', { name: /^Send/ }).last().click();
  await expect(page.getByText('The team is reacting')).toBeVisible();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
  await dismissOutcome(page);
  await dismissEvents(page);

  await start(page, 'Justin Keel', /Meet face to face/, /Energize the person/);
  await quiet(page);
  await say(page, 'Thanks for your time.');
  await end(page);
  await dismissOutcome(page);
  await dismissEvents(page);
  await page.getByText('Ruth Ether', { exact: true }).click();
  await expect(page.getByRole('button', { name: /Meet face to face.*live conversations this week/ })).toBeVisible();
});

test('written plan: fill, submit, then the check in, then the outcome', async ({ page }) => {
  await toBoard(page);
  await start(page, 'Derick Kaynes', /Set goals/, /Seek buy/);
  await expect(page.getByText(/Written plan with Derick/).first()).toBeVisible();
  await page.getByRole('textbox', { name: /^Goals/ }).fill('Qualify 12 leads from the Ashcroft list');
  await page.getByRole('textbox', { name: /^Measures/ }).fill('12 qualified leads in the CRM');
  await page.getByRole('textbox', { name: /^Owner/ }).fill('Derick, with me on Friday');
  await page.getByRole('radio').last().check({ force: true });
  await page.getByRole('button', { name: 'Submit plan' }).click();
  await expect(page.getByText(/numbers make it clear/)).toBeVisible({ timeout: 10000 });
  await end(page);
  // Evaluated on the fields like an email (D85); its due date is a promise to check in with Derick.
  await dismissOutcome(page);
  await dismissEvents(page);
  await page.getByRole('button', { name: 'Open profile for Derick Kaynes' }).click();
  await expect(page.getByText(/Qualify 12 leads from the Ashcroft list/).first()).toBeVisible();
});

test('letting someone go: the outcome shows them; hiring: End in the comparison asks first', async ({ page }) => {
  await toBoard(page, '/?start=board&period=4');
  await dismissOutcome(page);
  await dismissEvents(page);
  await start(page, 'Derick Kaynes', /^Let go/);
  await quiet(page);
  await say(page, 'Derick, I am sorry, this is a hard conversation. Thank you for your work here.');
  await end(page);
  // Derick has left the team; the engine still resolves him as the speaker.
  await expect(page.getByRole('region', { name: 'Outcome' }).getByRole('img', { name: 'Derick Kaynes' })).toBeVisible();
  await expect(page.getByText('Derick Kaynes', { exact: true })).toHaveCount(0);
  await dismissOutcome(page);
  await dismissEvents(page);

  await page.getByRole('button', { name: /Hire member/ }).click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  await expect(page.getByText('Interviews for a new hire').first()).toBeVisible();
  // A structured interview (D85): the same questions for both candidates, in the brief.
  await expect(page.getByText('Questions to ask').first()).toBeVisible();
  await expect(page.getByText(/Tell me about a deal you lost/).first()).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await quiet(page);
    await say(page, 'Tell me about a time you turned around a difficult client.');
    await page.getByRole('button', { name: /^(End|End and see how it lands)$/ }).click();
  }
  await expect(page.getByRole('table')).toBeVisible();
  const endButton = page.getByRole('button', { name: /^(End|End and see how it lands)$/ });
  await endButton.click();
  const confirm = page.getByRole('dialog', { name: 'End the interviews without hiring?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Keep comparing' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(endButton).toBeFocused();
  await endButton.click();
  await page.getByRole('button', { name: 'Pass on both' }).click();
  await expect(page.getByText('The team is reacting')).toBeVisible();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('You passed on both candidates. The seat stays open.')).toBeVisible();
});

test('hiring: a structured interview lands the candidate you choose, and the outcome says they joined', async ({ page }) => {
  await toBoard(page, '/?start=board&period=4');
  await dismissOutcome(page);
  await dismissEvents(page);
  await start(page, 'Derick Kaynes', /^Let go/);
  await quiet(page);
  await say(page, 'Derick, I am sorry, this is a hard conversation. Thank you for your work here.');
  await end(page);
  await dismissOutcome(page);
  await dismissEvents(page);
  await page.getByRole('button', { name: /Hire member/ }).click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  for (let i = 0; i < 2; i++) {
    await quiet(page);
    await say(page, 'Tell me about a time you lost a deal. Walk me through what happened next and why. What did you learn, and what was the result?');
    await page.getByRole('button', { name: /^(End|End and see how it lands)$/ }).click();
  }
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await table.getByRole('radio', { name: 'Hire' }).first().check({ force: true });
  await page.getByRole('button', { name: /^Hire / }).click();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/accepted the offer and joins/)).toBeVisible();
});
