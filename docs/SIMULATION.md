# iLead 2.0 simulation rules

The authoritative rule set for the iLead 2.0 engine. The mock engine (`src/engine`) implements exactly this, and every rule has a unit test. The UI never computes any of it: it renders engine state and sends intents.

**Sources** (each rule is tagged):
- **[M]**: iLead 1.0 Model doc (`docs/ilead-1/iLead - Model doc.docx`). Where 1.0 sources disagree, the Model doc wins.
- **[W]**: iLead 1.0 content workbook (`docs/ilead-1/iLead International Sales Elevator - Full content.xlsx`).
- **[S]**: iLead 2.0 Participant Interface Spec and the design.
- **[N]**: new in 2.0, designed here. Needs your review.

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

**A member's needed style** comes from their current skill and morale:

| Skill | Morale | Needed style |
|---|---|---|
| Low | Low | Directing (D) |
| Low | High | Guiding (G) |
| High | Low | Partnering (P) |
| High | High | Entrusting (E) |

The workbook's leadership style sheet lists Partnering as high and high, which is a typo; the Model doc is followed.

**Style difference** between a chosen style and the needed style:
- 0 when both the skill and the morale ranges match
- 1 when one of them matches
- 2 when neither matches

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
| Style changed for a member whose needed style did not change | −2 | Feels erratic. Not applied in the first period. |
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
- **Costs** are the workbook's whole days [W], per your decision (D32).
- **Repeat limits** follow the Model doc where it differs from the workbook [M].
- **Replying in the inbox** is not an action and costs nothing [S].

| Action | Scope | Kind | Cost | Repeat limit | Limits |
|---|---|---|---|---|---|
| Meet the team | team | live (meeting) | 1 | 10 days | |
| Energize the team: Team lunch | team | static | 1 | 20 days | |
| Energize the team: Team building | team | static | 1 | 8 days | |
| Send email | 1 to 3 people | live (email) | 1 | | max 3 recipients [M] |
| Send for training: 3 day / 1 week | 1 to 3 people | static | 1 | | away 3 or 5 days |
| Swap or reassign roles | 2 people / 1 person | hybrid | 1 | | prerequisite: Assess (nudge) |
| Hire member | team | live (interview) | 2 | 8 days | unlocks in period 3 (config) |
| Meet face to face | 1 person | live (1:1) | 1 | | |
| Coach member | 1 person | live (1:1) | 1 | | |
| Give feedback | 1 person | live (chat) | 1 | | |
| Set goals | 1 person | live (written plan) | 1 | | |
| Assess member | 1 person | static | 1 | | information only |
| Reward member | 1 person | hybrid | 1 | 20 days | |
| Let go | 1 person | hybrid | 1 | | |

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
| Meet the team, face to face, set goals, coach, feedback | The style used against each affected member's needed style. In 2.0 the style used comes from the live conversation (section 5), not from picking one of four options. |
| Team lunch and team building | The style you set for each member this period against their needed style at the start of the period. |
| Email | Each recipient's result now against 10 sub-periods ago. Congratulating someone whose result held or rose gives mismatch 0, otherwise 1. Warning someone whose result fell gives mismatch 0, otherwise 1. The evaluator classifies the email as congratulatory, warning or neutral; neutral uses the congratulatory row at half value. |
| Training | The style set this period against the needed style, using the training table (section 2). The member is away for the training's length. |
| Swap or reassign | No mismatch. The member takes their configured values for the new stage, ±6 at random [M]. Skipping the Assess prerequisite costs the moved members 3 morale [N]: the spec says the penalty still applies, and 1.0 gives none. |
| Assess | No effect. Reveals the member's values for a chosen stage, ±6 [M]. Satisfies the swap prerequisite. |
| Reward | The top performer (highest result among available members) gets mismatch 0. Rewarding anyone else gives that person mismatch 0, and the top performer gets mismatch 1, always negative [M]. |
| Fire | The member leaves. Every other member gets mismatch 1, always negative [M], plus the trust rule. |
| Hire | The candidate joins with their profile values [M]. In 2.0 the interview band decides whether they accept: Strong or Adequate, yes; Weak, 50%; Harmful, no. |

### 4.4 Weekly style setting [M]

At the start of each period you set a style per member; the Model doc calls these the actions a leader takes at the start of the week. When you confirm, each member's mismatch (their set style against their needed style) applies this change once:

| Mismatch | Skill / morale / result per period |
|---|---|
| 0 | +2 / +4 / +5 |
| 1 | 0 / −3 / −4 |
| 2 | −1 / −6 / −8 |

The Model doc gives the rule but no values; these are *config* defaults inside the workbook's stated bounds (result at most +10 and at least −18).

- Members who are away still get a style. It applies when they return [S].
- The optional reason note per member feeds the report's intent vs action insight [S].

---

## 5. Live interactions [N][S]

In iLead 1.0 you picked one of four written options. In 2.0 you speak or write freely, and an AI evaluator reads your words. The evaluator only reads; the rules decide the consequences. The UI never shows raw model scores [S].

### 5.1 The evaluator returns
| Field | Meaning |
|---|---|
| `styleUsed` | D, G, P or E: the leadership style your words expressed, with a confidence value |
| `band` | Strong, Adequate, Weak or Harmful, from the format's rubric. Never shown to the participant [S]. |
| `evidence` | Verbatim quotes from your words behind the judgement |
| `flags` | `openQuestions` (count), `acknowledged`, `invitedContribution`, `specificNextStep`, `promise {text, dueSubPeriod, fulfilledBy}`, `concernSurfaced`, `abusive` |

Rubric per format, scored 0 to 2 each:
- **1:1, coach, feedback:** acknowledges the person, asks open questions, listens before directing, agrees a specific next step, matches the style they need.
- **Team meeting:** sets direction, invites quiet members, handles objections, closes with ownership.
- **Email:** clear purpose, specific, appropriate tone for the recipient's trend.
- **Sponsor briefing:** leads with the three points, honest about risk, asks for what the team needs.
- **Interview:** probes for fit, sells the role honestly.
- **Written plan:** goals, measures, owner, due day and support needed are all present and specific.

Band from the total: Strong ≥ 80%, Adequate 50 to 79%, Weak under 50%. Harmful whenever `abusive` is set or the words demean the person, regardless of score.

### 5.2 Consequences
1. Style difference = `styleUsed` against each affected member's needed style, giving a mismatch type (section 2).
2. The band adjusts it:

| Band | Effect |
|---|---|
| Strong | Mismatch one step better (minimum 0), positive changes ×1.2 |
| Adequate | Unchanged |
| Weak | Mismatch one step worse (maximum 2) |
| Harmful | Mismatch 2 and trust −8 |

3. The action's effect table (section 4.2) applies, then the trust multiplier, then the trust band change (section 3.1).
4. If `styleUsed` confidence is under 0.5, the evaluator's best guess is used and the outcome's rule text says "your approach read as mostly Guiding".

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
| Hint | One coaching tip per interaction, if the author allows hints [S]. Using it caps the band at Strong (no extra effect) and is recorded for the report. |

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

### 6.3 General events [W]
Scheduled per period, with skill / morale / result applied to the whole team, adjusted by the style you set with each member:

| Style mismatch | Share of the event's impact |
|---|---|
| 0 | Half |
| 1 | Full |
| 2 | 1.5× |

Sales Elevator schedule, 12 week workbook mapped to 8 weeks as `round(period × 8 / 12)`:

| Event | Workbook week | Impact (S / M / R) |
|---|---|---|
| New CRM system | 2 | −1 / −4 / −7 |
| Performance declines | 3 | 0 / −6 / −10 |
| Review site criticizes | 3 | 0 / −4 / −4 |
| 360 degree feedback | 4 | 0 / −4 / 0 |
| Recession strikes | 5 | 0 / −5 / −5 |
| Rumors of being acquired | 6 | 0 / −5 / 0 |
| Job offer | 7 | 0 / −5 / −5 |
| Sales conference | 8 | 0 / −4 / −2 |
| Tragic accident | 9 | 0 / −8 / −7 |
| Business process change | 10 | 0 / −9 / −10 |
| Insider trading scandal | 10 | 0 / −5 / 0 |
| Supplier strike | 11 | 0 / −2 / −3 |

A period holds up to two events (first and third sub-period). A third moves to the next period with room, so no event is dropped.

Each event has a 2.0 card type [S]:
- **Impact:** business consequence, shown with "See impact".
- **Signal:** a hint about a person.
- **Capacity:** someone becomes unavailable.
- **Diagnostic:** new data.

### 6.4 Trigger events [W][M]
Conditions are checked each sub-period. Weeks are expressed as fractions of the run, so they scale with `period.count`.

| Trigger | Condition | Effect | At most |
|---|---|---|---|
| Casual leave | Result over 70 and another member in the same stage | Away 5 sub-periods | once |
| Medical leave | Result over 70, at about 30%, 60% and 90% of the run | Away 2 sub-periods | once |
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

## 7. 2.0 gamification [N][S]

All gamification values come from engine state; the UI only renders them. Points are earned, never taken away [S: "nothing is taken away for being slow"].

### 7.1 Leadership Score
Three pillars, accumulated per period. Each pillar can earn up to `2400 / period.count` per period (300 for 8 periods), so the maximum run score is 7,200 whatever the period count.

| Pillar | Points earned per period |
|---|---|
| Business | max × min(1, periodValue / periodTargetPace), plus a bonus of 10% of max when pace is 110% or more |
| People | max × (0.5 × average morale + 0.5 × average trust) / 100, at period end |
| Leadership | max × style accuracy this period |

- **Style accuracy** = decisions with mismatch 0 ÷ all style decisions. Decisions are weekly styles, plus the style used in live conversations [M].
- **Period target pace** = target × (period ÷ period count).

### 7.2 Stars, per period
| Star | Earned when |
|---|---|
| People | Average team morale at period end is at or above period start |
| Leadership | Style accuracy is 70% or more |
| Business | Cumulative value is at or above target pace |

A period can end with 0 stars (your decision, D29). The spec's "1 to 3" is superseded.

### 7.3 Streak and badges
**Streak:** consecutive periods with 2 or more stars.
- Every third period of a streak adds a bonus of 10% of one period's maximum (90 points with 8 periods) to the Leadership Score.
- A broken streak shows as "paused", never as lost or with a countdown [brief, humane gamification].

**Badges** (rules are hidden; locked badges show the hint [S]):

| Badge | Rule | Hint shown when locked |
|---|---|---|
| First word | Complete your first live interaction | |
| Listener | 3 or more open questions in one 1:1 | |
| Pipeline builder | Any stage at or over its ideal throughput (6.2) for a whole period | Push one stage past ideal |
| Steady hand | Every available member at morale 40 or more for a whole period | Keep everyone above 40 |
| Turnaround | A member's result goes from under 30 to 60 or more | Help someone bounce back |
| Clear voice | Every live interaction in a period done by voice | A whole week in voice |
| Promise keeper | 3 promises kept, none broken | |
| Right style | 100% style accuracy in a period | |

### 7.4 Tiers
At the end, the final Leadership Score as a share of the maximum gives the tier (thresholds are *config*):

| Tier | Share of maximum |
|---|---|
| Bronze | under 40% |
| Silver | 40 to 59% |
| Gold | 60 to 79% |
| Platinum | 80% and up |

### 7.5 Sponsor confidence
A hidden value from 0 to 100. It starts at 50 and shows as 5 levels on the meter: Low (0 to 19), Wavering (20 to 39), Steady (40 to 59), Confident (60 to 79), Champion (80 to 100).

| Cause | Change |
|---|---|
| Period end, at or above pace | +10 |
| Period end, under 80% of pace | −8 |
| Sponsor briefing band: Strong / Adequate / Weak / Harmful | +8 / +3 / −4 / −10 |
| Sponsor message unanswered past due | −5 |
| Impact event resolved well (per event config) | +5 |

Tapping the meter lists the last 3 causes [S].

**Unlock offer** [S]: the first time confidence rises through 60, and again through 80, the period end sequence offers 3 rewards, choose one (*config*):
- An extra day of capacity next period
- A quiet word: reveals one member's hidden concern without needing trust
- Team lunch at no cost, once

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

**Team Pulse** [S] counts members as upbeat (Upbeat), steady (Steady and Thinking) and struggling (Concerned and Frustrated).

**KPI trend** [S]: for 3 seconds after a change, the KPI tile shows the change; then rising, easing or steady, by comparing the team average with the start of the period.

---

## 8. Report [M][S]

Individual report [M]:
| Measure | Definition |
|---|---|
| Dominant style | The style you used most |
| Range of styles | Share of each style across all decisions |
| Leadership capability | Style accuracy over the run |
| Consistency, per member | Dominant intent (weekly style set) against dominant style in actions and conversations |
| Average result, per member | Mean result over the run |
| Delta in performance, per member | Final result − starting result |
| Actions taken, per member | Count |
| Time spent with members | Top 25% performers, bottom 25%, others |

New in 2.0:
- Tier and score breakdown
- Stars per period
- Best 3 moments and 1 to revisit: the largest positive and negative outcome deltas, with their evidence quotes
- Skills narrative per leadership style; the report says "skills", never "competency"
- Intent vs action: the reason notes from style setting against what happened

The group report measures [M] are listed in `docs/ilead-1`.

---

## 9. Calibration ("make it playable")

The starting numbers are tuned per storyline by `npm run calibrate -- <storyline>`. It runs the engine thousands of times under three policies:

| Policy | Behaviour | Required result (share of target) |
|---|---|---|
| Passive | Keeps the starting styles, takes no actions | 40 to 65% |
| Random | Random styles and affordable actions | 35 to 65%. Acting without reading people can do more harm than doing nothing, as in the Model doc. |
| Good | Sets the needed style each period, picks actions that address low metrics, conversations at Adequate or better | 100 to 125%, reached in 80% or more of runs |

**What it adjusts, in order:**
1. `performanceThreshold` and `inputPerSubPeriod`, until passive play sits in its band.
2. `target` (rounded to a clean number in the storyline's currency), until good play sits in its band.
3. Starting member values, only when needed. It nudges values so that at least one member starts in each style quadrant and at least two members start under 30 in some metric, so there is someone to help. Each nudge is at most ±8 from the authored value.

The output is a report (`calibration/<storyline>.md`) with the before and after values. The engine refuses an uncalibrated storyline in production builds.

For the Sales Elevator default, calibration starts from the workbook's starting values; the prototype's on-screen numbers are only design fixtures for the `/screens` gallery.
