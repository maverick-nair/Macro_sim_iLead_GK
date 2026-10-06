# iLead 2.0 participant app: handoff to the server and GenieKreator teams

This is the M8 handoff (DECISIONS D78). It says what the app is, what it expects from a server, and how to run, test and release it. The root `HANDOFF.md` is a different file: the Claude Design bundle's notes.

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
  src/author                                /author: GenieKreator's author chat prototype (lazy)
  src/group                                 /group: the organization's group report (lazy)

Server (to build; proposed paths)
  Engine        /sessions/{session}/view, /intents, /interactions/.../stream   (VITE_ILEAD_ENGINE_URL)
  App API       /profile, /theme, /history, /report.pdf, /report/email, /cohort/...  (VITE_ILEAD_API_URL)
  Speech        /transcriptions...                                             (VITE_ILEAD_SPEECH_URL)
  GenieKreator  /author/turn, /author/draft                                    (VITE_GENIE_URL)
```

**Rule 1: the engine is authoritative.** The UI renders engine state and sends intents (set styles, plan an action, take a turn, end the week). Every number, reason, outcome, badge, star and report value comes from the engine. The simulation itself is plain TypeScript in `src/engine/sim` (no DOM), so the server can run the same code: the mock engine in the browser is that code against a storyline fixture. What differs on the server is the AI: the evaluator (`src/engine/sim/evaluator.ts`, an `Evaluator`) and the NPC's words (`src/engine/sim/live.ts`, an `NpcModel`) are model calls there; the mock uses transparent keyword rules and persona lines.

**Every payload is parsed at the boundary** with the Zod schemas, for the real server and the mock alike. Parsing also applies the copy rules (`src/i18n/copy.ts`: no dashes as punctuation, no emoji, "skills" not "competency") to engine and AI text. A payload that does not parse is an `EngineError` with code `badPayload`.

**Bundle.** The participant's first load is held under 200 KB of gzipped JS (`scripts/budget.ts`, run by `npm run build`). The mock engine, the live screen, the reports, the group report, the author chat, the theme loader and the galleries are lazy chunks.

**Devices.** Laptops, desktops and tablets (D69): 1440 is the design, 1024 to 1279 folds the Actions panel, 744 to 1023 in portrait uses the tablet layouts (D73). Narrower than 744 shows a notice. Chrome, Edge 123+, Firefox 120+, Safari 17.5+ (native `light-dark()`, D21).

## 2. The engine contract

Schema: `src/engine/contract.ts`. JSON Schemas: `docs/schemas/engine-view.json`, `engine-intent.json`, `engine-intent-result.json`, `engine-stream-chunk.json`. The client is `createHttpClient(baseUrl, sessionId)` in `src/engine/client.ts`; the session id is the participant id from the launch link (`?participant=`).

| Method and path | Request | Response |
|---|---|---|
| `GET {engine}/sessions/{session}/view` | none | `EngineView` |
| `POST {engine}/sessions/{session}/intents` | `Intent` (JSON) | `IntentResult`: `{ view, changes, outcome?, interactionId?, summary?, turn?, hint? }` |
| `GET {engine}/sessions/{session}/interactions/{interaction}/turns/{turn}/stream` | `Accept: text/event-stream` | Server sent events, one `StreamChunk` JSON per `data:` event: `{type:'token',text}`, then `{type:'done',turnId}` or `{type:'error',retryable}` |

- Requests carry the session cookie (`credentials: 'include'`); the server identifies the participant from the launch.
- **Errors:** a non 2xx answer with `{ "message": string, "code": string }`. `code` is stable and the UI words it from the catalog (for example `unknownStyle`, `refused`, `liveCap`); 5xx is treated as retryable, a network failure as `network` (retryable). The UI keeps what the participant typed on any failure.
- **Intents** (`Intent`): `confirmStyles`, `openProfile`, `planAction`, `openConversation`, `sendTurn`, `submitInteraction`, `interruptTurn` (with `shownChars`, how much of the streamed line was on screen), `requestHint`, `nextCandidate`, `chooseCandidate`, `endInteraction`, `abandonInteraction`, `dismissCard`, `clearOutcome`, `endPeriod`, `chooseReward`, `submitReflection`, `startNextPeriod`.
- **The view never includes a member's needed style**, the fit table, raw model scores or the lens's source. Members' stats are `null` until the profile is opened (D39).
- **Streaming:** abort the request to stop a line, then send `interruptTurn`. A body that ends without `done` or `error` is read as a retryable error. Details: `src/ai/sse.ts`, `docs/SPEECH.md`.
- **The report** (`EngineView.report`) is null until the run ends, then a `ReportView` (`src/engine/reportContract.ts`, `docs/schemas/report-view.json`). The first load checks only that it is an object; the end screen and the report (both lazy) parse it.

## 3. The app API (proposed endpoints)

Interface: `IleadApi` in `src/api/types.ts`; HTTP adapter `createHttpApi` in `src/api/http.ts` (every path is in that one file). Base: `VITE_ILEAD_API_URL`. JSON in and out, `Authorization: Bearer` when a token getter is given, cookies always. A 404 marked "none" below means "there is none", not an error.

| Call | Method and path | Request | Response |
|---|---|---|---|
| `getProfile` | `GET /profile` | | `{ name: string \| null, cohort: string \| null }`: who launched the run, for the report header |
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

## 5. The author chat (GenieKreator)

Base `VITE_GENIE_URL`. Schemas in `src/api/author.ts`; prompts the server must follow in `docs/genie/prompts/author-chat.md` and `leadership-lens.md`. A 404 or 501 falls back to the templates turn by turn.

| Method and path | Request | Response |
|---|---|---|
| `POST /author/turn` | `AuthorTurnRequest`: `{ brief, asked, answers }` | `AuthorTurnResponse`: `{ kind: 'question', brief, question, progress }` or `{ kind: 'lens', brief, recommendation, framework }` |
| `POST /author/draft` | `AuthorDraftRequest`: `{ brief, leadership_lens }` (the locked Leadership Lens module) | `AuthorDraftResponse`: `{ storyline, preview }` |

The client checks every draft against the storyline schema and the copy guard (`src/author/copyGuard.ts`) and uses the templates when either fails. JSON Schemas: `docs/schemas/author-*.json`.

## 6. Configuration schemas

| Config | Schema | JSON Schema | Docs |
|---|---|---|---|
| Storyline (GenieKreator's simulation config): money, time, stages, people, thresholds, lens, actions, live settings, events, triggers, gamification, report | `StorylineConfig` in `src/engine/config.ts`; `parseStoryline()` | `docs/schemas/storyline-config.json` | SIMULATION 1 to 8, `docs/genie/GenieKreator Configuration Spec iLead Simulation.md`. The sample is `src/engine/storylines/sales-elevator.json`. |
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
npm run build               # token check, unit tests, typecheck, production build, bundle budget (200 KB initial JS)
npm run storybook:smoke     # every story in four themes, fails on render or console errors
npm run parity              # every design frame against the Claude Design prototype (60 frames)
npm run e2e                 # Playwright on the mock engine, axe on every route (tests/e2e/a11y.spec.ts) and visual baselines
npm run vitals              # Web Vitals budgets on a production build, throttled (section 9)
npm run calibrate -- sales-elevator --check   # a storyline still plays well
npm run benchmark -- --check                  # the cached group report benchmark matches the engine
```

Environment (`.env.example`; unset means the in-browser mock): `VITE_ILEAD_ENGINE_URL`, `VITE_ILEAD_API_URL`, `VITE_ILEAD_SPEECH_URL`, `VITE_GENIE_URL`.

**Release.** CI (`.github/workflows/ci.yml`) runs every check above on each push and pull request. A release is `npm run build`: static files in `dist/` (an `index.html` and hashed assets), served from any static host or CDN with gzip or brotli, long cache headers on `/assets/*` and no cache on `index.html`. Every route (`/`, `/group`, `/author`) is the same `index.html` (SPA fallback). `/author` and `/group` are not for participants; put them behind GenieKreator's and the organization's sign in. The app is meant to move into the GenieKreator monorepo as `apps/participant` with the engine as a shared package (D48).

**Visual baselines** live in `tests/e2e/visual.spec.ts-snapshots`. Refresh only after reviewing the diff: `npx playwright test visual --update-snapshots`. Parity baselines are rendered from the prototype on each run (`.visual-cache/`).

## 9. Budgets

| Budget | Value | Enforced by |
|---|---|---|
| Initial JS (gzipped) | 200 KB | `npm run build` (`scripts/budget.ts`) |
| LCP | 2.5 s (board and group report 3 s) | `npm run vitals` |
| CLS | 0.1 | `npm run vitals` |
| TBT (stands in for INP) | 300 ms (board and group report 600 ms) | `npm run vitals` |
| INP on the board (a few clicks and keys) | 200 ms | `npm run vitals` |
| Transfer, first load, board and group report | 450 KB | `npm run vitals` |
| Transfer, opening the report | 100 KB | `npm run vitals` |
| WCAG 2.2 AA | axe clean | `npm run e2e` |
| Design parity | 0.05% of a frame | `npm run parity` |

`npm run vitals` measures a production build served by `vite preview` (gzipped, as a CDN would), in Chromium with the CPU 4x slower and a Fast 3G like network (150 ms latency per request, 1.44 Mbps down and 675 Kbps up: Lighthouse's 1.6 Mbps and 750 Kbps at the 90% DevTools applies), 3 runs per page, the median against the budget. The build talks to a stub of the server over the HTTP adapters, running the same engine code in Node, so the numbers are the app's, not the mock engine's.

Measured on 6 Oct 2026 (medians of 3; D78 has the numbers before the M8 fixes):

| Page | LCP | CLS | TBT | INP | Transfer |
|---|---|---|---|---|---|
| First load (onboarding) | 2416 ms / 2500 | 0.002 / 0.1 | 219 ms / 300 | | 353 KB / 450 |
| Board | 2856 ms / 3000 | 0 / 0.1 | 504 ms / 600 | 144 ms / 200 | 384 KB / 450 |
| Report, opened from the end screen (click to title painted) | 1181 ms / 2500 | 0 / 0.1 | 217 ms / 300 | | 46 KB / 100 |
| Group report | 2684 ms / 3000 | 0.007 / 0.1 | 523 ms / 600 | | 386 KB / 450 |

The board and group report budgets sit above the usual 2.5 s and 200 ms: compiling the first load's scripts is a 200 to 250 ms task at this CPU, the board's largest paint is a portrait that needs the view first, and both pages render in one long task.

## 10. Known limits and open items

- **The server is not built.** Every endpoint above is a proposal, kept in one file per client (`src/api/http.ts`, `src/engine/client.ts`, `src/speech/transcription.ts`, `src/author/drafter.ts`) so the paths are easy to align.
- **AI on the server:** the evaluator and the NPC model need prompts and guardrails on the server; the mock's heuristics are for demos and tests only. The evaluator scores the words only, never the voice (SPEECH.md).
- **Engine text is English** (D60): headlines, reasons, events and NPC lines come from the engine as strings. A second language needs either server side localization or codes the client words.
- **Contract field names keep British spelling** where they already shipped (`organisation`, `behaviours`, a moment's `behaviour`); the copy shown is US English (D78). Renaming them is a breaking change to agree with the server team.
- **Open decisions** in `docs/DECISIONS.md`: D9 (minus signs, proposed), D12 (HUD week label), D15 (breakpoints, mostly settled by D69 and D73), D16 (Week 0 practice chat, not designed), D23 (the command palette's page behind it), D30, D33, D35, D37 (simulation rules, proposed), D61 (the onboarding mic test is simulated; the resume recap uses fixture data), D19 (what is still missing from the GenieKreator docs).
- **Performance next steps:** split the board's and the group report's first render (each one long task on a slow CPU), and trim the first load's scripts (React DOM, TanStack Query and the Radix dialog are most of it), to bring the board and group report to LCP 2.5 s and TBT 200 ms. The 200 KB initial JS budget has 0.3 KB left.
- **Not built:** interview and written plan formats have no design (built in the shared shell, D52, awaiting design review); phones (D69); offline play.
- **The design prototype** (`?engine=off`, `/screens`, `/states`) stays for parity only; it is not a product surface.
