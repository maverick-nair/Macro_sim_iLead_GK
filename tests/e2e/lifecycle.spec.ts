import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { dismissEvents, launch, leave, lmsCalls, lmsData, serveLms, servePlayerFromDist, setStyles, stored, storeSuspend, toResults } from './fixtures/scorm-lms';

/**
 * The full lifecycle in one run (D224): an author edits a draft in GenieKreator (the product's tagline), previews
 * it as a marked test and sees the change, the preview writes nothing a participant's data or reports read; the
 * draft is validated and downloaded as a SCORM package; the package launches in the mock LMS, the participant
 * goes through the four pre-game screens (and sees the same tagline) and plays week 1; completion, pass and the
 * score reach the LMS; later sessions play on (the suspend data, extended by tests/e2e/fixtures/lifecycle-forward.ts)
 * and the participant finishes the last week and opens the report of the run.
 */

const KEY = 'ilead.author.workspace';
/** The participant player, built for this spec on its own (scorm.spec.ts builds dist at the same time). */
let playerOut = '';
test.beforeAll(() => {
  test.setTimeout(300_000);
  playerOut = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-player-'));
  execFileSync('npx', ['tsx', 'scripts/player-build.ts', playerOut], { stdio: 'inherit' });
});
const TAGLINE = 'Quiet lifts for busy towers.';
const VERSION = 'scorm2004';

/** The draft as an author's earlier sessions would leave it: the brief finished, the scoring samples agreed. */
async function seeded(page: Page) {
  await page.goto('/author');
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) ?? '{}').stage === 'workspace', KEY);
  await page.waitForTimeout(500);
  await page.evaluate(key => {
    const d = JSON.parse(localStorage.getItem(key)!);
    d.brief.challenge = 'Deals stall at negotiation and new reps burn out.';
    d.story.product.dealValue = 42000;
    for (const s of d.scoring.samples) s.call = s.scored;
    localStorage.setItem(key, JSON.stringify(d));
  }, KEY);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
}

test('author to participant: edit, preview, validate, package, play in an LMS, report', async ({ page, context, browser }) => {
  test.setTimeout(420_000);
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  // The preview keeps its own tour state (D193); tours stay out of the way as GUIDE_OFF does for participants.
  await context.addInitScript(() => { try { localStorage.setItem('ilead.preview.guide', JSON.stringify({ never: true })); } catch { /* blocked */ } });
  await servePlayerFromDist(page, playerOut);

  // 1. Build: the author shows the product in onboarding and gives it a tagline, in Story and world.
  await seeded(page);
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Story and world/ }).click();
  await page.getByRole('radio', { name: '3D model from the library' }).check({ force: true });
  const portfolio = page.getByRole('region', { name: 'Portfolio scene' });
  await expect(portfolio).toBeVisible();
  await portfolio.getByText('About this section').click();
  await expect(portfolio).toContainText('The product portfolio scene: each product, its line, key specs and photo');
  await portfolio.getByRole('textbox', { name: /^Tagline/ }).fill(TAGLINE);
  await portfolio.getByRole('textbox', { name: /^Kind/ }).fill('Commercial');
  await expect(page.getByText('Saved just now')).toBeVisible({ timeout: 10_000 });
  const draft = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), KEY);
  expect(draft.story.product.tagline).toBe(TAGLINE);
  const product = draft.story.product.name as string;

  // 2. Preview: the latest saved draft, marked as a test, shows the tagline on the products screen.
  const opened = context.waitForEvent('page');
  await page.getByRole('banner').getByRole('button', { name: 'Preview', exact: true }).click();
  const preview = await opened;
  const bar = preview.getByRole('region', { name: 'Preview controls' });
  await expect(bar).toContainText('Preview · test run · nothing is saved to reports');
  await preview.getByRole('button', { name: /^Watch the video message from / }).click({ timeout: 15_000 });
  await preview.getByRole('slider', { name: 'Position in the message' }).press('End');
  await preview.getByRole('button', { name: 'Explore products' }).click();
  await expect(preview.getByRole('heading', { name: product })).toBeVisible();
  await expect(preview.getByText(TAGLINE)).toBeVisible();
  await expect(preview.getByText('Commercial / 01')).toBeVisible();

  // 3. The preview never reaches participant data or reports: no run, queue, settings or history outside its own keys.
  const keys = await preview.evaluate(() => Object.keys(localStorage));
  expect(keys.filter(k => k.startsWith('ilead.') && !k.startsWith('ilead.author.') && !k.startsWith('ilead.preview.') && k !== 'ilead.guide')).toEqual([]);
  await bar.getByRole('button', { name: 'Back to GenieKreator' }).click();
  await preview.close();

  // 4. Validate, then download the SCORM package: the untested draft is stopped as publishing is, until the author
  // chooses to publish without testing. Complete after one week, pass at a Leadership Score of 1.
  await page.goto('/author/workspace/publish');
  const section = page.getByRole('region', { name: 'Download a SCORM package' });
  await section.getByRole('button', { name: 'Download SCORM package' }).click();
  await expect(section.getByRole('alert')).toContainText('1 issue stops the package');
  await page.getByRole('checkbox', { name: 'Publish without testing' }).check();
  await section.getByRole('radio', { name: 'SCORM 2004 (4th edition)' }).check({ force: true });
  await section.getByLabel('Complete when').selectOption('weeks');
  await section.getByLabel(/^How many weeks, out of \d+$/).fill('1');
  await section.getByLabel('Pass when').selectOption('score');
  await section.getByLabel('Pass mark, out of 100').fill('1');
  const download = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Download SCORM package' }).click();
  const zip = await (await download).path();
  await expect(section.getByRole('status')).toContainText(/^SCORM 2004 \(4th edition\) package downloaded: /);
  expect(pageErrors).toEqual([]);

  const files = unzipSync(new Uint8Array(fs.readFileSync(zip)));
  const info = JSON.parse(Buffer.from(files['ilead-package.json']).toString('utf8'));
  expect(info.settings).toMatchObject({ version: VERSION, completion: { kind: 'weeks', weeks: 1 }, pass: { kind: 'score', min: 1 } });
  const storyline = JSON.parse(Buffer.from(files['storyline.json']).toString('utf8'));
  // The settings are the draft's, exported in the storyline's own LMS block (D184), and the tagline went with it.
  expect(storyline.lms).toMatchObject({ package: VERSION, completion: { rule: 'weeks', periods: 1 }, pass: { rule: 'score', score: 1 } });
  expect(storyline.world.products[0].tagline).toBe(TAGLINE);
  const weeks = storyline.time.period.count as number;

  // 5. The participant, in the LMS: a fresh browser, the package launched from the harness.
  const learner = await browser.newPage();
  const watch = await serveLms(learner, () => files);
  const sco = learner.frameLocator('#sco');
  await launch(learner, VERSION);
  await learner.evaluate(() => (window as unknown as { lms: { reset(): void } }).lms.reset());

  // The four pre-game screens: landing, the sponsor's message, the products (with the author's tagline), the objectives.
  await sco.getByRole('button', { name: /^Watch the video message from / }).click({ timeout: 30_000 });
  await expect(sco.getByRole('heading', { level: 1, name: /^A message from / })).toBeAttached();
  await sco.getByRole('slider', { name: 'Position in the message' }).press('End');
  await sco.getByRole('button', { name: 'Explore products' }).click();
  await expect(sco.getByText(TAGLINE)).toBeVisible();
  await sco.getByRole('button', { name: 'See your objectives' }).click();
  await expect(sco.getByRole('heading', { level: 1, name: /to lead your team/ })).toBeVisible();
  await sco.getByRole('button', { name: 'Start simulation' }).click({ timeout: 10_000 });

  // Week 1, played: styles set, the week ended.
  await setStyles(sco);
  await sco.getByRole('button', { name: /End week/ }).click();
  await dismissEvents(sco);
  await expect(sco.getByText('End of week 1')).toBeVisible();

  // Completion, pass and the score reached the LMS after the one week the author asked for.
  let data = await lmsData(learner);
  expect(data['cmi.completion_status']).toBe('completed');
  expect(data['cmi.success_status']).toBe('passed');
  expect(Number(data['cmi.score.raw'])).toBeGreaterThan(0);
  expect(Number(data['cmi.score.scaled'])).toBeCloseTo(Number(data['cmi.score.raw']) / 100, 4);
  expect((await lmsCalls(learner)).filter(c => c.fn.endsWith('SetValue') && c.result !== 'true')).toEqual([]);
  await leave(learner);

  // Later sessions: the weeks between, as the LMS's suspend data keeps them.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-'));
  fs.writeFileSync(path.join(tmp, 'storyline.json'), Buffer.from(files['storyline.json']));
  fs.writeFileSync(path.join(tmp, 'suspend.txt'), (await stored(learner, VERSION))['cmi.suspend_data']);
  execFileSync('npx', ['tsx', 'tests/e2e/fixtures/lifecycle-forward.ts', path.join(tmp, 'storyline.json'), path.join(tmp, 'suspend.txt'), path.join(tmp, 'forward.txt')], { stdio: 'inherit' });
  await storeSuspend(learner, VERSION, fs.readFileSync(path.join(tmp, 'forward.txt'), 'utf8'));

  // The last week, to the end screen, then the report of the run.
  await launch(learner, VERSION);
  await sco.getByRole('button', { name: 'Back to my team' }).click({ timeout: 30_000 });
  await expect(sco.getByRole('heading', { level: 1 })).toHaveText(`Set your leadership styles for week ${weeks}`);
  await setStyles(sco);
  await sco.getByRole('button', { name: /End week/ }).click();
  await dismissEvents(sco);
  await expect(sco.getByText(`End of week ${weeks}`)).toBeVisible();
  await toResults(sco);
  data = await lmsData(learner);
  expect(data['cmi.completion_status']).toBe('completed');
  expect(data['cmi.progress_measure']).toBe('1');
  expect(Number(data['cmi.score.raw'])).toBeGreaterThan(0);
  const finished = await sco.getByRole('heading', { level: 1, name: /^You finished at / }).textContent();
  const tier = /at (\w+)\./.exec(finished ?? '')?.[1];
  expect(tier).toBeTruthy();
  await sco.getByRole('button', { name: 'View my report' }).click();
  // The report of this run: its header, with the tier the run ended on.
  const header = sco.locator('header').filter({ hasText: 'Development report' });
  await expect(header).toBeVisible({ timeout: 30_000 });
  await expect(header.getByText('Tier', { exact: true }).locator('..')).toContainText(tier!);
  await expect(header.getByText('Leadership Score', { exact: true })).toBeVisible();

  expect(watch.missing).toEqual([]);
  expect(watch.errors).toEqual([]);
});
