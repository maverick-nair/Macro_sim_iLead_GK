# iLead 2.0 participant app: handoff to the server and GenieKreator teams

This is the M8 handoff (DECISIONS D78), kept current since (D79 to D153). It says what the app is, what it expects from a server, and how to run, test and release it. The root `HANDOFF.md` only points here.

Sources of truth, in order: the code's Zod schemas (generated into `docs/schemas/*.json`, see below), `docs/SIMULATION.md` (the rules), `docs/DECISIONS.md` (every conflict and choice), `docs/SPEECH.md` (voice and streamed text), and the GenieKreator docs in `docs/genie/`.

## 1. Architecture

```
Browser (this repo, Vite + React 19 + TypeScript strict)
  src/app, src/components, src/screens     UI: renders engine payloads, sends intents, never computes outcomes
  src/engine/contract.ts                    Engine contract (Zod): EngineView, Intent, IntentResult, StreamChunk
  src/engine/client.ts                      EngineClient: HTTP adapter or the in-browser mock engine (lazy)
  src/api                                   IleadApi: the app shell's other calls (HTTP adapter or mock)
  src/speech, src/ai                        Voice capture with server transcription; streamed AI text (SSE)
  src/theme                                 Runtime client theme loader (GenieKreator theme JSON)
  src/author                                /author: GenieKreator's authoring tool, chat, workspace and library (lazy, D105)
  src/author/calibrate                      GenieKreator's synthetic player calibration: CalibrateSlot (lazy, engine in a Web Worker)
  src/group                                 /group: the organization's group report (lazy)

Server (built: server/, docs/SERVER.md, D81; the base paths of .env.server)
  Engine        /engine/sessions/{session}/view, /intents, /interactions/.../stream   (VITE_ILEAD_ENGINE_URL=/engine)
  App API       /api/profile, /theme, /history, /report.pdf, /report/email, /cohort/...  (VITE_ILEAD_API_URL=/api)
  Speech        /speech/transcriptions...                                             (VITE_ILEAD_SPEECH_URL=/speech)
  GenieKreator  /genie/author/turn, /genie/author/draft, /genie/author/edit, /genie/calibrations          (VITE_GENIE_URL=/genie)
  Sign in       /launch?token=<signed launch link>, /auth/me, /auth/logout
  Operations    /healthz, /readyz, /openapi.json
```

**The server is built** (D81, `docs/SERVER.md`): `server/` runs this engine authoritatively, persists every run as a seed and an event log (SQLite by default, Postgres with `DATABASE_URL`), serves every endpoint below, signs participants in from a launch link the LMS or GenieKreator signs, renders report PDFs with headless Chromium, emails them over SMTP and loads the AI from `ai/` (D82). What an engineer configures is in section 11.

**Rule 1: the engine is authoritative.** The UI renders engine state and sends intents (set styles, plan an action, take a turn, end the week). Every number, reason, outcome, badge, star and report value comes from the engine. The simulation itself is plain TypeScript in `src/engine/sim` (no DOM), so the server can run the same code: the mock engine in the browser is that code against a storyline fixture. What differs on the server is the AI: the evaluator (`src/engine/sim/evaluator.ts`, an `Evaluator`) and the NPC's words (`src/engine/sim/live.ts`, an `NpcModel`) are model calls there; the mock uses transparent keyword rules and persona lines.

**Every payload is parsed at the boundary** with the Zod schemas, for the real server and the mock alike. Parsing also applies the copy rules (`src/i18n/copy.ts`: no dashes as punctuation, no emoji, "skills" not "competency") to engine and AI text. A payload that does not parse is an `EngineError` with code `badPayload`.

**Engine copy is message codes** (D83). Every sentence the engine writes (headlines, reasons, rules, outcome lines, badge reasons, week end banners, report findings) is sent as `{ code: 'engine.*', params }` (`src/engine/copy.ts`); the contract's `Text` words it on the client from the ICU catalog (`src/i18n/messages/<locale>/engine.json`) in the participant's language, so components still receive strings. Parameters may nest: messages, lists (`{ list, conj }`), money (`{ money, currency, locale, display }`, formatted in the participant's locale) and authored templates (`{ template, params }`). Authored storyline copy (events, emails, persona lines, report narratives) stays a plain string in the storyline's language (`StorylineConfig.locale`). The language comes from the launch: `?locale=es` (a Spanish skeleton ships, every other key falls back to English one by one), `en-XA` and `ar-XB` are pseudo locales for overflow and right to left testing. Server side code that needs plain text uses `wordEnglish` (`src/i18n/engineCopyEn.ts`).

**Bundle.** The participant's first load is held under 250 KB of gzipped JS (D79) (`scripts/budget.ts`, run by `npm run build`; it counts preloaded chunks too). The mock engine, the live screen, the reports, the group report, the author chat, the theme loader and the galleries are lazy chunks; the engine contract (Zod) and the engine's copy load beside the first view, preloaded, out of the first load's code (D87).

**Devices.** Laptops, desktops and tablets (D69): 1440 is the design, 1024 to 1279 folds the Actions panel, 744 to 1023 in portrait uses the tablet layouts (D73). Narrower than 744 shows a notice. Chrome, Edge 123+, Firefox 120+, Safari 17.5+ (native `light-dark()`, D21).

## 2. The engine contract

Schema: `src/engine/contract.ts`. JSON Schemas: `docs/schemas/engine-view.json`, `engine-intent.json`, `engine-intent-result.json`, `engine-stream-chunk.json`. The client is `createHttpClient(baseUrl, sessionId)` in `src/engine/client.ts`; the session id is the participant id from the launch link (`?participant=`).

| Method and path | Request | Response |
|---|---|---|
| `GET {engine}/sessions/{session}/view` | none | `EngineView` |
| `POST {engine}/sessions/{session}/intents` | `Intent` (JSON) | `IntentResult`: `{ view, changes, outcome?, interactionId?, summary?, turn?, hint? }` |
| `GET {engine}/sessions/{session}/interactions/{interaction}/turns/{turn}/stream` | `Accept: text/event-stream` | Server sent events, one `StreamChunk` JSON per `data:` event: `{type:'token',text}`, then `{type:'done',turnId}` or `{type:'error',retryable}` |
| `GET {engine}/sessions/{session}/demo/view` | none | `EngineView` of the demo round (D92): its own engine, fixed seed, in memory |
| `POST {engine}/sessions/{session}/demo/intents` | `Intent`: `confirmStyles`, `openProfile`, `planAction` (instant actions only), `clearOutcome`, `dismissCard` | `IntentResult`; anything else is 409 `notInDemo` |
| `DELETE {engine}/sessions/{session}/demo` | none | 204: the demo ends; the real run was never touched |

- Requests carry the session cookie (`credentials: 'include'`); the server identifies the participant from the launch.
- **Errors:** a non 2xx answer with `{ "message": string, "code": string }`. `code` is stable and the UI words it from the catalog (for example `unknownStyle`, `refused`, `liveCap`); 5xx is treated as retryable, a network failure as `network` (retryable). The UI keeps what the participant typed on any failure.
- **Intents** (`Intent`): `confirmStyles`, `openProfile`, `planAction`, `openConversation`, `sendTurn`, `submitInteraction`, `submitPlan` (a written plan's fields, D85), `interruptTurn` (with `shownChars`, how much of the streamed line was on screen), `requestHint`, `nextCandidate`, `chooseCandidate`, `endInteraction`, `abandonInteraction`, `dismissCard`, `clearOutcome`, `endPeriod`, `chooseReward`, `submitReflection`, `startNextPeriod`, `startPractice` and `skipPractice` (the Week 0 practice, D84).
- **Retries and idempotency** (D86): the client keeps intents in order and, while offline or after a network failure, holds them (in local storage, for a server run) and sends them again on reconnect, each with the same `Idempotency-Key` header. The server answers a repeated key with the stored result instead of applying the intent twice (D100; a key is 1 to 200 characters, otherwise 400 `badIdempotencyKey`). 5xx answers are retried three times (1, 3 and 8 seconds), then reported.
- **The first view early** (D87): `index.html` asks for `GET {engine}/sessions/{session}/view` in an inline script before the app's code arrives; a strict CSP needs that script's hash.
- **View additions for the original flow gaps** (D89 to D99): `storyline.video` (welcome video and transcript), `lens.examples` (worked examples), each stage's `about` and `suits`, each action's `cooldown` and `unlockPeriod`, `trends` (each revealed person's result by period), `milestones` (progress milestones reached, D93), `guide` (`tour.enabled`, `demo: { enabled, with, action }`), optional profile `attitude`, `awareness` and `responsibilities`, and the history log's `action` key. All have defaults in the contract, so an older server's view still parses.
- **Consequences that carry forward** (D135 to D142): a new intent, `decide` (`{ type: 'decide', choiceId, option }`, board phase only; an unknown or closed choice is refused). The view adds `variables` (the shown business variables: key, name, format, value, the period's start, range, whether more is better, what it means, the last three causes), `openChoices` (decisions waiting: what is known and the options' labels, never their consequences, with the days left) and `choices` (decisions made or left to their default, with what they changed); an event card that opens a decision carries its `choiceId`. The week end's summary adds `variables`, `choices` and `attrition` (who went off sick or resigned) when the storyline uses them. The report adds `decisions` and `businessVariables` and the `decisions` section. All have defaults, so an older server's payload still parses. The mock plays the Client Trust demo with `?storyline=client-trust`; the server lists `client_trust` as a built in storyline.
- **The view never includes a member's needed style**, the fit table, raw model scores or the lens's source. Members' stats are `null` until the profile is opened (D39).
- **Streaming:** abort the request to stop a line, then send `interruptTurn`. A body that ends without `done` or `error` is read as a retryable error. Details: `src/ai/sse.ts`, `docs/SPEECH.md`.
- **The report's summary** (D143 to D145) adds `profile`, `headline`, `lines` and `drivers` (what drove the results, which also names decisions and business variables that moved, D152), and a reconciled skill carries `reconciled`; all defaulted, so reports stored before still parse.
- **The report** (`EngineView.report`) is null until the run ends, then a `ReportView` (`src/engine/reportContract.ts`, `docs/schemas/report-view.json`). The first load checks only that it is an object; the end screen and the report (both lazy) parse it.

## 3. The app API (proposed endpoints)

Interface: `IleadApi` in `src/api/types.ts`; HTTP adapter `createHttpApi` in `src/api/http.ts` (every path is in that one file). Base: `VITE_ILEAD_API_URL`. JSON in and out, `Authorization: Bearer` when a token getter is given, cookies always. A 404 marked "none" below means "there is none", not an error.

| Call | Method and path | Request | Response |
|---|---|---|---|
| `getProfile` | `GET /profile` | | `{ name: string \| null, cohort: string \| null, exit?: string \| null }`: who launched the run, for the report header; `exit` is the launch's return address for Exit in the menu (D89) |
| `getTheme` | `GET /theme` | | The client theme JSON (`docs/schemas/theme-config.json`), or 404: none (the iLead theme) |
| `reportPdf` | `GET /report.pdf` | `Accept: application/pdf` | The participant's report as a PDF. 404 or 501: no PDF service, the app opens its print view instead |
| `emailReport` | `POST /report/email` | | 204. Emails the report to the participant's work address, once the run has ended |
| `getHistory` | `GET /history` | | `HistoryEntry[]` oldest first, `{ attempt, endedAt, headline, summary: RunSummary }` (`docs/schemas/history.json`), or 404: none |
| `getLeaderboard` | `POST /cohort/leaderboard` | `{ size, anonymous, you: { score, conversions, capability } }` | `{ entries: [{ rank, name \| null, you, score, conversions, capability }], total }`: the top `size`, plus this participant when outside it; ranked by Leadership Score, then conversions, then contextual capability % |
| `getGroupReport` | `GET /cohort/{id}/report` | | `GroupReport` (`docs/schemas/group-report.json`), or 404: no such cohort |
| (alternative) | `POST /cohort/report` | `GroupReportRequest` (`docs/schemas/group-report-request.json`): the run summaries, the storyline and the benchmark | `GroupReport`, for a server that stores only summaries |
| `getSession` | `GET /session` | | `SessionSnapshot` or 404: a fresh run (prototype board and settings) |
| `saveSettings` | `PUT /session/settings` | `Settings`: `{ text, captions, reduced, input, clock, voiceConsent, actionsCollapsed? }` | 204 |
| `getScenario`, `setStyle`, `planAction`, `submitInteraction`, `endWeek` | `GET /scenario`, `PUT /weeks/{w}/styles/{member}`, `POST /weeks/{w}/actions`, `POST /interactions`, `POST /weeks/{w}/end` | | Only the design prototype's fixed board (`?engine=off`) and the review galleries use these; the playable app uses the engine. They can stay unimplemented. |

**Building the group report on the server:** `buildGroupReport(runs, storyline, benchmark, options)` and `summarizeBenchmark(runs)` in `src/engine/report/group.ts` are pure functions of `RunSummary` values (`docs/schemas/run-summary.json`; `Engine.summary()` makes one at any point of a run, so unfinished runs count in the completion rate). Store one `RunSummary` per attempt; store the benchmark as `BenchmarkSummary` (averages and distributions only). Privacy rules: development reports withhold aggregates under `report.group.minimumCohort` (default 5) completed participants and never show names, verdicts or ranks; assessment adds the verdict distribution and a participant table (SIMULATION 8.5, D77).

## 4. Speech and streamed text

Base `VITE_ILEAD_SPEECH_URL`. Chunked uploads, one request at a time, transcript only (no audio kept, no voice or emotion inference): `POST /transcriptions` `{ mimeType, mode, language? }` gives `201 { id }`; `POST /transcriptions/{id}/chunks?seq={n}` raw audio gives `{ results }`; `POST /transcriptions/{id}/end` gives the remaining finals; `DELETE /transcriptions/{id}` cancels. `results` is `[{ kind: 'partial' | 'final', text }]`. Full contract: `docs/SPEECH.md`.

On the server, `createTranscriber(config)` from `ai/` (D82, `docs/AI.md` 7) forwards the chunks to a speech to text service configured by `SPEECH_URL` and `SPEECH_KEY` (vendor neutral, the same chunked contract; a mock without them). NPC replies stream from `createNpcModel(config)`; `docs/AI.md` 2 shows how to wire them to the stream endpoint.

## 5. GenieKreator's authoring tool (/author)

Built to the approved canvas in `docs/design/genie` (D105 to D111): the co-creator chat (typed or voice answers, a live "Your simulation so far", the lens recommendation), First draft ready, the workspace with twelve tabs and Ask Kora, and the library admin page. Routes `/author`, `/author/workspace/<tab>`, `/author/library`; all lazy, light only, laptops and tablets to 834 wide.

- **The draft** is one Zod model (`src/author/model/draft.ts`) kept in local storage (`ilead.author.workspace`) and parsed back on load; a stored draft that does not parse is repaired field by field and the author is told what changed (D124). Every change is a step of undo with a name, and changes that replace or remove work save a named version first (`ilead.author.workspace.versions`, History in the header, D122). Saves happen when the page is hidden or closed too, another tab's change pauses saving until the author picks a version, and full or blocked storage is said in view (D123). `seedDraft` fills it offline from the chat; `toStoryline` turns it into the engine's StorylineConfig (checked with the schema and the copy guard). Provenance marks: AI, You, Edited, Needs you (computed), Suggestion (Kora's dashed ideas).
- **Voice answers** use the participant app's speech client (MediaRecorder and the chunked transcription endpoints served with `createTranscriber` from `ai/`), at `VITE_GENIE_SPEECH_URL` or else `VITE_ILEAD_SPEECH_URL`; without either, an offline mock voice (`src/author/voice.ts`).
- **Ask Kora** turns an instruction into structured changes shown as a diff to apply or discard, never words appended to the content (D125): offline by rules (`src/author/model/intents.ts`), with a server by the model (`POST /author/edit`, D127), which falls back to the rules and says so. **Regenerate** drafts from the draft as it is now and keeps every field the author wrote (D126).
- **Test with synthetic players** renders `CalibrateSlot` from `src/author/calibrate/index.ts` when it exists (props in `src/author/ui/workspace/tabs/Calibrate.tsx`), else a coming soon panel.
- **Every field reaches the storyline** (D128 to D130): events export their timing, response, escalation and lead flow; pacing and days per week move real levers; a character's persona and the Story tab's world go to the AI character (`Person.npc`, `StorylineConfig.world`). Missing references are issues, never retargeted. `src/author/model/export.test.ts` guards it field by field. Not yet: the Brand tab's theme export and the Story tab's visuals (D128). Publishing offline records the version and offers the configuration to download; a server publishes it.

### The drafting endpoints

Base `VITE_GENIE_URL`. Schemas in `src/api/author.ts`; prompts the server must follow in `docs/genie/prompts/author-chat.md` and `leadership-lens.md`. A 404 or 501 falls back to the templates turn by turn.

| Method and path | Request | Response |
|---|---|---|
| `POST /author/turn` | `AuthorTurnRequest`: `{ brief, asked, answers, taken }` | `AuthorTurnResponse`: `{ kind: 'question', brief, question, progress }`, `{ kind: 'clarify', brief, clarify }` (D147) or `{ kind: 'lens', brief, recommendation, framework }`. The brief carries `stakeholders`, `objectives` and `dilemmas` (D146). The app waits 30 seconds; the server reads a turn in 25 (D148) |
| `POST /author/draft` | `AuthorDraftRequest`: `{ brief, leadership_lens }` (the locked Leadership Lens module) | `AuthorDraftResponse`: `{ storyline, preview }`. With dilemmas in the brief, the storyline has decisions seeded from them and business variables from the objectives, worded by the model (`author-draft` version 3, D153). The app waits 120 seconds |
| `POST /author/edit` | `AuthorEditRequest` (`src/api/authorEdit.ts`): `{ instruction, tab, view: { context, fields } }`, the whitelisted fields Kora may change | `AuthorEditResponse`: `{ kind: 'patch', reply, ops: [{ path, value }] }` or `{ kind: 'reply', reply, options }`; the app checks the patch against the draft (D127) and falls back to its rules on 404, 501, 502 or after 30 seconds |

The client checks every draft against the storyline schema and the copy guard (`src/author/copyGuard.ts`) and uses the templates when either fails. JSON Schemas: `docs/schemas/author-*.json`.

**Test with synthetic players** (D112 to D118, `docs/CALIBRATION-SYNTHETIC.md`): `src/author/calibrate` exports `CalibrateSlot` (props: the draft `config`, an optional `apiBase`, `results`, `onResults`, `onAsk`) for the /author workspace's tab, and `calibrationPublishCheck(results, { draft })` for its publish checks. It runs on the server (`POST /genie/calibrations` and friends, an in process job) or, without one, in a Web Worker in the browser; `/author/calibrate` shows it on the bundled draft.

The server implementation is `createAuthorDrafter(config)` in `ai/` (D82, `docs/AI.md`): the model reads answers, uploads and frameworks and writes the draft's copy; the question policy, the lens precedence and the template's mechanics stay rules; every draft passes the schema and the copy guard on the server too, or the templates draft is returned.

## 6. Configuration schemas

| Config | Schema | JSON Schema | Docs |
|---|---|---|---|
| Storyline (GenieKreator's simulation config): money, time, stages, people, thresholds, lens, actions, live settings, events, triggers, gamification, report; optional people dynamics (`dynamics`), business variables (`variables`), and on events conditions (`if`), business effects (`business`) and decisions (`choice`) (D135 to D138) | `StorylineConfig` in `src/engine/config.ts`; `parseStoryline()` | `docs/schemas/storyline-config.json` | SIMULATION 1 to 8 (3.5, 6.6 to 6.8 for the new blocks), `docs/genie/GenieKreator Configuration Spec iLead Simulation.md`. The samples are `src/engine/storylines/sales-elevator.json` and `client-trust.json` (every new block). |
| Leadership lens (inside the storyline) | `Lens` in `src/engine/config.ts`; the library in `src/engine/lensLibrary.ts` | (part of the storyline schema) | D70, D71, `docs/genie/leadership-lens-module.md` |
| Client theme | `ThemeConfigSchema` in `src/theme/schema.ts`; `resolveTheme()` | `docs/schemas/theme-config.json` | README "Themes", D72. Samples: `src/theme/samples/halden.json`, `brightwater.json`. |

A theme can also come inline in the launch page: `<script type="application/json" id="il-launch">{"theme": …}</script>`. It wins over `GET /theme`.

## 7. Report shapes

| Shape | Where | JSON Schema |
|---|---|---|
| `ReportView`: the individual report, purpose aware (development or assessment) | `src/engine/reportContract.ts`, built by `src/engine/report/build.ts` | `docs/schemas/report-view.json` |
| `RunSummary`: one attempt, the unit the history and the group report read | `src/engine/reportContract.ts` (schema), `src/engine/report/summary.ts` (built) | `docs/schemas/run-summary.json` |
| `GroupReport`, `GroupReportRequest`, `BenchmarkSummary` | `src/engine/groupContract.ts`, built by `src/engine/report/group.ts` | `docs/schemas/group-report*.json`, `benchmark-summary.json` |

`npm run schemas` regenerates `docs/schemas/` from the Zod schemas; a unit test (`scripts/schemas.test.ts`) fails when they drift, so the JSON Schemas are always the ones the app parses with. They describe what the server sends (the input side of each schema); transforms such as the copy rules do not show in them.

## 8. Run, test and release

```bash
npm ci
npm run dev                 # http://localhost:5173, the mock engine and mock API
npm test                    # Vitest: engine, contracts, report, theme, components (unit)
npm run typecheck           # tsc -b
npm run lint                # ESLint, 0 warnings
npm run build               # token check, unit tests, typecheck, production build, bundle budget (250 KB initial JS)
npm run storybook:smoke     # every story in four themes, fails on render or console errors
npm run parity              # every design frame against the Claude Design prototype (60 frames)
npm run e2e                 # Playwright on the mock engine, axe on every route (tests/e2e/a11y.spec.ts) and visual baselines
npm run vitals              # Web Vitals budgets on a production build, throttled (section 9)
npm run calibrate -- sales-elevator --check   # a storyline still plays well (exits 1 when a band fails)
npm run calibrate -- client-trust --check     # the consequences demo (D141)
npm run calibrate -- sales-elevator --check --lens six_styles   # the same on the five style test lens (D104)
npm run synthetic -- --check                  # synthetic players at four levels on every bundled storyline (docs/CALIBRATION-SYNTHETIC.md)
npm run benchmark -- --check                  # the cached group report benchmark matches the engine
```

Environment (`.env.example`; unset means the in-browser mock): `VITE_ILEAD_ENGINE_URL`, `VITE_ILEAD_API_URL`, `VITE_ILEAD_SPEECH_URL`, `VITE_GENIE_URL`. Against the server: `.env.server` (relative paths), used by `npm run build:server-app` and `npm run dev:full`.

The server (`docs/SERVER.md`):

```bash
npm run dev:full            # app (Vite --mode server) + server, prints launch links
npm run test:server         # server unit and integration tests
npm run e2e:server          # Playwright against the real server serving the built app
npm run server:mint -- --sub p-1 --name "Ana Ruiz" --cohort spring   # a launch link for testing
docker compose up --build   # the production image
```

**Release.** CI (`.github/workflows/ci.yml`) runs every check above on each push and pull request. A release is `npm run build`: static files in `dist/` (an `index.html` and hashed assets), served from any static host or CDN with gzip or brotli, long cache headers on `/assets/*` and no cache on `index.html`. Every route (`/`, `/group`, `/author` and its `/author/...` paths) is the same `index.html` (SPA fallback). `/author` and `/group` are not for participants; put them behind GenieKreator's and the organization's sign in. The app is meant to move into the GenieKreator monorepo as `apps/participant` with the engine as a shared package (D48).

**Visual baselines** live in `tests/e2e/visual.spec.ts-snapshots`. Refresh only after reviewing the diff: `npx playwright test visual --update-snapshots`. Parity baselines are rendered from the prototype on each run (`.visual-cache/`).

## 9. Budgets

| Budget | Value | Enforced by |
|---|---|---|
| Initial JS (gzipped) | 250 KB (214.6 KB with the new /author, D105; 217.6 KB with the business bar, D136; the decision dialog is lazy) | `npm run build` (`scripts/budget.ts`) |
| LCP | 2.5 s (board and group report 3 s) | `npm run vitals` |
| CLS | 0.1 | `npm run vitals` |
| TBT (stands in for INP) | 300 ms (board 400 ms, D87) | `npm run vitals` |
| INP on the board (a few clicks and keys) | 200 ms | `npm run vitals` |
| Transfer, first load, board and group report | 450 KB | `npm run vitals` |
| Transfer, opening the report | 100 KB | `npm run vitals` |
| WCAG 2.2 AA | axe clean | `npm run e2e` |
| Design parity | 0.05% of a frame | `npm run parity` |

`npm run vitals` measures a production build served by `vite preview` (gzipped, as a CDN would), in Chromium with the CPU 4x slower and a Fast 3G like network (150 ms latency per request, 1.44 Mbps down and 675 Kbps up: Lighthouse's 1.6 Mbps and 750 Kbps at the 90% DevTools applies), 3 runs per page, the median against the budget. The build talks to a stub of the server over the HTTP adapters, running the same engine code in Node, so the numbers are the app's, not the mock engine's.

Measured on 7 Oct 2026 after the new /author (D105; medians of 3; D78, D87, D101 have the numbers before). Initial JS 214.6 KB of 250.

| Page | LCP | CLS | TBT | INP | Transfer |
|---|---|---|---|---|---|
| First load (onboarding) | 2468 ms / 2500 | 0.002 / 0.1 | 241 ms / 300 | | 372 KB / 450 |
| Board | 2868 ms / 3000 | 0 / 0.1 | 336 ms / 400 | 136 ms / 200 | 404 KB / 450 |
| Report, opened from the end screen (click to title painted) | 1075 ms / 2500 | 0 / 0.1 | 168 ms / 300 | | 46 KB / 100 |
| Group report | 2756 ms / 3000 | 0.007 / 0.1 | 240 ms / 300 | | 405 KB / 450 |

The board and group report keep LCP 3 s: at this network the first load's bytes take about 2 s, and the board's largest paint is a portrait after them. Their first renders are split (D87), so TBT is held at 400 ms on the board and 300 ms on the group report.

## 10. Known limits and open items

- **The server is built** (D81, `docs/SERVER.md`); its own limits are in `docs/SERVER.md` section 15 (live model streaming needs a contract change, replay across engine changes, LTI and SSO are a seam, no assessor screen yet). The paths stay in one file per client (`src/api/http.ts`, `src/engine/client.ts`, `src/speech/transcription.ts`, `src/author/drafter.ts`).
- **AI on the server:** built in `ai/` (D82, `docs/AI.md`): `createNpcModel`, `createEvaluator`, `createAuthorDrafter`, `createTranscriber`, with versioned prompts, guardrails, verbatim quote checks, repair and mock fallbacks, and two gates (`npm run ai:calibrate`, `npm run ai:persona-check`) that pass on the mock. To configure: `ANTHROPIC_API_KEY`, `SPEECH_URL`, `SPEECH_KEY`. Not yet done: running both gates against the real model (no key in this repo), the live stream wiring in the server, a websocket speech adapter. The evaluator scores the words only, never the voice (SPEECH.md).
- **Languages** (D83): engine copy is codes the client words; only English and a Spanish skeleton (the HUD, time, settings, inbox, outcome and every engine code) ship. A real language needs its catalog files and storylines authored in it. NPC lines are model output: the mock's persona lines are English only. A turn that opens with engine copy streams its English words from the server (`wordEnglish`), then shows in the participant's language.
- **Contract field names keep British spelling** where they already shipped (`organisation`, `behaviours`, a moment's `behaviour`); the copy shown is US English (D78). Renaming them is a breaking change to agree with the server team.
- **Decisions the product owner can revisit:** D9, D12, D15, D16, D23, D30, D33, D35 and D37 were decided with documented defaults in D88. D61's mic test and resume recap were built in D68. Still open: D19 (what is still missing from the GenieKreator docs) and the visual redesign (D80, on hold).
- **Performance:** the first renders are split and Zod left the first load (D87). The board and the group report reach TBT 300 ms or near it, but not LCP 2.5 s: at the measured network the first load's bytes take about 2 s, and the board's largest paint is a portrait after them. Next steps: React DOM is most of the remaining first load; the view's parse (about 70 ms at 4x CPU) could use a lighter schema. The initial JS budget is 250 KB (D79).
- **Original flow gaps** (D89 to D103): built except Help and Support and Logout (dropped by the product owner) and the org chart (decide with the next storyline). The panels, tours and demo load on demand. Every play screen fits the window at the laptop and tablet sizes in D101 (`tests/e2e/viewport.spec.ts`).
- **Not built:** a design for the interview, the written plan and the Week 0 practice (functional in the shared shell, D52, D84, D85, awaiting the canvas, D80); phones (D69); playing offline (the client holds actions while offline and sends them on reconnect, D86, but the mock engine is the only offline engine).
- **The design prototype** (`?engine=off`, `/screens`, `/states`) stays for parity only; it is not a product surface.
- **Lens styles** (D104): every lens has 4 or 5 styles; Six Leadership Styles plays five (Drive merges Pacesetting and Commanding) and keeps its library title, which the product owner may rename. Authors rename styles per lens; report lines name a style with `{style}`.
- **Consequences** (D135 to D142, D152, D153): the run summary and the group report do not carry choices or business variables yet; decisions seeded from a brief's dilemmas are not seeded again when the author edits the dilemmas in the Brief tab; /author does not edit business effects on actions, counters, or an ignored decision's consequence without a default (the engine plays all three).
- **/author** (D105 to D111, D128 to D130): offline it drafts with rules and templates; the model drafter, Kora on the model, PDF reading, the persona check on publish and publishing itself are the server's. What the export does not carry yet (the theme, the Story tab's visuals) is in section 5. The calibration tab's feature lands separately (`src/author/calibrate`).

## 11. What the engineer configures (server)

Everything is environment (`.env.example` lists every variable; `docs/SERVER.md` section 8):

1. `NODE_ENV=production`, `PUBLIC_URL` (the participants' address) and `LAUNCH_SECRET` (32+ random characters, shared with the LMS / GenieKreator, which sign launch links with it: claims in `docs/SERVER.md` section 4).
2. Storage: `DATABASE_URL` for Postgres (several instances), or a persistent volume for SQLite at `SQLITE_PATH`. Backups: section 11 there.
3. AI: `ANTHROPIC_API_KEY` (and optionally the tuning variables of `docs/AI.md` section 8). Voice: `SPEECH_URL`, `SPEECH_KEY`. Unset, the mocks run.
4. Email: `SMTP_URL` (or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) and `EMAIL_FROM`.
5. `ADMIN_TOKEN` for operators; `RETENTION_DAYS` for the retention policy; `TRUST_PROXY=true` behind a load balancer; `FRAME_ANCESTORS` and `COOKIE_SAMESITE=None` when an LMS embeds the app in a frame; `CORS_ORIGINS` when the app is on another origin.
6. Deploy the `Dockerfile` (server, app and Chromium in one image) or `docker-compose.yml`; probes on `/healthz` and `/readyz`; publish storylines with `POST /api/admin/storylines`.
