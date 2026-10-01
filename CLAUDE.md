# CLAUDE.md

Guidance for anyone (human or agent) working in this repository: the iLead authoring experience in GenieKreator, KNOLSKAPE's no code AI authoring platform for L&D professionals.

## Read first

- `docs/plan.md`: architecture, data model, package layout, API, jobs, test plan per milestone.
- `docs/decisions.md`: conflicts (C-xx), open decisions (D-xx), assumptions (A-xx).
- `docs/progress.md`: what is built, deviations, open `TODO(decision)` items.
- `docs/source/`: the five specs, exported verbatim. Never edit them by hand.

## Source docs and priority

| Priority | Doc | Defines |
| --- | --- | --- |
| 1 | GenieKreator Authoring Screens iLead Business Simulation | Navigation and every authoring screen |
| 2 | GenieKreator Configuration Spec iLead Simulation | Every setting, defaults, AI generation, locked engine, quality gates |
| 3 | iLead 2.0 AI Authored Interactive Simulation Design | Static, hybrid and live actions; NPC state; evaluation; pacing; gamification formulas; Report 2.0 |
| 4 | iLead 2.0 Participant Interface Spec | Learner screens (Playtest, data model shape) |
| Ref | iLead Gameplay Teardown and GenieKreator Blueprint | Current iLead behaviour, default roster stats, confirmed report formulas |

- Do not invent product behaviour the docs do not define.
- If two docs disagree, follow the higher priority doc and log the conflict in `docs/decisions.md`.
- If a doc lists something as an open decision, do not resolve it: make it configurable, mark the code `TODO(decision): D-xx`, and list it in `docs/decisions.md`.
- If the docs are silent, pick the smallest reasonable default, log it as an A-xx assumption, and say so in `docs/progress.md`.

## Architecture rules (non negotiable)

1. **Everything is data.** A `SimulationTemplate` is one versioned, Zod validated object covering all 12 areas of the Configuration Spec, exported as JSON Schema. UI, generators, engine, report and quality gates all read this one object from `@gk/schema`. Authoring metadata (provenance, area status, revision) lives beside the template, never inside it.
2. **Locked engine.** Turn loop, state maths, evaluation pipeline, safety guardrails and report formulas live in `packages/engine`: pure, deterministic, headless TypeScript with a seeded RNG stored in state. Inside the engine: no `Date`, no `Math.random`, no network, no filesystem, no React, no Prisma, no AI adapters.
3. **AI judges, rules decide.** LLMs may generate content, play NPCs, and classify a live interaction into a band (Strong, Adequate, Weak, Harmful) against an authored rubric. Stat changes always come from authored consequence tables. Never pass an LLM produced number into a stat.
4. **Provider adapters.** Every external AI capability sits behind an interface with a mock: LLM (default Anthropic Claude via the official SDK), speech to text, text to speech, image generation; plus storage, mail and moderation. Tests and local dev use mocks. Keys come from env vars only; never commit keys or a default model id.
5. **Structured outputs.** Every LLM call returns JSON validated by Zod, with retry on validation failure. Prompts are versioned files in `/prompts/<task>/<version>.md`; no inline prompt strings in components or services.
6. **Audio rules.** Score transcripts only. No facial or voice emotion inference anywhere. Consent is required before any audio capture. Audio analytics (talk to listen ratio, open questions) are descriptive, never scores.
7. **Report integrity.** Every participant facing report element must trace to engine output or authored template copy (`trace` on every element). No invented scores, ratings or observations.
8. **Accessibility.** WCAG 2.2 AA, keyboard operable, visible focus, reduced motion respected.
9. **No client content outside the seed.** Client or scenario content (Secure Capital Bank, the roster, events) lives only in `packages/seed-ilead`. Dev demo data lives in `fixtures/demo` and is never imported by packages.

## Copy rules (all UI text, generated copy and seed copy)

- Say "skills", never "competency" or any form of it.
- No em dashes, en dashes, or hyphens used as punctuation. Use commas, colons, full stops or parentheses.
- Headlines are questions from the author's side ("What kind of simulation do you want to build?"). Card lines describe what the author will build, not what the learner will feel. Buttons are verbs (Generate draft, Use this format, Run all checks, Publish).
- Names exactly: Business Simulations, Day in the Life (DILO) Simulations, iLead, AI RolePlay. Product name: GenieKreator.
- 4E pill tabs and their product lines: Evaluate (Conversation AI, Nano AI, PitchPerfect AI), Educate (AI Microlearn, Interactive Learn), Experience (Simulations, AI RolePlay), Enable (AI Koach).
- All UI strings live in `apps/web/src/i18n/en.json`. `pnpm lint:copy` enforces these rules.
- These rules also apply to every document in `docs/` and to commit messages: no em dashes.

## Look and feel

Match today's GenieKreator: dark theme, breadcrumb, centred pill tabs, illustrated choice cards with an author perspective line, Products list cards with type chip, progress bar, Continue Editing and Preview. Tokens come from the GenieKreator Brand Guidelines (Deep Space `#0A081B`, Electric Blue `#249DFF`, Cyber Cyan `#43D6E8`, Mint Green `#00F2AD`, Pale Lavender `#DEE9FF`, Manrope only, sentence case). See `docs/plan.md` section 10.

## Stack

Next.js 14 (App Router), React 18, TypeScript strict, Tailwind CSS, Framer Motion, Zod for every schema, PostgreSQL with Prisma, BullMQ on Redis for generation, media, quality and export jobs, S3 compatible storage, Vitest, Playwright with axe. pnpm workspaces. Package layout in `docs/plan.md` section 3.

## Milestone workflow

Milestones M0 to M9 are defined in `docs/plan.md`. For each milestone:

1. Build only that milestone's scope.
2. Run typecheck, lint, copy lint, unit tests and e2e tests; all must pass. New logic has unit tests; key flows have Playwright tests.
3. Take screenshots of new screens and check them against the spec tables.
4. Update `docs/progress.md`: what was built, deviations from spec and why, open `TODO(decision)` items.
5. Commit with a clear message, push to the working branch, then stop for review before the next milestone.

## Commands

Added in M1 when the workspace exists (`pnpm typecheck`, `pnpm lint`, `pnpm lint:copy`, `pnpm test`, `pnpm e2e`, `pnpm sim`).
