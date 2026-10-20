import { expect, test, type Page } from '@playwright/test';

/**
 * Preview from GenieKreator (D190 to D199): Preview opens the latest saved draft in one preview tab, marked
 * as a test; the bar jumps to the desk and to the end report, labels where things come from, and offers
 * Reload when GenieKreator saves again; nothing a participant's history, runs or reports read is written.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const KEY = 'ilead.author.workspace';
const FINISHED = "d.brief.challenge = 'Deals stall at negotiation and new reps burn out.'; d.story.product.dealValue = 42000; for (const s of d.scoring.samples) s.call = s.scored;";
const stored = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);

/** A draft in the workspace, seeded as an author's earlier sessions would leave it. */
async function seeded(page: Page) {
  await page.goto('/author');
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) ?? '{}').stage === 'workspace', KEY);
  await page.waitForTimeout(500);
  await page.evaluate(([key, body]) => {
    const d = JSON.parse(localStorage.getItem(key)!);
    new Function('d', body)(d);
    localStorage.setItem(key, JSON.stringify(d));
  }, [KEY, FINISHED] as const);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
}

async function jump(preview: Page, item: string, week?: number) {
  const bar = preview.getByRole('region', { name: 'Preview controls' });
  await bar.getByRole('button', { name: 'Jump to' }).click();
  const menu = bar.getByRole('group', { name: 'Points in the run' });
  if (week) await menu.getByRole('combobox', { name: 'Week' }).selectOption(String(week));
  await menu.getByRole('button', { name: item }).click();
}

test('Preview opens the saved draft as a marked test, jumps, labels sources, reloads a new save, and writes no history', async ({ page, context }) => {
  // The preview keeps its own tour state (D193): tours stay out of this flow's way, as GUIDE_OFF does for participants.
  await context.addInitScript(() => { try { localStorage.setItem('ilead.preview.guide', JSON.stringify({ never: true })); } catch { /* blocked */ } });
  await seeded(page);
  const draft = await stored(page);
  const person = draft.team[0];

  const opened = context.waitForEvent('page');
  await page.getByRole('banner').getByRole('button', { name: 'Preview', exact: true }).click();
  const preview = await opened;
  const bar = preview.getByRole('region', { name: 'Preview controls' });
  await expect(bar).toContainText('Preview · test run · nothing is saved to reports');
  await expect(bar).toContainText(/Draft for version 1, saved /);
  expect(new URL(preview.url()).searchParams.get('preview')).toBe('1');
  expect(new URL(preview.url()).searchParams.get('jump')).toBe('onboarding');

  // Jump to the desk of week 2.
  await jump(preview, 'Your desk, week 2', 2);
  await expect(preview).toHaveURL(/jump=board%3A2/);
  await expect(preview.getByRole('region', { name: 'Preview controls' })).toBeVisible();
  const card = preview.locator(`[data-member-id="${person.id}"]`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(person.first);

  // Show where this comes from: traced surfaces carry their GenieKreator section.
  await bar.getByRole('button', { name: 'Show where this comes from' }).click();
  await expect(bar.getByRole('button', { name: 'Show where this comes from' })).toHaveAttribute('aria-pressed', 'true');
  const overlay = preview.locator('[data-preview-trace]');
  // Labels from the traceability registry (src/shared/trace.ts): a member card, an action tile.
  await expect(overlay).toContainText('Team · First and last name');
  await expect(overlay).toContainText('Actions and conversations · Action name');
  await bar.getByRole('button', { name: 'Show where this comes from' }).click();
  await expect(overlay).toHaveCount(0);

  // Jump to the end report.
  await jump(preview, 'End and report');
  await expect(preview).toHaveURL(/jump=report/);
  await expect(preview.locator('[data-trace="report"]')).toBeVisible({ timeout: 30_000 });
  await expect(preview.locator('[data-trace="report"]').getByRole('heading', { level: 1 })).toBeVisible();

  // Back to the desk, then rename the person in GenieKreator: the preview offers Reload, which plays the new save.
  await jump(preview, 'Your desk, week 1', 1);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Team/i }).click();
  await page.getByRole('button', { name: `Edit ${person.first} ${person.last}` }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'First name' }).fill('Zara');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(bar.getByRole('status').filter({ hasText: 'Updated from GenieKreator.' })).toBeVisible({ timeout: 10_000 });
  await bar.getByRole('button', { name: 'Reload' }).click();
  await expect(preview).toHaveURL(/jump=board%3A1/);
  await expect(card).toContainText('Zara', { timeout: 20_000 });

  // Back to GenieKreator returns to this tab; no other tab opens.
  await preview.getByRole('region', { name: 'Preview controls' }).getByRole('button', { name: 'Back to GenieKreator' }).click();
  expect(context.pages()).toHaveLength(2);

  // Nothing a participant's history, runs or reports read was written: no remembered run, no queue, no settings, no tour state.
  const keys = await preview.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  expect(Object.keys(keys).filter(k => k.startsWith('ilead.') && !k.startsWith('ilead.author.') && !k.startsWith('ilead.preview.') && k !== 'ilead.guide')).toEqual([]);
  expect(keys['ilead.guide']).toBe(JSON.stringify({ never: true }));
  expect(keys['ilead.run']).toBeUndefined();
});

test('the preview bar never shows outside a preview', async ({ page }) => {
  await page.goto('/?storyline=draft&start=board&participant=author_draft');
  await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('region', { name: 'Preview controls' })).toHaveCount(0);
});
