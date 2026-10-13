import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Authoring stakeholders outside the team (D160 to D165): add one in Team, shape them in the stakeholder editor
 * (identity, the relationship they start with, a negotiation played as a decision), have an event come from them as a
 * meeting request with a deadline, and read the exported storyline where Play a week leaves it.
 */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

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
async function axe(page: Page, include: string) {
  const r = await new AxeBuilder({ page: page as never }).withTags(TAGS).include(include).analyze();
  expect(r.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

test('a client stakeholder authored in Team, with a negotiation as a decision and a meeting request in Events', async ({ page, context }) => {
  await workspace(page, 'Team');
  const section = page.getByRole('region', { name: 'Stakeholders outside the team' });
  await expect(section.getByRole('list', { name: 'Stakeholders' })).toHaveCount(0);
  await section.getByRole('combobox', { name: 'Kind of stakeholder' }).selectOption({ label: 'A customer' });
  await section.getByRole('button', { name: 'Add a stakeholder' }).click();

  // The editor opens on the new stakeholder: identity first.
  await expect(page.getByRole('dialog', { name: 'Edit Priya Shah' })).toBeVisible();
  // The title follows the name as it is typed.
  const dialog = page.getByRole('dialog');
  await axe(page, '[role="dialog"]');
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Ana Costa');
  await dialog.getByRole('textbox', { name: 'Role' }).fill('Head of Procurement, Ascent Lifts');
  await dialog.getByRole('tab', { name: 'Relationship' }).click();
  await dialog.getByRole('spinbutton', { name: 'Trust in you, number' }).fill('40');
  await expect(dialog.getByRole('status')).toContainText('Ana starts cool');
  await dialog.getByRole('tab', { name: 'Interactions' }).click();
  const negotiate = dialog.getByRole('region', { name: 'Negotiate' });
  await negotiate.getByRole('switch', { name: 'Negotiate: participants can do this' }).click();
  await negotiate.getByRole('radio', { name: 'Decision' }).check({ force: true });
  const options = negotiate.getByRole('list', { name: 'Negotiate options' }).getByRole('listitem');
  await expect(options).toHaveCount(2);
  await options.first().getByRole('textbox', { name: 'Label' }).fill('Hold the scope and the date');
  await options.first().getByRole('textbox', { name: 'Their satisfaction' }).fill('-4');
  await options.nth(1).getByRole('textbox', { name: 'Label' }).fill('Trade a later date for the extra feature');
  await options.nth(1).getByRole('textbox', { name: 'Trust it needs' }).fill('55');
  await options.nth(1).getByRole('textbox', { name: 'Their trust' }).fill('5');
  await axe(page, '[role="dialog"]');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();

  const card = section.getByRole('list', { name: 'Stakeholders' }).getByRole('listitem').filter({ hasText: 'Ana Costa' });
  await expect(card).toContainText('Starts cool on trust (40)');
  await expect(card).toContainText('negotiate (a decision)');
  await axe(page, 'main');

  // An event from Ana: she asks to meet within two days.
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Events/i }).click();
  await page.getByRole('button', { name: 'Add an event' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Ana asks to meet about the delays');
  await page.getByRole('textbox', { name: 'What participants read' }).fill('Ana has heard about the delays and wants to talk this week.');
  const sh = page.getByRole('group', { name: 'Stakeholders' });
  await sh.getByRole('combobox', { name: 'Comes from' }).selectOption({ label: 'Ana Costa, Head of Procurement, Ascent Lifts' });
  await sh.getByRole('combobox', { name: 'Ana asks for' }).selectOption({ label: 'A meeting: meet (Meet Ana)' });
  await sh.getByRole('textbox', { name: 'Ana: trust' }).fill('-2');
  await expect(page.getByText(/^Response:/)).toHaveCount(0);
  await axe(page, 'main');

  const sl = await exported(page, context);
  const s = sl.stakeholders.find((x: Json) => x.name === 'Ana Costa');
  expect(s).toMatchObject({ kind: 'customer', role: 'Head of Procurement, Ascent Lifts', start: { trust: 40 } });
  expect(s.interactions.map((x: Json) => [x.type, x.kind])).toEqual([['meet', 'live'], ['negotiate', 'static'], ['email', 'live']]);
  const trade = s.interactions.find((x: Json) => x.type === 'negotiate').options[1];
  expect(trade).toMatchObject({ label: 'Trade a later date for the extra feature', effect: { trust: 5, needs: { trust: 55 } } });
  const ev = sl.events.find((x: Json) => x.title === 'Ana asks to meet about the delays');
  expect(ev).toMatchObject({ stakeholder: s.key, request: { kind: 'meeting', interaction: 'meet', within: 2 } });
});

test('removing a stakeholder an event comes from asks first, and the event stops coming from them', async ({ page }) => {
  await workspace(page, 'Team');
  const section = page.getByRole('region', { name: 'Stakeholders outside the team' });
  await section.getByRole('button', { name: 'Add a stakeholder' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Helen Brandt' });
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Events/i }).click();
  await page.getByRole('button', { name: 'Add an event' }).click();
  await page.getByRole('group', { name: 'Stakeholders' }).getByRole('combobox', { name: 'Comes from' }).selectOption({ label: 'Helen Brandt, Chief Financial Officer' });
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Team/i }).click();
  await section.getByRole('button', { name: 'Remove Helen Brandt' }).click();
  const alert = section.getByRole('alert');
  await expect(alert).toContainText('New event refers to Helen Brandt');
  await alert.getByRole('button', { name: 'Remove Helen' }).click();
  await expect(section.getByRole('list', { name: 'Stakeholders' })).toHaveCount(0);
  // With no stakeholders left, the event has no stakeholder part at all.
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Events/i }).click();
  await page.getByRole('button', { name: /^New event/ }).first().click();
  await expect(page.getByRole('group', { name: 'Stakeholders' })).toHaveCount(0);
});
