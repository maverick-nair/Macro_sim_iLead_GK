# Calibration with synthetic players

GenieKreator's "Test with synthetic players" step: before a draft is published, synthetic players at four proficiency levels (and, when the author turns them on, four player types) play the whole simulation, conversations included, and the author sees whether it rewards good leadership. Decisions: D112 to D120, D132 and D149 to D151 (`docs/DECISIONS.md`). Design: `docs/design/genie/Calibrate.dc.html` (setup and results), `CalibrateRun.dc.html` (one playthrough), `Publish.dc.html` (the "Synthetic players" check).

This is a different tool from `npm run calibrate` (`scripts/calibrate.ts`, SIMULATION 9), which tunes a storyline's funnel numbers with three simple policies. The synthetic players test a draft as authored, through the same engine, evaluator and NPC the participants meet.

## 1. Where the code is

| Part | Where |
|---|---|
| The player that runs a policy through the engine | `src/engine/sim/synthetic.ts` (`playSynthetic`, `PERSONA_COPY`, `policyOf`) |
| Traits, the policy hooks and the four levels | `src/engine/sim/syntheticPolicy.ts` (`PERSONA_TRAITS`, `SKILL_TRAITS`, `Policy`, `PlayerApi`) |
| The four player types | `src/engine/sim/syntheticArchetypes.ts` (`ARCHETYPES`, `ARCHETYPE_POLICIES`) |
| The probes | `src/engine/sim/syntheticProbes.ts` (`Probe`, `probePolicy`, `topPairs`) |
| What they say offline, and the speaker interface | `src/engine/sim/syntheticSpeech.ts` (`templateSpeaker`, `SyntheticSpeaker`, `SpeakerContext`), the phrasings in `syntheticPhrases.ts`, what they hear in `syntheticListen.ts` |
| What they say with AI | `ai/src/synthetic/player.ts`, `createSyntheticPlayer(config)` from `ai/`; prompt `ai/prompts/synthetic-player.md` |
| Run, aggregate, check, explain | `src/author/calibrate/logic/` (`run.ts`, `aggregate.ts`, `strategy.ts`, `archetypes.ts`, `mechanics.ts`, `findings.ts`, `bundled.ts`, `extract.ts`, `explain.ts`, `schema.ts`, `publish.ts`, `client.ts`, `worker.ts`, `chunked.ts`) |
| The screens | `src/author/calibrate/ui/` (`CalibrateView`, `Setup`, `Results`, `PlaythroughView`, stories) |
| Public entry | `src/author/calibrate/index.ts`: `CalibrateSlot`, `calibrationPublishCheck` |
| Server jobs | `server/src/calibration/jobs.ts`, `server/src/routes/calibrate.ts` |
| CLI | `scripts/synthetic.ts` (`npm run synthetic`) |
| Tests | `src/engine/sim/synthetic.test.ts` (players, probes, player types, trait monotonicity, speech), `src/author/calibrate/logic/*.test.ts` (`checks.test.ts` for the D149 and D150 checks), `ai/src/synthetic/player.test.ts`, `server/test/calibration.test.ts`, `tests/e2e/calibrate.spec.ts` |

## 2. The personas

Each persona is a policy (`Policy`, D151) over the participant's view and intents (never hidden engine state): a level's traits and, for the player types and the probes, hooks that replace one part of the level's way of playing (`style`, `meetingStyle`, `weights`, `respond`, `next`, `first`, `extra`, `neediest`, `option`, `email`, `meetings`, `budget`). Its choices are probabilities drawn from a seeded stream, so playthroughs differ between seeds and replay exactly for one seed. Styles, needs and actions come from the storyline, so any lens works; the tests play Readiness Based Leadership (four styles) and a lens of five styles.

| Trait (probability unless noted) | Beginner, low performer | Developing, average | Proficient, high performer | Expert, exceptional |
|---|---|---|---|---|
| diagnose: reads a person's need and picks a style that fits | 0.1 | 0.6 | 0.8 | 0.97 |
| oneStyle: falls back to its one default style | 0.85 | 0.15 | 0 | 0 |
| adapt: looks again at each person every week | 0.2 | 0.6 | 0.8 | 1 |
| events: answers an event or message that expects an answer | 0.1 | 0.5 | 0.8 | 0.97 |
| focus: spends time on the person who needs it most | 0.2 | 0.6 | 0.75 | 0.95 |
| fitAction: picks the action that suits the need | 0.2 | 0.6 | 0.8 | 0.97 |
| keepPromises: follows up before a promise is due | 0 | 0.4 | 0.8 | 1 |
| promise: makes a promise in a conversation | 0.3 | 0.3 | 0.4 | 0.5 |
| extras: spare days on team energy, training, role fit, a hire | 0 | 0.4 | 0.6 | 0.9 |
| waste: spare days on a person action with anyone, in any style | 0.9 | 0.3 | 0.05 | 0 |
| turns: lines in a conversation (count) | 1 | 2 | 2 to 3 | 3 to 4 |
| polish: speaks at its full level (else one level lower) | 0.6 (no lower level) | 0.7 | 0.85 | 0.95 |
| slip: says something that blames | 0.04 | 0 | 0 | 0 |

Every trait but `promise` and `turns` (habits) is a skill: a test gives each level the next level's value of one trait at a time and checks the score never falls by more than 2% of the scale over ten seeds (D151). That is why polish now rises with the level, a Beginner's misread is a guess rather than a near miss, and wasted days never go on team energy.

How a week goes: every profile is opened (as a participant reading the cards would; what the persona does with it is its level), then a style for each person (default style, last week's, a diagnosis, or a near miss; a Beginner guesses). On the board, in order: answer event cards and messages it chose to answer (replies and briefings cost no time); the action an event calls for; a follow up on a promise coming due; a conversation with the person who needs it, in the member action whose authored effects do most for that need in the chosen style (a team meeting when one style fits 70% of the team, for Proficient and Expert); then spare days used well (energize when most styles fit, training for low skill, assess the person struggling most once, reassign when another stage clearly suits them, hire when someone has left) or used on whatever is at hand.

**The player types (D150)**, off by default, under "More player types" in setup:

| Player type | Plays as | What it puts first |
|---|---|---|
| Risk taker | Proficient's traits, promises freely, keeps half of them | From week 2: lets the weakest go (results under 40, twice at most), hires when someone has left, assesses anyone under par, moves people to a stage that suits them, rewards the top performer; the costliest options; the stretch style for anyone skilled |
| Conservative | Proficient's traits, adapts rarely, every event and promise kept, no extras | Two careful 1:1s a week with the people who need them most, the cheapest options, no team meetings of its own |
| People first | An Expert's words, diagnoses 90% | Team energy every week, rewards whoever is lowest, 1:1s weighted to morale, praise in every email, the people's messages first and never the sponsor's |
| Business first | Proficient's traits, no promises | The most directive style for anyone under 60 results, training every week, lets the weakest go once, assesses and moves people, rewards the top performer, answers the sponsor first and most member messages not |

They play from the participant's view like the levels; the level checks never read them (D150).

## 3. Conversations

For a conversation action the persona speaks through a `SyntheticSpeaker`. The context it gets (`SpeakerContext`): the persona and its level (with the author's words for how it plays), the lens's styles and the style it means to show, the format and action, the person (mood, trust, stats when known, the need as the persona reads it, any concern they shared), the team for a meeting, the transcript so far, which line this is, and whether it makes a promise.

- **Offline, the templates** (`templateSpeaker`, D151): one script per level and format (one to one, chat, email, meeting, sponsor briefing, interview, written plan), each move picked from a bank of phrasings (`syntheticPhrases.ts`) by a seeded choice that never repeats a phrasing in one conversation (`SpeakerContext.said`). Each line answers what the other person just said (`syntheticListen.ts` reads it as a concern, pushback, a hard or good feeling, a question, agreement or an update): comfort after a worry, a question back after pushback, a short yes after agreement, an answer to an opening question. An Expert who hears only an update from someone who seems worried asks once more; a worry shared before is followed up next time; the sponsor's question (risk, needs, people) is answered first. Readiness Based Leadership's four styles have eight written lines each and blunt ones for Beginners; any other style speaks its own short line and description in the first person in a few frames ("You paint the destination" reads "I will paint the destination"). Beginner lines are blunt and closed; Developing generic with a little acknowledgement; Proficient acknowledges, asks an open question, shows the style and agrees a next step; Expert listens first, asks what is on the person's mind, adapts, invites ideas, agrees a dated next step and keeps any promise small.
- **Apart from the evaluator.** The phrasings were written as each style is described, never from the evaluator's cue lists; the speech modules import nothing from the evaluator (a test reads their source). How often the evaluator reads a player's words as the style meant, the **evaluator agreement**, is measured per player and shown in the results ("Words read as meant"). On a lens without written phrasing the offline evaluator reads the lens's own words, as the player speaks them, so agreement there is optimistic.
- **With AI** (`createSyntheticPlayer`, server side): the model writes each line from the same context; the reply is cleaned (copy rules, length) and the template answers on any failure, refusal or unusable line. The request names what the person just said ("What they just said reads as: a worry they raised. Answer it first.") beside the transcript, and the prompt's Listening section says to answer it (`synthetic-player` version 3). Model settings default to the NPC role's (fast, low effort); `AI_PROVIDER_SYNTHETIC`, `AI_MODEL_SYNTHETIC`, `AI_EFFORT_SYNTHETIC` and the other `_SYNTHETIC` tuning variables override them (docs/AI.md section 8).

Either way the words go through the engine like a participant's: the run's evaluator rates them (the keyword evaluator offline, the model evaluator on a server with AI), the style the words show is what the engine applies, and the NPC answers. So the scoring pipeline itself is under test, not only the mechanics.

## 4. What is measured, and the checks

Per persona (`PersonaStats`): Leadership Score range, mean, median and standard deviation; its points by pillar (Business, People and Leadership weighted, and the streak bonus, which add up to the score) and the share of runs whose Business was capped at the target; the evaluator agreement; the tier of the median playthrough and the count per tier; how many reached the target tier; revenue as a share of the target; the most common overall skill level and the share of playthroughs whose level fits the persona; style fit; conversation bands; concerns surfaced.

The target tier is the author's (`targetTier`), else the second tier from the top (Gold by default). Expected overall skill levels on a scale of n levels are the persona's place on the scale, a level either side where it falls between two (`expectedLevels`): on the default five levels, Beginner Novice or Developing, Developing Developing or Proficient, Proficient Proficient or Advanced, Expert Advanced or Role Model. A playthrough without enough evidence counts as the lowest level.

| Check | Passes when | Otherwise |
|---|---|---|
| Scores rise with proficiency | each persona averages more than the one below | fail |
| Expert players reach the target tier | 80% of Expert playthroughs or more | fail |
| Beginner players do not | 10% or fewer | fail |
| Skill ratings match each level | 75% of playthroughs or more | warn from 50%, fail below |
| Conversation ratings rise with proficiency | the mean band rises (the scoring pipeline) | warn |
| Each level scores clearly apart | neighbours more than 5% of the scale apart | warn |
| No single strategy wins without good leadership | no probe averages the target tier | fail; warn when a probe matches the Proficient average |
| Every action was used | some persona used each action; hiring and letting go are rare by design and not counted (D132) | warn |
| Events that call for an answer can be answered | Experts answered 80% or more | warn |
| Styles change the outcome (`styleEffect`, D132) | Proficient play beats the best one style probe by 5% of the scale or more | fail: a flat fit table, or one where one style fits every need |
| Conversations change what happens (`conversationEffect`, D132) | the same Proficient play with every conversation rated Strong reaches 5 points of the revenue target more than with every one rated Weak | fail: conversations with zero effect |
| The revenue target suits the levels (`target`, D132) | Beginners average under the target and Experts at least half of it | fail: a target trivially reachable or out of reach; warn when Experts reach under 80% |
| No routine beats judgement (`combined`, D149) | no combined probe beats the Expert's average, and none that ignores people (team energy with one style, busy) reaches the target tier | fail; advice, with the finding, on a storyline that plays the bundled Sales Elevator actions unchanged |
| Reading people without acting stays under the target tier (`idle`, D149) | the idle probe averages under the target tier | warn |
| Each player type plays out differently (`archetypes`, D150) | no two player types have action mixes within 0.2 (total variation) and averages within 3% of the scale and 10 points of revenue | warn |
| People first trades off against results (`tradeOff`, D150) | People first does not beat the Expert on both score and revenue | warn |
| No single mechanic drives the separation (`mechanics`, D149) | no more than 40% of a gap between neighbouring levels is streak bonus, and Business is capped for at most one level | warn |
| Neighbouring levels do not overlap much (`overlap`, D149) | neighbouring levels' score ranges overlap by at most 20% of the narrower | warn |

Every check that needs a look carries a suggested fix in plain words. The CLI and CI fail only on `fail`. The level checks (order, separation, skills, conversations, mechanics, overlap) read the four levels only.

**Probes for dominant strategies (D114, D149).** One style for everyone all run with otherwise sound play (the Proficient's, three seeds per style), and one action every day it can be taken (with random styles, two seeds). Combined (`combined`): team energy every week with one style for everyone (three seeds per style), as many actions as the days allow in any style (`busy`), and a pair of actions alternated every day with an Expert's reading of people and nothing else (`pair`: every pair among the three best single action probes, leaving out hiring and letting go, and team energy; six pairs on Sales Elevator, two seeds each, chosen once the single probes have played). Reading everyone right every week and taking no action (`idle`, two seeds). Probes always play on the offline templates and evaluator: they test mechanics and cost no model calls, and their words always show the style they mean (the evaluator's reading of the style is overridden for probes only). A pair is judged against the Expert only: reaching the target tier with an Expert's reading is the reading, which `idle` measures.

**The bundled actions' known finding (D149).** Every /author draft starts from Sales Elevator's calibrated actions, and on them pairs of actions repeated with an Expert's reading beat the Expert. `logic/bundled.ts` tells whether a storyline still plays those actions unchanged (what each action does, not its wording or style keys; actions switched off do not count); there `combined` is reported as advice with the finding (`logic/findings.ts`). Once an author changes what an action does, the check counts in full.

**Conversation probes (D132).** With the probes on, Proficient plays two more seeds with every conversation rated Strong and two with every conversation rated Weak (`forcedBand` in `logic/run.ts` wraps the offline evaluator and keeps everything but the band). They are kept in `results.probes` with `probe.kind` `band`, never count as a strategy, and feed `conversationEffect`. The style probes feed `styleEffect` as well as `dominant`.

## 5. Playthroughs

Each playthrough is kept week by week (styles that fit, actions with their style or option, events and whether they were answered, revenue) and conversation by conversation (the transcript, the band, the rubric bands, the style meant and the style the words showed, whether it fit the need) with a plain "why": what the player did (acknowledged, asked an open question, invited ideas, agreed a next step, made a promise, surfaced the concern), what was missing, the rubric, and the style fit. The view adds how often Expert players surfaced the same person's concern, and "Compare with the Expert run" opens the Expert on the same seed at the same week and person.

## 6. Where it runs

- **In the browser** (no `apiBase`, or a server without the endpoint): a Web Worker (`logic/worker.ts`) plays every playthrough off the page's thread. The chunked runner (`logic/chunked.ts`, one playthrough at a time with the thread given back in between) is the fallback in tests, Node and Storybook; the screen does not import it, because pulling the engine into the page's module graph splits shared modules out of the participant's first load (every supported browser has module workers; without one the screen says so). About 3 to 5 seconds for 40 playthroughs and the probes on a laptop. Offline: the templates and the keyword evaluator.
- **On the server** (`apiBase`, for example `/genie`): a job.

| Method and path | Body | Answer |
|---|---|---|
| `POST /genie/calibrations` | `CalibrationRequest`: `{ storyline, personas: { beginner, developing, proficient, expert, riskTaker?, conservative?, peopleFirst?, businessFirst? }, seed, probes, targetTier?, describe? }` (`docs/schemas/calibration-request.json`); `Idempotency-Key` header, 1 to 200 characters | 202 `CalibrationJob` and `Location`; the same caller and key answer the same job (200); the key with another body is 422 `idempotencyMismatch`; a draft that does not play is 400 `badStoryline` with `issues`; a full queue is 503 `busy`; an author with `CALIBRATION_PER_OWNER` jobs queued or running is 429 `tooManyCalibrations` (D120) |
| `GET /genie/calibrations/{id}` | | `CalibrationJob`: `status` queued, running, done, failed or cancelled; `progress`; `results` when done (`docs/schemas/calibration-job.json`) |
| `GET /genie/calibrations/{id}/playthroughs/{persona}/{index}` | | `Playthrough` (`docs/schemas/calibration-playthrough.json`); 409 `notReady` before it is done |
| `DELETE /genie/calibrations/{id}` | | 204: cancelled |

Author role, the AI rate limit on the start. Jobs run in process, `CALIBRATION_CONCURRENCY` at a time (default 2) with `CALIBRATION_QUEUE` waiting (default 20), each playthrough giving the event loop back. They play with the server's NPC model and evaluator, and the `ai/` module's synthetic players when AI is configured. Jobs live in memory: finished ones are kept an hour (the newest 50) and a restart forgets them. At most 25 playthroughs a persona, 100 in one calibration, and 250 with the probes.

- **CLI**: `npm run synthetic` plays every storyline in `src/engine/storylines` (10 playthroughs a level, with probes), prints the table (spread, points by pillar, evaluator agreement), the best probe of each kind and the checks; `--check` exits 1 on a failed check; `--types` adds the four player types; `--runs`, `--seed`, `--no-probes`, `--json <file>`. About 3.5 seconds; it runs in CI after the build.

## 7. The slot and the publish check

```tsx
import { CalibrateSlot, calibrationPublishCheck } from '../calibrate';

<CalibrateSlot
  config={draft}                         // the draft StorylineConfig input; pass the current one on every render
  apiBase={import.meta.env.VITE_GENIE_URL} // optional: run on the server; unset, in this browser
  results={kept}                          // optional: results kept from an earlier run
  onResults={r => keep(r)}                // each new run's results
  onAsk={(check, results) => askKora(check)} // optional: "Ask Kora" on the checks that need a look
  defaultRuns={{ beginner: 10, developing: 10, proficient: 10, expert: 10, peopleFirst: 10 }} // optional; player types default to 0 (off)
  headingLevel={2}                        // optional: 2 or 3
/>

const line = calibrationPublishCheck(kept, { draft });
// { key: 'syntheticPlayers', title: 'Synthetic players', status: 'passed' | 'advisory' | 'failed' | 'notRun' | 'outOfDate',
//   blocking, full, summary, details, action: 'See results' | 'Run the test' | 'Run the test again' }
```

`full` is true when all four levels played and the probes were on. **The /author workspace's gate (D132, `syntheticGate` in `src/author/model/validate.ts`)** is stricter than `blocking`: a full run on this version that passed passes, one with warnings is advice; a failed run blocks, and the failure stays on the draft (`calibration.failed`, written by `recordCalibration`) until a new full run passes, whatever is edited or run partially in between; no run, a run on an earlier version or a partial run blocks unless the author ticks "Publish without testing", which never covers a failure.

`CalibrateSlot` is light: the screen is a lazy chunk loaded on first render, and the engine loads only with a run, in the worker. Nothing in the participant app imports it: the only addition to the first load is the `/author/calibrate` route (initial JS 214.4 KB of 250, 214.3 before; vitals within budget). `calibrationPublishCheck` imports no engine and no schema library. Until /author mounts the slot, `/author/calibrate` shows it on the bundled Sales Elevator draft (`?theme=light`, `?api=/genie`).

## 8. Results on Sales Elevator

`npm run synthetic -- --types` (seed 1, 10 playthroughs a player, 70 probes). Points are each pillar's weighted share and the streak bonus, which add up to the score; "read as meant" is the evaluator agreement.

| Player | Score range | SD | Average | Tier | Revenue | Skills rated | Strong conversations | Read as meant | Business | People | Leadership | Streak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Beginner | 178 to 345 | 46 | 303 | Bronze | 48% | Developing | 0% | 51% | 129 | 45 | 130 | 0 |
| Developing | 324 to 490 | 53 | 423 | Bronze | 67% | Developing | 3% | 72% | 180 | 66 | 179 | 0 |
| Proficient | 835 to 905 | 19 | 872 | Platinum | 146% | Advanced | 69% | 94% | 270, capped | 200 | 303 | 100 |
| Expert | 914 to 978 | 25 | 943 | Platinum | 156% | Role Model | 95% | 89% | 270, capped | 231 | 343 | 100 |
| Risk taker | 605 to 843 | 89 | 715 | Silver | 103% | Proficient | 62% | 97% | 258 | 142 | 264 | 53 |
| Conservative | 532 to 780 | 99 | 660 | Silver | 85% | Advanced | 66% | 93% | 230 | 117 | 267 | 48 |
| People first | 960 to 983 | 7 | 973 | Platinum | 199% | Role Model | 96% | 97% | 270, capped | 270 | 334 | 100 |
| Business first | 772 to 888 | 34 | 835 | Gold | 119% | Advanced | 75% | 98% | 268, capped | 169 | 304 | 95 |

Best probes: Directing for everyone 662 (three seeds), a team meeting every day 411, team energy every week with Directing for everyone 659, as many actions as possible 346, reading people without acting 735, and the pairs with an Expert's reading: team meeting and team energy 970, goals and team energy 970, team meeting and goals 966, team meeting and feedback 966, feedback and team energy 962, goals and feedback 842. Every conversation Strong reaches 871 points, every one Weak 534.

The level checks all pass: scores rise (303, 423, 872, 943), Experts reach Gold in 10 of 10 and Beginners never, skill ratings fit every level, styles and conversations change the outcome, the target suits the levels, Experts answered 28 of 30 events, and the levels' ranges do not overlap. Four things to look at, all storyline findings, none a failure: five of the six pairs beat the Expert (`combined`, advice on the bundled actions, D149); reading people without acting reaches Gold (`idle`, 735); People first beats the Expert on score and revenue (`tradeOff`, 973 and 199% against 943 and 156%); and Business is capped for Proficient and Expert, so only People and Leadership separate them (`mechanics`). The streak bonus is 100 of the 449 points between Developing and Proficient (22%), under the 40% advisory line. The player types play out differently (the closest pair still differs in most of its actions).

The jump from Developing to Proficient is the storyline's: style fit compounds through the funnel (SIMULATION 9), so reading most people right is worth far more than reading half of them. Developing fell from 495 (D132) to 423 with the decoupled phrasings (72% read as meant, was about 94%) and with waste that no longer lands on team energy.

Timings in Node: 20 playthroughs and the 70 probes about 2.7 s on an idle machine, 40 playthroughs (the default) and the probes about 3.5 s; measured on a loaded machine (5.9 s and 7.7 s) against the D132 code on the same machine (5.2 s for 20 playthroughs and 38 probes, 2.4 s idle). The player builds fewer views per playthrough, so it is faster than before for the same work.

## 9. Not done

- **AI players have not met a real model here** (no key in this repository); `ai/src/synthetic/player.test.ts` covers the request, the cleaning and the fallbacks on a scripted transport. Run a calibration on the server with AI before the first pilot and compare it with the offline one.
- **"Add a custom player"** (Calibrate.dc.html) is not built: the levels' and player types' descriptions can be edited for AI players, but an author cannot add a persona of their own.
- **Sales Elevator's actions are not rebalanced** (D149): routines of two repeated actions beat the Expert, reading people without acting reaches Gold, People first beats the Expert on score and revenue, and Business is capped for Proficient and Expert. The checks report it; the fix (diminishing effects for repeated actions, costlier ignored events, a higher target) belongs to the storyline's owner.
- **Evaluator agreement on lenses without written phrasing** is optimistic offline (the player and the keyword evaluator both read the lens's words); measure it with the model evaluator on the server.
- **Ask Kora and "Try it and rerun"** belong to the /author workspace: the slot calls `onAsk` with the check; it does not change the draft.
- **Server jobs are in memory**, per instance; a calibration started on one instance is polled on that one (sticky sessions, or a shared store later).
