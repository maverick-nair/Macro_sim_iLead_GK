# iLead 2.0 simulation rules

The authoritative rule set for the iLead 2.0 engine. The mock engine (`src/engine`) implements exactly this, and every rule has a unit test. The UI never computes any of it: it renders engine state and sends intents.

**Sources** (each rule is tagged):
- **[M]**: iLead 1.0 Model doc (`docs/ilead-1/iLead - Model doc.docx`). Where 1.0 sources disagree, the Model doc wins.
- **[W]**: iLead 1.0 content workbook (`docs/ilead-1/iLead International Sales Elevator - Full content.xlsx`).
- **[S]**: iLead 2.0 Participant Interface Spec and the design.
- **[N]**: new in 2.0, designed here. Needs your review.
- **[G]**: GenieKreator source docs (`docs/genie/`): the Configuration Spec, the 2.0 Design doc and the Teardown. They outrank the 1.0 sources on 2.0 behaviour. `docs/genie/RECONCILIATION.md` lists every difference and the milestone that resolves it (D44).

Every number marked *config* comes from the GenieKreator storyline config (section 1). The values given are the defaults of the Sales Elevator storyline.

---

## 1. Storyline configuration (GenieKreator)

Schema: `src/engine/config.ts` (Zod). The engine refuses to start on an invalid config, and the authoring tool shows the validation errors.

### 1.1 Money
| Field | Rule |
|---|---|
| `currency` | Any ISO 4217 code. The authoring list offers USD, GBP, EUR, JPY, SGD, INR, MYR, AED, IDR, THB, PHP, VND, AUD, CNY, SAR. |
| `locale` | Formatting locale, for example `en-US`, `en-GB`, `ja-JP`, `en-SG`, `en-IN` (lakh and crore grouping), `ms-MY`, `ar-AE`. |
| `display` | `symbol` ($, £, ¥, ₹), `narrowSymbol` or `code` (SGD, MYR, AED). |
| `target` | Total business target for the run. |
| `valuePerConversion` | Value of one closed deal. |
| `inputPerSubPeriod` | New leads entering the first stage each sub-period, one value per period (the storyline can ramp). |

Amounts are stored in the currency's major unit. The decimals follow the currency: JPY shows 0, most others show 0 in the HUD and 2 only in the report tables. Large values use compact notation where the locale has it (for example `₹24 L`, `$240K`).

### 1.2 Time
| Field | Rule |
|---|---|
| `period.unit` | `year`, `month`, `week` or `day`. |
| `period.count` | 1 to 10. |
| `subPeriod.unit` | The unit actions are paid in. Defaults: year → quarter (4), month → week (4), week → day (5), day → hour (8). |
| `subPeriod.perPeriod` | Capacity per period, in sub-periods. |
| `costStep` | Smallest cost: 1 by default (whole days, per your decision). 0.5 is allowed for storylines that want half days. |

Every string that shows a unit ("Week 2", "3 days left", "End week") comes from ICU messages with the unit as an argument, so a month based storyline reads "Month 2", "3 weeks left", "End month". Events and triggers are scheduled per period (section 6), so they fit any count.

Sales Elevator default: 8 weeks of 5 days.

### 1.3 Stages
| Field | Rule |
|---|---|
| `stages` | 3 to 6 stages, in funnel order. Each has a name, a conversion ratio (0 to 1) and an ideal headcount. |
| First stage | Receives `inputPerSubPeriod`. |
| Last stage | Its output counts as conversions. |

The board shows one column per stage. Six stages is the most that fits at 1280 wide.

Sales Elevator default [M][W]:

| Stage | Conversion ratio |
|---|---|
| Leads | 0.62 (the workbook says 60 to 65%) |
| Qualify | 0.5 |
| Proposal | 0.3 |
| Negotiation | 0.5 |
| Conversion | 0.5 |

### 1.4 People
| Field | Rule |
|---|---|
| `members` | 6 to 12. Each has profile text, a portrait set (one image per mood), a voice, a home stage, and starting skill, morale (motivation), result (performance) and trust. |
| Per stage values | Each member also has skill, morale and result for every other stage, used when they are swapped or assessed [M][W]. |
| `candidates` | Hire pool, same shape. |
| `hiddenConcern` | Optional per member: text that only surfaces in conversation (section 3.4). |

Sales Elevator default: the 10 active actors and 10 candidates from the workbook, after calibration (section 9).

### 1.5 Thresholds
| Field | Default | Source |
|---|---|---|
| `high` | 70: skill or morale at or above this is High | [W] Game Math |
| `bands` | under 50 red, 50 to 69 amber, 70 and up green | [W] |
| `low` | 30: under this shows "low" and the amber bar | [S] |

---

## 2. Core model [M]

**Scale.** Skill, morale, result and trust are integers clamped to 0 to 100.

**The leadership lens** (D70, *config* `lens`) brings the styles a participant leads with: 2 to 6, each with a key, a letter of 1 or 2 characters for the segmented control, a name, a one line short and a description. The participant UI reads every style name from the view's `lens`; nothing in the client names a style. The default is Readiness Based Leadership with Directing (D), Guiding (G), Partnering (P) and Entrusting (E), the Sales Elevator storyline. `basedOn` (the source) is author only and never sent to participants.

**A member's need** comes from their current skill and morale, High at or above `thresholds.high` (70). There are always four needs, one per quadrant; the lens names them:

| Skill | Morale | Need key | Readiness Based name | Style that fits (difference 0) |
|---|---|---|---|---|
| Low | Low | `lowSkill_lowMorale` | Learning and unsure | Directing (D) |
| Low | High | `lowSkill_highMorale` | Keen to learn | Guiding (G) |
| High | Low | `highSkill_lowMorale` | Capable but cautious | Partnering (P) |
| High | High | `highSkill_highMorale` | Ready to run with it | Entrusting (E) |

The workbook's leadership style sheet lists Partnering as high and high, which is a typo; the Model doc is followed.

**Style difference** between a chosen style and a need is one table lookup: the lens's **fit table** gives, for each need, each style's difference (0, 1 or 2). The schema checks that every need lists every style, names no other, and has at least one style at 0. Readiness Based Leadership's table is the quadrant rule: each style has a home quadrant (D low and low, G low skill and high morale, P high skill and low morale, E high and high), and its difference to a need is the number of ranges that do not match (0 when both the skill and the morale ranges match, 1 when one does, 2 when neither does):

| Need | D | G | P | E |
|---|---|---|---|---|
| Low skill, low morale | 0 | 1 | 1 | 2 |
| Low skill, high morale | 1 | 0 | 2 | 1 |
| High skill, low morale | 1 | 2 | 0 | 1 |
| High skill, high morale | 2 | 1 | 1 | 0 |

So the default plays exactly as before the lens existed: same differences, same random draws in the same order, and seeded runs replay identically (`src/engine/sim/replay.test.ts`); calibration is unchanged. Another lens may give a need more than one fitting style (Six Leadership Styles, the test lens in `src/engine/storylines/sixStyles.ts`, fits both Harmoniser and Collaborator to high skill and low morale). The automated players pick the first style in lens order with difference 0.

**Mismatch type** adds the Model doc's randomness to the style difference:
- Difference 0 gives mismatch 0.
- Difference 1 gives mismatch 1 with probability 0.6, otherwise 0.
- Difference 2 gives mismatch 2 with probability 0.6, otherwise 0.

**Training** uses its own table [M]:

| Style difference | Mismatch 0 | Mismatch 1 | Mismatch 2 |
|---|---|---|---|
| 0 | 80% | 10% | 10% |
| 1 | 10% | 60% | 30% |
| 2 | 10% | 30% | 60% |

**Impact.** Every action has a skill, morale and result change for each mismatch type (section 4). The applied change is that value × a random factor between 0.8 and 1.2, rounded. Then the trust multiplier applies (section 3.3).

**Randomness** comes from a seeded generator per participant run, so a run can be replayed exactly. The report and support tools depend on that.

---

## 3. Trust [N]

Trust is how much a member believes in you as their leader. It is the 2.0 metric that captures relationship and fairness, which skill, morale and result don't. It starts per member from config (Sales Elevator: calibrated, 20 to 85). It shows as the ring around the portrait.

### 3.1 What raises or lowers trust

| Event | Change | Why |
|---|---|---|
| Weekly style matches: mismatch 0 / 1 / 2 | +2 / 0 / −3 | Being led the way you need builds trust |
| Style changed for a member whose need did not change, away from a style that fitted it | −2 | Feels erratic. Not applied in the first period. |
| Live conversation band: Strong / Adequate / Weak / Harmful | +6 / +2 / −3 / −8 | Section 5 |
| Promise kept by its due sub-period | +6 | Section 5.4 |
| Promise broken (due date passes) | −8 | Section 5.4 |
| Reply to the member's chat or email before its due day | +3 | Responsiveness |
| Their message passes its due day unanswered | −5 | Kent's unanswered chat in the design |
| Rewarding someone else while this member is the top performer | −6 | Mirrors the reward rule [M] |
| You fire a team member | −4 for everyone else | Mirrors the fire rule [M] |
| Sent for training when they asked for it (training request trigger) | +4 | Being heard |
| Role change request ignored past its period | −4 | [W] trigger, plus trust |

### 3.2 Caps
- Trust moves at most ±12 per member per sub-period, so one bad moment never wipes out a relationship.
- Under reduced motion the change is applied instantly. Otherwise it animates on the ring.

### 3.3 What trust changes

- **Effect multiplier.** Positive skill, morale and result changes from any action on a member are multiplied by `0.8 + 0.4 × trust / 100`, from 0.8 at trust 0 to 1.2 at trust 100. Negative changes are not reduced, so low trust makes good actions land softer.
- **Misreads.** When trust is under 30, the probability that a style difference of 1 becomes mismatch 1 rises from 0.6 to 0.75. The member reads you less charitably.
- **Hidden concerns** (section 3.4) only surface when trust is 45 or more, or the conversation band is Strong.
- **Triggers.** "Team member complains" also fires when trust is under 25 for two periods. "Resignation" also fires when trust is under 15 and morale is under 20.
- **Mood.** Trust feeds the portrait mood (section 7.6).

### 3.4 Hidden concerns
- A member's `hiddenConcern` is never shown as text until it surfaces [S].
- It surfaces when the conversation evaluator flags `concernSurfaced` for that member and the trust or band condition above holds.
- The profile then shows "Shared: ...", and Trust rises +4.
- The member's unanswered request then stops lowering morale.

---

## 4. Actions [M][W]

### 4.1 Costs and repeat limits

Costs are in sub-periods and repeat limits are in days; both are *config*. Defaults are below.
- **Costs** are the workbook's whole days [W], per your decision (D32), except where the GenieKreator docs set a different cost [G]: team building and the one week workshop take 2 days. An option may carry its own cost.
- **Repeat limits** follow the Model doc where it differs from the workbook [M].
- **Replying in the inbox** is not an action and costs nothing [S].

| Action | Scope | Kind | Cost | Repeat limit | Limits |
|---|---|---|---|---|---|
| Meet the team | team | live (meeting) | 1 | 10 days | |
| Energize the team: Team lunch | team | static | 1 | 10 days [G] | |
| Energize the team: Team building | team | static | 2 [G] | 10 days [G] | |
| Send email | 1 to 3 people | live (email) | 1 | | max 3 recipients [M] |
| Send for training: 3 day / 1 week | 1 to 3 people | static | 1 / 2 [G] | | away 3 or 5 days; a peer in the same stage must be available to cover [G] |
| Swap or reassign roles | 2 people in different stages / 1 person to a stage you pick | hybrid | 1 | | prerequisite: Assess (nudge); at most 2 per stage, nobody leaves a stage empty [G] |
| Hire member | team | live (interview) | 2 | 8 days | unlocks in period 3 (config); not while every stage is full [G] |
| Meet face to face | 1 person | live (1:1) | 1 | | |
| Coach member | 1 person | live (1:1) | 1 | | |
| Give feedback | 1 person | live (chat) | 1 | | |
| Set goals | 1 person | live (written plan) | 1 | | |
| Assess member | 1 person | static | 1 | | information only |
| Reward member | 1 person | hybrid | 1 | 20 days | |
| Let go | 1 person | hybrid | 1 | | not the last person in a stage [G] |

### 4.2 Effect tables

Skill / morale / result change for mismatch 0, 1 and 2 [W]:

| Action, option | Mismatch 0 | Mismatch 1 | Mismatch 2 |
|---|---|---|---|
| Meet the team (all 4 options) | +2 / +8 / +10 | −1 / −5 / −6 | −1 / −8 / −10 |
| Team lunch | 0 / +3 / +4 | 0 / −3 / −2 | 0 / −5 / −4 |
| Team building | +1 / +6 / +9 | −1 / −4 / −5 | −1 / −6 / −8 |
| Warning email | +1 / +3 / +3 | −1 / −6 / −7 | −7 / −5 / −3 |
| Congratulatory email | +1 / +8 / +8 | 0 / −4 / −5 | −1 / −2 / −4 |
| Training, 3 day | +9 / +6 / +8 | +5 / +3 / +2 | −4 / −8 / −3 |
| Training, 1 week | +8 / +7 / +6 | +5 / +6 / +4 | −3 / −5 / −7 |
| Meet face to face (all styles) | +1 / +6 / +9 | −1 / −4 / −5 | −1 / −6 / −8 |
| Set goals, D | +3 / +6 / +7 | −1 / −2 / −4 | −2 / −3 / −3 |
| Set goals, G | +2 / +5 / +6 | −1 / −2 / −3 | −2 / −3 / −2 |
| Set goals, P and E | +2 / +5 / +5 | −1 / −2 / −3 | −2 / −3 / −2 |
| Coach, D | +6 / +3 / +7 | −2 / −1 / −4 | −5 / −2 / −3 |
| Coach, G | +5 / +3 / +6 | −2 / −1 / −3 | −5 / −2 / −2 |
| Coach, P | +3 / +2 / +5 | −1 / −1 / −3 | −4 / −2 / −2 |
| Coach, E | +2 / +2 / +4 | −1 / −1 / −2 | −2 / −2 / −1 |
| Feedback, D | +3 / +6 / +7 | −1 / −2 / −4 | −2 / −3 / −3 |
| Feedback, G | +2 / +5 / +6 | −1 / −2 / −3 | −2 / −3 / −2 |
| Feedback, P | +2 / +5 / +5 | −1 / −2 / −3 | −2 / −3 / −2 |
| Feedback, E | +1 / +3 / +4 | −1 / −1 / −2 | −1 / −2 / −1 |
| Reward | 0 / +6 / +9 | 0 / −12 / −18 | |

### 4.3 How each action decides its mismatch type [M]

| Action | Compared against |
|---|---|
| Meet the team, face to face, set goals, coach, feedback | The fit table's difference for the style used and each affected member's need. In 2.0 the style used comes from the live conversation (section 5): the evaluator reads which of the lens's styles the participant's words show. An option's `style` tag is a lens style key. |
| Team lunch and team building | The style you set for each member this period against their need at the start of the period (the fit table). |
| Email | Each recipient's result now against 10 sub-periods ago. Congratulating someone whose result held or rose gives mismatch 0, otherwise 1. Warning someone whose result fell gives mismatch 0, otherwise 1. The evaluator classifies the email as congratulatory, warning or neutral; neutral uses the congratulatory row at half value. |
| Training | The style set this period against the need at the start of the period (the fit table), then the training table (section 2). The member is away for the training's length. |
| Swap or reassign | No mismatch. The member takes their configured values for the new stage, ±6 at random [M]. Skipping the Assess prerequisite costs the moved members 3 morale [N]: the spec says the penalty still applies, and 1.0 gives none. |
| Assess | No effect. Reveals the member's values for a chosen stage, ±6 [M]. Satisfies the swap prerequisite. |
| Reward | The top performer (highest result among available members) gets mismatch 0. Rewarding anyone else gives that person mismatch 0, and the top performer gets mismatch 1, always negative [M]. |
| Fire | The member leaves. Every other member gets mismatch 1, always negative [M], plus the trust rule. |
| Hire | The candidate joins with their profile values [M]. In 2.0 the interview band decides whether they accept: Strong or Adequate, yes; Weak, 50%; Harmful, no. |

### 4.4 Weekly style setting [M]

At the start of each period you set a style per member, one of the lens's 2 to 6 styles; the Model doc calls these the actions a leader takes at the start of the week. When you confirm, each member's difference comes from the lens's fit table (their set style against their need, section 2), becomes a mismatch with the usual randomness, and applies this change once:

| Mismatch | Skill / morale / result per period |
|---|---|
| 0 | 0 / +3 / +3 |
| 1 | 0 / −1 / −1 |
| 2 | 0 / −2 / −2 |

The Model doc gives the rule but no values. The Configuration Spec sets the size [G]: "About +2 to +3, −1 to −2" for morale and result. These are *config* defaults.

- The engine refuses a style key the lens does not have (`unknownStyle`).
- **Erratic change** (3.1): changing someone's style when their need did not change, from a style that fitted it, costs trust.
- After you confirm, the sponsor sends a team message with each person's reaction and a reason chip for every change [S]. The message words the share of good reactions as the Configuration Spec's four bands: fewer than half, half, most, the whole team [G].
- **Weekly drift [G]:** at the end of a period, anyone nobody acted with loses 3 morale (*config*, `drift`). Team wide actions count for everyone; the weekly style does not.
- **Team averages [G]** count the people who are available, not those away.

- Members who are away still get a style. It applies when they return [S].
- The optional reason note per member feeds the report's intent vs action insight [S].

---

## 5. Live interactions [G][S]

In iLead 1.0 you picked one of four written options. In 2.0 you speak or write freely, and an AI evaluator reads your words. The AI judges; the authored rules decide the consequences. The UI never shows raw model scores or band names [S].

### 5.0 Conversations [G][S]
- An interaction holds turns. The NPC speaks first unless the author set otherwise (Configuration Spec, Opening).
- Roleplay, chat, team meeting, sponsor briefing and interview are conversations: you send turns, the NPC answers in persona, and ending the interaction evaluates everything you said. Email and written plan are submitted once.
- **Turn limit** 12 for RolePlays (*config* per action); the NPC can also sign off. **Minutes** per interaction are *config* (3 to 5).
- **Interrupt:** speaking over the NPC stops it; the engine keeps only what was shown.
- **Hint:** one coaching tip per interaction, on request by default (*config*: off, on request, after a Weak band).
- **NPC words** come from an `NpcModel`: an AI model on the server in production, streamed to the client and labelled as AI. The mock engine uses a transparent persona stand in that follows mood, trust and what you said. A hidden concern surfaces in the person's own words (`concernLine`) when you ask about it and they trust you enough (trust 45 or more, or you acknowledged them).
- **Live cap [G]:** 2 live or hybrid actions per period (*config* `time.liveCap`). Inbox replies and sponsor briefings do not count.
- **Sponsor briefings [G]:** scheduled in weeks 4 and 8 (*config* `sponsor.briefings`) as an urgent inbox item due by the end of the period. Skipping one costs sponsor confidence −10 (an issue escalated to the CEO).
- **Interview [G]:** Hire interviews 2 candidates whose home stage has room, then you choose one or pass. How the interviews went sets the new hire's first trust in you (+6, +2, −3, −8). The brief lists the same structured questions for both candidates (*config* `live.questions`, otherwise three general ones), and the outcome says what the decision came to: joined, turned the offer down, no room, or passed on both (D85).
- **Written plan [N]:** submitted once with its fields (goals, measures, owner, due, support), then the person's check in. Ending it evaluates the fields alone, like an email: specific (goals of six words or more Strong, three Adequate, else Weak), measurable (a number in the measures and a due date: both Strong, one Adequate), involvement (an owner and your support: both Strong, one Adequate). The due date becomes a promise to check in with that person (5.4) (D85).
- **Week 0 practice [S][N]:** before week 1 a short conversation with one team member (*config* `practice`: on by default, the first member, 4 turns, 3 minutes), never evaluated, logged or scored, and skippable. It ends with one coaching tip (D84).

### 5.1 The evaluator returns [G]
| Field | Meaning |
|---|---|
| `dimensions` | A band (Strong, Adequate, Weak, Harmful) per rubric dimension, 2 to 4 per interaction, with the quotes behind each |
| `redFlags` | Abuse, blame, discrimination, policy breach. Any one forces Harmful. |
| `band` | Overall: Harmful on any red flag; otherwise the median of the dimension bands, ties to the lower band (scoring-and-report.md 4, your call D49) |
| `styleUsed` | D, G, P or E: the style your words showed, with a confidence value |
| `evidence`, `flags` | Verbatim quotes; open questions, acknowledgement, invitation, next step, concern surfaced, promise |

Default rubric dimensions per format (*config* per action):

| Format | Dimensions |
|---|---|
| 1:1 RolePlay | listening, clarity, involvement |
| Chat | responsiveness, clarity, listening |
| Email | specificity, tone, fairness |
| Team meeting | agenda, inclusion, clarity |
| Sponsor briefing | ownership, honesty, plan |
| Interview | structure, probing, fairness |
| Written plan | specific, measurable, involvement |

### 5.2 Consequences
- **Authored table [G]:** when an action has a consequence table, the band's deltas apply: skill, morale, result and trust for the target, a ripple for everyone else present, and sponsor confidence.
- **Default [M]:** without a table, 1.0's maths generates the consequences (D35): the style difference gives a mismatch type, and the band adjusts it:

| Band | Effect |
|---|---|
| Strong | Mismatch one step better (minimum 0), positive changes ×1.2 |
| Adequate | Unchanged |
| Weak | Mismatch one step worse (maximum 2) |
| Harmful | Mismatch 2 and trust −8 |

- **Style tags [G]:** only a conversation with one person counts as a style choice. Team meetings, sponsor briefings, interviews and multi recipient emails carry no style.
- **Intent vs action [G]:** when the style you show someone in conversation differs from the style you declared for them, two periods running, their trust drops by 4 (*config* `trustRules.intentGap`).

### 5.3 What every metric change carries (brief, rule 5)
Each change in the outcome is a `MetricChange` with a `Reason`:
- a short chip label ("1:1 went well")
- the cause, in plain words
- the authored rule, in words, for example "A 1:1 that matches the style Kent needs lifts morale 6 and result 9, and trust 6 when it goes well"
- evidence quotes with `judgedByAI: true`

The rubric band name never appears [S].

### 5.4 Promises
- A promise the evaluator extracts becomes an open promise on the member, with a due sub-period and a `fulfilledBy` action (for example "review lead routing", fulfilled by meet face to face or set goals with Kent).
- Kept when that action happens with that member by the due time: trust +6. Broken when the due time passes: trust −8, and a reason chip on the profile.

### 5.5 Format specifics
| Format | Rule |
|---|---|
| Chat (inbox reply) | Costs no days [S]. Band gives morale +3 / +1 / −1 / −4 and the responsiveness trust rule. |
| Team meeting | Every attendee is affected. Calling on a quiet member (raised hand) who then speaks adds +2 morale for them. |
| Sponsor briefing | Affects sponsor confidence (section 7.5), not members. |
| Email | Replies arrive in the inbox over the next sub-period [S]. |
| Inappropriate input | The NPC responds in role. A second `abusive` flag in the same interaction ends it with a neutral message, Harmful band, and the event is logged [S]. |
| Hint | One coaching tip per interaction, if the author allows hints [S]. Recorded for the report. |

---

## 6. Time, funnel and events

### 6.1 Time [M][S]
- A period starts with style setting, then the board. Capacity is `subPeriod.perPeriod`.
- Taking an action spends its cost. Each time the spent total crosses a whole sub-period, that sub-period runs: funnel, scheduled events and trigger checks.
- **End period** runs the remaining sub-periods, then the period end sequence.
- The session clock (real time, optional) pauses in live screens, modals, events and tours [S]. The engine owns it.
- **Time limit:** a gentle warning 2 minutes before, then the end screen. A live interaction in progress may finish [S].

### 6.2 Funnel [M]
Per sub-period, for each stage in order:

```
output = input × conversionRatio × (averageResult(stage) + performanceThreshold) / (100 + performanceThreshold)
```

The Model doc divides by 100. With a positive buffer that lets a stage output more than its conversion ratio allows, so the engine divides by `100 + buffer` (DECISIONS D36). With a buffer of 0 the two are identical.

- `input` for the first stage is `inputPerSubPeriod`; for later stages it is the previous stage's output.
- `averageResult(stage)` averages the result of available members in that stage. Away members count as 0, with no one covering.
- `performanceThreshold` is a *config* buffer, set by calibration. A larger buffer makes stage performance compound less across the funnel.
- Conversions = the last stage's output, carried as fractions and shown rounded.
- Business value = conversions × `valuePerConversion`.

**Ideal throughput** of a stage: what it would produce if everyone in the funnel performed at the High threshold (70).

**Bottleneck stage** [S]: the stage with the lowest ratio of actual to ideal throughput this period.

### 6.3 General events [W][G]
An event's impact (skill / morale / result) lands on its target, adjusted by the style you set with each person:

| Style mismatch | Share of the event's impact |
|---|---|
| 0 | Half |
| 1 | Full |
| 2 | 1.5× |

Every event setting is *config* (Configuration Spec, Events and NPC initiated moments):

| Setting | Options | Engine behaviour |
|---|---|---|
| Card type | Impact, signal, capacity, diagnostic, opportunity, crisis | Shown on the card |
| Timing | Fixed period and sub-period; random within a window of periods, with a probability; conditional | Random timing is drawn once per run from the seed, on its own stream, so adding an event changes nothing else. Conditions (team morale below, team trust below, someone's morale below, revenue behind pace, each for N period ends in a row) are checked at each period start and fire once. An event with no timing fires only as a follow up |
| Target | Team, everyone in a stage (`stage:<key>`), a named member, one member the engine picks, the sponsor | The engine picks the top performer for an opportunity or a job offer, otherwise someone mid table |
| Delivery | Board card, bulletin, chat, email, sponsor call | A bulletin is read in the week end before its period (its See impact text is authored) and lands with no card; in period 1 it shows as a card. A chat or email arrives in the inbox from the target. A sponsor call rings on the board and leaves an urgent sponsor message |
| Capacity loss | Sub-periods the target is away | |
| Label | Optional text on the card | Hidden unless authored (labels can mislead) |
| Expected response | Actions that count, the window in sub-periods, a bonus when on time | Replying to the event's message, or taking a listed action with the target, answers it. In time, the bonus applies to the target |
| Escalation | A follow up event, and whether the sponsor hears of it | Past the window, the sponsor loses confidence (escalation, −10) and the follow up event fires |

Sales Elevator: the 12 workbook events, mapped from 12 weeks to 8 as `round(period × 8 / 12)` with up to two a period (first and third sub-period), plus two that GenieKreator would generate from the context:

| Event | Period | Impact (S / M / R) | Delivery and response |
|---|---|---|---|
| New CRM system | 1 | −1 / −4 / −7 | Card |
| Review site criticizes | 2 | 0 / −4 / −4 | Bulletin |
| Performance declines | 2 | 0 / −6 / −10 | Card, one member; a 1:1, coaching or feedback within 2 days, else the sponsor hears |
| 360 degree feedback | 3 | 0 / −4 / 0 | Bulletin |
| Recession strikes | 3 | 0 / −5 / −5 | Sponsor call, crisis; a reply or a team meeting within 2 days |
| Rumors of being acquired | 4 | 0 / −5 / 0 | Bulletin |
| Job offer | 5 | 0 / −5 / −5 | Chat from the top performer; a reply, 1:1, reward or coaching within 2 days |
| Sales conference | 5 | 0 / −4 / −2 | Bulletin |
| Tragic accident | 6 | 0 / −8 / −7 | Card |
| Business process change | 7 | 0 / −9 / −10 | Bulletin |
| Insider trading scandal | 7 | 0 / −5 / 0 | Card, one member |
| Supplier strike | 8 | 0 / −2 / −3 | Bulletin |
| A big client referral | random, periods 3 to 6, 60% | 0 / +3 / +4 to the proposal stage | Card, opportunity |
| Paula has heard the team is struggling | when team morale is below 40 at two period ends | none | Sponsor call, crisis; a reply within 2 days, else the sponsor hears |

### 6.4 Trigger events [W][M]
Conditions are checked each sub-period. Weeks are expressed as fractions of the run, so they scale with `period.count`.

| Trigger | Condition | Effect | At most |
|---|---|---|---|
| Casual leave | Result over 70 and another member in the same stage, in the first sub-period of the periods at about 3/8, 5/8 and 7/8 of the run | Away 5 sub-periods | once |
| Medical leave | Result over 70, in the second sub-period of the periods at about 25%, 50% and 75% of the run | Away 2 sub-periods | once |
| Clueless team member | Reassigned last period without training | Skill −10 | once |
| Demoralized member | Result under 20, after 30% of the run | Message, morale risk | once |
| Lack of training | Result falling 6 periods in a row (scaled) | −2 / −6 / −8 | twice |
| Morale drops | Result over 60 for 3 periods with no congratulation or reward | Morale −5 | 3 times |
| Resignation | Result under 10, or trust under 15 and morale under 20 [N], after 20% of the run | Member leaves | twice |
| Role change request | Same stage for 4 periods | Morale −2, result +2; trust −4 if ignored [N] | 3 times |
| Team member complains | Result falling 3 periods in a row, or trust under 25 for 2 periods [N] | Message | twice |
| Training request | General event | Training them within the period: trust +4 [N] | |

Every event and trigger pauses the clock while its card is open [S].

---

## 7. 2.0 gamification [G]

The GenieKreator rules (`docs/genie/scoring-and-report.md` section 6, D62). Formulas are engine behaviour; every number is *config* under `gamification`, with these defaults. The UI only renders them. The game score never changes a skill rating.

### 7.1 Leadership Score
**Score = 9 × (0.3 B + 0.3 P + 0.4 L) + streak bonus**, rounded half up, 0 to 1,000. The 9 is (scale − streak cap) ÷ 100.

| Pillar | 0 to 100 |
|---|---|
| Business (B) | min(100, revenue ÷ target × 100) |
| People (P) | 50 + change in team morale + 0.5 × change in team trust, since the start of the run, kept in 0 to 100 |
| Leadership (L) | 0.5 × contextual capability % + 0.5 × the mean band score of all live interactions; with no live interaction, the capability % |

- **Contextual capability %** = style tagged choices that matched what the person needed ÷ all style tagged choices, whole run. Style tagged: weekly style setting, and live conversations with one person (meetings, briefings, interviews and multi person emails carry no style).
- **Band scores:** Strong 100, Adequate 70, Weak 35, Harmful 0.

### 7.2 Stars, per period
**Week score** = 0.5 × weekly style fit % + 0.3 × mean band score of the period's live interactions + 0.2 × min(100, final stage output ÷ the period's ideal × 100). With no live interaction in the period, 0.8 × weekly style fit % + 0.2 × the funnel part (D62).

1 star at 50, 2 at 70, 3 at 85. A period can end with 0 stars (D29).

### 7.3 Streak and badges
**Streak:** periods in a row at 2 stars or more. The third adds +25 to the score, each period after it another +25, up to +100 for the run. A broken streak resets the count at no cost.

**Badges** (each earned once, with its reason in words; unearned badges show their description):

| Badge | Checked | Earned when |
|---|---|---|
| First Close | each sub-period | The team's first conversion |
| Read the Room | period end | 90% or more of weekly style settings fit |
| Flex Master | period end | Every style used correctly at least twice in the run |
| Concern Uncovered | after a conversation | min(5, team size) people have opened up |
| Promise Keeper | run end | 3 or more promises made and none broken (promises still open and not yet due are not counted) |
| Fair Hand | after a conversation, period end | 3 rewards that nobody felt passed over by |
| Turnaround | period end | Someone's morale went from under 30 to over 60 |
| Change Champion | after a conversation | 2 Strong conversations that communicate change: a team meeting, an email, a swap or an exit talk |
| Steady Hand | run end | No Harmful band in the run |
| Target Crusher | period end | Revenue reaches the target |

Authors can rename, describe, remove or add badges by picking one of these rules.

### 7.4 Tiers
From the final Leadership Score: Platinum 850 and up, Gold 700 to 849, Silver 500 to 699, Bronze under 500. Two to five tiers, names and thresholds *config*.

### 7.5 Sponsor confidence
0 to 100, starting at 50. The meter shows the value and a level: Low (under 30, the check in line), Wavering (30 to 49), Steady (50 to 69), Confident (70 to 84, from the unlock line), Champion (85 and up).

| Cause | Change |
|---|---|
| Sponsor briefing band: Strong / Adequate / Weak / Harmful | +20 / +5 / −10 / −25 |
| Period end: revenue at or above the period's share of the target, or below | +5 / −5 |
| Escalation: a missed briefing, or an event ignored past its window | −10 |
| Sponsor message unanswered past due | −5 [N] |
| An authored consequence table entry | as authored |

Tapping the meter lists the last 3 causes [S].

**Unlock offer:** when confidence ends a period at or above 70 having started it below, the period end offers one reward (*config*, default all three):
- **A bonus day** next period.
- **Extra hire budget:** the next hire is allowed one seat past a full team, before Hire unlocks, and costs no days.
- **A team activity without cooldown:** the next team wide static action (Energize the team) skips its wait and sets none.

**CEO check in:** when confidence ends a period below 30 having started it at or above, the CEO asks for a check in that takes one sub-period of the next period's capacity. A news message says so.

### 7.6 Mood, Team Pulse
Portrait mood is derived per member and recomputed after every change:

| Mood | When (checked in order) |
|---|---|
| Frustrated | Morale under 25, or trust under 20 |
| Concerned | Morale under 45, or the last change was −5 or worse |
| Thinking | An open promise or open message from them, or reassigned this period |
| Upbeat | Morale 70 or more and the last change ≥ 0 |
| Steady | Otherwise |

Away members show "In training" or "On leave".

**Team Pulse** [G] is the mean of team morale and team trust, with its trend since the period start. The mood counts [S] stay alongside it: upbeat (Upbeat), steady (Steady and Thinking) and struggling (Concerned and Frustrated).

**Week end summary:** the engine words a headline (someone who bounced back, else by stars) and one sentence on people and business, and reports the funnel per stage against the period's ideal and the cumulative ideal, the bottleneck (the stage furthest below its ideal), KPI start and end, Team Pulse, sponsor confidence, the streak with the next bonus, new badges, any unlock offer or check in, and next period's bulletins.

**KPI trend** [S]: for 3 seconds after a change, the KPI tile shows the change; then rising, easing or steady, by comparing the team average with the start of the period.

---

## 8. Report [G]

Report 2.0 (`docs/genie/scoring-and-report.md` sections 5 and 7). The engine builds it from the run (`src/engine/report/build.ts`) and sends it in the view once the run has ended. Every element traces to the run or to authored copy; no text is written by a model at runtime. All settings are *config* under `report`, with these defaults (`src/engine/report/defaults.ts`).

### 8.1 Skill observations
- **Lens:** the primary lens's scoring dimensions are the skills (`report.skills`). A secondary lens (`lens.secondary`, D70) adds its dimensions as skills with `reportOnly: true`: scored from conversations like the others (linked in the linkage matrix), shown in the skills section with a "Report only" tag, and never in the Leadership Score, the badges, the executive summary (overall level, strengths, priorities) or the development plan.
- **Skills framework:** Situational flexibility, Coaching for growth, Handling difficult conversations, Goal setting and accountability, Giving feedback, Recognition and fairness, Communicating change, Results ownership, each with one authored behavioural anchor per level.
- **Linkage matrix:** which skills each live interaction rates (2 to 4), keyed by action: Meet face to face, Coach member, Give feedback, Send email, Meet the team, Set goals, the swap and exit talks, the sponsor briefing, the reward talk, the hire interview and replies to messages. Static actions never create observations.
- **Observation:** the evaluator returns one band per linked skill, with the participant's words it rests on. A red flag makes every rated skill Harmful. The interaction's overall band (and so its consequences, D62) still comes from its authored rubric, so the game is unchanged.

### 8.2 Ratings
- **Enough evidence:** 2 observations from 2 different interactions (`minObservations`, default 2); otherwise "Not enough evidence". Report only skills always need at least 2 from 2, whatever `minObservations` says.
- **Skill score:** the mean of band scores (Strong 100, Adequate 70, Weak 35, Harmful 0). Level by threshold: Novice 0, Developing 40, Proficient 60, Advanced 75, Role Model 90. Any Harmful observation caps the skill at Developing.
- **Overall level:** from the mean of rated skills, shown only when at least half the skills are rated.
- **Evidence quotes:** up to 2 per skill, verbatim from the participant's own turns, highest band first, then the most recent.

### 8.3 Sections
| # | Section | From |
|---|---|---|
| 1 | Executive summary | Overall level and its authored narrative; 3 strengths (top rated skills); 3 priorities (lowest rated, not already strengths); one business sentence (share of target, deals, the most frequent bottleneck) |
| 2 | Style flexibility and fit | Style shares over the lens's styles, dominant style, contextual capability %, the grid of the four needs (rows) against the style used (columns, one per lens style) with the fitting cells outlined from the fit table (sent with the report only, once the run has ended), weekly fit per person per period, narratives by capability band and dominant style (keyed by lens style; a style without a line adds none) |
| 3 | Intent vs action | Per person: dominant weekly style, dominant style shown in conversations, aligned or gap, a quote from the latest conversation that differed, the participant's own reason from style setting, trust lost to mixed signals |
| 4 | Skills profile | Level, anchor, observation count, quotes, or "Not enough evidence" |
| 5 | Key moments | 5 to 7: conversations with a Strong, Weak or Harmful band, escalations, promises kept or broken, unanswered messages; ranked by the size of the changes to people, then shown in order. Each in SBI form with the intent declared that week |
| 6 | People outcomes | Per person: morale, trust and result at each period end, actions taken and days spent with them, result change |
| 7 | Business outcomes | Revenue against target pace per period, the funnel against the cumulative ideal, deals, the bottleneck in most periods and why (its lowest result owner's weakest number) |
| 8 | Conversation analytics | Descriptive, never scored: participant words per NPC word in spoken and role play formats, open questions, recognition statements (authored phrase list) |
| 9 | Development plan | The 3 lowest rated skills (then skills without enough evidence), each with an authored practice activity and on the job action, and a check in date |
| 10 | Methodology | First the lens, in participant language: "This simulation looks at leadership through the {title} lens.", and with a secondary lens a line naming it and saying its skills are Report only. Then the authored copy, and the facts: conversations, observations, review status. The lens's source is never printed. |

The end screen collects up to 3 reflection answers (authored questions, by voice or text) and a 1 to 5 experience rating (`submitReflection`). The plan quotes the first answer.

### 8.4 Report 3.0: purpose, the run summary and the 1.0 sections (D75, D76)
- **Purpose** (*config* `purpose`): `development` (default) or `assessment`. `use: 'selection'` still reads as assessment, and the leaderboard stays off for assessment unless authored on. Development copy never uses verdict words and frames each finding as the next step at work; assessment copy is neutral and carries verdicts.
- **Action records.** Every action taken keeps who it reached (the people picked, or everyone available for a team action; nobody for a hire) and the net skill, morale and result change it made per person, from the decision, the conversation, ripples (a passed over top performer, colleagues of someone let go) and an event it answered. Conversations of the consistency actions also record the style shown to each person with their need then, team meetings included. Records never touch the random draws or ids: seeded runs replay exactly and calibration is unchanged.
- **Impact bands** (*config* `report.impact`): the mean of skill + morale + result change per person reached. Under −2 very low, −2 to under 3 low, 3 to under 10 moderate, 10 and up high. Never used, or nothing changed: no impact. The same bands colour the distribution matrix per member and action.
- **Run summary** (`summarizeRun(sim)`, `src/engine/report/summary.ts`; schema `RunSummary` in `src/engine/reportContract.ts`): completion, objectives (revenue, target, share, conversions, team skill, morale, result and trust at the start and end), the funnel per period against its ideal, skills (score, score out of 10, level), the overall level, styles (proportion, accuracy, how often people needed each, adaptability, preferred, the needs by styles grid), consistency, actions, the distribution matrix (members ordered by total impact), time spent with the top three, the bottom three and the rest by result at each period start (share of one to one actions), and, for assessment, the verdict keys. Plain numbers and keys, versioned, for the server and the group report.
- **Consistency** (*config* `report.consistencyActions`, default the 1.0 report's Meet the Team, Meet Face to Face, Set Goals, Coach Member, Give Feedback: `meet`, `f2f`, `goals`, `coach`, `feedback`): needed against used is the share of uses whose style does not fit the person's need then (the fit table); intended against used the share of uses whose style differs from the style set for that person that period; needed against intended the share of weekly settings that did not fit. Per member: the predominant need (and the first style that fits it), style set and style used, ties in lens order.
- **Verdicts** (assessment; *config* `report.assessment`): the bar is an overall level (default Proficient) and a floor (default Developing). Exceeds: above the bar overall and no rated skill below the bar's level. Meets: at the bar and no rated skill under the floor. Approaching: one level short at most and at most one skill under the floor. Below: anything else. No overall level, no verdict. Per skill: Strength above the bar's level, Meets at it, Development need below. Each verdict lists its live records, up to 3 quotes, and whether an assessor reviewed all, some or none of them. Report only skills get none.
- **Sections** (`report.sections`; left out, the purpose's default): about (the simulation, how to read, confidentiality), summary (assessment: the verdict first), skills (score out of 10, what the skill means, the purpose's narrative, assessment: its verdict), objectives, adaptability, styles, the weekly style fit, consistency, intent, actions, distribution, moments, people, business, analytics, food for thought, takeaways, plan (development: practice per skill, a 30, 60 and 90 day path, check ins at `checkInDays`, 30, 60 and 90 days; assessment: development needs against the bar), progress (earlier attempts from `getHistory`, hidden when none) and methodology. Assessment leaves out the weekly style fit, intent, food for thought and takeaways by default.
- **Narratives** come from `report.purposeCopy` (per purpose), `report.actionCopy`, `report.thought`, `report.takeaways` and `report.path`, defaults in `src/engine/report/defaults.ts`; GenieKreator replaces them.

### 8.5 The group report (D75, D77)
For the organization, not the participant: aggregates of a cohort's run summaries. `buildGroupReport({ runs, names?, benchmark?, cohort: { name, date, purpose, storyline, lens? } })` in `src/engine/report/group.ts`, pure and deterministic, so the server runs the same code; schema `GroupReport` in `src/engine/groupContract.ts`.
- **Benchmark** (`summarizeBenchmark(runs)`, schema `BenchmarkSummary`): what the server stores per storyline and lens from everyone who has played it. Averages and distributions only: completion buckets, per skill the mean score of the runs that rated it and the runs at each level, objectives and the team at the start and end, adaptability, preferred styles (a tie splits a run between its styles), pooled proportion, accuracy and need per style, mean deviations, the funnel per period, per action the mean frequency, the runs that used it and the mean change per person reached (pooled), time spent, and verdict counts for assessment runs. No seeds, names or single runs (the best revenue is the group's own, never stored). The group's numbers come from the same function, so group and benchmark always compare like with like. A benchmark of another storyline is ignored; one of another lens compares everything but the styles.
- **Which runs** (*config* `report.group.completeAt`, default 100): the completion rate counts every participant (50% or less, over 50 to under 80, 80 to under 100, 100); every other average reads only runs completed to `completeAt`%. Verdicts count every assessment run, finished or not.
- **Skills**: the group's mean score out of 10 (one decimal) and the level it reaches on the storyline's scale, beside the benchmark's; "in line" within 0.5, else "N points above or below". The share of the group at each level per skill, with "No level" for runs without enough evidence.
- **Business**: best revenue against the target, average revenue, conversions and share of target against the benchmark, the share who beat the target, and the team's skill, morale, result and trust at the end against the benchmark. Narrative by the average share: under 60%, under 100%, reached.
- **Styles** (lens aware, 2 to 6 styles): mean adaptability against the benchmark ("in line" within 3 points), the share of participants whose most used style each was, per style the pooled proportion, accuracy and need with the individual report's rules (accuracy under 40, under 70, 70 and up; used 10 points more or less than needed), and the three consistency deviations (under 25, under 50, 50 and up).
- **Funnel**: the last stage's (conversions) mean throughput per period against its mean ideal and the benchmark's. **Actions**: mean times taken per participant, the share who used each, the pooled mean change per person reached and its impact band (`report.impact`). **Management style**: mean shares of one to one actions with top, average and bottom performers; "evenly" when they are within 10 points.
- **Purpose.** Development: no verdicts, no names, no ranking; below `report.group.minimumCohort` participants who completed (default 5) every aggregate and the takeaways are withheld with a message, and below it in all the completion rate too. Assessment: the minimum does not apply (its table names people by design); it adds the verdict distribution against the benchmark and a participant table in name order (completion, overall level, verdict, review status: assessor, mixed, AI only, from the run summary's `review`).
- **Sections** in order: about (how to read, the benchmark line, confidentiality by purpose), verdicts (assessment), skills, distribution, completion, business, adaptability and preferred styles, styles, consistency, funnel, actions, management style, key takeaways (organizational questions by section). Sections without data are left out.
- **Narratives** come from `report.group.copy` (replaced as a whole), defaults in `src/engine/report/groupDefaults.ts`, adapted from the 1.0 group report's intent.

## 9. Calibration ("make it playable")

The funnel numbers are tuned per storyline by `npm run calibrate -- <storyline>` (`scripts/calibrate.ts`). It runs the engine a few thousand times under three policies:

| Policy | Behaviour | Required result (share of target) |
|---|---|---|
| Passive | Keeps the starting styles, takes no actions | 40 to 65% |
| Random | Random styles and affordable actions | 35 to 65%. Acting without reading people can do more harm than doing nothing, as in the Model doc. |
| Good | Sets a style that fits each need each period (the lens's fit table), picks actions that address low metrics, conversations at Adequate or better | 100 to 125%, reached in 80% or more of runs |

**What it adjusts, in order:**
1. `performanceThreshold`, the Model doc's funnel buffer. It is bisected until passive play earns about half of what good play earns (medians), because the compounding across stages is what makes or breaks playability.
2. `money.inputPerSubPeriod`, the leads entering the funnel. Value is linear in input, so it is scaled to put good play's median at about 110% of target.

The authored `target` is the client's number and stays as it is. Starting member values are never changed: the script only reports the starting mix, which passes when all four needs are present (the report names each by the first style that fits it) and at least two members start under the low threshold in some metric, so there is someone to help.

It then plays 200 runs per policy and checks every band. The output is a report (`calibration/<storyline>.md`) with the before and after values. The tuned values are written back to the storyline with `calibrated` set to whether every band and the member mix pass; when one fails, the script also exits with an error. `--check` only measures and reports. The engine does not read the `calibrated` flag yet, so an uncalibrated storyline still plays.

For the Sales Elevator default, calibration starts from the workbook's starting values; the prototype's on-screen numbers are only design fixtures for the `/screens` gallery.

## 10. Engine copy (D83)

Every sentence the engine writes is a message code with parameters (`src/engine/copy.ts`), worded on the client from the catalog in the participant's language (`src/i18n/messages/<locale>/engine.json`). Authored copy (events, triggers, emails, persona lines, report narratives) stays as authored, in the storyline's language (`locale`). The rules above quote the English wording.
