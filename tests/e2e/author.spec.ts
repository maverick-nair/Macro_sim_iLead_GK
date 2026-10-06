import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The author chat at /author (D74): a chat to a confirmed, locked draft for Readiness Based Leadership
 * and for Six Leadership Styles, then "Play this draft" opens the participant app on the drafted
 * storyline: its company, team and style names. Axe finds nothing at 1440 and 834, dark and light.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

async function axe(page: Page, where: string) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))));
  const r = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map(v => `${where}: ${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

const progress = (page: Page) => page.getByText(/^Question \d+ of about \d+$/);
const chip = (page: Page, name: string | RegExp) => page.getByRole('group', { name: 'Suggested answers' }).getByRole('button', { name });
async function type(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Your answer' }).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}

test('Readiness Based: ten questions, an edit, the lens, preview, lock and play', async ({ page, context }) => {
  await page.goto('/author');
  await expect(page.getByRole('heading', { level: 1, name: 'What do you want to build?' })).toBeVisible();
  await expect(progress(page)).toHaveText('Question 1 of about 10');
  await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeFocused();
  await chip(page, 'First time managers').click();
  await expect(progress(page)).toHaveText('Question 2 of about 10');
  await chip(page, 'Banking and financial services').click();
  await chip(page, 'Growing a new market').click();
  // Free text, then a wrong team size that the chat refuses.
  await type(page, 'Acme');
  await type(page, '30');
  await expect(page.getByRole('alert')).toHaveText('Pick a team size from 6 to 12.');
  await chip(page, '8').click();
  await chip(page, /^Sales Elevator funnel/).click();
  await chip(page, /^Lite/).click();
  await chip(page, 'English, India').click();
  await chip(page, 'No framework').click();
  await expect(progress(page)).toHaveText('Question 10 of about 10');
  // Edit an earlier answer from its link.
  await page.getByRole('button', { name: 'Edit your answer to: Which client is this for?' }).click();
  await page.getByRole('textbox', { name: 'Your new answer' }).fill('Acme Bank');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('log').getByText('Acme Bank', { exact: true })).toBeVisible();
  await chip(page, 'Professional').click();

  // The lens step: eight lenses in order, Readiness Based recommended for first time managers.
  await expect(page.getByRole('heading', { name: 'Choose your leadership lens' })).toBeFocused();
  const radios = page.getByRole('radiogroup').or(page.getByRole('group', { name: 'Primary lens (required)' })).getByRole('radio');
  await expect(radios).toHaveCount(8);
  await expect(page.getByRole('radio', { name: 'Readiness Based Leadership' })).toBeChecked();
  await expect(page.getByRole('note').filter({ hasText: 'We recommend Readiness Based Leadership because first time managers' })).toBeVisible();
  await expect(page.getByText('Works well with Six Leadership Styles.')).toBeVisible();
  await expect(page.getByText('Situational leadership research, Hersey and Blanchard')).toBeHidden();
  await page.getByRole('button', { name: 'More detail about Readiness Based Leadership' }).click();
  await expect(page.getByText('Situational leadership research, Hersey and Blanchard')).toBeVisible();
  await axe(page, 'lens 1440 dark');

  await page.getByRole('button', { name: 'Confirm lens and preview the build' }).click();
  await expect(page.getByRole('heading', { name: 'Build preview' })).toBeFocused();
  await expect(page.getByText('8 team members')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Leadership styles' }).getByRole('listitem')).toHaveCount(4);
  await expect(page.getByText('Draft made from templates').first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirm and lock' }).click();
  await expect(page.getByRole('heading', { name: 'Your draft is ready' })).toBeFocused();
  await page.getByText('Lens module output').click();
  await expect(page.getByRole('region', { name: 'Lens module JSON' })).toContainText('"locked": true');
  await axe(page, 'locked 1440 dark');

  // Changing the lens now warns.
  await page.getByRole('button', { name: 'Change lens' }).click();
  await expect(page.getByRole('alertdialog')).toHaveText(/Changing your lens will regenerate your team, events and scoring rubric\. Do you want to continue\?/);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

  // Download config.
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download config' }).click()]);
  expect(file.suggestedFilename()).toBe('draft_acme_bank.json');

  // Play this draft: the participant app on the drafted storyline.
  const firstMember = (await page.getByRole('complementary').getByRole('listitem').first().locator('b').textContent())!;
  const [play] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Play this draft' }).click()]);
  await expect(play.getByRole('heading', { level: 1, name: 'Lead a sales team of eight, for four weeks.' })).toBeVisible({ timeout: 20000 });
  await play.getByRole('button', { name: "Let's begin" }).click();
  await expect(play.getByText('Welcome to Acme Bank.', { exact: false })).toBeVisible();
  await play.goto('/?storyline=draft&start=board&participant=author_draft');
  await expect(play.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(8, { timeout: 20000 });
  await expect(play.getByRole('radiogroup', { name: `Leadership style for ${firstMember}` })).toBeVisible();
});

test('Six Leadership Styles: an upload skips questions, warm names reach the participant app', async ({ page, context }) => {
  await page.goto('/author');
  await expect(progress(page)).toHaveText('Question 1 of about 10');
  await page.locator('input[type=file]').setInputFiles({ name: 'brief.txt', mimeType: 'text/plain', buffer: Buffer.from('Client: Brightline Software\nTeam size: 10\nStages: Discover, Design, Build, Test, Release\nRegion: Singapore\n') });
  await expect(page.getByRole('log').getByText(/I read brief\.txt\. It covers the industry, client, team size, work process, region, so I will skip those questions\./)).toBeVisible();
  await expect(progress(page)).toHaveText('Question 1 of about 5');
  await chip(page, 'Mid level managers').click();
  await chip(page, 'Managers who rely on one style').click();
  await chip(page, /^Full/).click();
  await chip(page, 'No framework').click();
  await expect(progress(page)).toHaveText('Question 5 of about 5');
  await chip(page, 'Warm and encouraging').click();

  await expect(page.getByRole('radio', { name: 'Six Leadership Styles' })).toBeChecked();
  await expect(page.getByRole('note').filter({ hasText: 'We recommend Six Leadership Styles' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Secondary lens (optional)' }).selectOption({ label: 'Inspire and Deliver' });
  await expect(page.getByText('Inspire and Deliver adds report dimensions only.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm lens and preview the build' }).click();
  const dims = page.getByRole('list', { name: 'Scoring dimensions' });
  await expect(dims.getByRole('listitem').filter({ hasText: 'Team engagement' })).toContainText('Report only');
  await expect(dims.getByRole('listitem').filter({ hasText: 'Style range' })).not.toContainText('Report only');
  await page.getByRole('button', { name: 'Confirm and lock' }).click();

  const [play] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Play this draft' }).click()]);
  await play.getByRole('button', { name: "Let's begin" }).click({ timeout: 20000 });
  await expect(play.getByText('Welcome to Brightline Software.', { exact: false })).toBeVisible();
  await play.goto('/?storyline=draft&start=board&participant=author_draft');
  const styles = play.getByRole('radiogroup', { name: /^Leadership style for/ });
  await expect(styles).toHaveCount(10, { timeout: 20000 });
  await expect(styles.first().getByRole('radio')).toHaveCount(6);
  const defs = play.getByRole('list', { name: /style/i }).getByRole('listitem');
  for (const name of ['Vision Sharer', 'Coach', 'Bridge Builder', 'Collaborator', 'Bar Raiser', 'Steady Hand']) await expect(defs.filter({ hasText: name })).toHaveCount(1);
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

for (const width of [1440, 834]) {
  for (const theme of ['dark', 'light'] as const) {
    test(`axe at ${width}, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(theme === 'light' ? '/author?theme=light' : '/author');
      await expect(progress(page)).toBeVisible();
      if (width < 1280) await expect(page.getByRole('complementary')).toHaveCount(0);
      else await expect(page.getByRole('complementary', { name: 'Your simulation so far' })).toBeVisible();
      await axe(page, 'chat');
      for (const c of ['Senior leaders', 'Retail and consumer goods', 'Leading through change or transformation', 'Fictional company', '10 (default)', /^Service delivery/, /^Standard/, 'English, United Kingdom', 'No framework', 'Direct and brisk']) await chip(page, c).click();
      await expect(page.getByRole('radio', { name: 'Adaptive Leadership' })).toBeChecked();
      if (width < 1280) await page.getByText('Your simulation so far').click();
      await axe(page, 'lens');
      await page.screenshot({ path: `test-results/author-lens-${width}-${theme}.png` });
      await page.getByRole('button', { name: 'Confirm lens and preview the build' }).click();
      await page.getByRole('button', { name: 'Confirm and lock' }).click();
      await page.getByText('Lens module output').click();
      await axe(page, 'locked');
      await page.screenshot({ path: `test-results/author-locked-${width}-${theme}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });
  }
}
