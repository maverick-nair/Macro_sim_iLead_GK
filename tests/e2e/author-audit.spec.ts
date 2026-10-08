import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * The first author audit's scenarios, run again on the integrated P0 work (D134): Kora's structured change
 * reaches the exported storyline and undoes; Regenerate drafts from the current brief; removing a person
 * asks where their events go; a degenerate draft and a failed synthetic test block publishing; two tabs,
 * a quick reload, a corrupt draft and a tab opened offline lose nothing; a brief the template cannot play
 * is named before a draft is made; a conditional event and its "If ignored" follow up are in the exported
 * config; switching to Lite remaps events and says what moved.
 *
 * The exported config is read where Play a week leaves it for the participant tab (`ilead.author.draft`).
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const KEY = 'ilead.author.workspace';
const DRAFT_KEY = 'ilead.author.draft';
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function workspace(page: Page) {
  await page.goto('/author');
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Saved just now')).toBeVisible();
}
async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(name, 'i') }).click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name, 'i') })).toBeVisible();
}
const stored = (page: Page): Promise<Json> => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
/** Changes the stored draft and reloads, once the workspace's own save has landed. */
async function changeStored(page: Page, change: string) {
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) ?? '{}').stage === 'workspace', KEY);
  await page.waitForTimeout(500);
  await page.evaluate(([key, body]) => {
    const d = JSON.parse(localStorage.getItem(key)!);
    new Function('d', body)(d);
    localStorage.setItem(key, JSON.stringify(d));
  }, [KEY, change] as const);
  await page.reload();
}
/** Play a week, and the storyline it handed to the participant tab (the exported config). */
async function exported(page: Page, context: BrowserContext): Promise<Json> {
  const opened = context.waitForEvent('page');
  await page.getByRole('banner').getByRole('button', { name: 'Play a week' }).click();
  const tab = await opened;
  await tab.close();
  return page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), DRAFT_KEY);
}
const kora = (page: Page) => page.getByRole('complementary', { name: 'Ask Kora' });
const undo = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Undo', exact: true });
const money = (s: string) => Number(s.replace(/[^\d.]/g, ''));
const FINISHED = "d.brief.challenge = 'Deals stall at negotiation and new reps burn out.'; d.story.product.dealValue = 42000; for (const s of d.scoring.samples) s.call = s.scored;";

test('(a) "make it harder": a diff, Apply changes the target and the exported config, Undo reverts both', async ({ page, context }) => {
  await workspace(page);
  const before = await exported(page, context);
  await openTab(page, 'Work process');
  const target = page.getByRole('textbox', { name: 'Revenue target' });
  const was = money(await target.inputValue());

  await kora(page).getByRole('button', { name: 'Make it harder' }).click();
  const change = kora(page).getByRole('region', { name: 'Proposed change' });
  const rows = change.getByRole('list', { name: 'What changes' }).getByRole('listitem');
  await expect(rows.filter({ hasText: 'Revenue target' })).toContainText(was.toLocaleString('en-US'));
  await expect(rows.filter({ hasText: 'Pacing' })).toContainText('Demanding');
  await expect(change).toContainText('setbacks land 25% harder');
  await change.getByRole('button', { name: 'Apply' }).click();
  await expect.poll(async () => money(await target.inputValue())).toBeGreaterThan(was);
  await expect(undo(page)).toHaveAttribute('title', /^Undo: Kora: Harder$/);

  const after = await exported(page, context);
  expect(after.money.target).toBeGreaterThan(before.money.target);
  expect(after.money.inputPerSubPeriod[0]).toBeLessThan(before.money.inputPerSubPeriod[0]);
  expect(after.gamification.sponsor.escalation).toBeLessThan(before.gamification?.sponsor?.escalation ?? -10);
  const within = (s: Json) => s.events.filter((e: Json) => e.response).map((e: Json) => e.response.within);
  expect(within(after).reduce((a: number, b: number) => a + b, 0)).toBeLessThan(within(before).reduce((a: number, b: number) => a + b, 0));

  await undo(page).click();
  await expect.poll(async () => money(await target.inputValue())).toBe(was);
  await expect(page.getByRole('radio', { name: 'Balanced' })).toBeChecked();
  const undone = await exported(page, context);
  expect(undone.money.target).toBe(before.money.target);
  expect(undone.money.inputPerSubPeriod).toEqual(before.money.inputPerSubPeriod);
});

test('(b) Banking in the Brief, then Regenerate Story: banking content, and the field the author typed stays', async ({ page }) => {
  await workspace(page);
  await openTab(page, 'Story and world');
  const about = page.getByRole('textbox', { name: 'What it does' });
  await page.getByRole('textbox', { name: 'Headquarters' }).fill('Leeds, United Kingdom');
  await openTab(page, 'Brief');
  await page.getByRole('textbox', { name: 'Industry' }).fill('Banking');
  await openTab(page, 'Story and world');
  await page.getByRole('button', { name: 'Regenerate this tab' }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Kept 1 field you wrote: Headquarters.');
  await expect(about).toHaveValue(/bank/i);
  await expect(page.getByRole('textbox', { name: 'Headquarters' })).toHaveValue('Leeds, United Kingdom');
  await expect(undo(page)).toHaveAttribute('title', 'Undo: Regenerate Story and world');
});

test('(c) removing a person an event is about asks where their events go, and never retargets silently', async ({ page }) => {
  await workspace(page);
  const d = await stored(page);
  const ids = new Set(d.team.map((c: Json) => c.id));
  const ev = d.events.find((e: Json) => ids.has(e.who));
  const person = d.team.find((c: Json) => c.id === ev.who);
  const other = d.team.find((c: Json) => c.id !== person.id);
  await openTab(page, 'Team');
  await page.getByRole('region', { name: 'Characters' }).getByRole('button', { name: new RegExp(`^${person.first} ${person.last}`) }).click();
  await page.getByRole('button', { name: `Remove ${person.first}`, exact: true }).click();
  const ask = page.getByRole('alert').filter({ hasText: `Where should` });
  await expect(ask).toContainText(`${ev.title}`);
  await expect(ask).toContainText(`about ${person.first}`);
  // Nothing has changed yet.
  await page.waitForTimeout(500);
  expect((await stored(page)).team.some((c: Json) => c.id === person.id)).toBe(true);
  await ask.getByRole('combobox', { name: 'Their events' }).selectOption(other.id);
  await ask.getByRole('button', { name: `Remove ${person.first}` }).click();
  await expect.poll(async () => (await stored(page)).events.find((e: Json) => e.key === ev.key).who).toBe(other.id);
  expect((await stored(page)).team.some((c: Json) => c.id === person.id)).toBe(false);
  await expect(undo(page)).toHaveAttribute('title', `Undo: Remove ${person.first} ${person.last}, their events to ${other.first} ${other.last}`);
});

test('(d) identical impact tables and one action cannot be published, with the reason and a Fix link', async ({ page }) => {
  await workspace(page);
  await changeStored(page, `${FINISHED}
    const same = { fit: 'Skill +1, morale +1, result +1', close: 'Skill +1, morale +1, result +1', wrong: 'Skill +1, morale +1, result +1' };
    for (const a of d.actions) for (const k of Object.keys(a.impact)) a.impact[k] = { ...same };
    d.actions.forEach((a, i) => { a.core = i === 0; a.enabled = i === 0; });`);
  await page.getByRole('button', { name: 'Review and publish' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Review and publish' })).toBeVisible();
  const choices = page.getByRole('region', { name: 'Checks' }).getByRole('listitem').filter({ hasText: 'Choices make a difference' });
  await expect(choices).toContainText('Only 1 action is in use');
  const publish = page.getByRole('button', { name: 'Publish', exact: true });
  await expect(publish).toBeDisabled();
  await expect(publish).toHaveAccessibleDescription(/issues? blocks? publishing\. Fix the first one:/);
  await choices.getByRole('button', { name: 'Fix Choices make a difference' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Actions and conversations' })).toBeVisible();
});

test('(e) a failed synthetic run stays blocking after an edit', async ({ page }) => {
  test.setTimeout(150_000);
  await workspace(page);
  await changeStored(page, FINISHED);
  await openTab(page, 'Work process');
  await page.getByRole('textbox', { name: 'Revenue target' }).fill('1000000000000');
  await openTab(page, 'Test with synthetic players');
  for (const id of ['beginner', 'developing', 'proficient', 'expert']) await page.locator(`#cal-runs-${id}`).fill('1');
  await page.getByRole('button', { name: 'Run 4 playthroughs' }).click();
  await expect(page.getByRole('heading', { name: 'Results, 4 playthroughs' })).toBeVisible({ timeout: 90_000 });
  await openTab(page, 'Work process');
  await page.getByRole('textbox', { name: 'Revenue target' }).fill('240000');
  await openTab(page, 'Review and publish');
  const synthetic = page.getByRole('region', { name: 'Checks' }).getByRole('listitem').filter({ hasText: 'Synthetic players' });
  await expect(synthetic).toContainText('The last synthetic test failed, and no full test has passed since');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Publish without testing' })).toHaveCount(0);
});

test('(f) two tabs editing: a conflict banner, and no silent overwrite', async ({ page, context }) => {
  await workspace(page);
  await openTab(page, 'Brief');
  const other = await context.newPage();
  other.on('pageerror', e => errors.push(e.message));
  await other.goto('/author/workspace/brief');
  await expect(other.getByRole('heading', { level: 1, name: 'Brief' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Industry' }).fill('From tab one');
  await expect.poll(async () => (await stored(page))?.brief.industry).toBe('From tab one');
  await expect(other.getByRole('alert').filter({ hasText: 'This draft changed in another tab' })).toBeVisible();
  await other.getByRole('textbox', { name: 'Participants' }).fill('From tab two');
  await other.waitForTimeout(600);
  const now = await stored(page);
  expect(now.brief.industry).toBe('From tab one');
  expect(now.brief.participants).not.toBe('From tab two');
  await other.close();
});

test('(g) a reload within 300 ms of typing keeps the edit', async ({ page }) => {
  await workspace(page);
  await openTab(page, 'Brief');
  await page.getByRole('textbox', { name: 'Industry' }).fill('Typed just before reload');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Brief' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Industry' })).toHaveValue('Typed just before reload');
});

test('(h) a corrupt stored draft shows a recovery notice and keeps the backup', async ({ page }) => {
  await workspace(page);
  await page.waitForTimeout(500);
  await page.evaluate(k => localStorage.setItem(k, '{"v":1,"title":"Cut off mid'), KEY);
  await page.reload();
  const lost = page.getByRole('region', { name: 'Your saved draft could not be read' });
  await expect(lost).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ilead.author.workspace.backup'))).toBe('{"v":1,"title":"Cut off mid');
});

test('(i) offline, an unvisited tab shows an error with Try again, and works once back online', async ({ page, context }) => {
  await workspace(page);
  await context.setOffline(true);
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Scoring and report/ }).click();
  const failed = page.getByRole('main').getByRole('alert');
  await expect(failed).toContainText('This section could not load', { timeout: 15000 });
  await context.setOffline(false);
  await failed.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Scoring and report' })).toBeVisible();
  // Offline, the failed requests and the boundary's report are expected in the console; no page error is.
  const expected = /ERR_INTERNET_DISCONNECTED|Failed to fetch dynamically imported module/;
  errors.splice(0, errors.length, ...errors.filter(e => !expected.test(e)));
});

test('(j) the merger VP brief gets a plain fit warning before any draft is made', async ({ page }) => {
  await page.goto('/author');
  await page.getByRole('textbox', { name: 'Your answer' }).fill('Newly appointed VPs at a regional healthcare system that has just merged with a rival hospital group. They must integrate clinical and administrative functions across both organizations, keep the board and physician leaders aligned, negotiate with the nurses\' unions and decide where to cut a 12 million budget.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Before I go on, a plain word on fit.');
  await expect(page.getByRole('group', { name: 'Does iLead fit this brief?' })).toBeVisible();
  await expect(page.getByText('First draft ready')).toHaveCount(0);
  expect((await stored(page))?.stage ?? 'chat').toBe('chat');
});

test('(k) a conditional event and its "If ignored" follow up are in the exported config', async ({ page, context }) => {
  await workspace(page);
  await openTab(page, 'Events');
  const title = await page.getByRole('textbox', { name: 'Title' }).inputValue();
  const d = await stored(page);
  const ev = d.events.find((e: Json) => e.title === title);
  const follow = d.events.find((e: Json) => e.key !== ev.key && e.timing === 'followup') ?? d.events.find((e: Json) => e.key !== ev.key);
  await page.getByRole('combobox', { name: 'When' }).selectOption({ label: 'When something happens' });
  await page.getByRole('combobox', { name: 'Condition' }).selectOption({ label: 'Team trust falls below' });
  await page.getByText(/^Response: /).click();
  const meet = page.getByRole('checkbox', { name: 'Meet the team' });
  if (!(await meet.isChecked())) await meet.check();
  await page.getByRole('combobox', { name: 'Days to respond' }).selectOption({ label: '3 days' });
  const sponsor = page.getByRole('checkbox', { name: /The sponsor hears of it/ });
  if (!(await sponsor.isChecked())) await sponsor.check();
  await page.getByRole('combobox', { name: 'Then this event follows' }).selectOption(follow.key);

  const sl = await exported(page, context);
  const e = sl.events.find((x: Json) => x.key === ev.key);
  expect(e.period).toBeUndefined();
  expect(e.when).toMatchObject({ condition: 'teamTrustBelow' });
  expect(e.response).toMatchObject({ within: 3 });
  expect(e.response.actions).toContain('meet');
  expect(e.escalation).toEqual({ sponsor: true, event: follow.key });
  expect(sl.events.some((x: Json) => x.key === follow.key)).toBe(true);
});

test('(l) switching to Lite remaps events and says what moved, in the Brief and through Kora', async ({ page, context }) => {
  await workspace(page);
  await openTab(page, 'Brief');
  await page.getByText(/^Lite · 4 weeks/).click();
  await expect(page.getByText(/^To fit the new length, \d+ items moved/)).toBeVisible();
  await expect(undo(page)).toHaveAttribute('title', 'Undo: Change the run length to Lite');
  const sl = await exported(page, context);
  expect(sl.time.period.count).toBe(4);
  expect(sl.events.every((e: Json) => (e.period ?? 1) <= 4 && (e.window?.to ?? 1) <= 4)).toBe(true);
  expect(new Set(sl.events.flatMap((e: Json) => (e.period ? [e.period] : []))).size).toBeGreaterThan(2);

  // Undo, then the same through Ask Kora: the same remapping, and the reply says what moved.
  await undo(page).click();
  await expect(page.getByRole('radio', { name: /^Standard/ })).toBeChecked();
  const box = kora(page).getByRole('textbox', { name: 'Your instruction' });
  await box.fill('Shorten it to a 30 minute Lite run');
  await kora(page).getByRole('button', { name: 'Ask' }).click();
  const change = kora(page).getByRole('region', { name: 'Proposed change' });
  await expect(change).toContainText(/To fit the new length, \d+ items moved/);
  await change.getByRole('button', { name: 'Apply' }).click();
  const viaKora = await exported(page, context);
  expect(viaKora.time.period.count).toBe(4);
  expect(viaKora.events.map((e: Json) => [e.key, e.period ?? null, e.window ?? null])).toEqual(sl.events.map((e: Json) => [e.key, e.period ?? null, e.window ?? null]));
});
