import { expect, test, type Page } from '@playwright/test';

/**
 * The author chat after the first audit's P1 findings (D146 to D148): a detailed brief taken in one answer and said
 * back with the questions it answered skipped; an answer changed later with a preview of what it changes; a renamed
 * person updated in the event text after "Update N places"; and a server that does not answer in time.
 *
 * The timeout test needs the dev server built with a drafter URL, served by a stub in this file:
 *   E2E_PORT=5433 VITE_GENIE_URL=/genie npx playwright test tests/e2e/author-chat.spec.ts
 * Without it that test is skipped; the others run either way (with the URL set, the stub answers 501 so the
 * templates answer, as a server that does not offer the chat would).
 */

const SERVER = !!process.env.VITE_GENIE_URL;
const KEY = 'ilead.author.workspace';
const BRIEF = 'We need a simulation for VPs of Customer Operations at Northstar Health Partners, a US health insurer that is merging with its partner company, Bluewave Care. '
  + 'Each VP leads a team of 8 directors and managers across claims, member services and the contact centre. '
  + 'The challenge is keeping service levels and morale up while two customer operations teams merge onto one platform over the next two quarters. '
  + 'Key stakeholders are Dana Whitfield, the COO and their boss; Raj Patel, Head of Claims at Bluewave Care, a peer; Lisa Chen, the HR business partner; Marcus Bell, the CFO; Priya Nair, the union representative; and Tom Alvarez, account lead for their largest employer client. '
  + 'Objectives: retain key talent through the merger, keep member satisfaction above 85 percent, and deliver the synergy savings the board expects. '
  + 'The dilemmas we want them to face are short-term revenue vs customer trust, team wellbeing vs delivery deadlines, and standardising on one process or keeping the best of both. '
  + 'The tone should be serious and realistic. Use our LEAD framework: Listen, Empower, Align, Deliver. Each run should take about an hour.';

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  // A stub's 501 is logged by the browser as a failed load; that is the "not offered" answer, not an error.
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (SERVER) await page.route('**/genie/**', route => route.fulfill({ status: 501, json: { message: 'Not offered', code: 'notImplemented' } }));
});
test.afterEach(() => expect(errors).toEqual([]));

const progress = (page: Page) => page.getByText(/^Question \d+ of about \d+$/);
const chip = (page: Page, name: string | RegExp) => page.getByRole('group', { name: 'Suggested answers' }).getByRole('button', { name });
const answerBox = (page: Page) => page.getByRole('textbox', { name: 'Your answer' });
async function send(page: Page, text: string) {
  await answerBox(page).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}
const stored = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(name, 'i') }).click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name, 'i') })).toBeVisible();
}

test('a detailed brief in one answer: "I took these", the questions it answered skipped, and the named client kept', async ({ page }) => {
  await page.goto('/author');
  await expect(progress(page)).toHaveText('Question 1 of about 10');
  await send(page, BRIEF);
  const took = page.getByRole('region', { name: 'I took these from your brief' });
  await expect(took).toContainText('Participants: VPs of Customer Operations');
  await expect(took).toContainText('Industry: Healthcare');
  await expect(took).toContainText('Client: Northstar Health Partners');
  await expect(took).toContainText('Team size: 8 people');
  await expect(took).toContainText('Challenge: Keeping service levels and morale up');
  await expect(took).toContainText('Tone: Professional');
  await expect(took).toContainText('Framework: LEAD: Listen, Empower, Align, Deliver');
  await expect(took).toContainText('Run length: Standard');
  await expect(took).toContainText('Dana Whitfield (COO, boss)');
  await expect(took).toContainText('Objectives: Retain key talent through the merger');
  await expect(took).toContainText('Dilemmas: Short term revenue or customer trust');
  await expect(took.getByRole('button', { name: 'Change Client' })).toBeVisible();
  // The participants are the phrase, not the paragraph.
  const soFar = page.getByRole('region', { name: 'Your simulation so far' });
  await expect(soFar.getByText('VPs of Customer Operations', { exact: true })).toBeVisible();

  // The brief names people outside the team: the fit check still says so first (D133).
  await page.getByRole('group', { name: 'Does iLead fit this brief?' }).getByRole('button', { name: 'Continue with a team leadership version' }).click();
  // Only the work process is left; nothing the brief answered is asked again.
  await expect(progress(page)).toHaveText('Question 2 of about 2');
  await expect(page.getByRole('log')).toContainText('What work process does the team run?');
  await chip(page, /^Service delivery/).click();
  const rec = page.getByRole('article', { name: 'Client Leadership Model' });
  await expect(rec.getByText('Recommended')).toBeVisible();
  await rec.getByRole('button', { name: 'Use this lens' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Your simulation is playable/ })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('Northstar Health Partners');
  await expect(page.getByText('No client was named')).toHaveCount(0);
  await expect.poll(async () => (await stored(page))?.stage).toBe('ready');
  const d = await stored(page);
  expect(d.story.company.name).toBe('Northstar Health Partners');
  expect(d.brief.stakeholders).toHaveLength(6);
  expect(d.brief.dilemmas.map((x: { a: string; b: string }) => [x.a, x.b])).toEqual([['Short term revenue', 'Customer trust'], ['Team wellbeing', 'Delivery deadlines'], ['Standardising on one process', 'Keeping the best of both']]);
  expect(d.scoring.skills.map((s: { name: string }) => s.name)).toEqual(['Listen', 'Empower', 'Align', 'Deliver']);
});

test('an uploaded .txt brief keeps the client it names, and says what it took', async ({ page }) => {
  await page.goto('/author');
  await expect(progress(page)).toHaveText('Question 1 of about 10');
  await page.locator('input[type="file"]').setInputFiles({ name: 'brief.txt', mimeType: 'text/plain', buffer: Buffer.from(BRIEF) });
  await expect(page.getByRole('log')).toContainText('I read brief.txt.');
  const took = page.getByRole('region', { name: 'I took these from your brief' });
  await expect(took).toContainText('Client: Northstar Health Partners');
  await page.getByRole('group', { name: 'Does iLead fit this brief?' }).getByRole('button', { name: 'Continue with a team leadership version' }).click();
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await expect.poll(async () => (await stored(page))?.story.company.name).toBe('Northstar Health Partners');
  expect(JSON.stringify(await stored(page))).not.toContain('Greenfield Hospitals');
});

test('a short request for senior managers gets a clarifying question, not an industry of "senior managers"', async ({ page }) => {
  await page.goto('/author');
  await send(page, 'create a leadership simulation for senior managers');
  await expect(page.getByRole('log')).toContainText('Senior managers leading which kind of team?');
  await chip(page, 'Sales teams').click();
  await expect(progress(page)).toHaveText('Question 2 of about 10');
  await send(page, 'banking but actually a hospital');
  await expect(page.getByRole('log')).toContainText('You mention Banking and financial services and Healthcare. Which industry should the story be set in?');
  await chip(page, 'Healthcare').click();
  await expect(progress(page)).toHaveText('Question 3 of about 10');
  const soFar = page.getByRole('region', { name: 'Your simulation so far' });
  await expect(soFar.getByText('Senior managers leading sales teams')).toBeVisible();
  await expect(soFar.getByText('Healthcare', { exact: true })).toBeVisible();
});

test('an answer changed later shows what it changes, with Apply or Keep as note only; in the Brief tab too', async ({ page }) => {
  await page.goto('/author');
  await chip(page, 'First time managers').click();
  await chip(page, 'Manufacturing').click();
  await send(page, 'Deals stall at negotiation and new reps burn out in the first quarter.');
  await expect(progress(page)).toHaveText('Question 4 of about 10');
  const soFar = page.getByRole('region', { name: 'Your simulation so far' });
  await soFar.getByRole('button', { name: 'Change Industry' }).click();
  await expect(page.getByRole('log')).toContainText('Tell me the new answer to: Which industry is the simulation set in?');
  await send(page, 'Banking and financial services');
  const preview = page.getByRole('region', { name: 'What this change does' });
  await expect(preview).toContainText(/This changes: company name in \d+ places, the industry of the story/);
  await preview.getByRole('button', { name: 'Keep as note only' }).click();
  await expect(page.getByRole('log')).toContainText('Noted for industry: "Banking and financial services". I kept the brief as it was.');
  await expect(soFar.getByText('Manufacturing', { exact: true })).toBeVisible();
  await soFar.getByRole('button', { name: 'Change Industry' }).click();
  await send(page, 'Banking and financial services');
  await page.getByRole('region', { name: 'What this change does' }).getByRole('button', { name: 'Apply' }).click();
  await expect(soFar.getByText('Banking and financial services', { exact: true })).toBeVisible();
  await expect(progress(page)).toHaveText('Question 4 of about 10');

  // In the workspace: the client, then what it changes, then Apply as one named step of undo.
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await openTab(page, 'Brief');
  const client = page.getByRole('textbox', { name: 'Client' });
  await client.fill('Northstar Health Partners');
  await client.blur();
  const card = page.getByRole('group', { name: 'What changing the client does' });
  await expect(card).toContainText(/^This changes: company name in \d+ places/);
  await card.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Applied. Undo is in the header.')).toBeVisible();
  await expect.poll(async () => (await stored(page)).story.company.name).toBe('Northstar Health Partners');
  const undo = page.getByRole('banner').getByRole('button', { name: 'Undo', exact: true });
  await expect(undo).toHaveAttribute('title', 'Undo: Apply the new client to the draft');
  await undo.click();
  await expect.poll(async () => (await stored(page)).story.company.name).not.toBe('Northstar Health Partners');
});

test('renaming a person offers "Update N places", and the event text says the new name after it', async ({ page }) => {
  await page.goto('/author');
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) ?? '{}').stage === 'workspace', KEY);
  await page.waitForTimeout(500);
  // The audit's case: the person is named in an event's text and in the welcome letter.
  await page.evaluate(k => {
    const d = JSON.parse(localStorage.getItem(k)!);
    const p = d.team[1];
    d.events[0].body = `${p.first} ${p.last} asks for a word before the review.`;
    d.story.screens[0].body += `\n\nSay hello to ${p.first} first.`;
    localStorage.setItem(k, JSON.stringify(d));
  }, KEY);
  await page.reload();
  const before = await stored(page);
  const p = before.team[1];
  await openTab(page, 'Team');
  await page.getByRole('button', { name: `Edit ${p.first} ${p.last}` }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'First name' }).fill('Zara');
  await dialog.getByRole('textbox', { name: 'Last name' }).fill('Quinn');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  const prompt = page.getByRole('region', { name: 'Update what still refers to it' });
  await expect(prompt).toContainText(`You renamed ${p.first} ${p.last} to Zara Quinn.`);
  await expect(prompt.getByRole('list', { name: 'Places to update' })).toContainText(`Event "${before.events[0].title}"`);
  await prompt.getByRole('button', { name: /^Update \d+ places?$/ }).click();
  await expect(page.getByText(/^Updated \d+ places?\. Undo is in the header\.$/)).toBeVisible();
  await expect(prompt).toHaveCount(0);
  await expect.poll(async () => (await stored(page)).events[0].body).toBe('Zara Quinn asks for a word before the review.');
  expect((await stored(page)).story.screens[0].body).toContain('Say hello to Zara first.');
  await page.getByRole('banner').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await stored(page)).events[0].body).toBe(`${p.first} ${p.last} asks for a word before the review.`);
});

test('a server that does not answer in time: Retry and Continue offline, and the answer box stays usable', async ({ page }) => {
  test.skip(!SERVER, 'Needs the dev server built with VITE_GENIE_URL=/genie');
  let calls = 0;
  await page.unroute('**/genie/**');
  // The first turn never answers; the retry does, as the server would.
  await page.route('**/genie/author/turn', async route => {
    if (++calls === 1) return;
    await route.fulfill({ status: 501, json: { message: 'Not offered', code: 'notImplemented' } });
  });
  await page.clock.install();
  await page.goto('/author');
  await expect(page.getByText('Kora is thinking.')).toBeVisible();
  await expect(answerBox(page)).toBeEnabled();
  await page.clock.runFor(31_000);
  const failed = page.getByRole('alert').filter({ hasText: 'took longer than 30 seconds' });
  await expect(failed).toContainText('Kora\'s server took longer than 30 seconds. Retry, or continue offline with Kora\'s built-in rules.');
  await expect(failed.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(answerBox(page)).toBeEnabled();
  await failed.getByRole('button', { name: 'Continue offline' }).click();
  await expect(progress(page)).toHaveText('Question 1 of about 10');
  await expect(failed).toHaveCount(0);
  await chip(page, 'First time managers').click();
  await expect(progress(page)).toHaveText('Question 2 of about 10');
  // Offline from here on: the server is not asked again.
  expect(calls).toBe(1);
});

test('Cancel stops Kora, and Retry asks again', async ({ page }) => {
  test.skip(!SERVER, 'Needs the dev server built with VITE_GENIE_URL=/genie');
  let calls = 0;
  await page.unroute('**/genie/**');
  await page.route('**/genie/author/turn', async route => {
    if (++calls === 1) return;
    await route.fulfill({ status: 501, json: { message: 'Not offered', code: 'notImplemented' } });
  });
  await page.goto('/author');
  await expect(page.getByText('Kora is thinking.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const failed = page.getByRole('alert').filter({ hasText: 'You stopped Kora.' });
  await expect(failed).toBeVisible();
  await failed.getByRole('button', { name: 'Retry' }).click();
  await expect(progress(page)).toHaveText('Question 1 of about 10');
  expect(calls).toBe(2);
});
