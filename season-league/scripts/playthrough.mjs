/**
 * Plays Round 2 as Squad 3 from check-in to the league table in a real browser, screenshots every
 * scene, checks that no scene scrolls, and runs axe on each scene.
 * Usage: npm run dev (in another terminal), then node scripts/playthrough.mjs [outDir] [baseUrl]
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
// Playwright is resolved with require so a globally installed copy works (NODE_PATH).

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const out = process.argv[2] ?? "screenshots";
const base = process.argv[3] ?? "http://localhost:5173";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1194, height: 834 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
const problems = [];

async function scene(name) {
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${out}/${name}.png` });
  const scroll = await page.evaluate(() => {
    const el = document.scrollingElement;
    return { sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth };
  });
  if (scroll.sh > scroll.ch || scroll.sw > scroll.cw)
    problems.push(`${name}: page scrolls ${JSON.stringify(scroll)}`);
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.target,
    }));
  });
  const serious = result.filter((v) => v.impact === "serious" || v.impact === "critical");
  for (const v of serious)
    problems.push(`${name}: axe ${v.impact} ${v.id} (${v.nodes}) ${JSON.stringify(v.sample)}`);
  console.log(`scene ${name}: ${serious.length} serious axe issues, ${result.length - serious.length} minor`);
}

await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await scene("01-code");
await page.getByLabel("Unlock now (demo mode)").check();
await page.getByLabel("Squad code").fill("DEMO3");
await page.getByRole("button", { name: "Enter the stadium" }).click();

const names = [
  ["Amal", "KAM"],
  ["Badr", "SAM"],
  ["Dana", "CSM"],
  ["Fahad", "Connectivity lead"],
];
for (const [i, [n]] of names.entries()) await page.getByLabel(`Player ${i + 1} name`).fill(n);
await scene("02-roster");
await page.getByRole("button", { name: "Confirm the squad" }).click();
await scene("03-lobby");
await page.getByRole("button", { name: "Kick off" }).click();
await scene("04-briefing");
await page.getByRole("button", { name: "Open the plan board" }).click();

const boxes = page.locator(".heading-box textarea");
await boxes.nth(0).fill("Upload payroll through HSBCnet with dual authorization. H2H stays in test.");
await boxes.nth(1).fill("Fix field length and character set errors in the H2H file mapping.");
await boxes.nth(2).fill("Register the two missing signatories, then UAT sign-off before any live H2H file.");
await boxes.nth(3).fill("Daily update to Nadia at 10:00 until payroll is paid.");
for (const [action, owner, due] of [
  ["Register the two missing signatories", "CSM", "24th"],
  ["Confirm cut-off and channel to Priya", "Connectivity lead", "24th"],
]) {
  await page.getByRole("button", { name: "Add an action" }).click();
  const row = page.locator(".action-row").last();
  await row.locator("input").fill(action);
  await row.getByRole("radio", { name: owner }).click();
  await row.getByRole("radio", { name: due }).click();
}
await page
  .locator(".client-message textarea")
  .fill(
    "Payroll for the 28th runs through HSBCnet upload with dual authorization. Dana will confirm the cut-off to you by the 24th.",
  );
await page.getByRole("radio", { name: /Controlled interim/ }).click();
await scene("05-gameplan");
await page.getByRole("button", { name: "Lock the play" }).click();
await scene("06-locked-in");
await page.getByRole("button", { name: "Take the call" }).click({ timeout: 15000 });
await page.locator(".line-character").first().waitFor({ timeout: 20000 });
await scene("07-on-air");
const say = async (who, text) => {
  const before = await page.locator(".line-character:not(.pending)").count();
  await page.getByRole("radio", { name: who, exact: true }).click();
  await page.locator("#talk").fill(text);
  await page.getByRole("button", { name: "Say it" }).click();
  await page.waitForFunction(
    (n) => document.querySelectorAll(".line-character:not(.pending)").length > n,
    before,
    { timeout: 30000 },
  );
};
await say(
  "Fahad",
  "Payroll on the 28th runs through HSBCnet upload with dual authorization, not host-to-host. The cut-off is 14:00 on the 27th.",
);
await say(
  "Dana",
  "I will own it. I will confirm the two missing signatories are registered by the 24th and send you a written update every day at 10:00.",
);
await scene("08-on-air-talk");
await page.getByRole("button", { name: "End the call" }).click();
await page.getByText("Key moment").waitFor({ timeout: 60000 });
await scene("09-full-time");
await page.getByRole("button", { name: "Challenge a score" }).click();
await page.getByRole("button", { name: "Plan quality" }).click();
await page.getByText("Challenge settled").waitFor({ timeout: 60000 });
await scene("10-challenge");
await page.getByRole("button", { name: "To the league table" }).click();
await scene("11-league");
await page.getByRole("button", { name: "Back to the lobby" }).click();
await scene("12-lobby-after");

const screen = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await screen.goto(`${base}/screen`);
await screen.waitForTimeout(1500);
await screen.screenshot({ path: `${out}/13-shared-screen.png` });

await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("\nRound 2 played from check-in to the league table. No scene scrolls. No serious axe issues.");
