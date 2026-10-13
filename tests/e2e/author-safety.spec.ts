import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * /author keeps the author's work (D122 to D124): undo and redo of a lens change, by button and by key,
 * and History's versions; two tabs on one draft never overwrite each other silently; a stored draft
 * that has to be repaired or cannot be read says so and offers the original; a tab whose chunk cannot
 * load (offline) shows a message with Try again instead of a blank page; full storage is said in view
 * at every width, and Play a week does not play the wrong simulation.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

async function workspace(page: Page) {
  await page.goto('/author');
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
}
async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(name, 'i') }).click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name, 'i') })).toBeVisible();
}
/** Axe on the page as it is (WCAG 2.2 AA, as a11y.spec.ts): no violations. */
async function axe(page: Page) {
  const r = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}
const styleOne = (page: Page) => page.getByRole('table', { name: 'Your styles' }).getByRole('textbox', { name: 'Name of style 1' });
const announced = (page: Page, text: RegExp) => page.getByRole('status').filter({ hasText: text });
/** The stored draft, as the store wrote it. */
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ilead.author.workspace') ?? 'null'));

test('undo and redo a lens change by button and by key; History restores a version, and that is undoable too', async ({ page }) => {
  await workspace(page);
  await openTab(page, 'Leadership lens');
  const before = await styleOne(page).inputValue();
  const undo = page.getByRole('banner').getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('banner').getByRole('button', { name: 'Redo', exact: true });
  await expect(redo).toBeDisabled();

  await page.getByRole('button', { name: 'Change lens' }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Lens' }).selectOption('servant');
  await page.getByRole('dialog').getByRole('button', { name: /^Change to / }).click();
  await expect(styleOne(page)).not.toHaveValue(before);
  const after = await styleOne(page).inputValue();

  await expect(undo).toBeEnabled();
  await expect(undo).toHaveAttribute('title', /^Undo: Change lens to /);
  await undo.click();
  await expect(styleOne(page)).toHaveValue(before);
  await expect(announced(page, /^Undid: Change lens to /)).toHaveCount(1);

  // Out of a field, Ctrl+Shift+Z redoes and Ctrl+Z undoes the draft.
  await page.getByRole('heading', { level: 1, name: 'Leadership lens' }).focus();
  await page.keyboard.press('Control+Shift+Z');
  await expect(styleOne(page)).toHaveValue(after);
  await expect(announced(page, /^Redid: Change lens to /)).toHaveCount(1);
  await page.keyboard.press('Control+Z');
  await expect(styleOne(page)).toHaveValue(before);
  await page.keyboard.press('Control+Y');
  await expect(styleOne(page)).toHaveValue(after);

  // In a field, Ctrl+Z is the field's own: the lens stays.
  await styleOne(page).fill('Guide');
  await styleOne(page).press('Control+Z');
  await expect(page.getByRole('heading', { level: 1, name: 'Leadership lens' }).locator('..')).toContainText('Servant');

  // History: the version saved before the lens change, kept across a reload, restored, then undone.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Leadership lens' })).toBeVisible();
  await page.getByRole('button', { name: 'History' }).click();
  const dialog = page.getByRole('dialog', { name: 'History' });
  await expect(dialog.getByRole('heading', { name: 'Current version' })).toBeVisible();
  await axe(page);
  const version = dialog.getByRole('list', { name: 'Saved versions' }).getByRole('listitem').filter({ hasText: /^Before: Change lens to / });
  await expect(version).toHaveCount(1);
  await version.getByRole('button', { name: /^Restore Before: Change lens/ }).click();
  await expect(dialog).toBeHidden();
  await expect(styleOne(page)).toHaveValue(before);
  await expect(announced(page, /^Restored: Before: Change lens/)).toHaveCount(1);
  await undo.click();
  await expect(styleOne(page)).not.toHaveValue(before);
});

test('two tabs on one draft: the other tab says so and never overwrites silently', async ({ page, context }) => {
  await workspace(page);
  await openTab(page, 'Brief');
  const other = await context.newPage();
  other.on('pageerror', e => errors.push(e.message));
  await other.goto('/author/workspace/brief');
  await expect(other.getByRole('heading', { level: 1, name: 'Brief' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Industry' }).fill('Written in tab one');
  await expect.poll(async () => (await stored(page))?.brief.industry).toBe('Written in tab one');
  const banner = other.getByRole('alert').filter({ hasText: 'This draft changed in another tab' });
  await expect(banner).toBeVisible();
  await axe(other);
  // While the banner shows, the second tab's edits are not saved over the first's.
  await other.getByRole('textbox', { name: 'Participants' }).fill('Written in tab two');
  await other.waitForTimeout(600);
  expect((await stored(page)).brief.industry).toBe('Written in tab one');
  expect((await stored(page)).brief.participants).not.toBe('Written in tab two');

  await banner.getByRole('button', { name: 'Reload to latest' }).click();
  await expect(banner).toBeHidden();
  await expect(other.getByRole('textbox', { name: 'Industry' })).toHaveValue('Written in tab one');

  // Keep mine: the second tab writes over the first on purpose, and the first tab is told.
  await page.getByRole('textbox', { name: 'Industry' }).fill('Tab one again');
  await expect(other.getByRole('alert').filter({ hasText: 'This draft changed in another tab' })).toBeVisible();
  await other.getByRole('button', { name: 'Keep mine' }).click();
  await expect.poll(async () => (await stored(page))?.brief.industry).toBe('Written in tab one');
  await expect(page.getByRole('alert').filter({ hasText: 'This draft changed in another tab' })).toBeVisible();
  await other.close();
});

test('a stored draft that needs repair says what changed; one that cannot be read starts fresh and offers the original', async ({ page }) => {
  await workspace(page);
  const draft = await stored(page);
  const person = draft.team[1];
  draft.team[1].stats.skill = 500;
  await page.evaluate(d => localStorage.setItem('ilead.author.workspace', JSON.stringify(d)), draft);
  await page.reload();
  const notice = page.getByRole('region', { name: 'Your saved draft was repaired' });
  await expect(notice).toBeVisible();
  await notice.getByText(/^What changed/).click();
  await expect(notice.getByRole('listitem')).toHaveText([`Team, ${person.first} ${person.last}, stats, skill: 500 changed to 100`]);
  await axe(page);
  await openTab(page, 'Team');
  await expect(page.getByRole('region', { name: 'Characters' }).getByRole('listitem')).toHaveCount(draft.team.length);
  const download = page.waitForEvent('download');
  await notice.getByRole('button', { name: 'Download the original' }).click();
  expect((await download).suggestedFilename()).toMatch(/-original\.json$/);
  await notice.getByRole('button', { name: 'Got it' }).click();
  await expect(notice).toBeHidden();

  await page.evaluate(() => localStorage.setItem('ilead.author.workspace', '{"v":1,"title":"Half wri'));
  await page.reload();
  const lost = page.getByRole('region', { name: 'Your saved draft could not be read' });
  await expect(lost).toBeVisible();
  await expect(lost).toContainText('A new draft was started');
  expect(await page.evaluate(() => localStorage.getItem('ilead.author.workspace.backup'))).toBe('{"v":1,"title":"Half wri');
});

test('a tab that cannot load offline shows a message with Try again, and the draft survives', async ({ page, context }) => {
  await workspace(page);
  await openTab(page, 'Brief');
  await page.getByRole('textbox', { name: 'Industry' }).fill('Kept while offline');
  await context.setOffline(true);
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Events/ }).click();
  const failed = page.getByRole('main').getByRole('alert');
  await expect(failed).toContainText('This section could not load', { timeout: 15000 });
  await axe(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await context.setOffline(false);
  await failed.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Events' })).toBeVisible();
  await page.reload();
  await openTab(page, 'Brief');
  await expect(page.getByRole('textbox', { name: 'Industry' })).toHaveValue('Kept while offline');
});

test('full storage is said in view at every width, and Play a week does not play the bundled demo', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === 'ilead.author.workspace' || k === 'ilead.author.draft') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  });
  await page.goto('/author');
  await page.evaluate(() => localStorage.removeItem('ilead.author.draft'));
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  const full = page.getByRole('alert').filter({ hasText: 'Your browser’s storage for this site is full, so changes are not being saved.' });
  await expect(full).toBeVisible();
  await expect(full.getByRole('button', { name: 'Download draft' })).toBeVisible();
  await axe(page);
  const popups: string[] = [];
  page.context().on('page', p => popups.push(p.url()));
  await page.getByRole('button', { name: 'Play a week' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /^Play a week could not start: your browser's storage for this site is full/ })).toBeVisible();
  await page.waitForTimeout(300);
  expect(popups).toEqual([]);
});
