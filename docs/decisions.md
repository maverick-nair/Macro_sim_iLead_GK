# Decisions log

As of 2026-10-01 (M0). Three kinds of entry:

- **C-xx Conflict.** Two docs disagree. Resolved by doc priority (Screens 1, Config Spec 2, iLead 2.0 Design 3, Participant Spec 4, Teardown reference). The losing reading is recorded so it can be revisited.
- **D-xx Open decision.** A doc lists it as undecided. Not resolved here: implemented as configurable, marked `TODO(decision)` in code with this id, default noted.
- **A-xx Assumption.** The docs are silent. A default was chosen so work can continue; each one is easy to change and is listed with where it lives.

Questions that need your input are in `docs/plan.md` section 15 (Q1 to Q7). Answers will be recorded here.

## Conflicts (resolved by priority)

| ID | Topic | Docs and what they say | Resolution | Where it applies |
| --- | --- | --- | --- | --- |
| C-01 | Generation order | Config Spec: context, process, NPCs, leadership, actions, events, **gamification, then report**. iLead 2.0 Design: report is step 7, gamification step 8 | Config Spec (priority 2): gamification before report | `@gk/generators` order (M4) |
| C-02 | Name of area 3 | Config Spec: "NPCs". Screens doc rail and editors: "Cast" | Screens (priority 1): UI label "Cast"; schema key `cast` | Area rail, schema |
| C-03 | Set of quality gates | Screens P2: 7 automated gates (balance, style coverage, rubric calibration, persona, content safety, linkage, accessibility). Config Spec: the same 7 plus "Preview, pass rule: author sign off". iLead 2.0 Design: 4 gates | Screens: 7 gates block publish. Playtest sign off is recorded but does not block (see D-13) | Quality check page, publish gate (M8, M9) |
| C-04 | Balance test pass rule | Config Spec: strong reaches the target and Gold; careless stays below target and in Bronze. iLead 2.0 Design: strong must reach the target; all other bots (one style, careless, random) must not | Config Spec rule decides pass or fail. One style and random outcomes are shown as warnings with a dominant strategy flag | `@gk/quality` balance gate (M8) |
| C-05 | Time and pacing defaults | Config Spec defaults: play mode Full, real time limit 20 minutes, no clock pauses, save and resume off, 1 sitting. iLead 2.0 Design: Full takes 95 to 105 minutes, real time pauses during live interactions, save and resume required for Full. Participant Spec: clock pauses during live interactions and modals | Config Spec values seed the template. The Time and pacing editor shows a warning when Full mode is combined with a limit under 95 minutes or with save and resume off. See also D-05 | Seed (M1), Time editor (M5) |
| C-06 | Default team KPI dials | Config Spec: Skill, Morale, Result. Participant Spec: Skill, Morale, Result, Trust | Config Spec: 3 dials | Seed (M1) |
| C-07 | Trust | Config Spec: starting Trust "Not used" in the iLead default (AI default 50). iLead 2.0 Design: Trust is part of every NPC's state and drives consequences, the People score, Team Pulse and badges | Config Spec default unless you choose otherwise in Q2. If Trust is off, all Trust deltas are ignored and P uses morale only (matches the worked example "no trust data") | Seed (M1), engine (M2) |
| C-08 | Needed style override stored twice | Config Spec lists "Needed style override" under NPC stats and "Per member exceptions" under Leadership | Not a true conflict: one source of truth, `leadership.memberExceptions`, shown in both the Leadership editor and the NPC "Stats and fit" tab | Schema (M1) |
| C-09 | "AI RolePlays" vs "AI RolePlay" | Screens E1 (existing screen, no change) and today's UI show the card title "AI RolePlays". The brief says to use the name "AI RolePlay" exactly | Keep the existing E1 card title "AI RolePlays" (the screen is marked no change); use "AI RolePlay" everywhere else, for example "1:1 AI RolePlay". Easy to flip | E1 card copy (M3) |
| C-10 | Product name spelling | Brand Guidelines artifact: "Genie Kreator" (two words). Brief and all five docs: "GenieKreator" | Brief and docs: "GenieKreator" | All UI copy |
| C-11 | Funnel ideal | Config Spec and Teardown: ideal 3, 2, 1, 1, 1 per week. Teardown also observed a cumulative ideal at Week 3 of Lead 48, Qualify 24, Proposal 7, Negotiate 4, Conversion 2, which does not follow from 3, 2, 1, 1, 1 | Config Spec values. The Week 3 observation is recorded as unexplained and not reproduced | Seed, engine |
| C-12 | Brief upload kinds | Screens B1 question 8: org chart, process docs, values, product sheets, brand kit, policies. Config Spec question 8: the same but skills framework instead of policies | Union of both lists; the skills framework upload also appears in question 5 as Screens describes | Brief (M4) |
| C-13 | Leaderboard default | Config Spec: cohort, top 10, named. iLead 2.0 Design guardrail: off by default when results are used for selection | Consistent once the use declaration is applied: the seed uses the Config Spec default, and setting the use declaration to selection switches the leaderboard default off (Config Spec: use declaration "changes report, leaderboard and review defaults") with the Governance warning from the Screens doc | Governance editor (M5), seed |

## Open decisions (configurable, `TODO(decision)`)

| ID | Source | Question as written | How it is built | Default until decided |
| --- | --- | --- | --- | --- |
| D-01 | Screens, Open decisions | Do cards show DILO in full or as the acronym? | Copy key `nav.dilo.cardTitle` | "Day in the Life (DILO) Simulations" (as the brief instructs) |
| D-02 | Screens, Open decisions | Which other formats appear in the Business Simulations catalogue at launch? | Catalogue entries are seeded data with status available or coming soon | iLead available; placeholders per Q4 |
| D-03 | Screens, Open decisions | Should Start from my brief be the only start mode in the first release? | Feature flag per start mode (`startModes.brief`, `.original`, `.duplicate`) | All three on |
| D-04 | Screens, Open decisions | Who may approve the Report area: any reviewer, or only an L&D lead role? | Org setting `reportApproverRole: "any_reviewer" \| "ld_lead"` | `any_reviewer` |
| D-05 | iLead 2.0 Design, Decisions | Default session model: Full, Standard or Lite, and one sitting or two? | `time.playMode`, `time.sittings`; mode presets from the Design doc table | Config Spec: Full, 1 sitting (see C-05) |
| D-06 | iLead 2.0 Design, Decisions | Live cap: 2 per week or author defined? | `time.liveCap.perWeek` and `.perRun` editable | 2 per week |
| D-07 | iLead 2.0 Design, Decisions | Development report only, or a human assessor review tier for high stakes use? | `report.humanReview`: off, sample audit, full review (Config Spec setting) | Sample audit (Config Spec) |
| D-08 | iLead 2.0 Design, Decisions | Default skills framework: iLead defaults or the KNOLSKAPE Skills Ontology? | `report.skillsFramework.source`; the Ontology option is present but has no content in the repo | iLead default 8 skills (Config Spec) |
| D-09 | iLead 2.0 Design, Decisions | Pilot scope: convert Meet face to face and Send email first? | `actions.catalogue[].mode` per action | Modes from the Design doc action table (4 static, 3 hybrid, 7 live, 2 new live) |
| D-10 | Teardown, Open questions | Is the style fit matrix per member or global bands? | Global readiness bands plus per member exceptions | Global bands (A-11) |
| D-11 | Teardown, Open questions | Is the funnel conversion formula documented? | `process.throughput` weights and reference productivity | Derived default (plan 5.4) |
| D-12 | Teardown, Open questions | What do Give feedback and Meet the team do, and how does Hire present candidates? | Defined by the iLead 2.0 Design as live formats (chat or 1:1 AI RolePlay; team meeting; interview 2 candidates). No observed static data exists for them | Live formats per the Design doc |
| D-13 | Raised by C-03 | Must the author's playtest sign off block publish? | Governance flag `requirePlaytestSignOff` | Off (Screens gate list) |

## Assumptions (docs silent)

| ID | Topic | Assumption | Where | Why |
| --- | --- | --- | --- | --- |
| A-01 | Generation slots for areas the Config Spec order omits | Full order: Context, Process and targets, Branding and media, Cast, Time and pacing, Leadership model, Actions, Events, Gamification, Report, Language and access, Governance | Generators (M4) | Keeps the Config Spec relative order and the Screens group order (World, Rules, Experience and output); branding before cast so portraits use the art style; time before actions so live suggestions can use the time budget |
| A-02 | Progress formula granularity | Gate part = 20% × passed gates / 7; approval part = 10% × approved areas / 12; total rounded to a whole percent | Progress service (M5) | Screens gives the weights, not whether parts accrue per item |
| A-03 | Weekly drift trigger | At week end, each available member not targeted by any action that week (team actions count) loses `weeklyDrift.morale` and `weeklyDrift.result` | Engine (M2) | Teardown: "dropped about 3 points at each week end when nothing addressed it" |
| A-04 | When a promise counts as kept | A promise logged in week n is kept if the leader takes any action with that NPC by the end of week n+1; otherwise broken. Kept and broken Trust deltas are engine parameters exposed as `leadership.promises` | Engine (M2) | Design doc says a broken promise costs Trust but not how keeping is detected |
| A-05 | Overall band from dimension bands | Any red flag forces Harmful; otherwise the median of dimension bands, ties to the lower band | Evaluator (M7) | Design doc step 3 converts to a band without a rule |
| A-06 | Leadership component with no live interactions | L = style fit % | Engine (M2) | Implied by the worked example (L = 69 with style fit 69% and no live interactions) and matches the stars rule |
| A-07 | Score rounding | Leadership Score rounded half up to an integer before tier lookup (425.25 gives 425) | Engine (M2) | Worked example shows 425 |
| A-08 | Generation failure in an upstream area | Later areas use iLead seed values for the missing input and are marked amber | Generation jobs (M4) | Screens: "Retry for that area only; the rest continue" |
| A-09 | Provenance of copilot changes | Applied copilot proposals are recorded as `source: author, via: copilot` (the AI badge clears) | Patch service (M5) | Author explicitly approved the change; also counts as editing the area |
| A-10 | Attention metric: average Result | Mean of the member's Result sampled after each player action | Engine report (M2) | Teardown figures are exact elevenths and the run had 11 actions: Kent 464/11 = 42.18, Jack 1032/11 = 93.82 |
| A-11 | Readiness bands | 2 by 2 on Skill 50 and Morale 60: Directing (low, low), Guiding (low skill, high morale), Partnering (high skill, low morale), Entrusting (high, high) | Seed (M1), pending Q1 | Reproduces every Teardown observation (see plan 5.4) and matches Situational Leadership |
| A-12 | What a swap does to stats | The member's Skill, Morale and Result become their role fit Skill, Motivation and Performance for the new role, then any prerequisite penalty applies | Engine (M2), pending Q1 | Teardown: Assess "predicts Skill, Motivation, Performance in the new role"; swap results move by role |
| A-13 | Sponsor briefings and the live cap | Sponsor briefings do not count toward the weekly live cap | Engine (M2) | Design doc play modes: "2 per week plus 2 sponsor briefings" |
| A-14 | Status after publish | Product stays Published; later edits show "Unpublished changes" and a new review cycle | Products (M9) | Screens lists the four statuses but not the post publish edit state |
| A-15 | Skill rating from bands | Skill score = mean of linked dimension band scores (100, 70, 35, 0); level = highest scale level whose `minScore` it reaches; overall band = level of the mean skill score | Engine report (M2, M9), pending Q5 | Design doc says "integrated" without a rule |
| A-16 | Randomness and same day ordering | Named RNG streams per subsystem; on a given day fixed events fire before random ones, in deck order | Engine (M2) | Keeps runs stable when features are added |
| A-17 | Percent display rounding | Engine stores exact fractions; display rounds half up to whole percent | Engine, report | 13/45, 6/45, 16/45, 10/45 and 31/45 display as 29, 13, 36, 22 and 69 |
| A-18 | Local adapters and sign in | Local disk storage and console mailer in dev and tests; dev sign in with seeded users, pending Q3 | Infra (M3, M4) | Docs do not cover infrastructure |
| A-19 | Type chips | E2 Simulations list uses short chips "Business" and "DILO"; Products cards for iLead builds show "Business Simulation" plus a format chip "iLead" | Products list (M3) | Both wordings appear in the Screens doc for different screens |
| A-20 | Meaning of "style fit %" | In the Leadership Score it is contextual capability % over the whole run; in weekly stars it is the share of correct weekly settings that week; `style_fit_count` is the number of correct weekly settings that week | Engine (M2) | Read the Room fires at "9 or 10 of 10 in one week" |
| A-21 | Weekly drift amount | 3 points of Morale and 3 of Result | Seed (M1) | Config Spec and Teardown say "about 3 points per week" |

## Evidence notes

**Report fixture (M2).** The Teardown run has 45 style tagged choices: 40 weekly settings (10 members × 4 weeks) and 5 individual actions. Weekly mismatches were 5, 3, 3 and 1, so 28 of 40 settings were correct; the actions were Meet Kent with "discuss role" (Partnering, wrong), Coach Kent with "handhold" (Directing, right), Set Goals Peter with "tasks and milestones" (right, and Peter at 10/15 needs Directing, so the option is tagged Directing), Meet Kent with "emotional support" (Guiding, wrong) and Coach Mandy with "handhold" (Directing, right): 3 of 5. That gives 31 of 45 = 69%. Counts by style: actions Directing 3, Guiding 1, Partnering 1, so weekly settings were Directing 10, Guiding 5, Partnering 15, Entrusting 10. The M2 fixture reconstructs a per member weekly log that satisfies all of these counts and the Teardown's per member notes (for example Kent's intent is Directing).

**Leadership Score fixture (M2).** B = 30,000 / 240,000 × 100 = 12.5; P = 50 + (57 - 54) + 0.5 × 0 = 53; L = 69. Score = 9 × (3.75 + 15.9 + 27.6) = 425.25, displayed 425, Bronze (below 500).
