# Progress

## M0. Plan (2026-10-01): ready for review

**Built**

- Located all five source specs (two uploaded as PDFs, all five live as Claude Docs) and exported them verbatim to `docs/source/`, with the six embedded drawings reconstructed as Mermaid. The two uploaded PDFs are kept in `docs/source/pdf/`. Live docs and PDFs match word for word.
- `docs/plan.md`: architecture (Mermaid), rule to mechanism mapping, package layout, SimulationTemplate outline for all 12 areas, persistence model, engine design with formulas, AI adapters and evaluator pipeline, routes and API surface, job design, workspace mechanics, UI system, test plan per milestone, risks, and 7 questions.
- `docs/decisions.md`: 14 conflicts resolved by doc priority, 13 open decisions to build as configurable (`TODO(decision)`), 29 assumptions where the docs are silent, plus the arithmetic behind the M2 report and score fixtures.
- Independent review of the plan against all five specs: 14 findings (unflagged mechanics, a missing lock path, the Mandy caveat on the derived bands, Results and human audit scope, a missed conflict on event labels, smaller screen elements, status storage) fixed in the plan and decisions log; arithmetic for both M2 fixtures re-verified.
- `CLAUDE.md`: the rules from the brief, doc priority, copy rules, look and feel, stack and milestone workflow.

**Checks run**

- No feature code exists yet, so there is nothing to typecheck, lint or test.
- Docs lint: no em or en dashes in `CLAUDE.md`, `docs/plan.md`, `docs/decisions.md`, `docs/progress.md` or the exported specs.
- Toolchain availability in the build container: Node 22, pnpm, PostgreSQL 16, Redis 7, Chromium for Playwright, npm registry reachable.

**Deviations from the brief**

- The brief said the specs were already in `/docs`; the repository was empty. They now live in `docs/source/` (file names as in the brief) so the build has a stable, searchable copy.

**Your answers (2026-10-01), now in the docs**

- Q1 to Q7 recorded in `docs/decisions.md`, "Your answers".
- New `docs/scoring-and-report.md`: full rules for the 7 dials (Engagement, Quality and Safety defined in detail), style metrics, live scoring, skill ratings on a 5 level scale, game scores, all 10 badges, every Report 2.0 section and cohort Results.
- `docs/plan.md` section 6.1: model routing per task and token controls at scale. Participant identity is separate from authors (Q3).

**Interface preview**

- A clickable design canvas of 11 planned screens (E1 to E5, B1, B2, workspace with the Cast studio and NPC panel, live interaction designer, quality check, playtest) is published as a private artifact. It is a design reference for M3 to M8, not application code, and is not in this repo.

**Waiting on you**

- Review of the plan, the scoring spec and the interface preview, then a go for M1.

**Open `TODO(decision)` items**

D-01 to D-13 in `docs/decisions.md`. None is in code yet.

## M1. Config model and iLead default (2026-10-01): ready for review

**Built**

- Monorepo: pnpm workspaces, TypeScript strict with `noUncheckedIndexedAccess`, ESLint flat config, Prettier, Vitest projects, GitHub Actions CI (`.github/workflows/ci.yml`) with Postgres 16 and Redis 7 services. ESLint keeps `@gk/schema`, `@gk/seed-ilead` and the future `@gk/engine` pure: no `Date`, `Math.random`, timers, Node APIs, React, Prisma or AI adapters (checked with a deliberate violation).
- `@gk/schema`
  - Zod schemas for all 12 areas plus `meta`, every object strict. `TemplateSchema` runs on every save; `PublishableTemplateSchema` adds the cross field rules (ids and references, team size, role fit for every stage, stage capacity, band coverage of every Skill and Morale pair, style tagged options, action scope and limits, live designs, rubric to linkage, event windows and escalation, sittings, score weights, stars, tiers, report sections, rating scale, anchors, at least 2 observations per skill, development plan, narratives, lock paths).
  - Settings inventory: all 205 Config Spec settings mapped to schema paths; a test proves every path resolves. Six settings are listed under one area and stored in another (portraits, event images, icons, the style override, style tags); the test pins that list.
  - JSON Schema (draft 2020-12) exported to `packages/schema/generated/simulation-template.schema.json` (`pnpm schema:export`); a snapshot test fails when it is stale.
  - Migrations runner (`vN` to `vN+1`, refuses newer documents and gaps), drafts migrate on read.
  - Envelope: provenance on stable paths (`/cast/npcs/@kent/persona`), so badges and locks follow items when others are added or removed; area state (opened, reviewed) with attention computed (A-29).
  - Author patch service: JSON Patch (add, replace, remove), all or nothing, revision check, `/meta` protection, admin locks with the admin's name, full validation with field paths, provenance flip (AI badge clears on the edited field only), touched areas marked reviewed, revision bump. AI regeneration records `source: ai` and does not mark areas reviewed.
  - Version snapshots: deep frozen, content hash, refused while publish issues remain.
  - Copy rules (`copyIssues`) shared by `pnpm lint:copy`, the seed tests, the CLI and, from M4, the generators.
- `@gk/seed-ilead`: the iLead original. Secure Capital Bank; 5 stages (ideal 3, 2, 1, 1, 1, max 2); the 10 Teardown members with exact starting Skill, Morale and Result, Trust 50 for everyone (your answer to Q2) and derived role fit tables; sponsor Roger Kent; 2 hiring candidates; Jack's fairness ripple; 4 styles with the in game definitions; derived bands, delta table and misfit rule (your answer to Q1); 15 actions (13 iLead actions with Design doc modes plus Reply to messages and Sponsor briefing); 13 events (the 8 observed plus 5 follow ups); time and pacing per the Config Spec; gamification and the full report configuration per `docs/scoring-and-report.md` (8 skills, linkage, 5 level scale, anchors, narrative bank, development plan, audit sample). `SEED_BASIS` records where every derived or assumed value comes from.
- `@gk/db`: Prisma schema for plan 4.3 (28 models, including Participant, Enrolment, ConsentRecord and AuditSample), the initial migration, a client factory reading `DATABASE_URL`, and a draft repository: create a product with its draft, load with migration on read, save with optimistic concurrency, publish numbered immutable versions and set the live version.
- `@gk/sim-cli`: `pnpm sim validate <seed:ilead | file.json>` prints structure, publish readiness per area, copy rules, inventory and a summary. M2 adds `run`.
- Scripts: `scripts/lint-copy.ts` (no em or en dashes in any file outside `docs/source`; hyphens as punctuation, "competency" and product name spellings in seed copy, UI strings and prompts; hyphens as punctuation in docs prose) and `scripts/export-json-schema.ts`.

**Checks run (all pass)**

- `pnpm typecheck`, `pnpm lint`, `pnpm lint:copy`, `pnpm format:check`.
- `pnpm test`: 79 tests in 11 files (schema 28, seed 43, sim CLI 5, database integration 3 against a real Postgres 16).
- Exit check `pnpm sim validate seed:ilead`: structure valid, all 12 areas ready, copy clean, 205 settings resolve, publishable.
- End to end: not applicable in M1. The test plan lists no Playwright tests until M3, when `apps/web` exists; `pnpm e2e` joins CI then.
- Screenshots: none, M1 has no screens.

**Deviations and why**

- The 6 to 12 calibration sample rule moved from the publishable schema to the rubric calibration gate in M8 (A-37); the schema keeps the maximum of 12. Plan 4.1 updated.
- Governance in the template holds roles, approval flags (D-04, D-13) and the lock mirror; named collaborators and reviewers live in the database (A-38). Plan 4.1 updated.
- Template operation tests (patches, locks, snapshots, publish rule negatives) live in `packages/seed-ilead/test`, because they need a complete template and `@gk/schema` must not depend on the seed.
- Lock semantics refined: adding an item is blocked by a lock on the list or above it, not by a lock on a sibling item; replacing or removing is blocked by a lock on the path, above it or below it.
- Database tests need `TEST_DATABASE_URL` or `DATABASE_URL` (CI sets both). `GK_SKIP_DB_TESTS=1` skips them on purpose; they are never skipped silently.
- Prettier formats code and JSON but not Markdown, so the docs' tables stay as written.

**New assumptions**

A-30 to A-41 in `docs/decisions.md`: role fit derivation and misfit for moved members, unlock kinds for replies and briefings, replies outside the live cap, sponsor style and tone, the "performance" target, invented candidates, assumed brand palette, calibration minimum at the gate, people in the database, follow up event kinds, skill level anchors, and seed copy written where the docs give none.

**Open `TODO(decision)` items in code**

- D-04 report approver (`governance.approval.reportApprover`, default any reviewer).
- D-05 session model and D-06 live cap (`time`).
- D-07 human review tier and D-08 default skills framework (`report`).
- D-09 pilot scope and D-12 undefined actions (`actions` modes and live formats).
- D-10 per member or global fit (`leadership.memberExceptions`).
- D-11 funnel formula (`process.throughput`).
- D-13 playtest sign off (`governance.approval.requirePlaytestSignOff`, default off).
- D-01 to D-03 arrive with the navigation screens in M3.

**Waiting on you**

- Review of M1, then a go for M2.

## Next: M2. Engine

`@gk/engine`: the pure deterministic turn loop for static and live paths, state maths, events, gamification and report metrics, with the report fixture (Directing 29%, Guiding 13%, Partnering 36%, Entrusting 22%, capability 69%) and the Leadership Score example (425, Bronze); `@gk/sim-cli run` for full 8 week runs.
