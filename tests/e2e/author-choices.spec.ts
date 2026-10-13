import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Authoring decisions that carry forward (D136 to D138): business variables in Work process, a choice event in
 * Events with its options, flags and leadership read, and a later event that plays only if a decision set a flag
 * and team morale is low. The exported storyline is read where Play a week leaves it.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function workspace(page: Page, tab: string) {
  await page.goto('/author');
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(tab, 'i') }).click();
}
async function exported(page: Page, context: BrowserContext): Promise<Json> {
  const opened = context.waitForEvent('page');
  await page.getByRole('banner').getByRole('button', { name: 'Play a week' }).click();
  await (await opened).close();
  return page.evaluate(() => JSON.parse(localStorage.getItem('ilead.author.draft') ?? 'null'));
}
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test('business variables in Work process reach the storyline; people dynamics are on for a new draft', async ({ page, context }) => {
  await workspace(page, 'Work process');
  const card = page.getByRole('region', { name: 'Business variables' });
  await expect(card.getByRole('textbox', { name: 'Name' })).toHaveCount(2);
  await expect(card.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('Budget');
  await card.getByRole('button', { name: 'Add a variable' }).click();
  await card.getByRole('textbox', { name: 'Name' }).nth(2).fill('Quality');
  await card.getByRole('switch', { name: 'Participants see it on their board' }).nth(2).click();
  await expect(page.getByRole('switch', { name: 'How people feel shows in their work' })).toHaveAttribute('aria-checked', 'true');
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).include('main').analyze();
  expect(r.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  const sl = await exported(page, context);
  expect(sl.dynamics).toEqual({});
  expect(sl.variables.map((v: Json) => [v.key, v.name, v.shown])).toEqual([['budget', 'Budget', true], ['customer_trust', 'Customer trust', true], ['measure', 'Quality', false]]);
});

test('a decision that cuts the training budget, and a later event that plays only if it was cut and morale is low', async ({ page, context }) => {
  await workspace(page, 'Events');
  // The drafted decision: its options, its default and the flag the first option sets.
  await page.getByRole('button', { name: /^Finance wants a cut/ }).click();
  const decision = page.getByRole('group', { name: 'Decision' });
  await expect(decision.getByRole('switch', { name: 'The participant decides what to do' })).toHaveAttribute('aria-checked', 'true');
  const options = decision.getByRole('list', { name: 'Options' }).getByRole('listitem').filter({ has: page.getByRole('textbox', { name: 'Label' }) });
  await expect(options).toHaveCount(2);
  await expect(options.first().getByRole('textbox', { name: 'Label' })).toHaveValue('Cut the training budget');
  await expect(options.first().getByRole('textbox', { name: 'Sets these flags' })).toHaveValue('budget cut');
  await options.nth(1).getByRole('textbox', { name: 'What happened, shown after it is chosen' }).fill('The course goes ahead, and the team notices you fought for it.');
  await decision.getByRole('button', { name: 'Add an option' }).click();
  await expect(options).toHaveCount(3);
  await options.nth(2).getByRole('textbox', { name: 'Label' }).fill('Ask the team which course matters most');
  await options.nth(2).getByRole('textbox', { name: 'Morale' }).fill('2');
  await options.nth(2).getByRole('textbox', { name: 'Budget' }).fill('-3000');
  await options.nth(2).getByRole('button', { name: 'Add a skill' }).click();

  // A new event, two weeks later, that waits on the flag and on team morale.
  await page.getByRole('button', { name: 'Add an event' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Two people ask for the training you cut');
  await page.getByRole('textbox', { name: 'What participants read' }).fill('Two of your team ask when the course will be back.');
  await page.getByRole('combobox', { name: 'When' }).selectOption({ label: 'Week 6, Monday' });
  const only = page.getByRole('group', { name: 'Plays only if' });
  await only.getByRole('button', { name: 'Add a condition' }).click();
  await expect(only.getByRole('combobox', { name: 'Condition 1' })).toHaveValue('flag');
  await only.getByRole('combobox', { name: 'Flag' }).selectOption({ label: 'budget cut' });
  await only.getByRole('button', { name: 'Add a condition' }).click();
  await only.getByRole('combobox', { name: 'Condition 2' }).selectOption({ label: 'A team measure' });
  await only.getByRole('combobox', { name: 'Measure' }).selectOption({ label: 'Team morale' });
  await only.getByRole('textbox', { name: 'Value' }).fill('60');
  await expect(page.getByRole('button', { name: /^Two people ask for the training you cut/ })).toContainText('only if');
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).include('main').analyze();
  expect(r.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  const sl = await exported(page, context);
  const cut = sl.events.find((e: Json) => e.key === 'budget_decision');
  expect(cut.choice.options.map((o: Json) => o.label)).toEqual(['Cut the training budget', 'Keep the training and cut elsewhere', 'Ask the team which course matters most']);
  expect(cut.choice.options[0].business.set).toEqual(['budget_cut']);
  expect(cut.choice.options[2].business.variables).toEqual({ budget: -3000 });
  expect(cut.choice.options[2].read).toHaveLength(1);
  const ask = sl.events.find((e: Json) => e.title === 'Two people ask for the training you cut');
  expect(ask.period).toBe(6);
  expect(ask.if).toEqual([{ kind: 'flag', flag: 'budget_cut', is: true }, { kind: 'metric', metric: 'teamMorale', op: 'below', value: 60 }]);
});

test('a condition on a flag no decision sets blocks publishing, on the Events tab', async ({ page }) => {
  await workspace(page, 'Events');
  await page.getByRole('button', { name: 'Add an event' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('A ghost event');
  const only = page.getByRole('group', { name: 'Plays only if' });
  await only.getByRole('button', { name: 'Add a condition' }).click();
  await only.getByRole('combobox', { name: 'Flag' }).selectOption({ label: 'discounted' });
  // The discount decision sets "discounted": clear it, and the event waits on nothing.
  await page.getByRole('button', { name: /^A discount to close this week/ }).click();
  const first = page.getByRole('group', { name: 'Decision' }).getByRole('list', { name: 'Options' }).getByRole('listitem').first();
  await first.getByRole('textbox', { name: 'Sets these flags' }).fill('');
  await first.getByRole('textbox', { name: 'Label' }).click();
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Review and publish/i }).click();
  await expect(page.getByText('The event "A ghost event" waits for "discounted", which no decision sets').first()).toBeVisible();
});
