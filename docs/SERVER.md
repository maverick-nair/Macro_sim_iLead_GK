# The iLead reference server (`server/`)

The server the participant app, the group report and GenieKreator's author chat talk to. It runs the same engine as the app's mock (`src/engine`, imported, not copied), authoritative and persisted, and serves every endpoint the app's HTTP adapters call. An engineer configures it with environment variables and deploys it; nothing in it needs to be written. Decision: D81. The AI behind it is the `ai/` package (D82, `docs/AI.md`).

Contents: 1 Run it locally. 2 Architecture. 3 Endpoints. 4 Launch, sessions and roles. 5 Storage. 6 AI and speech. 7 Report PDF and email. 8 Configuration. 9 Deploy. 10 Operations. 11 Backup and restore. 12 Scaling. 13 Security. 14 Tests. 15 Known limits.

## 1. Run it locally

```bash
npm ci
npm run dev:full          # app on http://localhost:5173 (Vite, --mode server) + server on :8787; prints launch links
```

Open the printed participant link: it signs you in (a cookie) and lands on the app, which now talks to the server. The staff link opens the group report and the author chat. More links: `npm run server:mint -- --sub p-42 --name "Ana Ruiz" --cohort spring`, options in `server/scripts/mint.ts`.

Other commands:

| Command | What |
|---|---|
| `npm run server:dev` | The server alone, restarting on changes (SQLite in `./data`). |
| `npm run server` | The server as production runs it (`node --import tsx server/src/index.ts`). |
| `npm run server:migrate` | Apply database migrations and exit (the server also migrates on start). |
| `npm run build:server-app` | The app built against the server's paths (`.env.server`) into `dist-server/`. |
| `npm run test:server` | Server unit and integration tests (Vitest, in memory SQLite, pg-mem, fake SMTP, Chromium). |
| `npm run e2e:server` | Playwright against the real server serving the built app. |
| `docker compose up --build` | Server and app in the production image on http://localhost:8787. |

## 2. Architecture

```
Browser (the app, built with .env.server: VITE_ILEAD_*_URL = /engine, /api, /speech, /genie)
   │  cookie session                                                    LMS / GenieKreator
   ▼                                                                         │ signed launch link (HS256 JWT)
server/src/app.ts (Hono on @hono/node-server)                                ▼
   middleware: request id, JSON log line, security headers, CORS, gzip, origin check, body limit, session
   routes/launch.ts   /launch, /auth/*                 auth/      launch JWT, sessions, roles, IdentityProvider (LTI/SSO seam)
   routes/engine.ts   /engine/sessions/{id}/...        engine/runs.ts  RunService: one engine per run, LRU cache, per run queue,
                      /engine/runs/{id}/... (assessor)                 event log with recorded model answers, replay
   routes/api.ts      /api/...                         reports.ts      group report, history, leaderboard, benchmarks
   routes/author.ts   /genie/author/*                  report/         PDF (headless Chromium), email (nodemailer)
   routes/speech.ts   /speech/transcriptions/*         ports.ts, ai.ts NpcModel, Evaluator, AuthorDrafter, Transcriber
   routes/admin.ts    /api/admin/*, privacy            store/          Repository: SQLite (node:sqlite) or Postgres (pg), migrations
   routes/ops.ts      /healthz, /readyz, /openapi.json, static app
```

**Framework: Hono.** Chosen over Fastify because it is built on web standard `Request` and `Response` (the same `fetch` types the app's adapters and SSE reader use, so tests call `app.request()` with no socket), has first party SSE streaming, cookies, CORS, secure headers, request ids, compression and HS256 JWT, and is small (no plugin system to learn). Validation and OpenAPI come from one route declaration (`server/src/http/route.ts`) using the app's own Zod schemas, so the document at `/openapi.json` cannot drift from what is enforced.

**TypeScript at runtime.** The server imports `src/` (engine, contracts, report builders, author drafter, theme schema) and loads `ai/` dynamically, all TypeScript. It runs under `tsx` (`node --import tsx`) instead of a bundle, so the shared code is the same files the app builds from and the `ai/` module can be swapped with `AI_MODULE`. Startup compiles in under a second.

**Engine on the server (rule 1, authoritative).** Each run is a seed, a snapshot of the storyline input, and an append only event log: every participant intent (and every assessor review) with the model answers that intent used (`server/src/engine/recorder.ts`). A run's engine lives in an in memory LRU cache (`ENGINE_CACHE_SIZE`); any other instance, or this one after a restart, rebuilds it by replaying the log, answering the model calls from the log instead of asking the model again, so a replay is exact even with a real model. Intents on one run apply strictly one at a time (a per run queue); an intent the engine refuses (409 with its code) or that fails changes nothing (the engine is rebuilt from the log). Across instances the event's sequence number is the guard: a second writer gets 409 `conflict`. Run summaries (`Engine.summary()`) are stored at each period end and at the end, so the group report and benchmarks read stored summaries, never replay runs. A small additive seam in the engine, `Engine.records()`, gives assessor tooling the live conversation records (ids, AI band, words).

## 3. Endpoints

Every path, its schema and its roles are in `/openapi.json` (OpenAPI 3.1, generated). Errors are always `{ message, code }` with a non 2xx status; 5xx means retryable (HANDOFF section 2). The app's adapters and the base paths:

| App adapter | Base (`.env.server`) | Server routes |
|---|---|---|
| `createHttpClient` (src/engine/client.ts) | `VITE_ILEAD_ENGINE_URL=/engine` | `GET /engine/sessions/{session}/view`, `POST .../intents`, `GET .../interactions/{i}/turns/{t}/stream` (SSE) |
| `createHttpApi` (src/api/http.ts) | `VITE_ILEAD_API_URL=/api` | `/api/profile`, `/api/theme`, `/api/history`, `/api/cohort/leaderboard`, `/api/cohort/{id}/report`, `/api/cohort/report`, `/api/report.pdf`, `/api/report/email`, `/api/scenario`, `/api/session`, `/api/session/settings` |
| `createHttpTranscriptionClient` (src/speech/transcription.ts) | `VITE_ILEAD_SPEECH_URL=/speech` | `POST /speech/transcriptions`, `POST .../{id}/chunks?seq=n`, `POST .../{id}/end`, `DELETE .../{id}` |
| `ServerDrafter` (src/author/drafter.ts) | `VITE_GENIE_URL=/genie` | `POST /genie/author/turn`, `POST /genie/author/draft` |

Added by the server (not called by the app today):

| Route | Role | What |
|---|---|---|
| `GET /engine/sessions/{session}/run` | participant | The current run: attempt, status, storyline id and version. |
| `POST /engine/sessions/{session}/runs` | participant | Start a new attempt once the last one ended (also: a launch with `attempt: "new"`). |
| `GET /engine/runs/{runId}`, `GET .../records`, `POST .../review` | assessor | Read a run; list its live conversations; review one (`engine.review`, logged and replayed). |
| `GET /api/admin/cohorts/{id}/runs`, `PUT /api/admin/cohorts/{id}` | cohort admin (assessor reads) | Who played, status, score; a cohort's name, storyline, purpose and theme. |
| `GET/POST /api/admin/storylines`, `GET /api/admin/storylines/{id}` | author | Storyline versions: drafts (also saved by `/genie/author/draft`) and published. Publishing checks the schema and the author copy rules. |
| `PUT /api/admin/themes/{id}` | author, cohort admin | A client theme (`theme-config.json`). |
| `POST /api/admin/benchmarks/refresh`, `GET /api/admin/benchmarks/{lens}` | cohort admin with `*` | Recompute the benchmarks now; read one (`X-Benchmark-Source` says stored or sample). |
| `GET /api/privacy/export`, `DELETE /api/privacy/me` | participant | Their data as JSON; delete it all and sign out. |
| `GET /api/admin/participants/{id}/export`, `DELETE /api/admin/participants/{id}` | cohort admin | The same for a participant in their cohorts (data subject requests). |
| `POST /api/admin/retention/run` | cohort admin with `*` | Apply `RETENTION_DAYS` now (it also runs daily). |
| `GET /launch`, `POST /launch`, `GET /auth/me`, `POST /auth/logout` | | Sign in from a launch link; who am I; sign out. |
| `GET /healthz`, `GET /readyz`, `GET /openapi.json` | public | Liveness, readiness (database), the API document. |

Notes on behaviour:
- **Start and resume.** The first `GET .../view` starts the participant's run of the launch's storyline (or the cohort's, or `DEFAULT_STORYLINE`); later calls resume the latest attempt, in any browser, after any restart. The path's session id must be the signed in participant (403 otherwise).
- **Streaming.** `sendTurn` returns the NPC's turn (its words already decided by the `NpcModel`); the stream endpoint sends those words as `StreamChunk` SSE events at `STREAM_TOKENS_PER_SEC`, then `done`. A turn that is not in the open conversation is 404. This is option 1 of `docs/AI.md` section 2; see 15 for live model streaming.
- **Leaderboard.** Ranks each cohort member's latest attempt from stored scores (score, then conversions, then capability). The caller's own numbers come from their run, not from what the browser sends. Refused (403) in an assessment.
- **Group report.** `GET /api/cohort/{id}/report` builds `buildGroupReport` over each participant's latest attempt (unfinished runs count in the completion rate) with the stored benchmark of the storyline's lens. Development withholds aggregates under `report.group.minimumCohort`; assessment adds verdicts and names (D77).
- **History.** Ended earlier attempts of the same storyline, oldest first, with their stored summary and the report's headline; 404 when there are none.
- **Benchmarks.** `summarizeBenchmark` over every stored run summary of a lens, refreshed every `BENCHMARK_REFRESH_HOURS` (and soon after start) or on demand. A lens with fewer than `BENCHMARK_MIN_RUNS` runs keeps the cached sample (`src/api/samples`).
- **Prototype only.** `PUT /api/weeks/...`, `POST /api/interactions` and friends (the design prototype's fixed board, `?engine=off`) answer 501. `GET /api/scenario` is served because the app shell reads it on load.

## 4. Launch, sessions and roles

**Launch links.** The LMS or GenieKreator signs a short lived HS256 JWT with `LAUNCH_SECRET` and sends the participant to `{PUBLIC_URL}/launch?token=<jwt>` (or POSTs `token` as a form field). Claims (`server/src/auth/principal.ts`, `LaunchClaims`):

| Claim | Required | What |
|---|---|---|
| `sub` | yes | Participant (or staff) id: letters, digits and `. _ : @ \| -`, up to 128. |
| `exp` | yes | Expiry (seconds). A link may live 7 days at most; 15 minutes is the minting default. |
| `aud` | yes | Must equal `LAUNCH_AUDIENCE` (`ilead`). |
| `iss` | when `LAUNCH_ISSUERS` is set | Must be one of them. |
| `name`, `email` | no | For the report header and the report email. |
| `cohort` | no | The participant's cohort (created on first sight). |
| `cohorts` | no | Staff: every cohort they may see; `*` is all. |
| `storyline`, `purpose`, `theme`, `locale` | no | What to play (storyline id; `development` or `assessment` overrides the storyline's), the client theme id, the locale. |
| `roles` | no | `participant` (default), `assessor`, `cohort_admin`, `author`. |
| `attempt` | no | `new` starts a fresh attempt when the last one has been played; `resume` (default). |
| `redirect` | no | A path on this site to land on (never another site). |

Minting in another language is three lines with any JWT library (HS256, the claims above). `server/scripts/mint.ts` is the reference.

**Sessions** are rows in the store named by a random 256 bit id in an HTTP only cookie (`SESSION_COOKIE`, `SameSite` from `COOKIE_SAMESITE`, `Secure` in production), so they can be revoked (logout, privacy deletion) and carry nothing a browser can read. Lifetime `SESSION_TTL_HOURS`. Machine callers can send `Authorization: Bearer <launch JWT>` per request instead; operators send `Authorization: Bearer <ADMIN_TOKEN>` (every role, every cohort).

**Roles.** participant: their own runs, report, history, theme, settings, data. assessor: read runs and review conversations in their cohorts; read the group report. cohort_admin: group reports, cohorts, runs, privacy requests in their cohorts; with `*`, benchmarks and retention. author: the author chat, storylines and themes. The landing after a launch follows the role: the app (participant), `/group?cohort=` (staff), `/author` (author).

**Embedding in an LMS frame.** Set `FRAME_ANCESTORS` to the LMS origin, and `COOKIE_SAMESITE=None` (HTTPS only) when the LMS is on another site.

**LTI 1.3 and SSO later.** `server/src/auth/identity.ts` defines `IdentityProvider { id, mount(app) }`. An LTI 1.3 provider mounts `/lti/login` (OIDC third party login: redirect to the platform with state and nonce), `/lti/launch` (verify the `id_token` with the platform's JWKS, for example `verifyWithJwks` from `hono/jwt`; check `iss`, `aud`, nonce and deployment id) and `/.well-known/jwks.json`, maps the token to `LaunchClaims` (sub, name, email; the context id to `cohort`; a custom parameter to `storyline` and `purpose`; Learner to participant, Instructor to assessor and cohort_admin, ContentDeveloper to author), then calls `sessions.open(c, claims)` and redirects with `landing(claims)`. Staff SSO (OIDC code flow with PKCE) is the same shape at `/sso/login` and `/sso/callback`, mapping IdP groups to roles and cohorts. Everything after the session is unchanged.

## 5. Storage

`Repository` (`server/src/store/repo.ts`) is every read and write the server makes. `SqlRepository` implements it over a small `Db` seam with two adapters and shared SQL: SQLite through Node's built in `node:sqlite` (the default: zero config, no native module, WAL mode, file at `SQLITE_PATH`) and Postgres through `pg` (`DATABASE_URL`). Migrations (`server/src/store/migrations.ts`) are append only, run in a transaction each at startup or with `npm run server:migrate`, and are recorded in `schema_migrations`.

| Table | What |
|---|---|
| `participants` | Id, name, work email, cohort, locale, settings. |
| `cohorts` | Name, storyline, purpose, theme. |
| `runs` | One attempt: participant, cohort, storyline id and version, lens, purpose, the storyline input snapshot, seed, attempt, engine version, status, event count, score, conversions, capability, headline. |
| `run_events` | The event log: `(run_id, seq)` unique, intent or review, payload, the model answers it used. |
| `run_summaries` | The latest `RunSummary` per run, by lens (group report, history, benchmark). |
| `reviews` | Assessor reviews (also in the event log). |
| `storylines` | Every version: draft or published, by whom. |
| `themes` | Client themes. |
| `benchmarks` | `BenchmarkSummary` per lens, with how many runs and when. |
| `email_log` | Every report email: to, template, sent or failed, message id. |
| `sessions` | Cookie sessions. |
| `pdf_cache` | The report PDF per run, keyed by the run's event count. |

**Privacy and retention.** A participant can export and delete their data (`/api/privacy/*`); cohort admins can for their cohorts. Deletion removes the participant, runs, events, summaries, reviews, PDFs, email log and sessions, and drops any engine in memory. `RETENTION_DAYS` deletes runs untouched that long (daily, and on demand); expired sessions are always removed. Benchmarks keep only averages and distributions, never names. Audio is never stored (section 6). Logs carry ids, codes and timings, never what a participant typed or said, and never query strings (launch tokens travel in them).

## 6. AI and speech

Ports (`server/src/ports.ts`): `NpcModel` and `Evaluator` are the engine's own interfaces (`src/engine/sim/live.ts`, `src/engine/sim/evaluator.ts`); `AuthorDrafter` is `turn`/`draft` with the shapes of `src/api/author.ts`; `Transcriber` is `open(options)` giving a session with `chunk(audio, seq)`, `end()`, `cancel()` (a batch `transcribe({ audio, mimeType, language })` also works: the server buffers chunks and transcribes on `end`).

Wiring (`server/src/ai.ts`):
- `AI_PROVIDER=mock` (the default without `ANTHROPIC_API_KEY`): the engine's stand ins (`personaNpc`, `heuristicEvaluator`, the author chat's `MockDrafter`) and a scripted transcriber. `ai/` is not loaded.
- `AI_PROVIDER=anthropic` (the default with a key): the server imports the `ai/` module (`ai/src/index.ts`, or `AI_MODULE`), maps the environment with the module's own `configFromEnv(process.env)` (every tuning variable is in `docs/AI.md` section 8), adds the server's JSON logger and an evaluation audit logger, and calls `createNpcModel`, `createEvaluator`, `createAuthorDrafter`. Per role providers (`AI_PROVIDER_NPC=mock` and so on) still apply.
- Speech: `SPEECH_PROVIDER=http` (the default when `SPEECH_URL` is set) uses the module's `createTranscriber` (the vendor neutral HTTP transcriber, `SPEECH_URL`, `SPEECH_KEY`), whatever the AI provider; `mock` scripts; `off` answers 501.
- A configured provider whose module, factory or method is missing stops the server at startup with a message saying what to set, never a failure in front of a participant. What each factory returns is checked (`reply`, `evaluate`, `turn`, `draft`, `open` or `transcribe`).
- NPC calls get the engine's `NpcContext` plus the scene the AI layer reads: the storyline's locale, organisation and sponsor (`sceneFromStoryline`) and the conversation so far (`history`).
- Every model answer is recorded in the event log (section 2), so replays never call the model, and a model's later change of mind cannot change a stored run.
- Author drafts are checked against the app's schemas before they leave (502 `badModelOutput` otherwise); a draft that parses as a storyline is saved as the next draft version.
- Rate limits: model calls (conversation intents, author chat, new transcriptions) at `RATE_LIMIT_AI_PER_MIN` per caller.

Speech privacy: audio lives in memory for one transcription, is forwarded or buffered and then dropped; it is never stored or logged, and only the transcript is scored (docs/SPEECH.md).

## 7. Report PDF and email

**PDF.** `GET /api/report.pdf` (after the run has ended) renders the app's own print view, `/report/print?participant=<id>` (a lazy route: `src/app/PrintReport.tsx`), in headless Chromium (`playwright-core`): a fresh browser context per render, signed in with a five minute session made for the renderer and deleted afterwards, print media, A4, backgrounds on. The page marks itself `data-print-state="ready"` once the report and history have rendered. The PDF is cached per run version (a reflection or an assessor review renders it again). `PDF_CONCURRENCY` renders at once; `PDF_ENABLED=false` answers 501 and the app opens its print view instead. The renderer loads the app at `APP_URL` (default `PUBLIC_URL`).

**Email.** `POST /api/report/email` sends the PDF to the participant's work address (`email` claim or stored) over SMTP (`SMTP_URL`, or `SMTP_HOST` and friends) from `EMAIL_FROM`. The template (`server/src/report/email.ts`, plain text and HTML) follows the copy rules (no dashes as punctuation, no emojis, "skills"). Every send is logged in `email_log`; at most `RATE_LIMIT_EMAIL_PER_HOUR` per participant. No SMTP: 501. No address: 409 `noEmail`.

## 8. Configuration

Everything is environment, parsed and checked at startup (`server/src/config.ts`; a bad value stops the server with the variable's name). `.env.example` lists every variable with its default; a test fails if one is missing. The ones to set for production:

| Variable | Why |
|---|---|
| `NODE_ENV=production` | Secure cookies; refuses to start without `LAUNCH_SECRET`. |
| `PUBLIC_URL` | The address participants open (launch redirects, the PDF renderer, the origin check). |
| `LAUNCH_SECRET` | Shared with the LMS / GenieKreator, 32+ random characters. Rotate with `LAUNCH_SECRET_PREVIOUS`. |
| `DATABASE_URL` | Postgres for more than one instance (SQLite otherwise, on a persistent volume). |
| `ANTHROPIC_API_KEY` | The models (`docs/AI.md`). Unset: the mocks. |
| `SPEECH_URL`, `SPEECH_KEY` | Voice. Unset: the scripted mock voice. |
| `SMTP_URL` (or `SMTP_HOST`...), `EMAIL_FROM` | The report email. Unset: email off. |
| `ADMIN_TOKEN` | Operator access (benchmarks, retention, any cohort). |
| `FRAME_ANCESTORS`, `COOKIE_SAMESITE` | Only when an LMS embeds the app in a frame. |
| `CORS_ORIGINS` | Only when the app is served from another origin. |
| `TRUST_PROXY=true` | Behind a load balancer. |
| `RETENTION_DAYS` | Your data retention policy. |

**The app.** A production build that talks to the server needs no code change: `npm run build:server-app` builds with `.env.server` (`VITE_ILEAD_ENGINE_URL=/engine`, `VITE_ILEAD_API_URL=/api`, `VITE_ILEAD_SPEECH_URL=/speech`, `VITE_GENIE_URL=/genie`). With relative paths the same build works on any host that serves the app and these prefixes on one origin. To call the server on another origin, build with full URLs in those variables, and set `CORS_ORIGINS` and `COOKIE_SAMESITE=None` on the server. `npm run build` still makes the mock build (`dist/`) for demos and the budget check.

## 9. Deploy

The `Dockerfile` is multi stage: dependencies, the app's server build, then a runtime image with production packages, Chromium and its libraries (for PDFs), the server and `ai/` sources run by tsx, and `dist-server/` served by the server (`STATIC_DIR`). It runs as the `node` user, keeps SQLite in the `/data` volume, exposes 8787 and has a health check.

```bash
docker build -t ilead .
docker run -p 8787:8787 --env-file .env -v ilead-data:/data ilead
docker compose up --build                       # the same, from docker-compose.yml
docker compose --profile postgres up --build    # with Postgres (set DATABASE_URL in .env)
docker compose --profile mail up                # with Mailpit as a fake SMTP inbox (SMTP_URL=smtp://mailpit:1025)
```

**CDN.** Serve `dist-server/` from the CDN (long cache on `/assets/*`, none on `index.html`, every non asset path falls back to `index.html`) and route `/api`, `/engine`, `/speech`, `/genie`, `/launch`, `/auth` to the server on the same origin; unset `STATIC_DIR`. SSE needs the proxy not to buffer `text/event-stream` (the server sends `X-Accel-Buffering: no` and `Cache-Control: no-transform`).

**TLS** terminates at the load balancer; set `TRUST_PROXY=true` and an `https://` `PUBLIC_URL` (HSTS is then sent).

## 10. Operations

- **Logs:** one JSON object per line on stdout: `time`, `level`, `msg`, `service`, `requestId`, and fields (method, path, status, ms, principal for requests). `X-Request-Id` is accepted from the load balancer or made, and returned. `LOG_LEVEL` sets the floor.
- **Health:** `GET /healthz` (the process answers; for liveness probes), `GET /readyz` (the database answers; reports AI provider, PDF, email and speech; for readiness probes and the load balancer).
- **Shutdown:** SIGTERM stops accepting connections, finishes requests, closes the browser, SMTP pool and database (10 s at most).
- **Schedules** (in process, each instance): benchmarks every `BENCHMARK_REFRESH_HOURS`, retention daily, both 15 s after start. With several instances they run on each; both jobs are idempotent.
- **Replay failures** (`replayFailed`, 500) mean an event log no longer replays on this engine build (section 15); the log line names the run and event. The run's data is intact.
- **Storylines:** publish with `POST /api/admin/storylines` (author). Runs keep the storyline snapshot they started with.

## 11. Backup and restore

- **Postgres:** your platform's backups or `pg_dump`. Everything is in the database except the in memory caches.
- **SQLite:** back up the file while the server runs with SQLite's online backup (`backupSqlite(file, dest)` in `server/src/store/sqlite.ts`, or `sqlite3 ilead.sqlite ".backup backup.sqlite"`); copy `-wal` and `-shm` with the file only when the server is stopped.
- **Restore:** put the database back and start the server; engines are rebuilt from the event logs on first request, sessions survive.
- **Moving from SQLite to Postgres:** the schema is the same; export each table and import it in order (participants, cohorts, storylines, themes, runs, then the rest).

## 12. Scaling

- One instance with SQLite carries a pilot (thousands of participants: an intent is a few milliseconds of engine time plus one transaction). Beyond that, or for high availability, use Postgres and several instances.
- Several instances are safe for runs: any instance can serve any run (it replays the log into its cache), and the event sequence number stops two instances writing the same run (the later write answers 409 `conflict` and changes nothing; sticky routing makes it rare). Route by participant (sticky sessions on the session cookie) to keep each run's engine warm in one cache, and route `/speech/*` by session: an open transcription lives in one instance's memory.
- Rate limits are per instance (section 13); put a shared limit at the load balancer or swap `RateLimiter` for a Redis backed one.
- PDF rendering is the heaviest call (a Chromium page, 1 to 3 s). `PDF_CONCURRENCY` caps it per instance; PDFs are cached per run version. A separate PDF worker can take `PdfRenderer` later.
- Model latency dominates conversation turns (`docs/AI.md` section 9); the server holds no lock across runs, only within one.

## 13. Security

- **Auth:** signed launch links (HS256, expiry, audience, optional issuer, a 7 day ceiling, redirects to this site only), server side sessions in HTTP only cookies, role checks on every route, cohort scoping for staff, bearer tokens for machines, a long `ADMIN_TOKEN` compared in constant time.
- **CSRF:** cookies are `SameSite=Lax` by default, and every state changing request that carries an `Origin` must come from `PUBLIC_URL` or `CORS_ORIGINS` (403 `badOrigin`).
- **Input:** every body, query and path parameter is validated with the app's Zod schemas (400 with the issues); bodies are capped (`BODY_LIMIT_KB`, `AUDIO_CHUNK_LIMIT_KB`).
- **Headers:** Content Security Policy (scripts from this site only; styles inline and Google Fonts for client theme fonts; images over https; `frame-ancestors` from `FRAME_ANCESTORS`), `nosniff`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, a Permissions Policy allowing the microphone on this site only, HSTS on https.
- **Rate limits:** model calls, emails and launches per caller.
- **Secrets:** only in the environment (`LAUNCH_SECRET`, `ADMIN_TOKEN`, `ANTHROPIC_API_KEY`, `SPEECH_KEY`, SMTP credentials, `DATABASE_URL`); none in the repo. Rotate the launch secret with `LAUNCH_SECRET_PREVIOUS`.
- **Containers:** the image runs as `node`; Chromium runs without its sandbox inside the container (`--no-sandbox`) and only ever opens this site's print view.
- **Errors** never return internal details; logs never carry participant text or launch tokens.

## 14. Tests

`npm run test:server` (Vitest, `server/test`): launch links (expired, forged, wrong audience, unsigned, too long, rotation, open redirects), sessions and logout, every role on its routes, bearer and admin tokens, the origin check, CORS, rate limits, security headers and validation; the engine (start, refusals change nothing, SSE chunks the app's reader parses, concurrent intents in order, exact replay with a model that never answers the same way twice, resume after a restart on the same database, attempts and history, assessor review surviving replay, launch storyline and purpose); reports (group report parsed by the app's schema, `POST /cohort/report`, leaderboard from stored scores, benchmark refresh, history); PDF caching and email with a fake SMTP server (attachment, log, cap, copy rules); the storage contract on SQLite and Postgres (pg-mem, plus a real Postgres with `TEST_DATABASE_URL`); the AI wiring (the real `ai/` module, per role mocks through the server, a batch transcriber, an HTTP speech service); speech, author, privacy, OpenAPI coverage, configuration and `.env.example` coverage; and the real Chromium renderer.

`npm run e2e:server` (Playwright, `server/e2e`): the app built with `--mode server` and served by the server; a minted launch link, a week played through the UI (styles, a 1:1 whose replies stream over SSE from the server, the outcome, the week end), a reload and a new browser resuming week 2 from the server, the report's print view and its PDF rendered once and then cached, the group report for a cohort admin.

## 15. Known limits

- **Live model streaming.** NPC words stream after the model has written the whole line (option 1 of `docs/AI.md` 2), because the app's contract returns the turn's text in the `sendTurn` result before it asks for the stream. Streaming words as the model writes them needs the contract to return the turn id first (empty text) and the stream endpoint to forward `npc.stream(ctx)`; the engine then takes the `done` reply. It is a contract change for the app and the server together.
- **Replay across engine changes.** A replay is exact on the engine build that wrote the log (`runs.engine_version`). A rule change that alters an earlier decision can make an old log fail to replay (`replayFailed`). Before such a release, end or snapshot runs in progress, or keep the old engine for them.
- **Postgres in CI** runs on pg-mem, which ignores rollbacks; run `TEST_DATABASE_URL=postgres://... npm run test:server` against a real Postgres before going live (the contract tests wipe its public schema: use a throwaway database).
- **The Docker image** was not built in this environment (no Docker daemon); the production install and start (production packages only, the real `ai/` module, the app served) were run directly.
- **In process schedules and rate limits** are per instance (section 12).
- **LTI 1.3 and SSO** are a documented seam, not implemented (section 4).
- **Assessor UI:** the review endpoints exist; there is no assessor screen in the app yet.
