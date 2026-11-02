# Season League: progress

## v1 (2026-11-02): ready for review

**Built**

- Game shell: one 1194 by 834 landscape stage, scaled and letterboxed, no page scroll. Scenes instead of pages, slash transitions, a score bug on every scene (crest, colour, matchday, round, clock, league position, captain armband, Demo AI badge, sound and motion toggles).
- Scenes: squad code, roster check-in (once per matchday), matchday lobby (fixtures, next fixture hero, form guide, squad, Kick off with an auto kick-off countdown), briefing (scouting cards with big numbers), game plan board (four headings, actions with owner role and due date, client message, three play cards, Lock the play), locked in, inject, on air (lower-third, live commentary, speaker pick, dictation where the browser supports it, promises tracked), scoring, full time (scoreboard with count-up, key moment, coach's notes, the client's verdict, form update, Challenge a score), league table (colour bars, rank movement, pending categories).
- Shared room screen at `/screen`: league table, latest Trust Meter, breaking card, up next, email ticker. Cycles on its own.
- Engine: consequence model, carry-forward triggers (all six, data driven), leadership score, the round state machine with a timeout on every waiting phase, rubric pass rules, league with v3.1 weights and the Trust Meter tie-break.
- AI: Express proxy with the Anthropic SDK, prompts in `prompts/`, strict JSON validated with Zod and retried once, mock fallback on any failure. Mock mode when no key is set.
- Content: Zod schema for every file, Round 2 seed copy exactly as the PRD, other rounds as "Content not loaded", SheetJS importer and validator.
- Audit log in KSA time on the server; audit entries in squad state.

**Checks run**

- `npm test`: 32 pass, 2 skipped (the full worked examples need workbook v1.1). Both worked examples' leadership scores (83 and 67) are checked on a synthetic nine-round season.
- `npm run typecheck`, `npx vite build`: clean.
- `scripts/playthrough.mjs` in mock mode: Squad 3 plays Round 2 from check-in to the league table with no admin action; no scene scrolls; axe reports no serious or critical issues on any of the 12 scenes.
- Importer run against a synthetic workbook: 9 rounds, 3 options each, valid.

**Not yet verified**

- Live mode with a real key. The live code path typechecks but has not been run against the API in this environment.

**Not built yet (from the PRD)**

| ID  | Item                                                                     |
| --- | ------------------------------------------------------------------------ |
| F1  | One device at a time and device takeover (state is per browser for now)  |
| F10 | Server-held squad state and conversations that resume across devices     |
| F11 | Trust Challenge sittings (gap week tile shows "Content not loaded")      |
| F7  | Boardroom panel, Faisal and the Department Head briefs; the Lift         |
| F15, F16 | Kick-off replay, Most Improved, kudos                               |
| F18, F19 | Transcript review screen, workbook-format export, readout, imports of mission results |

**Deviations**

- The PRD lists Omar (Head of IT) in the build prompt but not in F7; v1 includes a character file for him with the brief not loaded.
- The importer cannot fill the big numbers on the evidence cards from the workbook; after an import the cards show plain evidence text until the workbook has those columns. Injects, plan headings and due chips carry over from the seed.
