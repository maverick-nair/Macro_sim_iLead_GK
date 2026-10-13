import { expect, test, type Page } from '@playwright/test';

/**
 * The publish gate and the template fit check (D131 to D133): the chat says what an iLead simulation is
 * before question 1 and stops on a brief the template cannot play; a degenerate draft cannot publish and
 * says why, with a Fix link; a failed synthetic test stays blocking after an edit.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const KEY = 'ilead.author.workspace';
const progress = (page: Page) => page.getByText(/^Question \d+ of about \d+$/);
const answerBox = (page: Page) => page.getByRole('textbox', { name: 'Your answer' });
async function type(page: Page, text: string) {
  await answerBox(page).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}
async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(name, 'i') }).click();
}
/** A fresh draft in the workspace, saved. */
async function workspace(page: Page) {
  await page.goto('/author');
  await expect(progress(page)).toBeVisible();
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Saved just now')).toBeVisible();
}
/** Changes the stored draft and reloads, as an author's edits over several sessions would leave it. */
async function changeStored(page: Page, change: string) {
  // Let the workspace's own save land first (it waits 300 ms after the last change), so it cannot overwrite this one.
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) ?? '{}').stage === 'workspace', KEY);
  await page.waitForTimeout(500);
  await page.evaluate(([key, body]) => {
    const d = JSON.parse(localStorage.getItem(key)!);
    new Function('d', body)(d);
    localStorage.setItem(key, JSON.stringify(d));
  }, [KEY, change] as const);
  await page.reload();
}
const FINISHED = "d.brief.challenge = 'Deals stall at negotiation and new reps burn out.'; d.story.product.dealValue = 42000; for (const s of d.scoring.samples) s.call = s.scored;";

const MERGER = 'Newly appointed VPs at a regional healthcare system that has just merged with a rival hospital group. They must integrate clinical and administrative functions across both organizations, keep the board and physician leaders aligned, negotiate with the nurses\' unions and decide where to cut a 12 million budget.';

test('the chat says what an iLead simulation is before question 1, then folds it', async ({ page }) => {
  await page.goto('/author');
  const intro = page.getByRole('region', { name: 'What you are building: an iLead simulation' });
  await expect(intro).toBeVisible();
  await expect(intro).toContainText('a team of 6 to 12 direct reports through a staged work process, over up to 10 weeks');
  await expect(intro).toContainText('Not covered yet: a merger across several functions');
  await expect(intro).toContainText('I am Kora.');
  await expect(intro.getByRole('term').filter({ hasText: 'Pressure point' })).toBeVisible();
  const question = page.getByRole('log').getByText('Who are your participants?');
  await expect(question).toBeVisible();
  expect((await intro.boundingBox())!.y).toBeLessThan((await question.boundingBox())!.y);
  await page.getByRole('group', { name: 'Suggested answers' }).getByRole('button', { name: 'First time managers' }).click();
  await expect(progress(page)).toHaveText('Question 2 of about 10');
  await expect(intro).toHaveCount(0);
  await expect(page.getByText('What you are building: an iLead simulation')).toBeVisible();
  // Why we ask the industry.
  await expect(page.getByText(/^Why we ask: it sets the company, the product/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Your answer' }).fill('idk');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('No problem. Pick an industry below, or choose Decide for me and I will pick one you can change later.')).toBeVisible();
  await expect(progress(page)).toHaveText('Question 2 of about 10');
});

test('a brief the template cannot play is named plainly, with the nearest fit and a choice', async ({ page }) => {
  await page.goto('/author');
  await type(page, MERGER);
  const log = page.getByRole('log');
  await expect(log).toContainText('Before I go on, a plain word on fit.');
  await expect(log).toContainText('It cannot play a merger or an integration across several functions');
  await expect(log).toContainText('a merger or an integration across several functions');
  await expect(log).toContainText('The nearest fit:');
  const choice = page.getByRole('group', { name: 'Does iLead fit this brief?' });
  await expect(choice.getByRole('button', { name: 'Continue with a team leadership version' })).toBeVisible();
  // Nothing goes on until the author chooses: no next question, no suggestions, and Send says why.
  await expect(page.getByRole('group', { name: 'Suggested answers' })).toHaveCount(0);
  await type(page, 'Healthcare');
  await expect(page.getByText('First choose: continue with a team leadership version, or change the brief.')).toBeVisible();

  await choice.getByRole('button', { name: 'Change the brief' }).click();
  await expect(log).toContainText('Tell me the new answer to: Who are your participants?');
  await type(page, MERGER);
  await expect(choice.getByRole('button', { name: 'Continue with a team leadership version' })).toBeVisible();
  await choice.getByRole('button', { name: 'Continue with a team leadership version' }).click();
  await expect(log).toContainText('Then I will draft the team leadership version:');
  await expect(choice).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Suggested answers' })).toBeVisible();
  await expect(progress(page)).toHaveText(/^Question 2 of about \d+$/);
});

test('a degenerate draft cannot publish: the reason shows, and Fix opens the tab', async ({ page }) => {
  await workspace(page);
  await changeStored(page, `${FINISHED}
    const same = { fit: 'Skill +1, morale +1, result +1', close: 'Skill +1, morale +1, result +1', wrong: 'Skill +1, morale +1, result +1' };
    for (const a of d.actions) for (const k of Object.keys(a.impact)) a.impact[k] = { ...same };
    d.actions.find(a => a.key === 'energize').options.length = 1;
    d.brief.participants = '';`);
  await expect(page.getByRole('banner')).toContainText('1 needs you');
  await page.getByRole('button', { name: 'Review and publish' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Review and publish' })).toBeVisible();
  const checks = page.getByRole('region', { name: 'Checks' });
  await expect(checks.getByRole('listitem').filter({ hasText: 'Choices make a difference' })).toContainText('Styles make no difference in any conversation');
  await expect(checks.getByRole('listitem').filter({ hasText: 'Choices make a difference' })).toContainText('"Energize the team" is a decision with only one option');
  await expect(checks.getByRole('listitem').filter({ hasText: 'Everything required is filled in' })).toContainText('Participants is empty');
  const publish = page.getByRole('button', { name: 'Publish', exact: true });
  await expect(publish).toBeDisabled();
  await expect(publish).toHaveAccessibleDescription(/^4 issues block publishing\. Fix the first one:/);
  await page.getByRole('button', { name: 'Fix: Participants is empty' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Brief' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Participants' }).fill('First time managers');
  await expect(page.getByRole('banner')).toContainText('3 to fix');
  await openTab(page, 'Review and publish');
  await page.getByRole('button', { name: 'Fix: Styles make no difference in any conversation' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Actions and conversations' })).toBeVisible();
});

test('a failed synthetic test stays blocking after an edit, until a full run passes', async ({ page }) => {
  test.setTimeout(120_000);
  await workspace(page);
  await changeStored(page, FINISHED);
  // Without a test: blocking, unless the author ticks Publish without testing.
  await page.goto('/author/workspace/publish');
  const publish = page.getByRole('button', { name: 'Publish', exact: true });
  await expect(publish).toBeDisabled();
  await expect(page.getByRole('banner')).toContainText('1 to fix');
  await page.getByRole('checkbox', { name: 'Publish without testing' }).check();
  await expect(publish).toBeEnabled();
  await expect(page.getByRole('banner').getByText('Ready to publish')).toBeVisible();

  // Break the target, run the test: it fails.
  await openTab(page, 'Work process');
  await page.getByRole('textbox', { name: 'Revenue target' }).fill('1000000000000');
  await openTab(page, 'Test with synthetic players');
  for (const id of ['beginner', 'developing', 'proficient', 'expert']) await page.locator(`#cal-runs-${id}`).fill('1');
  await page.getByRole('button', { name: 'Run 4 playthroughs' }).click();
  await expect(page.getByRole('heading', { name: 'Results, 4 playthroughs' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/The revenue target is out of reach/).first()).toBeVisible();
  await openTab(page, 'Review and publish');
  const synthetic = page.getByRole('region', { name: 'Checks' }).getByRole('listitem').filter({ hasText: 'Synthetic players' });
  await expect(synthetic).toContainText('Synthetic players found problems on this version');
  await expect(publish).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Publish without testing' })).toHaveCount(0);

  // Fix the target: the draft changed, but the failure stays until a new full run passes.
  await openTab(page, 'Work process');
  await page.getByRole('textbox', { name: 'Revenue target' }).fill('240000');
  await openTab(page, 'Review and publish');
  await expect(synthetic).toContainText('The last synthetic test failed, and no full test has passed since');
  await expect(publish).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Publish without testing' })).toHaveCount(0);
  await expect(page.getByRole('banner')).toContainText('1 to fix');
});
