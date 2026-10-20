import { expect, test, type Page } from '@playwright/test';

/**
 * Ask Kora edits the draft with structured changes (D125) and Regenerate drafts from the draft as it
 * is now (D126), on the offline rules (no VITE_GENIE_URL in the dev server).
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

async function workspace(page: Page) {
  await page.goto('/author');
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
}
async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(name, 'i') }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}
const kora = (page: Page) => page.getByRole('complementary', { name: 'Ask Kora' });
const money = (s: string) => Number(s.replace(/[^\d.]/g, ''));

test('"Make it harder" shows a structured diff, and Apply changes the numbers, not the words', async ({ page }) => {
  await workspace(page);
  await openTab(page, 'Story and world');
  const about = await page.getByRole('textbox', { name: 'What it does' }).inputValue();
  await openTab(page, 'Work process');
  const target = page.getByRole('textbox', { name: 'Revenue target' });
  const before = money(await target.inputValue());
  expect(before).toBeGreaterThan(0);

  await kora(page).getByRole('button', { name: 'Make it harder' }).click();
  const change = kora(page).getByRole('region', { name: 'Proposed change' });
  await expect(change).toContainText('Harder: the revenue target goes up');
  const rows = change.getByRole('list', { name: 'What changes' }).getByRole('listitem');
  await expect(rows.filter({ hasText: 'Revenue target' })).toContainText(before.toLocaleString('en-US'));
  await expect(rows.filter({ hasText: 'Pacing' })).toContainText('Demanding');
  await expect(change.getByText(/^Show all \d+ changes$/)).toBeVisible();
  await change.getByRole('button', { name: 'Apply' }).click();
  await expect(kora(page).getByRole('status')).toContainText(/^Applied \d+ changes\./);
  await expect.poll(async () => money(await target.inputValue())).toBeGreaterThan(before);
  await expect(page.getByRole('radio', { name: 'Demanding' })).toBeChecked();

  // The audit's failure: the instruction was appended to the company description.
  await openTab(page, 'Story and world');
  await expect(page.getByRole('textbox', { name: 'What it does' })).toHaveValue(about);
});

test('Kora says what it cannot do, asks when instructions conflict, and Discard changes nothing', async ({ page }) => {
  await workspace(page);
  const box = kora(page).getByRole('textbox', { name: 'Your instruction' });
  await box.fill('Make the story more about pricing pressure');
  await kora(page).getByRole('button', { name: 'Ask' }).click();
  await expect(kora(page).getByRole('region', { name: 'Kora\'s reply' })).toContainText('I can\'t do that yet.');
  await kora(page).getByRole('button', { name: 'OK' }).click();

  await box.fill('Make it harder but also easier');
  await kora(page).getByRole('button', { name: 'Ask' }).click();
  const reply = kora(page).getByRole('region', { name: 'Kora\'s reply' });
  await expect(reply).toContainText('Those two conflict');
  await reply.getByRole('button', { name: 'Make it easier' }).click();
  const change = kora(page).getByRole('region', { name: 'Proposed change' });
  await expect(change).toContainText('Easier:');
  await change.getByRole('button', { name: 'Discard' }).click();
  await expect(kora(page).getByRole('status')).toHaveText('Discarded. Nothing changed.');
});

test('Ask Kora sits beside the lens and the actions, where decisions are designed', async ({ page }) => {
  await workspace(page);
  await openTab(page, 'Actions and conversations');
  await kora(page).getByRole('button', { name: 'Make decisions less obvious' }).click();
  const change = kora(page).getByRole('region', { name: 'Proposed change' });
  await expect(change).toContainText('when it fits');
  await change.getByRole('button', { name: 'Apply' }).click();
  await expect(kora(page).getByRole('status')).toContainText('Applied');
  await openTab(page, 'Leadership lens');
  await expect(kora(page)).toBeVisible();
});

test('Regenerate after an industry change drafts from the current brief and keeps what the author wrote', async ({ page }) => {
  await workspace(page);
  await openTab(page, 'Story and world');
  const about = page.getByRole('textbox', { name: 'What it does' });
  const was = await about.inputValue();
  await page.getByRole('textbox', { name: 'Headquarters' }).fill('Leeds, United Kingdom');

  await openTab(page, 'Brief');
  await page.getByRole('textbox', { name: 'Industry' }).fill('Banking');
  await openTab(page, 'Story and world');
  await page.getByRole('button', { name: 'Regenerate this tab' }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText(/^Kora drafted it again from your current brief: \d+ fields changed\. Kept 1 field you wrote: Headquarters\.$/);
  await expect(about).not.toHaveValue(was);
  await expect(about).toHaveValue(/business banking/);
  await expect(page.getByRole('textbox', { name: 'Headquarters' })).toHaveValue('Leeds, United Kingdom');

  // Again, with nothing new: nothing changes, and it says so.
  await page.getByRole('button', { name: 'Regenerate this tab' }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText(/^Nothing changed: Kora's draft already matches your current brief\./);
});

test('Regenerate one event changes that event only', async ({ page }) => {
  await workspace(page);
  await openTab(page, 'Events');
  await page.getByRole('button', { name: /^Pulse survey results/ }).click();
  const others = await page.getByRole('list', { name: 'Week 5' }).innerText();
  await page.getByRole('button', { name: 'Regenerate Pulse survey results' }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('1 field changed');
  await expect(page.getByRole('list', { name: 'Week 3' })).not.toContainText('Pulse survey results');
  expect(await page.getByRole('list', { name: 'Week 5' }).innerText()).toBe(others);
});
