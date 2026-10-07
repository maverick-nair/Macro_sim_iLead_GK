# iLead 1.0 flow against iLead 2.0: gap report

Source: the product owner's Figma file of original iLead screenshots (file `uiabMLLjBbUz1uT4U2dSe9`, page 1), compared with this repo on 7 Oct 2026 (the playable app on the mock engine, `/`, `?start=board`, plus the end screen, report and group report). Every screenshot node on the page was viewed. Local copies are in the session scratchpad (`figma-original/<group>/<order>-<node>.png`).

Two storylines appear in the screenshots. Most screens are the 1.0 "mobile banking app" story (Secure Capital Bank, four sub modules, eight people, the Accenture build). The Sim Intro's first three screens and two board shots are the sales version (Innov8 Elevators, a sales funnel), which is the storyline our app plays. Where the two differ only in content, this report judges the flow, not the content.

Status words used below:
- **Covered**: our app does the same job in the same place in the flow.
- **Differently**: our app does the job another way. Where that was a deliberate 2.0 choice, the decision number is given.
- **Partial**: some of it is there, something the participant could do or see in 1.0 is not.
- **Missing**: nothing in our app does this job.
- **Reference**: a planning note, not a product screen.

## Summary

140 screenshots in seven groups.

| Status | Screens |
|---|---|
| Covered | 35 |
| Differently | 18 |
| Partial | 20 |
| Missing | 64 |
| Reference | 3 |

The 64 missing screens come down to a short list of features, because 53 of them are the guided tour (30 tour screens in the two walkthrough frames, 23 more of the same tips in the demo and play rows). The other 11 are the demo (3), the profile menu and support form, the video replay and its transcript, the stage info hover, Objectives during play, and the milestone popup (twice). The core loop is all there: intro letter with the three tabs, meeting the team, weekly leadership styles with a confirm table, actions with options and a cost in days, the team's response with changes, events and news bulletins with See impact, a weekly report, medical leave and other triggers, the session clock, the end screen with the report, PDF and email.

What the original has and we do not, in order of impact:

1. **The guided tour** (tips over the board, the profile, the actions, the week end). The 2.0 spec asks for it ("Tutorial: replayable guided tour", "Tour runs once per area"). Not built.
2. **The demo** (a short practice week before the real run, with Exit demo). Not built; our nearest item, the optional Week 0 practice chat (D16), is open and undesigned.
3. **The HUD menu during play**: Objective, Tutorial and video, History, Result overview, Module overview, Leaderboard, Help. In 1.0 these are always one click away. On our engine board the menu is empty (D38 hid it "until its panels exist"); the spec lists Objective, Tutorial, Funnel, History, Leaderboard, Badges and Help.
4. **History of interactions** across the team, week by week, with each person's changes. We have a per person timeline in the profile and See why on each outcome, but no team wide log.
5. **Overviews on demand mid week**: the result table (person by week) and the progress table (stage by week). We show both only at the week end and in the final report.
6. **Help and support**: the Support tab and its contact form. Nothing in our app.

## Sim Intro

| # | Node | What it is | Status | Where in our app, or what is missing |
|---|---|---|---|---|
| 1 | 60:3 | Sales version intro: CEO welcome letter, tabs Welcome, About Product, Your Targets; top bar with Full Screen, Support, Exit | Partial | The letter and its three tabs are our onboarding sponsor step. Full Screen, Support and Exit in the top bar are missing (we have Pause and Settings). |
| 2 | 60:4 | About Product tab with a product picture | Covered | Sponsor step, About the product tab (text only, no picture). |
| 3 | 60:5 | Your Targets: revenue, conversions, team stats, 8 weeks, 60 minutes | Covered | Sponsor step, Your targets tab; total time is on the first onboarding step ("About 100 minutes"). |
| 4 | 1:3 | Introduction video with Video and Transcript tabs, Next | Partial | The sponsor step has a video slot that shows when a storyline sets a welcome video (none does today, D54). No transcript tab. |
| 5 | 6:24 | Profile menu: "Hi, user" and Logout | Missing | No account menu or sign out. The launch (LMS or GenieKreator) owns sign in; we only have the "session timed out, sign in again" dialog. |
| 6 | 6:26 | On clicking Support: Help and Support form (requester, subject, message, product, program, location) | Missing | No help or support entry anywhere. The spec lists "Help: controls, voice tips, support contact". |
| 7 | 1:5 | Transcript tab: the leadership theory with two worked examples | Partial | Style names and one line definitions show on style setting and in "What do D, G, P and E mean?". The worked examples that teach the model are not there. |
| 8 | 1:7 | Objectives: welcome letter from the project manager | Covered | Sponsor step, Welcome tab. |
| 9 | 1:13 | Module Scope: which skills suit each sub module | Partial | About the product names the stages and the staffing rule, but not which skills or strengths suit each stage. |
| 10 | 1:15 | Your Targets: lead for 8 weeks, improve skill, morale, result; timeline; playing time | Covered | Sponsor step, Your targets tab. |
| 11 | 7:30 | Offer to play a demo first (one week in 10 minutes, no impact) or skip to the simulation | Missing | No demo or practice round (D16 open). |

## Demo screenshots

| # | Node | What it is | Status | Where in our app, or what is missing |
|---|---|---|---|---|
| 1 | 6:28 | Demo loading screen, Exit DEMO tab | Covered | Loading screen ("Setting up your office"); there is no demo, so no Exit demo. |
| 2 | 1:18 | Tour tip: Objectives and Tutorial can be revisited | Missing | Tour not built; Objective and Tutorial are not in the HUD (D38). |
| 3 | 1:20 | Tour tip: Tick tock, day, week and timer | Missing | Tour not built. The clock itself is covered (HUD week, day, days left, session clock). |
| 4 | 1:22 | Tour tip: the sub modules and their (i) hover | Missing | Tour not built; no stage info hover. |
| 5 | 8:3 | Tour tip: know your team member before Proceed | Missing | Tour not built. The rule is covered differently (onboarding asks for 3 profiles, per the spec). |
| 6 | 8:5 | Board before play: team as an org chart, Proceed locked until every profile is read, 10 minute timer | Differently | Onboarding "Meet your team" step; Start week 1 unlocks after 3 profiles (spec onboarding step 6). No "You, Team Lead" node on the board. |
| 7 | 8:8 | Tour tip in the profile: Summary (result trend and interactions) | Missing | Tour not built. |
| 8 | 8:9 | Tour tip in the profile: Actions column | Missing | Tour not built. |
| 9 | 8:10 | Profile: photo, Skill, Morale, Result, approach, previous company, joined, experience, skills, remarks; Result Trend chart; Your Interactions; Take an Action | Partial | Profile panel has all of these except the Result Trend chart (a person's result week by week). |
| 10 | 8:12 | After viewing all actors: Identify Leadership Approach, with tour tip | Covered | Weekly style setting (D46). The tip is missing. |
| 11 | 8:13 | Approach dropdown with a one line definition per approach | Covered | Segmented style control with the definitions strip (the spec replaced the dropdown). |
| 12 | 8:7 | On clicking Objectives: the objectives carousel reopens | Missing | No way to reread the objectives or the letter during play (HUD menu empty, D38). |
| 13 | 8:11 | On clicking Exit demo: warning that the demo cannot be replayed | Missing | No demo. |
| 14 | 8:16 | "Are you sure?" table of person and approach, Go Back or Proceed | Covered | Review and confirm summary table. |
| 15 | 8:20 | On clicking View History: History of Previous Interactions, by week | Partial | Per person timeline in the profile; no team wide history. |
| 16 | 8:14 | Animation: big coloured plus and minus numbers over each card, notification with Average Impact | Differently | Outcome panel with faces, change chips and See why; metric bars animate. Intentional: the spec's fixes table removes the large overlays ("mood change and small deltas"). |
| 17 | 8:19 | Result overview: each person's result per week and average | Partial | Only at the end, in the report ("Your people over the run"). Not available during play. |
| 18 | 8:15 | Tour tip: Notifications and View History | Missing | Tour not built. |
| 19 | 8:23 | Module overview: completion per sub module, this week and all time, week by week | Partial | The week end shows the funnel this week and so far; nothing on demand mid week (the spec's Funnel menu item is not built). |
| 20 | 8:17 | Tour tip: Team Performance | Missing | Tour not built. KPI tiles are covered. |
| 21 | 8:27 | More info on actions: a table of every action and what it does | Partial | Each action's drawer describes it; the panel says live or instant. No overview of all actions in one place. |
| 22 | 8:18 | Tour tip: Module Progress | Missing | Tour not built. The target tile is covered. |
| 23 | 8:22 | Tour tip: Result and Module overview buttons | Missing | Tour not built. |
| 24 | 8:26 | Tour tip: Actions panel and its (i) | Missing | Tour not built. |
| 25 | 8:24 | Tour tip: Action duration | Missing | Tour not built. Costs in days on each action are covered. |
| 26 | 8:29 | Recognize panel: three options, "This action will take 1 day", Cancel or Do it | Covered | Action drawer with options and cost (Reward member and the other actions). |
| 27 | 8:28 | On taking the first action: the person's reply with portrait, quote and changes; day moves on | Covered | Outcome panel: headline, quote, change chips, days left. |
| 28 | 8:21 | Help set priorities: pick a person on the board, Cancel or Proceed | Covered | Pick people on the board, then confirm in the drawer. |
| 29 | 8:25 | Funnel shaped loading animation between screens | Covered | Loading screen. |
| 30 | 8:33 | Demo end: "Hope you are familiar with the simulation now", Play Simulation | Missing | No demo. |
| 31 | 87:113 | Org chart note: COO, a peer team lead, You, four teams of two with archetype tags | Reference | A cast proposal for a new storyline, not a screen. Our board shows stages, not reporting lines. |
| 32 | 60:7 | Same org chart note, cropped | Reference | As above. |

## Sim play screenshots

| # | Node | What it is | Status | Where in our app, or what is missing |
|---|---|---|---|---|
| 1 | 8:34 | Loading screen with the HUD, Support tab | Covered | Loading screen. |
| 2 | 8:35 | Tour tip: Objectives and Tutorial; board opens with an introductory message and Proceed locked | Missing | Tour not built. The intro is covered by onboarding. |
| 3 | 8:36 | Tour tip: Video and Leaderboard links | Missing | Tour not built; no Video or Leaderboard link in the HUD. Our rank sits inside the score breakdown and on the end screen. |
| 4 | 8:37 | Tour tip: Tick tock | Missing | Tour not built. |
| 5 | 8:38 | Tour tip: sub modules, hover (i) for info | Missing | Tour not built. |
| 6 | 8:39 | Tour tip: know your team member | Missing | Tour not built. |
| 7 | 8:40 | The board: HUD, Team Skill, Morale, Result, module progress, four sub modules of two, Actions panel, Result and Module Overview buttons | Differently | Our board: HUD, seven KPI tiles, the team by stage, the Actions panel. No Result or Module Overview buttons. Our actions are the 1.0 sales set (SIMULATION 4.1), not the banking set. |
| 8 | 8:41 | Profile with Summary tip, Result Trend chart, "can't take any action now" at the start | Partial | Profile panel, without the trend chart. |
| 9 | 8:42 | Profile with Actions tip | Missing | Tour not built. |
| 10 | 8:43 | Card after its profile is read: stats and "Your approach: yet to be decided" | Covered | Stats show after the profile is opened (D39); "No style yet" on style setting. |
| 11 | 9:69 | On clicking Video: Introduction Video, replayable during play | Missing | No video replay during play. |
| 12 | 10:70 | Video Transcript tab with the theory and examples | Missing | No transcript. |
| 13 | 10:71 | Hover on a sub module (i): what it is and which skills suit it | Missing | Stage headers show the name and ideal headcount only. |
| 14 | 8:44 | Once all actors are viewed: Identify Leadership Approach, "Set your approach" per card, tip | Covered | Weekly style setting. |
| 15 | 8:45 | Approaches set on every card | Covered | Style setting. |
| 16 | 8:46 | "Are you sure?" confirm table | Covered | Review and confirm. |
| 17 | 8:47 | Animation: response notification, Average Impact, View History, previous and next arrows, big deltas on cards | Differently | Outcome panel (D46, spec fixes table). No View History link from it. |
| 18 | 10:72 | On clicking View History: History of Previous Interactions, week pager | Partial | Profile timeline per person only. |
| 19 | 10:73 | History expanded: each person's skill, morale and result change | Partial | See why on the outcome lists every reason; the profile timeline lists that person's changes. No team view by week. |
| 20 | 8:48 | Tour tip: Notifications | Missing | Tour not built. |
| 21 | 8:49 | Tour tip: Team Performance | Missing | Tour not built. |
| 22 | 8:50 | Tour tip: Module Progress | Missing | Tour not built. |
| 23 | 8:51 | Tour tip: Result and Module overview | Missing | Tour not built. |
| 24 | 8:52 | Tour tip: Actions | Missing | Tour not built. |
| 25 | 8:53 | Swap panel with Action duration tip | Covered | Swap roles in the drawer (D45). The tip is missing. |
| 26 | 8:54 | Swap panel | Covered | Swap roles. |
| 27 | 8:55 | Select two members to swap, Cancel or Proceed | Covered | Pick two people in different stages (D45). |
| 28 | 8:56 | On selecting an action: the person's reply, small avatars "click to see how they were affected", deltas, people moved | Covered | Outcome panel with faces, chips and See why. |
| 29 | 8:57 | When two actors have something to say: arrows step through each reply; Energize panel with three options, one once only | Partial | Energize options and the once only rule are covered. The outcome panel shows one quote; a second person's own reply is not stepped through. |
| 30 | 8:58 | End of the week bar, Proceed, tip "you have some news" | Differently | End week button, then the week end banner. Tip missing. |
| 31 | 13:16 | End of the week bar | Differently | As above. |
| 32 | 8:59 | News Bulletin with tip: arrow for more events | Covered | Week end news, "1 of N", Previous and Next. |
| 33 | 8:60 | News Bulletin: client email, Average Impact, See Impact, Proceed | Covered | Week end news with See impact. |
| 34 | 23:91 | See impact: red numbers over every card | Differently | See impact explains in words; the overlays were removed on purpose (spec fixes table). |
| 35 | 8:61 | Weekly report: sub module progress this week, team metrics start plus change, manager quote, a tip, Proceed to next week | Covered | Week end report: funnel this week, team over the week, stars, sponsor confidence, Team Pulse; the engine's headline sentence. No separate "Tip" line. |
| 36 | 10:76 | Weekly report, after scrolling down | Covered | As above. |
| 37 | 65:13 | Profile fields note: Attitude, Awareness, Part of the project, Responsibilities, Remarks | Partial | Our profile has previous company, tenure, experience, skills, remarks, career goal, relationships. Attitude, Awareness and Responsibilities are not fields. |
| 38 | 10:77 | Proceed: week 2 profile with the trend line, interactions list, actions now enabled | Partial | Covered except the trend chart. |
| 39 | 8:62 | Actors at the end of the week: profile says no action can be taken | Differently | Our week ends when you press End week; when days run out the actions panel says so. |
| 40 | 8:63 | Medical leave: "Something has happened!", two day break, Proceed | Covered | Medical leave trigger (SIMULATION 6.4) as an event card. |
| 41 | 8:64 | Card greyed with a MEDICAL LEAVE badge | Covered | Away people are greyed with "On leave for N days". |
| 42 | 8:65 | Milestone Reached: 25% of the module, Leaderboard or Continue, confetti | Missing | No progress milestones. We celebrate stars and badges at the week end. |
| 43 | 8:66 | News Bulletin "Fetching it" | Differently | Loading states in the week end. |
| 44 | 10:79 | Week 8: a sub module marked COMPLETE, IDLE badges on people | Differently | The sales funnel has no finish line per stage; people are never idle. Content difference, not a gap. |
| 45 | 8:67 | Tip: the Idle action is now available; a new member was inducted | Differently | Hire unlocks in week 3 ("Unlocks in week 3" on the tile). No tip. |
| 46 | 10:80 | Release from module: "position is VACANT", Induct Now | Differently | Let go, then Hire when a seat is open (D44, D53). No "vacant seat, hire now" prompt. |
| 47 | 8:68 | Thank you for playing: module completion, team metrics, email field, Email Report, Download Report | Differently | End screen: tier, score, results, moments, badges, reflection, Download PDF, Email to me (to the work address, no field). |
| 48 | 10:81 | Completed bar: View Summary, View Module Overview, View Result Overview | Differently | End screen: View my report, Look at the board. |
| 49 | 10:78 | Clicking Result Overview at the end: person by week table | Differently | Report: "Your people over the run" and "Your team over the run". |
| 50 | 23:119 | Clicking Module Overview at the end: per sub module, week by week | Differently | Report: Business results with the funnel. |
| 51 | 65:9 | Sales version board: Full Screen, Support, Exit; sales funnel; target; sales actions | Partial | Our board is this version (Sales Elevator). Full Screen, Support and Exit are missing. |
| 52 | 65:11 | A newer board with a renamed cast and actions (Meet the Team, Connect One on One), Leaderboard link, no Video | Reference | A content variant, shown for comparison. |

## Loading screens

| # | Node | What it is | Status | Where in our app |
|---|---|---|---|---|
| 1 | 11:2 | Loading tile spinner over the office | Covered | Loading screen. |
| 2 | 11:3 | Funnel loading animation | Covered | Loading screen (our own art). |

## Walkthrough screens, sim

All 17 are tour tips. The tour is not built, so each is Missing. The right column says whether the thing the tip points at exists.

| # | Node | Tip | Status | The feature it points at |
|---|---|---|---|---|
| 1 | 11:7 | Objectives and Tutorial | Missing | Not in our HUD (D38). |
| 2 | 11:8 | Video and Leaderboard | Missing | Not in our HUD; rank is in the score breakdown. |
| 3 | 11:9 | Tick tock: day, week, timer | Missing | Covered: HUD clock. |
| 4 | 11:10 | Sub modules of the app, hover (i) | Missing | Stages covered; no info hover. |
| 5 | 11:11 | Know your team member | Missing | Covered differently in onboarding. |
| 6 | 11:12 | Summary: result trend and interactions | Missing | Interactions covered; trend chart missing. |
| 7 | 11:13 | Actions in the profile | Missing | Covered: Take an action in the profile. |
| 8 | 11:14 | Leadership Approach, set every week | Missing | Covered: style setting. |
| 9 | 11:15 | Notifications and View History | Missing | Outcome covered; History missing. |
| 10 | 11:16 | Team Performance | Missing | Covered: KPI tiles. |
| 11 | 11:17 | Module Progress | Missing | Covered: target tile. |
| 12 | 11:18 | Result and Module overview | Missing | Partial: week end and report only. |
| 13 | 11:19 | Actions panel and its (i) | Missing | Panel covered; overview of all actions missing. |
| 14 | 11:20 | Action duration | Missing | Covered: cost in days. |
| 15 | 11:21 | End of Week, you have news | Missing | Covered differently: End week, week end. |
| 16 | 11:22 | More events: arrow then Proceed | Missing | Covered: week end news. |
| 17 | 11:23 | Idle Action now available | Missing | Covered differently: Hire unlocks in week 3. |

## Walkthrough screens, demo

The same tips inside the demo, with the Exit DEMO tab. All Missing (no tour, no demo).

| # | Node | Tip | Status |
|---|---|---|---|
| 1 | 11:43 | Objectives and Tutorial | Missing |
| 2 | 11:44 | Tick tock | Missing |
| 3 | 11:45 | Sub modules of the app | Missing |
| 4 | 11:46 | Know your team member | Missing |
| 5 | 11:47 | Summary in the profile | Missing |
| 6 | 11:48 | Actions in the profile | Missing |
| 7 | 11:49 | Leadership Approach | Missing |
| 8 | 11:50 | Notifications | Missing |
| 9 | 11:51 | Team Performance | Missing |
| 10 | 11:52 | Module Progress | Missing |
| 11 | 11:53 | Result and Module overview | Missing |
| 12 | 11:54 | Actions | Missing |
| 13 | 11:55 | Action duration | Missing |

## Events

| # | Node | What it is | Status | Where in our app, or what is missing |
|---|---|---|---|---|
| 1 | 13:5 | History of Previous Interactions (demo) | Partial | Profile timeline only. |
| 2 | 13:6 | A person's reply to an action, with quote and changes (demo) | Covered | Outcome panel. |
| 3 | 13:7 | Reply to a swap, avatars of others affected; HUD shows Video and Leaderboard | Covered | Outcome panel. Video and Leaderboard links missing (see above). |
| 4 | 13:8 | Second person's reply, with the Energize panel open | Partial | One quote per outcome (see play 29). |
| 5 | 13:9 | News Bulletin: client email, See Impact | Covered | Week end news. |
| 6 | 13:10 | Weekly report with positive changes | Covered | Week end report. |
| 7 | 13:11 | Medical leave | Covered | Event card. |
| 8 | 13:12 | Milestone Reached, Leaderboard or Continue | Missing | No progress milestones. |
| 9 | 13:13 | News Bulletin "Fetching it" | Differently | Loading state. |
| 10 | 13:14 | History, collapsed | Partial | Profile timeline only. |
| 11 | 13:15 | History, expanded per person | Partial | Profile timeline and See why. |
| 12 | 13:17 | See impact overlays on every card | Differently | Words, not overlays (spec fixes table). |
| 13 | 13:18 | Weekly report with a negative change | Covered | Week end report. |

## What to do about each gap

Ordered by how much the participant loses without it.

| # | Gap | Status | Recommendation |
|---|---|---|---|
| 1 | Guided tour over the board, profile, actions, outcome and week end (43 screens) | Missing | **Build.** The spec requires a replayable tour that runs once per area and never over a dialog, with the clock paused. Reuse the 1.0 tip order and text, worded for 2.0. |
| 2 | HUD menu: Objective, Tutorial, Funnel, History, Leaderboard, Help | Missing | **Build** the panels the spec lists, then show the menu on the engine board (lifting D38). Objective rereads the sponsor letter and targets. |
| 3 | Demo or practice round before the run, with Exit demo and Play simulation | Missing | **Adapt to 2.0.** Offer an optional, unscored practice (a short guided week or the Week 0 practice chat, D16) after onboarding, with "Skip to the simulation". Needs a design and storyline config. |
| 4 | History of interactions, team wide, week by week, each person's changes | Partial | **Build** the spec's History panel (filterable by person), linked from the outcome panel the way 1.0's View History was. |
| 5 | Result overview and module overview on demand during play | Partial | **Build** into the Funnel and History panels: the funnel this week and so far (already drawn at the week end), and each person's result by week. |
| 6 | Result trend chart in each profile | Partial | **Build** a small result line in the profile; the series already exists for the report's people section. |
| 7 | Help and support (Support tab, contact form) | Missing | **Build** the spec's Help panel (controls, voice tips, support contact). The form itself can be a link the launch provides, since KNOLSKAPE support sits outside the app. |
| 8 | Introduction video and transcript, replayable during play | Partial | **Adapt.** The video slot exists when a storyline sets one; add a transcript tab (also an accessibility need) and replay from Tutorial. |
| 9 | Teaching the leadership model with worked examples (the transcript content) | Partial | **Adapt** into the Tutorial and the "What do D, G, P and E mean?" legend: one short example per need, written for the storyline's lens. |
| 10 | Overview of all actions with a description each (Actions (i)) | Partial | **Build** an "About these actions" list behind an info button on the Actions panel. |
| 11 | Stage info hover: what a stage does and which skills suit it; Module Scope table | Missing | **Adapt** as a popover on each stage header, with the same text in Objective. Content comes from the storyline. |
| 12 | When several people reply, step through each reply | Partial | **Adapt** if the engine returns more than one reaction line: let the outcome panel page through them. Check with design first. |
| 13 | Progress milestones (25%, 50%, 75%) with a celebration and a Leaderboard link | Missing | **Adapt** or drop: a short milestone moment at 25, 50 and 75% of the revenue target, honoring the celebration setting and reduced motion. Low priority, since stars and badges already reward progress. |
| 14 | Full Screen and Exit in the top bar | Missing | **Build** a full screen toggle in Settings (small). Exit can be Pause, which already saves; a true exit back to the LMS needs the launch's return address. |
| 15 | Profile menu with Logout | Missing | **Drop.** The LMS or GenieKreator owns sign in; the session timed out dialog covers the case we own. |
| 16 | Tips at key moments (end of week, idle or hire unlock, more events) | Missing | **Build** with the tour: one time tips when a feature first appears, such as Hire unlocking in week 3. |
| 17 | Profile attributes Attitude, Awareness, Responsibilities | Partial | **Adapt** only if authors want them: they are storyline content, so add optional profile fields to the config rather than to the UI. |
| 18 | Org chart with You, a peer team lead and the COO | Reference | **Decide** with the next storyline. Our board groups people by stage; a "You" node or reporting line would be a design change. |
| 19 | Large coloured numbers over cards (actions and See impact) | Differently | **Keep the 2.0 way.** The spec's fixes table removed them because they hid faces and stats. |
| 20 | Read every profile before play | Differently | **Keep the 2.0 way** (3 profiles, spec onboarding step 6). |
| 21 | Email the report to a typed address | Differently | **Keep the 2.0 way** (sent to the work address from the launch). |
| 22 | Vacant seat prompt with Induct Now after someone leaves | Differently | **Optional:** a "seat open, hire now" nudge after Let go. Small. |

Not in the original screenshots, and not in our app either: a glossary, an FAQ, sound or music settings. Our app adds things 1.0 did not have: Settings (text size, voice, captions, reduced motion, session clock), Pause, the welcome back recap, the inbox, live conversations by voice or text, Team Trust, Team Pulse, sponsor confidence, the Leadership Score with stars, streak and badges, the reflection, and the development and group reports.
