import { expect, test, type Page } from '@playwright/test';

/** The team on the board: ten, or nine from week 8, opened with `period=8`: the mock's fast forward plays seven weeks with
 * no actions, and with people dynamics (D135) Peter's morale stays so low that he resigns. */
const team = (page: Page) => (/[?&]period=8\b/.test(page.url()) ? 9 : 10);

/**
 * Text at 200% (D56): the board's trust ring, the week end, the end screen and the development
 * report at 1440 and 1024 wide. No element's text may run out of its box: for every element that
 * holds text directly, its scroll size must not pass its client size. Screenshots of every step are
 * attached for review (test-results, and the HTML report).
 */

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Settings are per participant; the mock API keeps them in localStorage. 200% text from the start.
  await page.addInitScript(() => {
    localStorage.setItem('ilead.settings.local', JSON.stringify({ text: 200, captions: true, reduced: true, input: 'text', clock: true, voiceConsent: false }));
  });
});
test.afterEach(() => expect(errors).toEqual([]));

/**
 * Elements whose text runs out of their box, as `tag.classes: "text" (+w, +h)`: text that overflows
 * its own box, and boxes whose text content overflows them (a pill, a tile). Overflow that is already
 * there at 100% by design (a badge hanging off a button's corner) is measured with the scale set back
 * to 1 in the same state, and left out.
 */
function overflowing(page: Page, scope: string) {
  return page.evaluate(scope => {
    const measure = () => {
      const out = new Map<string, string>();
      const root = document.querySelector(scope) ?? document.body;
      for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (!(el instanceof HTMLElement) || el.closest('.sr-only')) continue;
        const text = (el.textContent ?? '').trim();
        if (!text) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'inline' || cs.display === 'contents' || cs.display === 'none') continue;
        // Intended scroll areas are not overflow.
        if (['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const w = el.scrollWidth - el.clientWidth;
        // Display type set tight (line height under 1.2) lets glyphs run past its line box by design.
        const size = parseFloat(cs.fontSize), tight = parseFloat(cs.lineHeight) < size * 1.2;
        const rawH = el.scrollHeight - el.clientHeight, h = tight && rawH <= size * 0.25 ? 0 : rawH;
        if (w <= 1 && h <= 1) continue;
        const key = `${el.tagName.toLowerCase()}.${el.className.toString().split(' ').slice(0, 4).join('.')}: "${text.slice(0, 40)}"`;
        out.set(key, `${key} (+${w}w, +${h}h)`);
      }
      return out;
    };
    const large = measure();
    const app = document.querySelector<HTMLElement>('[data-text-large]');
    if (!app) return [...large.values()];
    const scale = app.style.getPropertyValue('--il-text-scale');
    app.style.setProperty('--il-text-scale', '1');
    app.removeAttribute('data-text-large');
    const base = measure();
    app.style.setProperty('--il-text-scale', scale);
    app.setAttribute('data-text-large', '');
    return [...large].filter(([k]) => !base.has(k)).map(([, v]) => v);
  }, scope);
}

async function check(page: Page, name: string, scope = 'main') {
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  const list = await overflowing(page, scope);
  // Kept for review beside the HTML report: test-results/<test>/<name>.png
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
  expect.soft(list, name).toEqual([]);
}

async function setStyles(page: Page) {
  await expect(page.getByRole('radiogroup', { name: /^Leadership style for/ })).toHaveCount(team(page), { timeout: 20000 });
  for (const g of await page.getByRole('radiogroup', { name: /^Leadership style for/ }).all()) await g.getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: 'Review and confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm styles' }).click();
  await expect(page.getByText(/Styles are set for week \d/)).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss outcome' }).click();
  await dismissEvents(page);
}

async function dismissEvents(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  while (await gotIt.count()) {
    const title = await page.getByRole('dialog').getByRole('heading').first().textContent();
    await gotIt.click();
    await expect(page.getByRole('heading', { name: title ?? '' })).toHaveCount(0);
  }
}

for (const width of [1440, 1024]) {
  test(`200% text at ${width}: board, week end, end screen and report`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?start=board&period=8');
    await setStyles(page);

    // The mock opens every profile on the way to a later period, so the trust rings show their numbers.
    await page.waitForTimeout(600);
    await dismissEvents(page);
    await check(page, `board-${width}`);

    await page.getByRole('button', { name: /End week/ }).click();
    await dismissEvents(page);
    await expect(page.getByText('End of week 8')).toBeVisible();
    await check(page, `weekend-banner-${width}`);
    await page.getByRole('button', { name: /^See your week$/ }).click();
    const step = page.getByRole('button', { name: /^(Continue|Nice|See your results)$/ });
    const h1 = page.getByRole('heading', { level: 1, name: /^You finished at (Bronze|Silver|Gold|Platinum)\.$/ });
    for (let i = 0; ; i++) {
      await expect(step.first().or(h1)).toBeVisible();
      if (await h1.count()) break;
      await check(page, `weekend-${i}-${width}`);
      await step.first().click();
    }
    await check(page, `end-${width}`);

    await page.getByRole('button', { name: 'View my report' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { level: 2 }).nth(5)).toBeVisible({ timeout: 20000 });
    await check(page, `report-${width}`);
  });
}
