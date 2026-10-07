import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** The Week 0 practice conversation (D16, D84): offered after onboarding (here `?practice=1`), unscored, skippable. */
const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function axe(page: Page) {
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.length}`);
}

test('practise with a teammate before week 1: a live conversation that scores nothing', async ({ page }) => {
  await page.goto('/?start=board&practice=1');
  const offer = page.getByRole('region', { name: 'Practice before week 1' });
  await expect(offer).toBeVisible({ timeout: 20000 });
  expect(await axe(page)).toEqual([]);
  await offer.getByRole('button', { name: /^Practice with / }).click();
  // The live shell, with the practice goal in the brief.
  await expect(page.getByText(/Nothing here is scored/).first()).toBeVisible();
  const box = page.getByRole('textbox', { name: 'Your reply' });
  await box.fill('Hi, how are you doing this week? What is on your mind?');
  await box.press('Enter');
  await expect(box).toHaveValue('');
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: /^(End|Finish)/ }).first().click();
  // Back to style setting with a tip: no team reacting, no outcome, the offer gone, week 1 untouched.
  await expect(page.getByText(/Practice done\. A tip for the real thing/)).toBeVisible();
  await expect(page.getByText('The team is reacting')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Set your leadership styles for week 1');
  await expect(offer).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
});

test('the practice can be skipped', async ({ page }) => {
  await page.goto('/?start=board&practice=1');
  const offer = page.getByRole('region', { name: 'Practice before week 1' });
  await offer.getByRole('button', { name: 'Skip practice' }).click({ timeout: 20000 });
  await expect(offer).toHaveCount(0);
  await expect(page.getByText('Practice skipped. Set your styles for week 1.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});
