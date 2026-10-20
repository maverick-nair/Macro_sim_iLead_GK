# iLead 2.0: two products, one ecosystem

What we build, for whom, and how every participant facing element traces back to where an author created it. Decisions D180 to D185. The machine readable form of the trace matrix is `src/shared/trace.ts`.

## 1. Two products

| | GenieKreator | Simulation Player |
|---|---|---|
| Who | Authors: L&D professionals, instructional designers, consultants | Participants: managers and learners |
| Job | Create, preview, refine, validate and ship a leadership simulation, no code | Lead a team through a realistic business run and learn from it |
| Feels like | A modern, intelligent studio that explains itself | A game set in a real business, never an authoring tool or an LMS |
| Never | Asks the author to understand the architecture; offers an option with no participant impact | Shows authoring or system complexity; shows content nobody configured |
| Code | `src/author` (lazy, `/author`) | `src/app`, `src/components`, engine `src/engine` |

They meet in one contract: the **StorylineConfig** (`src/engine/config.ts`). GenieKreator's draft exports to it (`src/author/model/export.ts`); the engine plays it; the player renders the engine's view (`src/engine/sim/view.ts`, `src/engine/contract.ts`), never fixtures.

## 2. Personas

**Authors**
- *L&D professional.* Owns a programme. Needs a credible simulation for a client cohort, on brand, fast, with reports that hold up with sponsors.
- *Instructional designer.* Shapes the experience: story, characters, events, the leadership lens, what is scored. Wants to see what participants will see while editing.
- *Consultant.* Tailors a simulation to a client's industry and challenge, often from a brief or documents. Wants the client's language, people and dilemmas, and a SCORM package for the client's LMS.

**Participants**
- *Manager.* A first time or experienced people leader. Plays a few weeks of a team's life in 30 to 60 minutes a week; wants it to feel like their job, and a report that tells them something true.
- *Learner in a programme.* Takes it in an LMS or a cohort, alongside others; cares about clarity, fairness, accessibility and their progress.

## 3. GenieKreator: UX philosophy and information architecture

Every section answers four questions, in this order:
1. **What am I creating?** A plain title and one line.
2. **Why does it matter?** What it changes for the participant or the score.
3. **Where will it appear?** The participant surfaces it reaches (from `surfacesFor(section)`).
4. **What will the participant experience?** A contextual preview of the real participant view.

**Workflow.** Build, then Preview, then Refine, then Validate, then Download SCORM or Publish.

| Step | Where | What happens |
|---|---|---|
| Build | Kora chat, then the workspace sections | Kora drafts from the brief; the author edits any field |
| Preview | Play a week, from any section | A participant like run of the latest saved draft, marked as a test, never in real data or reports |
| Refine | Back to the section | Edit, re-preview, no publish needed |
| Validate | Test with synthetic players, Review and publish | Export issues in plain words, calibration, the publish checklist |
| Download SCORM / Publish | Review and publish | The same version as a SCORM package (rules in `lms`, D184) or published to a cohort |

**Sections** (`src/author/ui/sections.ts`, in nav order):

| Tab id | Section | Holds |
|---|---|---|
| `overview` | Overview | Status of every section, the simulation title |
| `brief` | Brief | Participants, industry, challenge, purpose, run length, language |
| `story` | Story and world | Company, office image, logo, product and portfolio view, market, sponsor, intro screens |
| `process` | Work process | Stages, revenue target, weeks, days, pacing, people dynamics, business variables |
| `team` | Team | Characters (photo, voice, persona, concern, stats) and stakeholders |
| `lens` | Leadership lens | Styles, needs, fit rules, secondary lens |
| `actions` | Actions and conversations | What the participant can do, costs, goals, impact by style, Scored on |
| `events` | Events | Timing, delivery, response, escalation, decisions, stakeholder requests |
| `scoring` | Scoring and report | Purpose, skills, rating scale, report sections |
| `brand` | Brand and theme | Colours, logo, font, look |
| `calibrate` | Test with synthetic players | Author tool only: checks scoring with synthetic runs |
| `publish` | Review and publish | Checklist, LMS rules (completion, pass, score, SCORM version, connected mode), publish |

## 4. Simulation Player: UX philosophy and journey

Immersive, game like, a realistic business: the participant is a manager in a company with a product, a team, a sponsor and a market. The board is their office; the office image, brand and logo are the client's. Numbers always say why they moved. The participant never sees ids, rules, AI scores or system errors.

**Journey.**
1. **Onboarding scenes.** Sponsor welcome letter (welcome, product, targets), the intro screens in order, the product portfolio, meet the team, the leadership lens tutorial, optional welcome video, Week 0 practice, guided tour.
2. **Week loop.** Set each person's style, then spend the week's days on actions.
3. **Actions.** Decisions with options, or live conversations with AI characters (meeting, 1:1, email, chat, plan, interview, sponsor briefing, stakeholders); each ends in an outcome with reasons.
4. **Events.** Cards, bulletins, chats, emails and sponsor calls; decisions with a deadline; stakeholder requests.
5. **Week end.** Stars, what changed, sponsor confidence, unlocks, news for next week.
6. **End.** Final score and tier, badges, reflection.
7. **Report.** The development or assessment report, its sections chosen by the author.

## 5. The traceability principle

- Every participant facing element traces back to the GenieKreator section and field that created it.
- Every GenieKreator field has participant impact, or is labelled an author note (`AUTHOR_NOTES` in `export.test.ts`).
- No hardcoded simulation content: the player renders what was configured, through the view.
- One registry, `src/shared/trace.ts`, maps StorylineConfig paths to `{ section, label, surfaces }`. GenieKreator's "Where it appears" panels read it forwards (`surfacesFor(section)`), the preview's "Show where this comes from" overlay reads it backwards (`pathsFor(surface)`, `traceOf(path)`).
- A test (`trace.test.ts`) walks the StorylineConfig schema: every field is traced or listed in `INTERNAL` with a reason (`id`, `mechanics`, `author`, `default`). `export.test.ts` keeps the other direction: every draft field reaches the storyline.

## 6. Trace matrix

Participant element, then where the author creates it (section and field), the StorylineConfig path, and the player surfaces. Surface ids are defined with their participant description in `SURFACES`.

| Participant element | GenieKreator section: field | StorylineConfig path | Player surface(s) |
|---|---|---|---|
| Report header title | Overview: Simulation title | `name` | report.cover |
| Company name | Story and world: Company name | `organisation` | onboarding.sponsor, report.cover |
| Welcome letter pages | Story and world: Welcome letter, product and targets screens | `intro.welcome`, `intro.product`, `intro.targets` | onboarding.sponsor |
| Intro screens and titles | Story and world: Intro screens, Screen title | `intro.screens[]` | onboarding.screens |
| Office behind every screen | Story and world: Office image | `world.office.image` | theme.backdrop |
| Company logo | Story and world: Logo (letters or upload) | `world.logo` | onboarding.sponsor, theme.logo |
| Product portfolio scene | Story and world: Product, selling points, Product view, product photo | `world.products[]` | onboarding.portfolio |
| What characters know of the company | Story and world: what it does, HQ, team, product, customers, rivals, office words | `world.about` ... `world.rivals[]`, `world.office.description` | live.npc |
| Sponsor name and title | Story and world: Sponsor, Title | `sponsor.name`, `sponsor.title` | onboarding.sponsor, board.sponsor, live.npc |
| Sponsor's voice | Story and world: Voice | `world.sponsorVoice` | live.npc, board.sponsor |
| Deal value | Story and world: Average deal value | `money.valuePerConversion` | board.funnel, board.hud, report.business |
| Money format and currency | Brief: Language | `money.locale`, `money.currency` | board.hud, report.business |
| Live conversations per week | Brief: Run length | `time.liveCap` | board.actions |
| Stages | Work process: Stage name, People, Passes on | `stages[].name`, `.ideal`, `.conversionRatio` | board.funnel, onboarding.sponsor, report.business |
| Revenue target | Work process: Revenue target | `money.target` | board.hud, onboarding.sponsor, weekend.summary, report.business |
| Run length | Work process: Weeks, Days per week | `time.period.count`, `time.subPeriod.perPeriod` | board.hud, board.actions, weekend.summary |
| Pacing | Work process: Pacing | `money.inputPerSubPeriod`, `drift`, `gamification.sponsor.escalation` | board.funnel, board.team, board.sponsor |
| People dynamics | Work process: People dynamics | `dynamics` | board.team, weekend.summary |
| Business measures | Work process: Business variables | `variables[]` | board.variables, weekend.summary, report.business |
| Team member card | Team: name, job title, stage, photo | `members[].name`, `.title`, `.homeStage`, `.portrait` | board.team, onboarding.team, live.npc, live.outcome |
| Profile facts and stats | Team: previous company, tenure, experience, persona, relationships, communication style, starting stats, best stage | `members[].profile.*`, `.start`, `.byStage` | board.profile, onboarding.team |
| Hidden concern and career goal | Team: Hidden concern, What they say, Career goal | `members[].hiddenConcern`, `.concernLine`, `.careerGoal` | board.profile, live.npc, live.brief |
| How a character talks and sounds | Team: Voice, persona, motivations, reactions, topics to avoid | `members[].voice`, `members[].npc` | live.voice, live.npc |
| Stakeholders and their interactions | Team: Stakeholders | `stakeholders[]` | board.stakeholders, live.brief, live.npc, live.outcome, report.stakeholders |
| Styles, needs and the tutorial | Leadership lens: styles, needs | `lens.id`, `lens.styles[]`, `lens.needs` | onboarding.lens, style.setting, live.brief, report.styles |
| Whether a style fits | Leadership lens: Fit rules | `lens.fit` | style.setting, live.outcome, weekend.summary, report.styles |
| Actions drawer | Actions: name, description, plays as, days, again after, available from | `actions[].name` ... `.unlockPeriod` | board.actions, board.hud |
| Conversation goal and opener | Actions: Goal, Who starts | `actions[].live.goal`, `.live.opening` | live.brief, live.npc |
| Options and their impact | Actions: options, impact by style | `actions[].options[].label`, `.style`, `.effects`, `.away` | board.actions, live.outcome, board.team |
| Skills a conversation rates | Actions: Scored on | `report.linkage` | report.skills |
| Event cards and messages | Events: title, body, kind, timing, who, how it arrives | `events[].title`, `.body`, `.card`, `.period`, `.window`, `.when`, `.if`, `.target`, `.delivery` | board.events, weekend.summary |
| Event consequences | Events: impact, response, if ignored | `events[].impact`, `.response`, `.escalation` | live.outcome, board.team, board.sponsor |
| Decisions | Events: decision (known, options, deadline, default) | `events[].choice` | board.choice, weekend.summary, report.decisions |
| Stakeholder requests | Events: from a stakeholder, request | `events[].stakeholder`, `.request`, `.business` | board.events, board.stakeholders |
| Report purpose | Scoring and report: Purpose | `purpose` | report.summary, report.sections, leaderboard |
| Skills and levels | Scoring and report: Skills framework, Rating scale | `report.skills[]`, `report.scale[]` | report.skills, report.summary, end.screen |
| Report sections | Scoring and report: Report sections | `report.sections` | report.sections |
| Colours | Brand and theme: Main and second colour | `brand.colors` | theme.colors |
| Logo next to the wordmark | Brand and theme: Logo, Brand name | `brand.logo`, `brand.name` | theme.logo |
| Typeface | Brand and theme: Font | `brand.font` | theme.font |
| Dark or light | Brand and theme: Look | `brand.mode` | theme.mode |
| LMS completion, pass and score | Review and publish: completion, pass, score, SCORM version, connected mode | `lms.*` | lms.record |

**Trace gaps** (participant facing, from engine or template defaults, not authored in GenieKreator yet; `INTERNAL` kind `default`): sponsor portrait, briefing weeks and style line; stage info popovers (`stages[].about`, `.suits`); profile skills, awareness and responsibilities; portraits by mood; hire candidates; conversation rubrics, turn limits and minutes; event away days, bulletin impact lines and labels; people triggers; gamification (stars, tiers, badges, unlocks, leaderboard); the report's narrative bank and plans; Week 0 practice; welcome video; guided tour wording; milestones; the tutorial's worked examples.

## 7. Images and the look (D181 to D183)

- Images are site paths (the library, `/assets/...`), https, or uploads embedded as data URLs: at most 300 KB each, 3 MB per storyline. GenieKreator shrinks uploads to fit; export names any image it cannot use, and the participant sees the fallback.
- The player applies the storyline brand through the theme loader (contrast corrected). A theme from the server (`GET /theme` or the launch payload) wins over it as a whole. The office image goes behind the screens either way, under a veil for uploads so text stays readable.
