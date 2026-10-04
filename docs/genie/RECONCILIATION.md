# GenieKreator docs vs docs/SIMULATION.md

Compared after the GenieKreator source docs arrived (M3). Abbreviations: DES = iLead 2.0 AI Authored Interactive Simulation Design, CFG = Configuration Spec, TD = Gameplay Teardown, SR = scoring-and-report.md, AUTH = Authoring Screens, SIM = docs/SIMULATION.md. Priority: AUTH 1, CFG 2, DES 3, TD reference; SR implements DES's locked formulas unless CFG disagrees.

Where each item lands is in the last column of the summary table; DECISIONS.md D44 records the plan.

| # | Topic | Ours | GK | Severity | When |
|---|---|---|---|---|---|
| 1 | Leadership Score | 3 pillars per period, run max 7200 | `9 × (0.3B + 0.3P + 0.4L) + streak`, 0 to 1000; P = 50 + Δ avg morale + 0.5 Δ avg trust; L = 0.5 style fit % + 0.5 avg live band (SR: capability % with no live) | Conflict | M5 |
| 2 | Stars | 3 named stars | Week score = 0.5 style fit % + 0.3 avg live band + 0.2 funnel vs weekly ideal; 1 star at 50, 2 at 70, 3 at 85 | Conflict | M5 |
| 3 | Streak | +90 every 3rd period | +25, then +25 per extra week, cap +100; broken streak resets, no cost | Conflict | M5 |
| 4 | Tiers | 40/60/80% of max | Platinum ≥850, Gold 700 to 849, Silver 500 to 699, Bronze <500; CFG: 2 to 5 tiers, names configurable | Conflict | M5 |
| 5 | Badges | 8 badges | 10 badges (SR 6.1), data driven rules; Steady Hand, Turnaround, Promise Keeper defined differently | Conflict | M5 |
| 6 | Sponsor confidence, unlocks | +10/−8 per period; briefing bands; unlock at 60 and 80 | Strong +20, Adequate +5, Weak −10, Harmful −25; week revenue vs ideal ±5; CEO escalation −10; ≥70 unlocks +1 day, extra hire budget or team building without cooldown; <30 CEO check in costs a day; sponsor briefings in weeks 4 and 8 | Conflict | M5 (briefings M4) |
| 7 | Live consequences | Band shifts the mismatch step | Red flag forces Harmful, else median of dimension bands (ties down); authored consequence table per band for target, bystanders, sponsor, plus triggers per band | Conflict | M4 |
| 8 | Style tagged choices | Every meeting attendee records a style decision | Meetings, sponsor briefings, interviews and multi recipient emails carry no style | Conflict | M4 |
| 9 | Weekly style deltas | Fit +2/+4/+5, clear miss −1/−6/−8 (D33) | About +2 to +3 for a match, −1 to −2 for a mismatch | Conflict | M3 |
| 10 | Team Pulse | Counts by mood | Average of team morale and trust, with weekly trend arrows | Conflict | M5 |
| 11 | Trust | Calibrated starts 20 to 85; D30 extras | Start 50 (CFG: lower for wary archetypes); intent vs action gap 2 weeks in a row costs trust | Conflict | M4 (intent gap needs rationale data from M3) |
| 12 | Weekly drift | None | About 3 points a week decline of morale or result when nothing is done | Missing | M3 |
| 13 | Role coverage | None | Max 2 per role, at least 1 left after fire, training only if a peer covers the role, no candidates while the team is full | Missing | M3 |
| 14 | Funnel inputs | Result only, ideal from High threshold | Authored ideal throughput per stage per week, Skill/Morale/Result weights, carry over | Missing | M5 |
| 15 | Events | 4 card types | 6 types, random and conditional triggers, role and sponsor targets, chat or email delivery, expected response, response window, escalation chain, hidden labels; ignored messages grow into public events | Missing | M5 |
| 16 | Hire, fire, ripples | One candidate; hire unlocks period 3 | Interview 2 then choose; hidden true profile revealed over weeks; HR escalation after a bad firing; relationship map with ripple rules; hire available from week 1 | Missing | M4 |
| 17 | Pacing and modes | None | Full, Standard, Lite (4 weeks); live cap 2 a week; save and resume; practice week | Missing | M4 and M5 |
| 18 | Ranges | Periods 1 to 10; sub-periods 2 to 12; team 6 to 12; stages 3 to 6; 4 styles | Weeks 2 to 12; days 3 to 7; team 4 to 16; stages 3 to 7; styles 3 to 6 | Units | M7 (the user set max 10 periods; keep) |
| 19 | Money | $8,400 per conversion | $240,000 target, $30,000 per conversion | Units | M3 recalibration |
| 20 | Costs, cooldowns | Team building 1, one week training 1, energize 20/8 days | Team building 2, one week training 2, energize 10 days | Units | M3 |
| 21 | Dials | 4 metrics | 7 dials (Engagement, Quality, Safety off by default); KPI dials renameable; team averages over available members only | Units | M5 (averages M3) |
| 22 | Moods | Upbeat, Steady labels | Expressions happy, neutral | Naming only | none |

## Status after M5
- Resolved in the engine (D62): 1 Leadership Score, 2 stars, 3 streak, 4 tiers, 5 badges, 6 sponsor confidence and unlocks (briefings since M4), 10 Team Pulse, 15 events (types, timing, targets, delivery, responses, escalation).
- Still open: 14 funnel inputs (authored ideal throughput per stage, Skill/Morale/Result weights, carry over); 17 play modes (Full, Standard, Lite), save and resume, practice week; 21 the Engagement, Quality and Safety dials and renameable KPI labels; the leaderboard and celebration level settings.

## What the participant UI must show
- Stats hidden until the profile is first opened (D39 matches).
- Trust as the ring and in Team Pulse.
- Skill ratings only in the report.
- Rubric band names never shown.
- The sponsor meter may show its value (CFG "CEO meter, 0 to 100").
- Playtest view: "Playtest, not scored" banner, debug drawer with hidden state, jump controls (AUTH P1).

## Per milestone needs
- **M3:** profile fields (previous company, tenure, skills, remarks, career goal); 5 mood expressions and status tags; Assess role fit grid; configurable style names and definitions; one line rationale per member; team feedback message by share of matches (below half, half, majority, all); drawer rows: mode, day cost, cooldown, limits, eligibility, prerequisite nudge, unlock condition; static options with style tags; dial labels as configured.
- **M4:** 7 formats by text or voice; transcript before submit for email, chat and plan; typed fallback; audio consent first; soft or hard time limit, turn limit 12; participant brief card; who speaks first; hints on request; interview 2 candidates; hybrid decide then talk; live cap; sponsor briefings weeks 4 and 8.
- **M5:** 6 event types and channels, hidden labels, response windows and escalation; weekly report with funnel vs current and cumulative ideal; star week score; streak flame with next bonus; sponsor meter, unlocks, CEO check in; badge popup and shelf; Team Pulse with arrows; leaderboard (off when used for selection); celebration level.
- **M6:** tier and 0 to 1000 score; 1 to 5 experience rating; the 10 report sections (SR §7) with 5 to 7 key moments in SBI form; 5 level skills scale, 2 observation minimum, Harmful cap, "Not enough evidence"; conversation analytics; development plan; methodology page; "Reviewed by an assessor"; PDF.
- **M7:** colours (primary, secondary, accent, status, light and dark); logos and fonts; title and subtitle; loading and end art; per screen backgrounds; action and stage icons; labels for dials, styles, tiers, time units; badge names and icons; sounds and celebrations; accessibility toggles; low bandwidth mode; locale and currency.

## Open questions
- Is SR binding where it goes beyond DES (trust start 50 for everyone, median banding)?
- Should the D30 trust mechanics without a GK source (erratic style change −2, effect multiplier, misread chance) survive as configurable defaults?
