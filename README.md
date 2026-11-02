# iLead authoring in GenieKreator

The iLead Business Simulation authoring experience for GenieKreator: from the Products list, through a brief and AI generation, to a 12 area authoring workspace, playtest, quality checks, review and publish.

- Plan: [docs/plan.md](docs/plan.md)
- Decisions log: [docs/decisions.md](docs/decisions.md)
- Progress: [docs/progress.md](docs/progress.md)
- Source specs: [docs/source/](docs/source/)
- Working rules: [CLAUDE.md](CLAUDE.md)

Status: M1 (config model and iLead default) complete and awaiting review. See the progress log.

## Packages

- `@gk/schema`: the SimulationTemplate (12 areas), publish rules, settings inventory, JSON Schema, migrations, provenance, locks, patches, copy rules.
- `@gk/seed-ilead`: the iLead original (Secure Capital Bank). The only place client content lives.
- `@gk/db`: Prisma schema, migrations and the draft repository.
- `@gk/sim-cli`: `pnpm sim validate seed:ilead`.

Commands are in [CLAUDE.md](CLAUDE.md#commands).
