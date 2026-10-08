import { expect, test, type Page } from '@playwright/test';

/**
 * GenieKreator's authoring tool at /author (D105 to D111): the co-creator chat, typed and by voice
 * (the offline mock voice), the lens recommendation, First draft ready and its participant preview,
 * the workspace (renamed and added styles flowing into actions and the played storyline, the
 * character editor, needs, scoring samples, publish), Ask Kora, Add an action, events, the library
 * admin page, and storage that is blocked or holds a stale draft.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const progress = (page: Page) => page.getByText(/^Question \d+ of about \d+$/);
const chip = (page: Page, name: string | RegExp) => page.getByRole('group', { name: 'Suggested answers' }).getByRole('button', { name });
const answerBox = (page: Page) => page.getByRole('textbox', { name: 'Your answer' });
async function type(page: Page, text: string) {
  await answerBox(page).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}
const FORBIDDEN = /iLead 1\.0|Ask GenieKreator|\bD G P E\b|Mark reviewed/;

/** A fresh chat, straight to the workspace on Kora's defaults. */
async function workspace(page: Page, tab = 'overview') {
  await page.goto('/author');
  await expect(progress(page)).toBeVisible();
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  if (tab !== 'overview') await openTab(page, tab);
}
async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(name, 'i') }).click();
}

test('the co-creator chat: typed, chips and voice answers, the lens, First draft ready and the participant preview', async ({ page, context }) => {
  await page.goto('/author');
  await expect(progress(page)).toHaveText('Question 1 of about 10');
  await expect(page.getByRole('heading', { name: 'Your simulation so far' })).toBeVisible();
  await chip(page, 'First time managers').click();
  await chip(page, 'Manufacturing').click();
  await type(page, 'Deals stall at negotiation and new reps burn out in the first quarter.');
  await expect(page.getByText('Here is what I took from that')).toBeVisible();
  const soFar = page.getByRole('region', { name: 'Your simulation so far' });
  await expect(soFar.getByRole('list', { name: 'Stages' })).toContainText('Negotiation');
  await expect(soFar.getByText('Add your average deal value')).toBeVisible();
  await type(page, 'Ascent Lifts');
  await expect(progress(page)).toHaveText('Question 5 of about 10');

  // Voice: record, the live transcript, stop, then the words in the answer box to edit before Send.
  // Focus follows: Stop and review while recording, the microphone after Cancel, the answer box after stop.
  const micButton = page.getByRole('button', { name: 'Record your answer' });
  const rec = page.getByRole('group', { name: 'Recording your answer' });
  await micButton.click();
  await expect(rec.getByRole('button', { name: 'Stop and review' })).toBeFocused();
  await rec.getByRole('button', { name: 'Cancel' }).click();
  await expect(micButton).toBeFocused();
  await micButton.click();
  await expect(rec.getByText(/^Recording/)).toBeVisible();
  await expect(rec.getByRole('button', { name: 'Stop and review' })).toBeFocused();
  await expect(rec.getByText(/Ten\. Eight/)).toBeVisible({ timeout: 10_000 });
  await rec.getByRole('button', { name: 'Stop and review' }).click();
  await expect(page.getByText(/Transcribed from your recording/)).toBeVisible();
  await expect(answerBox(page)).toBeFocused();
  await expect(answerBox(page)).toHaveValue(/Eight account managers/);
  await answerBox(page).fill(`${await answerBox(page).inputValue()} Two of them joined last month.`);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Two of them joined last month.');
  await expect(progress(page)).toHaveText('Question 6 of about 10');

  await chip(page, /^Sales Elevator funnel/).click();
  await chip(page, 'Standard').click();
  await chip(page, 'English, India').click();
  await chip(page, 'No framework').click();
  await chip(page, 'Professional').click();

  // The lens: Kora recommends one from the challenge; the panel previews its styles.
  const rec2 = page.getByRole('article', { name: 'Inspire and Deliver' });
  await expect(rec2.getByText('Recommended')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your simulation so far' }).getByText('Preview of the recommendation')).toBeVisible();
  await rec2.getByRole('button', { name: 'Use this lens' }).click();

  await expect(page.getByRole('heading', { level: 1, name: /Your simulation is playable\. Two things need you before you publish\./ })).toBeFocused();
  await expect(page.getByRole('button', { name: /Average deal value/ })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN);

  const [play] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Preview week 1 as a participant' }).click()]);
  await play.getByRole('button', { name: "Let's begin" }).click({ timeout: 20_000 });
  await expect(play.getByText(/Ascent Lifts/).first()).toBeVisible();
  await play.close();

  await page.getByRole('button', { name: 'Open the workspace' }).click();
  await expect(page).toHaveURL(/\/author\/workspace\/overview$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  // The draft is kept: a reload opens the workspace where it was.
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Ascent Lifts', { exact: false }).first()).toBeVisible();
});

test('renamed and added styles flow into actions and the played storyline; edits mark Edited; publish once nothing needs you', async ({ page, context }) => {
  await workspace(page, 'Leadership lens');
  const styles = page.getByRole('table', { name: 'Your styles' });
  await styles.getByRole('textbox', { name: 'Name of style 1' }).fill('Instruct');
  await styles.getByRole('textbox', { name: /^Tag letter for Instruct/ }).fill('I');
  await expect(styles.getByText('Renamed')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add a fifth style' }).click();
  await expect(page.getByRole('button', { name: 'Add a fifth style' })).toBeDisabled();
  await styles.getByRole('textbox', { name: 'Name of style 5' }).fill('Challenge');
  await styles.getByRole('textbox', { name: /^Tag letter for Challenge/ }).fill('C');
  await styles.getByRole('textbox', { name: /^What the participant reads for Challenge/ }).fill('You raise the bar together.');
  await page.getByRole('combobox', { name: 'Challenge for Ready to run with it' }).selectOption('Best');
  await page.getByRole('button', { name: 'Restore lens names' }).isVisible();

  await openTab(page, 'Actions and conversations');
  const impact = page.getByRole('table', { name: /^Impact of each lens style/ });
  await expect(impact.getByRole('rowheader', { name: 'Instruct' })).toBeVisible();
  await expect(impact.getByRole('rowheader', { name: 'Challenge' })).toBeVisible();
  await page.getByRole('switch', { name: 'Use Swap roles' }).first().click();
  await expect(page.getByRole('switch', { name: 'Use Swap roles' }).first()).toHaveAttribute('aria-checked', 'false');

  await openTab(page, 'Team');
  const first = page.getByRole('region', { name: 'Characters' }).getByRole('listitem').first();
  await first.getByRole('button', { name: /^Edit / }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'First name' }).fill('Kenneth');
  await dialog.getByRole('tab', { name: 'Starting stats' }).click();
  await dialog.getByRole('spinbutton', { name: 'Morale, number' }).fill('15');
  await expect(dialog.getByRole('status')).toContainText('starts needing');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(first).toContainText('Kenneth');
  await expect(first.getByText('Edited')).toBeVisible();

  await openTab(page, 'Brief');
  await page.getByRole('textbox', { name: 'Business challenge' }).fill('Deals stall at negotiation and new reps burn out.');
  await openTab(page, 'Overview');
  await page.getByRole('textbox', { name: 'Average deal value' }).fill('42000');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await openTab(page, 'Scoring and report');
  await page.getByRole('button', { name: 'Agree with the rest' }).click();
  await expect(page.getByRole('banner').getByText('Ready to publish')).toBeVisible();

  await page.getByRole('button', { name: 'Review and publish' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ready to publish' })).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Version 1 published')).toBeVisible();

  const [play] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Play a week' }).click()]);
  await play.goto('/?storyline=draft&start=board&participant=author_draft');
  const groups = play.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(groups.first()).toBeVisible({ timeout: 20_000 });
  await expect(groups.first().getByRole('radio')).toHaveCount(5);
  await expect(groups.first().getByRole('radio').first()).toHaveAccessibleName(/^Instruct\./);
  await expect(play.getByRole('radiogroup', { name: /^Leadership style for Kenneth / })).toBeVisible();
});

test('Ask Kora proposes before it applies; Add an action with Kora; move an event; nothing names old tags', async ({ page }) => {
  await workspace(page);
  const kora = page.getByRole('complementary', { name: 'Ask Kora' });
  await kora.getByRole('button', { name: 'Add a remote team member' }).click();
  const change = kora.getByRole('region', { name: 'Proposed change' });
  await expect(change).toContainText('New character');
  await change.getByRole('button', { name: 'Apply' }).click();
  await expect(kora.getByRole('status')).toContainText('Applied');
  await openTab(page, 'Team');
  await expect(page.getByText(/^11 characters across/)).toBeVisible();

  const story = 'Story and world';
  await openTab(page, story);
  await page.getByRole('complementary', { name: 'Ask Kora' }).getByRole('button', { name: 'Add a rival' }).click();
  await page.getByRole('tab', { name: 'Market and competitors' }).click();
  await expect(page.getByRole('textbox', { name: 'Rival 2' })).toBeVisible();

  await openTab(page, 'Actions and conversations');
  await page.getByRole('button', { name: 'Add an action' }).click();
  const add = page.getByRole('dialog', { name: 'Add an action' });
  await add.getByRole('textbox', { name: 'What should the participant be able to do?' }).fill('Approve or refuse a discount a rep asks for, then explain the decision to them.');
  await add.getByRole('button', { name: 'Set it up with Kora' }).click();
  await expect(add.getByRole('heading', { name: 'Discount approval' })).toBeVisible();
  await add.getByRole('button', { name: 'Add to this simulation' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Discount approval' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Actions' }).getByText('Yours')).toBeVisible();

  await openTab(page, 'Events');
  await page.getByRole('combobox', { name: 'When' }).selectOption({ label: 'Week 8, Friday' });
  await expect(page.getByRole('list', { name: 'Week 8' }).getByRole('button')).toHaveCount(1);
  expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN);
});

test('an event keeps the timing and response the author gives it; a shorter run moves what it leaves behind and says so (D128)', async ({ page }) => {
  await workspace(page, 'Events');
  const title = await page.getByRole('textbox', { name: 'Title' }).inputValue();
  await page.getByRole('combobox', { name: 'When' }).selectOption({ label: 'When something happens' });
  await page.getByRole('combobox', { name: 'Condition' }).selectOption({ label: 'Team trust falls below' });
  await page.getByText(/^Response: none expected/).click();
  await page.getByRole('checkbox', { name: 'Meet the team' }).check();
  await page.getByRole('combobox', { name: 'Days to respond' }).selectOption({ label: '4 days' });
  await page.getByRole('checkbox', { name: /The sponsor hears of it/ }).check();
  await expect(page.getByRole('button', { name: `${title} · When team trust is below 40` })).toBeVisible();
  await expect(page.getByText(/^Response: Meet the team, within 4 days; if ignored, it escalates$/)).toBeVisible();

  await openTab(page, 'Brief');
  await page.getByText(/^Lite · 4 weeks/).click();
  await expect(page.getByText(/^To fit the new length, \d+ items moved/)).toBeVisible();
  await openTab(page, 'Events');
  await expect(page.getByRole('list', { name: 'Week 4' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Week 5' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Week 4' }).getByRole('button').first()).toBeVisible();
});

test('the library admin page registers a new interaction type as beta', async ({ page }) => {
  await page.goto('/author/library');
  await expect(page.getByRole('heading', { level: 1, name: 'Action library' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Interaction types' }).getByRole('row')).toHaveCount(9);
  await page.getByRole('textbox', { name: 'Name' }).fill('Phone call');
  await page.getByRole('button', { name: 'Save as beta' }).click();
  await expect(page.getByRole('table', { name: 'Interaction types' }).getByRole('rowheader', { name: 'Phone call' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Phone call saved as beta');
});

test('blocked storage keeps the draft in memory and says so; a stale stored draft starts fresh', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) { if (k === 'ilead.author.workspace') throw new DOMException('blocked', 'SecurityError'); return set.call(this, k, v); };
  });
  await page.goto('/author');
  await chip(page, 'First time managers').click();
  await expect(page.getByText('Not saved: this browser blocks storage')).toBeVisible();
  await expect(progress(page)).toHaveText('Question 2 of about 10');

  const fresh = await page.context().newPage();
  fresh.on('pageerror', e => errors.push(e.message));
  await fresh.goto('/author');
  await fresh.evaluate(() => localStorage.setItem('ilead.author.workspace', '{"v":0,"stage":"workspace"}'));
  await fresh.reload();
  await expect(progress(fresh)).toHaveText('Question 1 of about 10');
});

test('a bad draft falls back to Sales Elevator with a warning', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
  await page.goto('/author');
  await page.evaluate(() => localStorage.setItem('ilead.author.draft', '{"id":"broken"}'));
  await page.goto('/?storyline=draft&start=board');
  await expect(page.getByRole('radiogroup', { name: 'Leadership style for Kent Goldberg' })).toBeVisible({ timeout: 20000 });
  expect(warnings.some(w => w.startsWith('Draft storyline not used, playing Sales Elevator'))).toBe(true);
});
