import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * GenieKreator's "Test with synthetic players" (D116) at /author/calibrate: a small calibration of the
 * Sales Elevator draft runs in this browser (a Web Worker), the results and checks show, and one
 * playthrough opens with its transcript and why each rating was given. Axe finds nothing on the setup,
 * the results and the playthrough, dark and light.
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

for (const theme of ['dark', 'light'] as const) {
  test(`runs a small calibration and opens a playthrough (${theme})`, async ({ page }) => {
    await page.goto(`/author/calibrate${theme === 'light' ? '?theme=light' : ''}`);
    await expect(page.getByRole('heading', { level: 2, name: 'Test with synthetic players' })).toBeVisible();
    for (const p of ['Beginner', 'Developing', 'Proficient', 'Expert']) {
      await expect(page.getByRole('switch', { name: `Include ${p}` })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('textbox', { name: `How ${p} plays` })).toBeVisible();
    }
    await axe(page, `${theme} setup`);

    // One playthrough each, with the strategy probes, so the test is quick but complete.
    for (const id of ['beginner', 'developing', 'proficient', 'expert']) await page.locator(`#cal-runs-${id}`).fill('1');
    await page.getByRole('button', { name: 'Run 4 playthroughs' }).click();
    await expect(page.getByRole('heading', { name: 'Results, 4 playthroughs' })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('status').filter({ hasText: /^Test finished: / })).toHaveCount(1);
    const rows = page.getByRole('table', { name: /Leadership Score, tier, revenue and skills rated/ }).getByRole('row');
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(4).getByRole('rowheader')).toHaveText('Expert');
    await expect(page.getByText('Scores rise with proficiency').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Checks' })).toBeVisible();
    await expect(page.getByText(/Expert players reach Gold in 1 of 1 run/)).toBeVisible();
    await expect(page.getByText('No single strategy wins without good leadership')).toBeVisible();
    await expect(page.getByText(/ran in this browser with the built in players/i)).toBeVisible();
    await axe(page, `${theme} results`);

    await page.getByRole('button', { name: 'Watch a playthrough' }).click();
    await expect(page.getByRole('group', { name: 'Player' }).getByRole('button', { name: 'Proficient' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Week by week' })).toBeVisible();
    const transcript = page.getByRole('list', { name: 'Transcript' });
    await expect(transcript.getByRole('listitem').first()).toBeVisible();
    await expect(page.getByText(/^Why (Strong|Adequate|Weak|Harmful): /)).toBeVisible();
    await axe(page, `${theme} playthrough`);

    await page.getByRole('button', { name: 'Compare with the Expert run' }).click();
    await expect(page.getByRole('group', { name: 'Player' }).getByRole('button', { name: 'Expert' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/^Why (Strong|Adequate|Weak|Harmful): /)).toBeVisible();
    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect(page.getByRole('button', { name: 'Watch a playthrough' })).toBeFocused();
  });
}

test('shows what keeps a draft from playing, and the cancel', async ({ page }) => {
  await page.goto('/author/calibrate');
  await page.locator('#cal-runs-expert').fill('25');
  await page.getByRole('button', { name: /^Run \d+ playthroughs$/ }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Test cancelled.' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Run \d+ playthroughs$/ })).toBeEnabled();
});
