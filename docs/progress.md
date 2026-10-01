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

## Next: M1. Config model and iLead default

Monorepo scaffold and CI, `@gk/schema` (12 areas, settings inventory, JSON Schema export, migrations, provenance, locks, patches), `@gk/seed-ilead` (Secure Capital Bank, 5 stages, 10 members with Teardown stats, 4 styles, 13 actions plus 2 new live ones, observed event deck, 10 badges), `@gk/db` Prisma schema.
