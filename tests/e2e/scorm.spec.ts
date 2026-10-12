import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import { launch, leave, lmsCalls, lmsData, serveLms, servePlayerFromDist, setStyles, dismissEvents, stored, storeSuspend, toResults, type ScormVersion } from './fixtures/scorm-lms';

/**
 * SCORM packages in a mock LMS (D209). Sales Elevator is packaged as SCORM 1.2 and SCORM 2004 with the player
 * the build makes (tests/e2e/fixtures/scorm-build.ts), unzipped and served under http://lms.test/pkg/ beside
 * the harness page (tests/e2e/fixtures/scorm-harness.html), which offers the LMS API and records every call.
 * Each package launches fresh, then relaunches with seven weeks in its suspend data, plays the last week to
 * the end, and relaunches once more to resume the finished run.
 */
type Fixture = { zip: string; suspend: string; hash: string; skills: number };
let fixtures: Record<ScormVersion, Fixture>;
const packages: Record<string, Record<string, Uint8Array>> = {};

test.beforeAll(async () => {
  test.setTimeout(300_000);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'scorm-e2e-'));
  execFileSync('npx', ['tsx', 'tests/e2e/fixtures/scorm-build.ts', out], { stdio: 'inherit' });
  fixtures = JSON.parse(fs.readFileSync(path.join(out, 'fixtures.json'), 'utf8'));
  for (const [v, f] of Object.entries(fixtures)) packages[v] = unzipSync(new Uint8Array(fs.readFileSync(f.zip)));
});

for (const version of ['scorm12', 'scorm2004'] as const) {
  test(`${version === 'scorm12' ? 'SCORM 1.2' : 'SCORM 2004'}: launch, resume seven weeks in, finish, report to the LMS, resume the finished run`, async ({ page }) => {
    test.setTimeout(180_000);
    const watch = await serveLms(page, () => packages[version]);
    const v12 = version === 'scorm12';
    const sco = page.frameLocator('#sco');

    // A first launch: the pre-game flow's landing (D219), and the LMS hears the run has started.
    await launch(page, version);
    await page.evaluate(() => (window as unknown as { lms: { reset(): void } }).lms.reset());
    await expect(sco.getByRole('heading', { level: 1, name: /^Lead a team of ten through eight weeks that count\.$/ })).toBeVisible({ timeout: 30_000 });
    let data = await lmsData(page);
    expect(data[v12 ? 'cmi.core.lesson_status' : 'cmi.completion_status']).toBe('incomplete');
    expect(data['cmi.suspend_data']).toMatch(/^il1:/);
    expect((await lmsCalls(page)).map(c => c.fn)).toContain(v12 ? 'LMSCommit' : 'Commit');
    await leave(page);
    let kept = await stored(page, version);
    expect(kept[v12 ? 'cmi.core.exit' : 'cmi.exit']).toBe('suspend');
    expect(kept[v12 ? 'cmi.core.session_time' : 'cmi.session_time']).toMatch(v12 ? /^\d{2,4}:\d{2}:\d{2}\.\d{2}$/ : /^PT/);

    // The participant played seven weeks in earlier sessions: the LMS kept them in its suspend data.
    await storeSuspend(page, version, fixtures[version].suspend);
    await launch(page, version);
    await sco.getByRole('button', { name: 'Back to my team' }).click({ timeout: 30_000 });
    await expect(sco.getByRole('heading', { level: 1 })).toHaveText('Set your leadership styles for week 8');
    data = await lmsData(page);
    expect(data[v12 ? 'cmi.core.lesson_location' : 'cmi.location']).toBe('period:8');

    // The last week, to the end screen.
    await setStyles(sco);
    await sco.getByRole('button', { name: /End week/ }).click();
    await dismissEvents(sco);
    await expect(sco.getByText('End of week 8')).toBeVisible();
    await toResults(sco);
    // A package has no email service and no cohort: neither is offered.
    await expect(sco.getByRole('button', { name: 'Email to me' })).toHaveCount(0);

    // Completion, pass or fail, and the Leadership Score out of 100.
    data = await lmsData(page);
    const raw = Number(data[v12 ? 'cmi.core.score.raw' : 'cmi.score.raw']);
    expect(raw).toBeGreaterThan(0);
    expect(raw).toBeLessThan(100);
    expect(data[v12 ? 'cmi.core.score.min' : 'cmi.score.min']).toBe('0');
    expect(data[v12 ? 'cmi.core.score.max' : 'cmi.score.max']).toBe('100');
    if (v12) {
      // 1.2 passes on any score above 0.
      expect(data['cmi.core.lesson_status']).toBe('passed');
    } else {
      // 2004 asks for 100, so the same run fails; one objective per skill, each with the report's score.
      expect(data['cmi.completion_status']).toBe('completed');
      expect(data['cmi.success_status']).toBe('failed');
      expect(Number(data['cmi.score.scaled'])).toBeCloseTo(raw / 100, 4);
      expect(data['cmi.progress_measure']).toBe('1');
      expect(Number(data['cmi.objectives._count'])).toBe(fixtures[version].skills);
      for (let i = 0; i < fixtures[version].skills; i++) {
        expect(data[`cmi.objectives.${i}.id`]).toBeTruthy();
        expect(data[`cmi.objectives.${i}.completion_status`]).toBe('completed');
      }
      // Named by the skill; a skill this run never rated (no conversations were held) has no score yet.
      expect(data['cmi.objectives.0.description']).toBeTruthy();
    }
    const calls = await lmsCalls(page);
    expect(calls.filter(c => c.fn.endsWith('SetValue') && c.result !== 'true')).toEqual([]);
    expect(calls.map(c => c.fn)).toContain(v12 ? 'LMSCommit' : 'Commit');

    // Closed and opened again: the finished run resumes from the suspend data, on its results.
    await leave(page);
    kept = await stored(page, version);
    expect(kept[v12 ? 'cmi.core.lesson_status' : 'cmi.completion_status']).toBe(v12 ? 'passed' : 'completed');
    await launch(page, version);
    // The run opens on its last week end, as it does on the iLead site, and walks on to the results.
    await expect(sco.getByText('End of week 8')).toBeVisible({ timeout: 30_000 });
    await toResults(sco);
    expect(Number((await lmsData(page))[v12 ? 'cmi.core.score.raw' : 'cmi.score.raw'])).toBe(raw);

    expect(watch.missing).toEqual([]);
    expect(watch.errors).toEqual([]);
  });
}

/** GenieKreator's Download SCORM package (D207), on the site's player as the build left it in dist. */
test('GenieKreator: checks the draft first, then downloads the package of the saved draft with the author\'s choices', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await servePlayerFromDist(page);
  await page.goto('/author');
  await page.getByRole('button', { name: 'Skip to the workspace' }).click();
  await expect(page.getByText('Saved just now')).toBeVisible();
  // Let the workspace's own save land, then finish the draft as an author would.
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) ?? '{}').stage === 'workspace', 'ilead.author.workspace');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('ilead.author.workspace')!);
    d.brief.challenge = 'Deals stall at negotiation and new reps burn out.';
    d.story.product.dealValue = 42000;
    for (const s of d.scoring.samples) s.call = s.scored;
    localStorage.setItem('ilead.author.workspace', JSON.stringify(d));
  });
  await page.goto('/author/workspace/publish');
  const section = page.getByRole('region', { name: 'Download a SCORM package' });
  await expect(section.getByText(/^The package is made from your draft as last saved: version 1,/)).toBeVisible();

  // The synthetic test has not run: that blocks the package as it blocks publishing.
  await section.getByRole('button', { name: 'Download SCORM package' }).click();
  await expect(section.getByRole('alert')).toContainText('1 issue stops the package');

  await page.getByRole('checkbox', { name: 'Publish without testing' }).check();
  await section.getByRole('radio', { name: 'SCORM 1.2' }).check({ force: true });
  await section.getByLabel('Pass when').selectOption('score');
  await section.getByLabel('Pass mark, out of 100').fill('65');
  const download = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Download SCORM package' }).click();
  const file = await (await download).path();
  await expect(section.getByRole('status')).toContainText(/^SCORM 1\.2 package downloaded: .+, version 1\. Its fingerprint is [0-9a-f]{12}/);

  const files = unzipSync(new Uint8Array(fs.readFileSync(file)));
  expect(Object.keys(files)).toEqual(expect.arrayContaining(['imsmanifest.xml', 'index.html', 'storyline.json', 'ilead-package.json']));
  const info = JSON.parse(Buffer.from(files['ilead-package.json']).toString('utf8'));
  expect(info).toMatchObject({ version: 1, settings: { version: 'scorm12', pass: { kind: 'score', min: 65 }, completion: { kind: 'finish' }, connected: false } });
  expect(Buffer.from(files['imsmanifest.xml']).toString('utf8')).toContain('<adlcp:masteryscore>65</adlcp:masteryscore>');
  await expect(section.getByRole('status')).toContainText(info.hash.slice(0, 12));
  expect(pageErrors).toEqual([]);
});
