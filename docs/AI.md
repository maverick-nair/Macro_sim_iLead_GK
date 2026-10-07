# The AI layer (`ai/`)

The server's AI: NPC replies, the evaluator, GenieKreator's author drafter and speech to text, behind interfaces the engine already uses. Server side only. Nothing in `ai/` is imported by the participant app (a unit test fails if `src/` ever imports it, and `npm run build` checks the bundle budget). Do not confuse it with `src/ai/`, the browser's reader for streamed text.

Decision: D82. Sources: `docs/SIMULATION.md` 5, `docs/genie/scoring-and-report.md`, `docs/genie/iLead 2.0 AI Authored Interactive Simulation Design.md` (quality gates), `docs/genie/leadership-lens-module.md`, `docs/genie/prompts/`, `docs/SPEECH.md`.

## 1. What the engineer configures

Nothing, to run on the mocks: every factory works with `{ provider: 'mock' }`, which is what tests, demos and the quality gates use offline.

To go live, set these on the server and map them with `configFromEnv(process.env)` (or build the config objects any other way):

| Variable | Needed for | What |
|---|---|---|
| `ANTHROPIC_API_KEY` | the model | API key. With it set, every role defaults to the Anthropic provider. Keep it in the secret store, never in the repo. |
| `SPEECH_URL` | voice | Base URL of the speech to text service (section 7). With it set, the transcriber uses HTTP. |
| `SPEECH_KEY` | voice | The speech service's credential. |

Everything else has a default and is for tuning (section 8).

## 2. Architecture

```
Browser ── intents, SSE ──> Server (server/) ── loads the factories ──> ai/src/index.ts
                                │                                         │
                                │  createEngine(config, { npc, evaluator })│
                                ▼                                         ▼
                      src/engine (rules decide)            NpcModel     Evaluator     AuthorDrafter     Transcriber
                                                             │             │              │                 │
                                                             └── LlmTransport (Anthropic SDK) ──┘           HTTP speech service
                                                                   prompts in ai/prompts/*.md
```

- **The engine is unchanged.** `NpcModel` and `Evaluator` in `ai/src/types.ts` extend the engine's own interfaces (`src/engine/sim/live.ts`, `src/engine/sim/evaluator.ts`), so `createEngine(config, { seed, npc, evaluator })` takes them as they are. The AI judges; the authored rules still decide every consequence.
- **One transport.** All model calls go through `LlmTransport` (`ai/src/llm/transport.ts`). The Anthropic transport (`ai/src/llm/anthropic.ts`) uses the official SDK; tests use a scripted fake (`createFakeTransport`). Every call streams; structured calls read the final message.
- **Mocks are the fallback.** The engine's persona stand in (`personaNpc`), the keyword evaluator (`heuristicEvaluator`) and the template drafter (`MockDrafter`) answer whenever the model fails, refuses or breaks a guardrail, and the failure is logged.

### Interfaces (`ai/src/types.ts`)

| Interface | Methods | Returns |
|---|---|---|
| `NpcModel` | `stream(ctx, { signal })`, `reply(ctx, { signal })` | Stream of `{ type: 'token', text }` then `{ type: 'done', reply, meta }`; `reply` gives the engine's `NpcReply` (`text`, `revealsConcern`, `signsOff`). `ctx` is the engine's `NpcContext` plus an optional scene: `locale`, `history` (the conversation so far), `story`, `meeting` (attendees, raised hands), `guarded`, `role`. |
| `Evaluator` | `evaluate(input)`, `evaluateWithAudit(input)` | Exactly the engine's `Evaluation` (checked against `EvaluationSchema`, with a compile time check that it matches the engine type), plus an `EvaluationAudit`. `input` is the engine's `EvaluationInput` plus `locale`, `actionKey`, `actionName`, `goal`, `rubricLabels`, `skillDefs` (names and anchors), `transcript`, `counterpart`, `promiseActions`. |
| `AuthorDrafter` | `turn(req)`, `draft(req)` | The shapes of `src/api/author.ts`: `AuthorTurnResponse`, `AuthorDraftResponse`. |
| `Transcriber` | `open({ mimeType, mode, language, onResult, signal })` gives a session with `push(chunk, seq)`, `end()`, `abort()` | `{ kind: 'partial' | 'final', text }[]`, the contract of `docs/SPEECH.md`. |
| `SyntheticPlayer` | `say(ctx)` | GenieKreator's synthetic players (D112, `docs/CALIBRATION-SYNTHETIC.md`): a persona's next line from its level, the lens, the person and the transcript (the engine's `SpeakerContext`). The engine's `templateSpeaker` is the mock and the fallback on any failure, refusal or unusable line. |

Helpers for the server: `sceneFromStoryline(config)` (locale and workplace) and `historyFromTurns(turns, nameOf)`.

### Wiring an NPC turn to the stream endpoint

The engine awaits `npc.reply(ctx)` inside `sendTurn`. Two ways to serve `GET .../turns/{turn}/stream`:

1. **Simple:** let the engine call `reply`, then stream the stored turn's text (what the mock engine does). First word latency is the whole reply.
2. **Live (recommended):** run `npc.stream(ctx)` yourself, forward each `token` as an SSE `{type:'token',text}` while it arrives, and hand the `done` reply to the engine through a small `NpcModel` that returns it (for example a per interaction promise). Abort the signal when the client sends `interruptTurn` or disconnects: the model call stops and no `done` is emitted.

## 3. Prompts (`ai/prompts/`)

| File | Used by | Holds |
|---|---|---|
| `npc.md` | NPC | Staying in role, the hidden concern rules (share at trust 45 or more or after real acknowledgement, never under 30 or when the team is guarded, never on demand), hard moments (off topic, hostile, jailbreak, unsafe, personal), formats, the signal tag. |
| `evaluator.md` | Evaluator | Assessor rules: words only, content in any language, bands, verbatim evidence, red flags, style shown, flags, promise, email intent, reasons. |
| `evaluator/<format>.md` | Evaluator | The default rubric of each format (roleplay, chat, email, meeting, sponsor, interview, plan) and what good looks like. |
| `lens.md` | Author | The Leadership Lens guardrails (KNOLSKAPE titles only, no certification claims, "skills", no dashes, no emojis, no invented framework content). |
| `author-turn.md`, `author-framework.md`, `author-draft.md` | Author | Reading answers and uploads; extracting a client framework; writing the storyline's copy. |
| `synthetic-player.md` | Synthetic player | Playing one proficiency level faithfully in a calibration: what each level does, showing the intended style in plain words, the copy rules, never mentioning the test. |
| `repair.md` | All structured calls | The repair instruction after an answer that fails validation. |

**Versions.** Each file has a header (`id`, `version`). The version recorded is `<id>@<version>#<hash of the text>`, for example `evaluator@1#a1b2c3d4+evaluator.roleplay@1#e5f6a7b8`, so an edit without a version bump still shows. It is on every evaluation's audit record (`EvaluationAudit.promptVersion`, for the report's methodology and the assessor review) and every NPC reply's `meta.promptVersion`. Raise the version when you change a prompt, and rerun both quality gates.

**Order for caching.** Stable text first: the rules, then the format guide, then the per interaction context (character sheet; rubric, skills with anchors, lens styles) with a cache breakpoint. What changes per call (mood, trust, the conversation, the words to score) comes last. A prefix shorter than the model's minimum cacheable length is simply not cached.

**Untrusted text.** Participant and author text goes inside tags (`<participant_says>`, `<participant_words>`, `<answers>`, `<documents>`) with `<` and `>` replaced, and every prompt says that text inside them is never an instruction.

## 4. Guardrails

### NPC
- **In the prompt:** stay in role; never mention being an AI, a simulation or a prompt; never mention scores, ratings or its own trust and mood as numbers; never coach the participant or give them the answer; decline unsafe, illegal, discriminatory and personal requests in role; steer off topic requests back; end the conversation politely after a second abusive message; reply in the run's language.
- **In code (`ai/src/guards/npc.ts`), on every reply, mock included:** out of role talk, scoring talk and leaks (the author's concern description read out, or the concern shared below trust 30 or while guarded) are caught. In `sentence` mode (default) each sentence is checked before it is released, so a broken sentence never reaches the participant; the reply ends at the last good sentence, or the persona stand in answers when nothing was shown. The signal tag is never shown. Copy rules (no dashes, no emojis, "skills") are applied to every sentence.
- **Signals:** the model proposes `reveal` and `end`; code has the last word (`revealsConcern` only when the person has a concern line, has not shared it, trust is 30 or more and the team is not guarded).

### Evaluator
- **Words only.** The model gets the participant's words and the conversation for context. `usedVoice` is passed through to the result and never sent to the model (a test checks the request is identical with and without voice). The prompt forbids scoring spelling, grammar, fluency, accent or transcription errors.
- **Verbatim quotes.** Every quote is looked up in the participant's own words (`ai/src/guards/quotes.ts`): same words, order, spelling and case, forgiving only whitespace, quote marks and a trailing full stop. A quote that is not found is dropped and listed in the audit. The quote kept is the exact slice of what was said.
- **No invented observations.** A band above Weak needs a verified quote, or it falls to Weak. A red flag needs a verified quote, or it is dropped. The overall band is the engine's rule (`overallBand`: any red flag forces Harmful, otherwise the median), never the model's. A red flag makes every rated skill Harmful, as in the engine's heuristic.
- **Shape.** Structured output with a JSON Schema whose keys are the requested dimensions, skills, lens styles and follow up actions; then Zod; then a check that every dimension is there and nothing else is. One repair retry with the issues; still failing, the heuristic answers, `audit.fallback` is true and an error is logged.

### Author drafter
- The question order and the "5 to 10 questions" policy are rules (`src/author/questions.ts`); the lens recommendation's precedence is a rule (`src/author/recommend.ts`). The model only reads: brief fields it states clearly (never overwriting what the brief has, never guessing a client), and a client framework, where every dimension, behaviour and level must appear in the text or it is dropped.
- The draft starts from the template draft (calibrated mechanics) and the model writes only the copy, by id and key. The copy passes the copy rules, then the merged storyline must pass `StorylineConfig` and the copy guard (`src/author/copyGuard.ts`: KNOLSKAPE lens titles, no source names outside `basedOn`, no certification claims, "skills", no dashes, no emojis) and have distinct names. Otherwise one repair with the issues, then the templates draft.

### Transcriber
- Transcript only: no audio is kept by this layer, nothing is inferred from the voice. Chunks are applied in `seq` order; a repeated `seq` is ignored; a gap is an error; nothing is accepted after `end` or `abort`.

## 5. Localization

The run's locale is the storyline's (`money.locale`, `sceneFromStoryline`). NPC replies are written in it. The evaluator writes its reasons in it and scores content the same way in any language; quotes stay in the language they were said in. The mocks are English only. Engine text (headlines, reasons) stays English until D60 is settled.

## 6. Quality gates

| Gate | Command | What passes |
|---|---|---|
| Rubric calibration | `npm run ai:calibrate [-- <storyline>] [--provider mock|anthropic|all] [--out report.json]` | Every live action's rubric agrees with the authors' labels on 85% or more of its samples (`ai/calibration/<storyline>.json`). Reports exact agreement and agreement within one band per action, the misses, fallbacks and prompt versions. |
| Persona check | `npm run ai:persona-check [-- <storyline>] [--only kent,beth] [--verbose]` | Every member, candidate and the sponsor stays in role on 9 probes: two off topic, hostile, two jailbreaks, two "hidden concern" demands at low trust, an unsafe request, personal questions. Checks: a short, non empty reply; no out of role, scoring or leak; the copy rules; no concern shared at low trust; with a real model, a reply the filter had to replace fails too. `--verbose` prints every reply for a human read. |
| Balance test | `npm run calibrate -- sales-elevator --check` | (Existing, engine side.) AI players: the strong leader reaches the target, the others do not. |

Both AI gates always run on the mock and run on the real model when `ANTHROPIC_API_KEY` is set; without it they print that the real provider was skipped. Results on the mock today: calibration 88 of 88 (100%, 11 actions), persona check 189 of 189. The real model has not been run in this repository (no key here); run both before the first pilot and record the numbers in the publish record.

**The starter set** has 8 samples per live action of Sales Elevator (f2f, coach, feedback, swap, fire, reward, goals, meet, email, hire, sponsor), two per band, written as an assessor would label them. Before publish, authors extend it (20 or more per action is a better base, with borderline cases), and a second assessor should label it blind. The mock passing is a check of the set's labels against transparent rules, not of the model.

## 7. Speech to text

`createHttpTranscriber` speaks the same chunked contract as the browser (`docs/SPEECH.md`) to `SPEECH_URL`:

| Request | Body | Response |
|---|---|---|
| `POST {url}/transcriptions` | `{ mimeType, mode, language? }` | `{ id }` |
| `POST {url}/transcriptions/{id}/chunks?seq={n}` | raw audio, `Content-Type` is the mime type | `{ results }` |
| `POST {url}/transcriptions/{id}/end` | none | `{ results }` |
| `DELETE {url}/transcriptions/{id}` | none | 204 |

The key goes in `Authorization: Bearer <key>` by default, or any header and scheme (`SPEECH_AUTH_HEADER`, `SPEECH_AUTH_SCHEME`). A vendor with a websocket streaming API or a different body needs a thin shim that speaks this contract, or a new `Transcriber` beside the HTTP one (the interface is four methods). Choose a vendor that keeps no audio, offers the participants' languages and accents, and runs no emotion or voice analysis; check its word error rate on accented speech (the design's speech bias risk).

## 8. Configuration reference

Factories: `createNpcModel(config)`, `createEvaluator(config)`, `createAuthorDrafter(config)`, `createTranscriber(config)`, `createSyntheticPlayer(config)`, exported from `ai/src/index.ts`. Defaults are `DEFAULTS` in `ai/src/config.ts`.

| Field | Env variable | Default | Notes |
|---|---|---|---|
| `provider` | `AI_PROVIDER`, or per role `AI_PROVIDER_NPC`, `AI_PROVIDER_EVALUATOR`, `AI_PROVIDER_AUTHOR`, `AI_PROVIDER_SYNTHETIC` | `anthropic` when `ANTHROPIC_API_KEY` is set, else `mock` | `mock` or `anthropic`. |
| `anthropic.apiKey` | `ANTHROPIC_API_KEY` | none | Left out, the SDK looks for its own default credentials. |
| `anthropic.baseURL` | `ANTHROPIC_BASE_URL` | the public API | A gateway or proxy. |
| `anthropic.refusalFallback` | `AI_REFUSAL_FALLBACK` | `true` | Server side refusal fallback: a request declined by a safety classifier is re-run on the recommended fallback model in the same call. Turn off where the platform does not offer it. |
| `anthropic.promptCaching` | `AI_PROMPT_CACHE` | `true` | Cache breakpoint on the stable prefix. |
| `anthropic.cacheTtl` | `AI_CACHE_TTL` | `5m` | `1h` pays off for a cohort playing one storyline over an hour. |
| `model.model` | `AI_MODEL_NPC`, `AI_MODEL_EVALUATOR`, `AI_MODEL_AUTHOR`, `AI_MODEL_SYNTHETIC` | see `DEFAULTS` | Model id per role. The synthetic player takes the NPC role's settings unless its own are set (`AI_EFFORT_SYNTHETIC`, `AI_MAX_TOKENS_SYNTHETIC`, `AI_TIMEOUT_MS_SYNTHETIC` and so on). |
| `model.effort` | `AI_EFFORT_NPC`, `AI_EFFORT_EVALUATOR`, `AI_EFFORT_AUTHOR` | `low`, `high`, `high` | `low`, `medium`, `high`, `xhigh`, `max`. |
| `model.maxTokens` | `AI_MAX_TOKENS_<ROLE>` | 2048, 16000, 32000 | Includes thinking. |
| `model.temperature` | `AI_TEMPERATURE_<ROLE>` | not sent | Current default models reject sampling parameters; set only for a model that takes them. |
| `model.timeoutMs` | `AI_TIMEOUT_MS_<ROLE>` | 30000, 120000, 300000 | Per request; retried. |
| `model.maxRetries` | `AI_MAX_RETRIES`, or `AI_MAX_RETRIES_<ROLE>` | 2 | Retries 408, 409, 429, 5xx and connection errors with backoff. |
| `holdBack` (NPC) | `AI_NPC_HOLD_BACK` | `sentence` | `none` shows words as they arrive (lower latency); a reply that then breaks role has been seen, though the engine keeps the stand in's line. |
| `repairRetries` (evaluator, author) | `AI_REPAIR_RETRIES` | 1 | Repairs before the fallback. |
| `onAudit` (evaluator) | | none | Called with every `EvaluationAudit`: store it with the interaction. |
| `logger` | | console | `info`, `warn`, `error`. |
| `provider` (transcriber) | `SPEECH_PROVIDER` | `http` when `SPEECH_URL` is set, else `mock` | `mock` or `http`. |
| `http.url`, `http.key` | `SPEECH_URL`, `SPEECH_KEY` | | |
| `http.authHeader`, `http.authScheme` | `SPEECH_AUTH_HEADER`, `SPEECH_AUTH_SCHEME` | `Authorization`, `Bearer` | An empty scheme sends the bare key. |
| `http.timeoutMs` | `SPEECH_TIMEOUT_MS` | 15000 | |

## 9. Costs and latency

- **Per NPC turn:** the rules and character sheet (about 1,500 to 2,500 tokens, cached after the first turn of a conversation when long enough), the scene and conversation (grows to a few thousand tokens by turn 12), and a reply of 30 to 80 words plus a little thinking at `low` effort. Twelve turns per conversation, about two live conversations a week.
- **Per evaluation:** one call after the conversation (never per turn), about 2,500 to 5,000 input tokens of which the rules, format guide and context are cached across a cohort, and 500 to 1,500 output tokens at `high` effort.
- **Per draft:** a few calls per authoring session, the draft being the largest (the template's copy in and out, 10,000 to 20,000 tokens each way).
- **Latency:** NPC first words arrive after the first sentence is complete in `sentence` mode (typically 1 to 2 seconds); `none` saves that sentence. Evaluations take seconds and run after the interaction, so the outcome screen should show a short wait state.
- Watch `usage.cacheReadTokens` in the audit: if it stays 0 for repeated evaluations of the same action, something in the prefix varies per call.

## 10. How to tune

1. Change a prompt in `ai/prompts/`, raise its `version`.
2. `npm run ai:calibrate -- --provider anthropic --out before.json` before and after; compare per action agreement and the misses. Look at `audit.droppedQuotes` and `audit.adjustments`: many dropped quotes mean the model paraphrases; tighten the evidence section.
3. `npm run ai:persona-check -- --provider anthropic --verbose` and read the replies, especially the unsafe and personal probes: code checks role, leaks and copy, a human judges tone.
4. Lower `effort` (cost, latency) only while calibration holds. A cheaper model for the NPC is a configuration change (`AI_MODEL_NPC`); rerun both gates.
5. After a cohort, compare AI bands with the assessor review sample (scoring-and-report.md 8): an interaction whose disagreement exceeds 15% needs its rubric or prompt tuned.

## 11. Tests

`npm test` runs `ai/**/*.test.ts` with the rest (no network: a fake client and recorded answers). Covered: prompt files, versions and placeholders; the SDK request (cache breakpoints, effort, schema, refusal fallback, timeouts, retries) and streaming through a fake SDK client; structured output, repair and refusal; verbatim quotes; NPC guardrails, the sentence filter and the signal tag; NPC streaming, signals, fallbacks and cancellation; evaluator mapping, dropped quotes, red flags, repair, fallback, locale and the voice rule; the engine running a conversation on the AI NPC and evaluator; author reading, framework grounding, draft merge, copy guard, repair and fallback; the transcribers; the factories and the environment mapping; the synthetic player (its request, cleaning, fallbacks and a whole run through the engine); both quality gates on the mock; and that `src/` never imports `ai/`.

## 12. Not done

- The real model has not been run here: no key in this environment. Run both gates with a key before the pilot.
- The persona check judges in code; a model or human judge for tone and helpfulness is not built.
- The live stream wiring (section 2) is the server's to build.
- No websocket speech adapter: vendors without the chunked HTTP contract need a shim.
- The author draft writes copy over the template; it does not yet generate new events, actions or a new fit table for a client framework (the lens library's tables and the template's mechanics are used).
