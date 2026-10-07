# Calibration with synthetic players

GenieKreator's "Test with synthetic players" step: before a draft is published, synthetic players at four proficiency levels play the whole simulation, conversations included, and the author sees whether it rewards good leadership. Decisions: D110 to D116 (`docs/DECISIONS.md`). Design: `docs/design/genie/Calibrate.dc.html` (setup and results), `CalibrateRun.dc.html` (one playthrough), `Publish.dc.html` (the "Synthetic players" check).

This is a different tool from `npm run calibrate` (`scripts/calibrate.ts`, SIMULATION 9), which tunes a storyline's funnel numbers with three simple policies. The synthetic players test a draft as authored, through the same engine, evaluator and NPC the participants meet.

## 1. Where the code is

| Part | Where |
|---|---|
| The four personas, as engine policies | `src/engine/sim/synthetic.ts` (`playSynthetic`, `PERSONA_TRAITS`, `PERSONA_COPY`) |
| What they say offline, and the speaker interface | `src/engine/sim/syntheticSpeech.ts` (`templateSpeaker`, `SyntheticSpeaker`, `SpeakerContext`) |
| What they say with AI | `ai/src/synthetic/player.ts`, `createSyntheticPlayer(config)` from `ai/`; prompt `ai/prompts/synthetic-player.md` |
| Run, aggregate, check, explain | `src/author/calibrate/logic/` (`run.ts`, `aggregate.ts`, `extract.ts`, `explain.ts`, `schema.ts`, `publish.ts`, `client.ts`, `worker.ts`, `chunked.ts`) |
| The screens | `src/author/calibrate/ui/` (`CalibrateView`, `Setup`, `Results`, `PlaythroughView`, stories) |
| Public entry | `src/author/calibrate/index.ts`: `CalibrateSlot`, `calibrationPublishCheck` |
| Server jobs | `server/src/calibration/jobs.ts`, `server/src/routes/calibrate.ts` |
| CLI | `scripts/synthetic.ts` (`npm run synthetic`) |
| Tests | `src/engine/sim/synthetic.test.ts`, `src/author/calibrate/logic/*.test.ts`, `ai/src/synthetic/player.test.ts`, `server/test/calibration.test.ts`, `tests/e2e/calibrate.spec.ts` |

## 2. The personas

Each persona is a policy over the participant's view and intents (never hidden engine state). Its choices are probabilities drawn from a seeded stream, so playthroughs differ between seeds and replay exactly for one seed. Styles, needs and actions come from the storyline, so any lens works; the tests play Readiness Based Leadership (four styles) and a lens of five styles.

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
| waste: spare days on whatever is at hand (overspends time) | 0.9 | 0.3 | 0.05 | 0 |
| turns: lines in a conversation (count) | 1 | 2 | 2 to 3 | 3 to 4 |
| polish: speaks at its full level (else one level lower) | 1 | 0.75 | 0.6 | 0.95 |
| slip: says something that blames | 0.04 | 0 | 0 | 0 |

How a week goes: every profile is opened (as a participant reading the cards would; what the persona does with it is its level), then a style for each person (default style, last week's, a diagnosis, or a near miss). On the board, in order: answer event cards and messages it chose to answer (replies and briefings cost no time); the action an event calls for; a follow up on a promise coming due; a conversation with the person who needs it, in the member action whose authored effects do most for that need in the chosen style (a team meeting when one style fits 70% of the team, for Proficient and Expert); then spare days used well (energize when most styles fit, training for low skill, assess the person struggling most once, reassign when another stage clearly suits them, hire when someone has left) or used on whatever is at hand.

## 3. Conversations

For a conversation action the persona speaks through a `SyntheticSpeaker`. The context it gets (`SpeakerContext`): the persona and its level (with the author's words for how it plays), the lens's styles and the style it means to show, the format and action, the person (mood, trust, stats when known, the need as the persona reads it, any concern they shared), the team for a meeting, the transcript so far, which line this is, and whether it makes a promise.

- **Offline, the templates** (`templateSpeaker`): one script per level and format (one to one, chat, email, meeting, sponsor briefing, interview, written plan), with the style's own sentences. Readiness Based Leadership's four styles have written sentences; any other style speaks its own short line and description in the first person ("You paint the destination" reads "I will paint the destination"). Plain parts of a line are picked so they carry no other style's cues. Beginner lines are blunt and closed; Developing generic with a little acknowledgement; Proficient acknowledges, asks an open question, shows the style and agrees a next step; Expert listens first, asks what is on the person's mind (which surfaces a hidden concern), adapts, invites ideas, agrees a dated next step and keeps any promise small.
- **With AI** (`createSyntheticPlayer`, server side): the model writes each line from the same context; the reply is cleaned (copy rules, length) and the template answers on any failure, refusal or unusable line. Model settings default to the NPC role's (fast, low effort); `AI_PROVIDER_SYNTHETIC`, `AI_MODEL_SYNTHETIC`, `AI_EFFORT_SYNTHETIC` and the other `_SYNTHETIC` tuning variables override them (docs/AI.md section 8).

Either way the words go through the engine like a participant's: the run's evaluator rates them (the keyword evaluator offline, the model evaluator on a server with AI), the style the words show is what the engine applies, and the NPC answers. So the scoring pipeline itself is under test, not only the mechanics.

## 4. What is measured, and the checks

Per persona (`PersonaStats`): Leadership Score range, mean and median; the tier of the median playthrough and the count per tier; how many reached the target tier; revenue as a share of the target; the most common overall skill level and the share of playthroughs whose level fits the persona; style fit; conversation bands; concerns surfaced.

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
| Every action was used | some persona used each action | warn |
| Events that call for an answer can be answered | Experts answered 80% or more | warn |

Every check that needs a look carries a suggested fix in plain words. The CLI and CI fail only on `fail`.

**Probes for dominant strategies (D112).** Two seeds each: one style for everyone all run with otherwise sound play (the Proficient's), and one action every day it can be taken (with random styles). Probes always play on the offline templates and evaluator: they test mechanics, cost no model calls, and the threshold is absolute (the target tier).

## 5. Playthroughs

Each playthrough is kept week by week (styles that fit, actions with their style or option, events and whether they were answered, revenue) and conversation by conversation (the transcript, the band, the rubric bands, the style meant and the style the words showed, whether it fit the need) with a plain "why": what the player did (acknowledged, asked an open question, invited ideas, agreed a next step, made a promise, surfaced the concern), what was missing, the rubric, and the style fit. The view adds how often Expert players surfaced the same person's concern, and "Compare with the Expert run" opens the Expert on the same seed at the same week and person.

## 6. Where it runs

- **In the browser** (no `apiBase`, or a server without the endpoint): a Web Worker (`logic/worker.ts`) plays every playthrough off the page's thread. The chunked runner (`logic/chunked.ts`, one playthrough at a time with the thread given back in between) is the fallback in tests, Node and Storybook; the screen does not import it, because pulling the engine into the page's module graph splits shared modules out of the participant's first load (every supported browser has module workers; without one the screen says so). About 3 to 5 seconds for 20 playthroughs and the probes on a laptop. Offline: the templates and the keyword evaluator.
- **On the server** (`apiBase`, for example `/genie`): a job.

| Method and path | Body | Answer |
|---|---|---|
| `POST /genie/calibrations` | `CalibrationRequest`: `{ storyline, personas: { beginner, developing, proficient, expert }, seed, probes, targetTier?, describe? }` (`docs/schemas/calibration-request.json`); `Idempotency-Key` header, 1 to 200 characters | 202 `CalibrationJob` and `Location`; the same caller and key answer the same job (200); the key with another body is 422 `idempotencyMismatch`; a draft that does not play is 400 `badStoryline` with `issues`; a full queue is 503 `busy` |
| `GET /genie/calibrations/{id}` | | `CalibrationJob`: `status` queued, running, done, failed or cancelled; `progress`; `results` when done (`docs/schemas/calibration-job.json`) |
| `GET /genie/calibrations/{id}/playthroughs/{persona}/{index}` | | `Playthrough` (`docs/schemas/calibration-playthrough.json`); 409 `notReady` before it is done |
| `DELETE /genie/calibrations/{id}` | | 204: cancelled |

Author role, the AI rate limit on the start. Jobs run in process, `CALIBRATION_CONCURRENCY` at a time (default 2) with `CALIBRATION_QUEUE` waiting (default 20), each playthrough giving the event loop back. They play with the server's NPC model and evaluator, and the `ai/` module's synthetic players when AI is configured. Jobs live in memory: finished ones are kept an hour (the newest 50) and a restart forgets them. At most 25 playthroughs a persona and 100 in one calibration.

- **CLI**: `npm run synthetic` plays every storyline in `src/engine/storylines` (5 playthroughs a persona, with probes), prints the table and the checks; `--check` exits 1 on a failed check; `--runs`, `--seed`, `--no-probes`, `--json <file>`. About 4 seconds; it runs in CI after the build.

## 7. The slot and the publish check

```tsx
import { CalibrateSlot, calibrationPublishCheck } from '../calibrate';

<CalibrateSlot
  config={draft}                         // the draft StorylineConfig input; pass the current one on every render
  apiBase={import.meta.env.VITE_GENIE_URL} // optional: run on the server; unset, in this browser
  results={kept}                          // optional: results kept from an earlier run
  onResults={r => keep(r)}                // each new run's results
  onAsk={(check, results) => askKora(check)} // optional: "Ask Kora" on the checks that need a look
  defaultRuns={{ beginner: 5, developing: 5, proficient: 5, expert: 5 }} // optional
  headingLevel={2}                        // optional: 2 or 3
/>

const line = calibrationPublishCheck(kept, { draft });
// { key: 'syntheticPlayers', title: 'Synthetic players', status: 'passed' | 'advisory' | 'failed' | 'notRun' | 'outOfDate',
//   blocking, summary, details, action: 'See results' | 'Run the test' | 'Run the test again' }
```

`CalibrateSlot` is light: the screen is a lazy chunk loaded on first render, and the engine loads only with a run, in the worker. Nothing in the participant app imports it: the only addition to the first load is the `/author/calibrate` route (initial JS 214.4 KB of 250, 214.3 before; vitals within budget). `calibrationPublishCheck` imports no engine and no schema library. Until /author mounts the slot, `/author/calibrate` shows it on the bundled Sales Elevator draft (`?theme=light`, `?api=/genie`).

## 8. Results on Sales Elevator

`npm run synthetic` (seed 1, 5 playthroughs a persona, 34 probes, 3.5 s):

| Player | Score range | Average | Tier | Revenue | Skills rated | Fits level | Strong conversations |
|---|---|---|---|---|---|---|---|
| Beginner | 380 to 429 | 400 | Bronze | 65% | Novice | 100% | 0% |
| Developing | 449 to 576 | 495 | Bronze | 74% | Proficient | 100% | 12% |
| Proficient | 843 to 912 | 863 | Platinum | 141% | Advanced | 100% | 65% |
| Expert | 914 to 966 | 937 | Platinum | 147% | Role Model | 100% | 97% |

Every check passes but one advisory: nobody used "Hire member" or "Let go" (fine if they are meant to be rare). The best probe, Directing for everyone, averages 618, under Gold (700); the best one action probe, a team meeting every day, 488. The jump from Developing to Proficient is the storyline's: style fit compounds through the funnel (SIMULATION 9), so reading most people right is worth far more than reading half of them.

## 9. Not done

- **AI players have not met a real model here** (no key in this repository); `ai/src/synthetic/player.test.ts` covers the request, the cleaning and the fallbacks on a scripted transport. Run a calibration on the server with AI before the first pilot and compare it with the offline one.
- **"Add a custom player"** (Calibrate.dc.html) is not built: the four levels' descriptions can be edited for AI players, but there is no fifth persona.
- **Ask Kora and "Try it and rerun"** belong to the /author workspace: the slot calls `onAsk` with the check; it does not change the draft.
- **Server jobs are in memory**, per instance; a calibration started on one instance is polled on that one (sticky sessions, or a shared store later).
