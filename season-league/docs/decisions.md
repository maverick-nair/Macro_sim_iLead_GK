# Season League: decisions and assumptions

Source: Final PRD, The Client Majlis: Season League (2 Nov 2026). Where the PRD is silent, v1 takes the smallest reasonable default and lists it here.

## Placement

| #    | Decision                                                                                                   | Why                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| P-01 | Built as a standalone npm project in `season-league/`, outside the pnpm workspace and the `@gk/*` packages | The PRD makes it a fully custom build, not on GenieKreator, and names Vite, React, Zustand, Express and npm |
| P-02 | Root ESLint ignores `season-league/`; it has its own typecheck and tests, and its own CI job               | Keeps `pnpm check` for GenieKreator unchanged                                                               |

## Assumptions (PRD silent)

| #    | Topic                        | Assumption                                                                                                                                                            |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | On air clock                 | 6 minutes per conversation (`onAirMinutes` in `rounds.json`)                                                                                                          |
| S-02 | Round 2 inject               | "Incoming call from Dubai": Nadia on the line about payroll. Built from the PRD's "payroll call with Nadia". Marked `seed: true`                                       |
| S-03 | Round 2 due dates            | Day chips 23rd to 28th, from "payroll in five days" and "payroll file ready for the 28th". Seed values                                                                |
| S-04 | Trust Meter behaviors        | Five seed behaviors until workbook v1.1 is loaded; the score is their mean, 0 to 10                                                                                   |
| S-05 | Combining two rubric passes  | Mean per line, rounded half up. With a third pass, the median per line. The reason shown comes from the pass closest to the final score                               |
| S-06 | Control bypass zero          | Applied when most passes flag it. Rounds come from `rubric.json` (Round 2 only, as the workbook does). Open question 10 decides whether it applies everywhere          |
| S-07 | League normalisation         | Plan quality = mean plan score over 20; Trust Meter = mean over 10; Decisions = points over 10 per round. Other categories show as pending until they have data        |
| S-08 | No play at time-out          | The board locks with no decision. 0 decision points; the plan is still scored                                                                                         |
| S-09 | Self-running waits           | Lobby kicks off after 90 s, locked in shows 2 s, the inject 8 s, full time 120 s, the league 30 s (`schedule.json` timers)                                            |
| S-10 | Ticket T-013 timing          | The importer places T-013 (Round 4 B) in Round 5, the next servicing round                                                                                            |
| S-11 | Speaker pick default         | The captain is picked first; any member can be tapped                                                                                                                 |
| S-12 | Challenge a score            | The squad picks plan quality or the Trust Meter. Plan challenges run two fresh passes. A plan zeroed by the decision stays zero                                       |
| S-13 | Bot squads                   | Their fixed results count in the league only for rounds a real squad has played, so the table starts level                                                            |
| S-14 | Faisal, Department Head, panel | Organisation set to "The bank". Briefs not loaded                                                                                                                   |

## Open questions from the PRD that v1 leaves configurable

- Q4 squad count: `squads.json` supports up to 6.
- Q5 dates: `schedule.json` holds the proposed 22 and 23 Nov times.
- Q6 hosting region and retention: not decided; the server keeps results and the audit log on local disk.
- Q10 control bypass scope: `rubric.json` `controlBypassZero.rounds` (`[2]` or `"all"`).
