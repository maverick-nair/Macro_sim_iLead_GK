import { expect, test, type Page } from '@playwright/test';

/** M4: live interactions on the engine, by text (no audio consent in these runs). */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

async function toBoard(page: Page) {
  await page.goto('/?start=board');
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(10);
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByText(/Styles are set for week 1/)).toBeVisible();
}

async function dismissEvents(page: Page) {
  for (let i = 0; i < 4; i++) {
    const b = page.getByRole('button', { name: 'Got it' });
    if (!(await b.count())) return;
    await b.click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
}

test('1:1: the NPC opens, streams labelled AI replies, opens up when asked, and the outcome follows', async ({ page }) => {
  await toBoard(page);
  await page.getByText('Kent Goldberg', { exact: true }).click();
  await page.getByRole('button', { name: /Meet face to face/ }).click();
  await page.getByText('Energize the person').click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  await dismissEvents(page);
  await expect(page.getByText('1:1 with Kent Goldberg')).toBeVisible();
  await expect(page.getByText('AI persona').first()).toBeVisible();
  const box = page.getByRole('textbox', { name: /what you would say|your reply|type/i }).last();
  await box.fill('I am sorry it has been rough. What is on your mind?');
  await box.press('Enter');
  await expect(page.getByText(/not what I was promised/).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Hint' }).click();
  await expect(page.getByText(/open question/).first()).toBeVisible();
  await page.getByRole('button', { name: /^(End|Finish)/ }).first().click();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/not what I was promised/).first()).toBeVisible();
});

test('interrupting the NPC cuts its line where you spoke over it', async ({ page }) => {
  await toBoard(page);
  await page.getByText('Peter Higgins', { exact: true }).click();
  await page.getByRole('button', { name: /Coach member/ }).click();
  await page.getByRole('radio').first().click().catch(() => undefined);
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  await dismissEvents(page);
  await expect(page.getByText(/Coach member/).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Interrupted').first()).toBeVisible({ timeout: 5000 });
});

test('email: written once, then the outcome; the live cap blocks a third live action', async ({ page }) => {
  await toBoard(page);
  await page.getByText('Beth Killiney', { exact: true }).click();
  await page.getByRole('button', { name: /Send email/ }).click();
  await page.getByText('Send congratulatory mail').click();
  await page.getByRole('button', { name: /Open the composer|Confirm and start|composer/i }).first().click();
  await dismissEvents(page);
  await page.getByRole('textbox', { name: /subject/i }).fill('Great work on the Ashcroft leads');
  await page.getByRole('textbox', { name: /body|message/i }).fill('Thank you for the 12 new leads this week, specifically the Ashcroft account. Please keep me posted by Friday.');
  await page.getByRole('button', { name: /^Send/ }).last().click();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });

  await page.getByText('Justin Keel', { exact: true }).click();
  await page.getByRole('button', { name: /Meet face to face/ }).click();
  await page.getByText(/Energize the person/).click();
  await page.getByRole('button', { name: /Confirm and start/ }).click();
  await dismissEvents(page);
  const box = page.getByRole('textbox').last();
  await box.fill('Thanks for your time.');
  await box.press('Enter');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^(End|Finish)/ }).first().click();
  await expect(page.getByText('How it landed')).toBeVisible({ timeout: 10000 });
  await page.getByText('Ruth Ether', { exact: true }).click();
  await expect(page.getByRole('button', { name: /Meet face to face.*live conversations this week/ })).toBeVisible();
});
