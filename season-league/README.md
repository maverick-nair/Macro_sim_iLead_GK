# The Client Majlis: Season League (v1 prototype)

A self-running squad game for SAB's Global Payments Solutions client managers. A squad of 4 to 5 players shares one access code and one tablet, and runs one fictional corporate client, Gulf Horizon Trading, across a season of three matchdays, a gap week and a final. Rounds unlock, run, inject, score and advance on their own. AI characters play the client.

Built from the Season League PRD (2 Nov 2026). This is a separate product from GenieKreator: it has its own npm project and does not use the `@gk/*` packages.

## Run it

Node 20 or later.

```bash
cd season-league
npm install
cp .env.example .env
npm run dev
```

- Game: http://localhost:5173 (squad code `DEMO3`)
- Shared room screen: http://localhost:5173/screen (1920 by 1080 broadcast, no controls)
- API server: http://localhost:8787 (Vite proxies `/api` to it)

Other scripts:

| Script                     | What it does                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `npm test`                 | Engine tests (consequence model, triggers, round loop, rubric rules, league, content file) |
| `npm run typecheck`        | TypeScript strict check                                                                    |
| `npm run build`            | Typecheck and production build to `dist/`                                                  |
| `npm start`                | Serves the built game and the API from one server                                          |
| `npm run import-content`   | Imports `content/Simulation_Workbook.xlsx` into `content/*.json` and validates it          |
| `npm run validate-content` | Validates `content/*.json` and prints the report                                           |

`node scripts/playthrough.mjs [outDir]` plays Round 2 in Chromium from check-in to the league table (with `npm run dev` running), screenshots every scene, fails if any scene scrolls, and runs axe on each scene. It needs Playwright installed (globally is fine, with `NODE_PATH=$(npm root -g)`).

## Environment variables

| Variable            | Default            | Meaning                                                                                                                 |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | empty              | Anthropic API key. Without it the game runs in mock mode.                                                               |
| `AI_MODEL`          | empty              | Claude model id. Required for live mode; there is no default in code.                                                   |
| `AI_EFFORT_CHAT`    | `low`              | Effort for character replies (kept low for the 3 second reply target). `none` omits the setting for older models.       |
| `AI_EFFORT_SCORE`   | `medium`           | Effort for the rubric scorer and the Trust Meter.                                                                       |
| `PORT`              | `8787`             | API server port.                                                                                                        |
| `DEMO_MODE`         | `true`             | Shows the "Unlock now" switch on check-in so a matchday can start before its scheduled time. Set `false` for real play. |

Keys stay on the server. The browser only talks to `/api`.

## Demo mode and mock mode

- **Mock mode** (no key, or no model): characters reply from a script and the scorers return fixed sample scores (plan 4, 3, 4, 4; Trust Meter 7 on every behavior). The score bug shows a "Demo AI" badge. If the server cannot be reached at all, the game falls back to the same mock so play never stops.
- **Demo mode** (`DEMO_MODE=true`): the check-in scene shows "Unlock now", which opens every matchday regardless of `content/schedule.json`. The four bot squads in `content/squads.json` carry fixed results so the league moves; they are labelled "Demo squad" everywhere.

## Content

No case content is in the code. Everything loads from `/content` and is validated with Zod at start-up and by the scripts.

| File                       | Holds                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `rounds.json`              | The nine rounds. Only Round 2 is loaded in the seed; the others show as "Content not loaded" tiles.  |
| `consequence.json`         | Start values, caps, points per round, the +5, 0, minus 5 display                                     |
| `league.json`              | League categories and v3.1 weights (must sum to 100)                                                 |
| `rubric.json`              | Four rubric lines, tie-break gap, the control bypass zero rule and which rounds it applies to        |
| `trust-meter.json`         | Trust Meter behaviors (seed values until the workbook is loaded)                                     |
| `schedule.json`            | Matchday unlock times in KSA time and the self-running timers                                        |
| `squads.json`              | Squads, codes, colours, roles, demo bot results                                                      |
| `characters/*.json`        | One file per AI character. Nadia has a full brief; the others are marked "brief not loaded".        |

### Importing workbook v1.1

Put the workbook at `content/Simulation_Workbook.xlsx` and run `npm run import-content`. The importer reads the Page content, Consequence model, Ticket register and Trust Meter sheets, keeps the other sheets as raw JSON in `content/raw/`, writes `content/rounds.json` with `meta.source: "workbook"`, and prints a validation report (9 rounds, 3 options each, ticket ids in the register, weights summing to 100).

The column names in `scripts/import-content.ts` are best guesses until we see the real file. If a header differs, add it to the `COLUMNS` aliases. Once `meta.source` is `workbook`, the two worked examples in `test/engine.test.ts` run automatically (they are skipped on seed content).

## How it is built

- `src/engine/`: the locked rules, pure TypeScript with no clock, network or UI. Consequence model, carry-forward triggers, the round state machine, rubric pass rules and the league.
- `src/store/game.ts`: Zustand store. Owns the clock, runs the state machine every second, fires AI calls when a phase starts, saves after every change, syncs results.
- `src/store/storage.ts`: squad state in localStorage behind a `SquadStorage` interface, so a server store can replace it.
- `src/scenes/`: one component per scene. `src/screen/`: the shared room screen.
- `server/`: Express. Proxies AI calls through the official Anthropic SDK, validates every AI output with Zod and retries once, holds squad results for the league and the shared screen, writes an audit log in KSA time to `server/data/audit.log`.
- `prompts/<task>/v1.md`: versioned prompts for the character, the rubric scorer and the Trust Meter.

AI judges and writes words. Numbers that move the client dashboard come only from the consequence matrix. The rubric scorer's line scores feed the plan score through the rules in `src/engine/rubric.ts` (two passes, a third when a line differs by more than 2, median of three, zero for a control bypass).

See `docs/progress.md` for what v1 covers and what is still to build, and `docs/decisions.md` for the assumptions made where the PRD is silent.
