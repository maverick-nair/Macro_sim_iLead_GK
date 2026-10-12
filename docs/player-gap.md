# Participant player: the approved canvas against the React player

The product owner approved a design canvas for the participant's desk (artboards Board, Leaderboard, Menu,
TourBoard and their tablet frames at 1194x834, desktop at 1440x900). This note compares it with the engine
player in `src/components` and says what workstream WS4 builds (decisions D210 to D219). The canvas's words
and numbers are Innov8 sample data; the player renders what the storyline configures and what the engine
sends, never the sample.

## What the canvas asks for, and what the player had

| Area | Canvas | React player before WS4 | WS4 builds |
| --- | --- | --- | --- |
| HUD | Navy bar: Menu, storyline, week of N and day, day pips with "3 days left", session time, Pause, Save, End week. No score. | Logo, Menu, week and day, capacity bolts, Pause with the session clock, score star with its breakdown, streak flame, Cmd K, Settings, End week. No Save. | Save beside Pause in one "session" group (`data-tour="session"`). The score and the streak move to the status band (the score keeps its breakdown disclosure). Cmd K and Settings stay. |
| Status band | Three groups under the HUD: TEAM HEALTH (skill, morale, results, trust with change arrows and screen reader words), BUSINESS (revenue against target with a pace marker and "Behind pace by $15K", late pipeline, client trust, Results and stages), YOUR PROGRESS (score and tier with points to the next tier, stars this week, rank, sponsor confidence with reward and check in lines). | A row of tiles: four team KPIs (trend word, no change number), Team Pulse, the run target with a pace marker (no ahead or behind text), sponsor confidence (level and value, causes popover). Business variables in a separate bar. Score, tier and rank only in the HUD popover. | `StatusBand` (desk layout) from the view: KPI value and change since the period started (arrow plus words), revenue with pace marker and "Behind pace by" or "Ahead of pace by" from `clock.runShare`, the storyline's business variables (with their causes on demand), Results and stages; score, tier progress from `gamification.tiers`, last week's stars, rank when the leaderboard is on, sponsor value with the reward and check in lines from config. The portrait tablet board (D73) keeps its tiles. |
| Funnel | Each stage column shows deals against the ideal as a number and a bar; the bottleneck says "Bottleneck" in words with a heavier border. | Stage header: headcount and ideal headcount; the bottleneck replaced the ideal line with words and a tint. No deals. | Stage headers show the stage's deals this period against its ideal (`funnel.throughput`, `idealThroughput`) as text and a bar; the bottleneck keeps its words and adds a "!" mark and a heavier border, never colour alone. Headcount stays in the header's name for screen readers and in the profile. |
| Feedback and inbox | A row of cards beside the inbox: the last feedback ("Coaching Nalani landed. Skill up 3, morale up 2", See why), milestones ("Revenue reached 25% of the target", See results), and messages with sender, due and Reply. | Outcome panel while an outcome is open; milestones as notice rows under the KPIs (D93); an inbox rail of icons on the left and an inbox drawer. | `DeskFeed` under the team on the desk: the last thing that landed (the engine's history title and its changes as words, See why opens History on it), milestones from `notices.ts` (Keep going, Leaderboard), each inbox message (sender, title, due, Reply or Read, Later) and All messages for the drawer. The icon rail goes from the desk (the feed is the inbox now); tips stay as notices. The portrait tablet keeps its dock. |
| Pause, save, sign out | Pause in the HUD opens "Simulation paused" with Resume, Save progress, Sign out and the last saved time. Save shows "Progress saved at 11:06". Sign out saves first and ends on a signed out page. | Pause opened a dialog with Resume only. Exit (when the launch gave a return address) asked to leave. No Save, no saved time. | Save in the HUD, in the pause dialog and in the menu: it waits until every action sent has been confirmed by the server (the engine saves after every action), then says the time; offline it says the actions are kept on this device until the connection is back. Sign out saves the same way, then goes back to the learning platform when the launch gave a return address, else shows a signed out screen with Sign back in. |
| Menu | A side sheet: SESSION (Pause, Save progress with last saved time, Sign out), then Objectives, Replay the tutorial, History, Results and stages, Your eight weeks, About these actions, Leaderboard (with your rank), Settings. | A dropdown list of the same items without session controls or descriptions. | The menu becomes a modal side sheet with the session group and a one line description per item (the leaderboard row shows the rank when known). Items open the existing panels. "Your eight weeks" has no panel yet; History covers it. |
| Leaderboard | A page: where you stand (score, tier, points to next tier, rank), how points are earned (pillar weights and streak), privacy note, top 10 table with tier, Overall and This week tabs. | A panel with the cohort table (rank, name, score, tier). | The leaderboard panel gains Where you stand, How points are earned (weights and streak bonus from config) and a privacy note that follows `anonymous` and `scope`; it opens from the band's rank, the menu and a milestone. Only shown when the storyline turns it on. "This week" and "change since yesterday" need cohort history the API does not have; left out. |
| First time tour | Desk tour of 13 stops: Menu, clock, days, pause and save, team health, business, results and stages, your progress, funnel, member, feedback and inbox, actions, action duration, end of week. | Board tour of 13 stops targeting the old HUD, the KPI strip, the target tile, the stage header, the outcome or inbox rail. | Targets and copy follow the new layout: new stops for Team health, Business, Your progress, and Session (Pause and Save); Notifications points at the feed. Steps whose target is not on screen are skipped as before. |

## Gaps left open (need engine or API work)

- **Stars on track this week.** The engine sends stars per finished period (`periods[].week.stars`), not a
  running forecast, and the UI may not compute scores. The band shows last week's stars until the engine
  sends the running week score.
- **Late pipeline value.** Not an engine quantity. It shows when a storyline authors it as a business
  variable (as it can client trust); the band lists the storyline's shown variables.
- **Sponsor change in week 1.** The band shows the change since the last period ended; before the first
  week end only the value and the lines show.
- **Leaderboard "This week" and movement.** The cohort API ranks by Leadership Score only.
- **Visual language.** The canvas's paper and navy palette, Newsreader and Geist type are not in the
  player's tokens, and the player is themed per client (D71, D72) in light and dark. WS4 builds the new
  surfaces on the existing semantic tokens (so client themes and both modes keep working) and borrows the
  canvas's structure: uppercase group labels, tabular numbers, words beside every arrow. Adopting the
  canvas palette and type as the default theme is a separate theme change (fonts, every screen's
  baselines) to decide on its own.

## Pre-game flow (added later, D219)

The canvas's pre-game flow is four screens: landing (Main), the sponsor's video message (Sponsor), the product
portfolio (Portfolio) and the objectives (Ready). The React player had a six step onboarding (language, the
sponsor's letter, consent, a voice check, how to play, the team), then the demo offer and the Week 0 practice.
The engine player now shows the four screens only, from the engine view; the portfolio appears when the storyline
contract carries one (workstream 1's `storyline.products`), and is skipped otherwise.
