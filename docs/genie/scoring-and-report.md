# Scoring, KPI dials and Report 2.0: the rules

As of 2026-10-01. Status: **decided** (your answers to Q2, Q5 and Q7). This is the bedrock spec for the engine's state, every score, and every report element. Formulas here are locked engine behaviour; inputs marked *configurable* live in the SimulationTemplate. Where a rule comes from a source doc it is cited; everything else was decided here, following your answers, and is summarised in `docs/decisions.md` under "Your answers".

## 1. Principles

1. **Two scores, never mixed** (iLead 2.0 Design, Gamification rule 1). The game score (Leadership Score, stars, streaks, badges) drives play. Skill ratings come only from rubric evidence in live interactions. No badge, point or game metric ever changes a skill rating.
2. **AI judges, rules decide.** The evaluator returns bands, a style shown, a concern flag, red flags, promises and quotes. Every number below is computed by the engine from authored tables and these outputs.
3. **No rating without evidence.** A skill with too few observations shows "Not enough evidence", never a guessed level.
4. **Every report element traces** to engine output (metric name plus event log entries) or to authored template copy. The LLM never writes participant report text at runtime; narratives come only from the authored narrative bank.
5. **Deterministic.** Same template, seed, commands and evaluator outputs always give the same scores and report. The engine stores exact values; display rounds half up to whole numbers.

## 2. State model: the seven dials

All dials are 0 to 100 integers, clamped after every change. Members hold their own values; team dials are means over **available** members (not on leave, in training or gone) unless stated.

| Dial | Level | Starting value | Changed by | Drives | Seed default |
| --- | --- | --- | --- | --- | --- |
| Skill | Member | Authored per NPC (Teardown roster) | Authored deltas: style fit, actions, options, bands, events, training; swap moves it to role fit values (A-12) | Readiness band, funnel productivity | On, dial shown |
| Morale | Member | Authored | Same as Skill, plus weekly drift (A-03) | Readiness band, funnel productivity, People score | On, dial shown |
| Result | Member | Authored | Same as Skill, plus weekly drift | Funnel productivity, attention metric | On, dial shown |
| Trust | Member | **50 for every member** (your answer to Q2) | Band consequence tables, intent vs action gaps, promises kept or broken, ripples | People score, Team Pulse, NPC openness in conversation | On, shown in Team Pulse and as a ring on member cards |
| Engagement | Member | Authored, else round(0.6 × Morale + 0.4 × Trust) | Weekly pull toward its target (2.1), authored deltas | Funnel productivity multiplier, disengagement signal | Off |
| Quality | Team (from stages) | Derived each week | Owner stats, overload, authored team modifier | Rework in the funnel | Off |
| Safety | Team | Authored, default 70 | Harmful bands, red flags, overload, recovery, authored deltas | Trust gain rate, incident signal, NPC openness | Off |

`process.targets.kpiDials` chooses which 3 to 5 dials learners see (Config Spec). Turning on Engagement, Quality or Safety also switches on its mechanics below; turning it off removes them, so the iLead original plays exactly as specified with them off. Any change to these settings marks the balance test Stale. Authors can rename any dial with `kpiLabels` (for example Quality as "Accuracy", Safety as "Compliance").

### 2.1 Engagement (member)

*Meaning:* how much discretionary effort a person gives.

- **Weekly update** at week end, after drift: `E = E + round(0.25 × (target − E))`, where `target = 0.5 × Morale + 0.3 × Trust + 0.2 × A`, and `A = 100` if the member was addressed by any action that week (team actions count), else `40`.
- **Direct changes:** any `StatDeltas` in actions, options, band consequences, ripples or events may include `engagement`.
- **Effect on the funnel:** each owner's productivity is multiplied by `0.85 + 0.30 × E / 100` (0.85 to 1.15).
- **Signal:** `member.disengaged` becomes true when E is below 25 at two week ends in a row. Authored conditional events can use it (`member.disengaged`); when Engagement is switched on, the Events generator proposes one resignation risk event that uses it.
- **Team dial:** mean of available members.

### 2.2 Quality (team, from stages)

*Meaning:* the share of work done right first time.

- **Stage quality** at week end: `q = clamp(round(0.6 × mean owner Skill + 0.4 × mean owner Result − overload + Qmod), 0, 100)`, where `overload = 10` when the stage's WIP exceeds 2 × its ideal per week, and `Qmod` is a team modifier (−30 to +30) moved only by authored `quality` deltas on actions, bands and events.
- **Effect on the funnel (rework):** of the units a stage completes in a week, a share `(100 − q) / 100 × 0.3` returns to that stage's WIP as rework, using a carried fractional remainder so results stay deterministic. Low quality can cut a stage's effective output by up to 30%.
- **Team dial:** output weighted mean of stage quality (simple mean in a week with no output).
- **Report:** Business outcomes shows rework units per stage.

### 2.3 Safety (team)

*Meaning:* safe and compliant working, including people feeling safe to speak up.

- **Changes (engine defaults, configurable):** −8 for each Harmful band; −5 for each red flag (in addition); −3 at week end if any stage's WIP exceeds 2 × its ideal; +2 recovery at week end if the week had no Harmful band and no overload. Authored `safety` deltas on actions and events (for example compliance or crisis events) apply as usual.
- **Effect on Trust:** positive Trust deltas are multiplied by `0.5 + Safety / 200` (0.5 to 1.0). Negative deltas are unchanged.
- **Signal:** `team.safety_risk` is true while Safety is below 40. Authored conditional events can use it; when Safety is switched on, the Events generator proposes one incident event that uses it.
- **NPC behaviour:** below 40, the NPC agent prompt marks the team as guarded, so hidden concerns are harder to surface (same mechanism as low Trust in the Design doc).

## 3. Style fit metrics

A **style tagged choice** is any of: a weekly style setting for a member; a static option with a style tag applied to one member; or a live interaction aimed at one member, where the style is the evaluator's style shown. Team meetings, sponsor briefings, interviews and multi recipient emails carry no style. A choice is **correct** when its style equals the member's needed style at that moment (readiness band, member exceptions, role misfit rule).

| Metric | Definition | Source |
| --- | --- | --- |
| Contextual capability % | correct choices / all choices, whole run | Teardown, confirmed |
| Style share | choices per style / all choices | Teardown, confirmed |
| Dominant style | style with the most choices; ties listed | Teardown, confirmed |
| Weekly style fit % | correct weekly settings / members set that week | Design doc stars |
| `style_fit_count` | correct weekly settings that week | Design doc badge |
| Style used vs needed grid | count of choices by (needed style, style used), 4 by 4 | Design doc Report 2.0 |
| Intent per member | dominant weekly setting for that member; ties listed | Teardown, confirmed |
| Style shown per member | dominant style across that member's static options and live interactions; "None" if none | Teardown, extended to live |

## 4. Live interaction scoring

1. The evaluator returns a band per rubric dimension (2 to 4 skills from the linkage matrix), with reasons and verbatim evidence quotes, plus style shown, concern surfaced, red flags and promises.
2. **Overall band:** any red flag forces Harmful; otherwise the median of the dimension bands, ties to the lower band (A-05).
3. **Band scores:** Strong 100, Adequate 70, Weak 35, Harmful 0 (Design doc; configurable as `gamification.liveBandScores`).
4. The engine applies the authored consequence table for the overall band, then triggers (follow up events, promises, concern resolved, escalation).
5. **Human review replaces AI.** When an assessor records a band for an interaction (sample audit or full review), that band replaces the AI's overall and dimension bands everywhere: consequences already applied stay (the run is history), but every score and report element recomputes from the human bands and is marked "Reviewed by an assessor".

## 5. Skill ratings

### 5.1 Observations

One **observation** is one rubric dimension band for one skill in one live interaction. Static actions never create skill observations.

### 5.2 Default linkage matrix (complete)

The iLead 2.0 Design matrix, plus mappings for the four live moments it left out (your answer to Q5; marked new). Every interaction has 2 to 4 skills; every skill has at least 2 observation points.

| Interaction | Skills rated |
| --- | --- |
| Meet face to face | Situational flexibility, Coaching for growth, Handling difficult conversations |
| Coach member | Situational flexibility, Coaching for growth, Goal setting and accountability |
| Give feedback | Situational flexibility, Giving feedback, Recognition and fairness, Handling difficult conversations |
| Send email | Giving feedback, Recognition and fairness, Communicating change |
| Meet the team | Situational flexibility, Recognition and fairness, Communicating change |
| Set goals | Situational flexibility, Goal setting and accountability, Results ownership |
| Swap or reassign talk, Fire talk | Giving feedback, Communicating change, Handling difficult conversations |
| Sponsor briefing | Goal setting and accountability, Results ownership |
| Reward note (new) | Recognition and fairness, Giving feedback |
| Hire interview (new) | Recognition and fairness (bias free probing), Results ownership (decision rationale) |
| Reply to NPC messages (new) | Situational flexibility, Handling difficult conversations |
| Energize toast, optional (new) | Recognition and fairness, Communicating change |

### 5.3 Rating scale (default, configurable)

Five levels; authors may change the count (3 to 7), names, colours and thresholds. Thresholds apply to the skill score.

| Level | Name | Skill score |
| --- | --- | --- |
| 1 | Novice | 0 to 39 |
| 2 | Developing | 40 to 59 |
| 3 | Proficient | 60 to 74 |
| 4 | Advanced | 75 to 89 |
| 5 | Role Model | 90 to 100 |

Reading the scale: all Adequate scores 70 (Proficient); a mix of Strong and Adequate scores 85 (Advanced); three Strong and one Adequate scores 92.5 (Role Model); Adequate and Weak scores 52.5 (Developing).

### 5.4 Rules

- **Enough evidence:** at least 2 observations from at least 2 different interactions (`report.minObservations`, default 2). Otherwise the skill shows "Not enough evidence" and is excluded from averages.
- **Skill score** = mean of the skill's observation band scores.
- **Harmful cap:** any Harmful observation for a skill caps that skill at level 2 (Developing).
- **Level** = the highest level whose lower threshold the score reaches, after the cap.
- **Overall level** (executive summary) = level of the mean score of rated skills, shown only when at least half the framework's skills are rated; otherwise "Not enough evidence for an overall level", with the rated skills still shown.
- **Behavioural anchors:** one authored line per skill per level (AI drafted, author approved), shown with the level.

### 5.5 Evidence quotes

Per skill, up to `report.evidence.perSkill` (default 2) verbatim quotes from the participant's own turns: first from the highest band observations, then the most recent. Names of NPCs are redacted when `report.evidence.redactNames` is on. A quote that is not a verbatim substring of the stored transcript is never shown.

## 6. Game scores (Design doc, locked; weights and thresholds configurable)

- **Leadership Score** = 9 × (0.3 B + 0.3 P + 0.4 L) + streak bonus, rounded half up, 0 to 1000.
  - B = min(100, revenue / target × 100).
  - P = clamp(50 + Δ mean Morale + 0.5 × Δ mean Trust, 0, 100), means over the team at start and at end.
  - L = 0.5 × contextual capability % + 0.5 × mean overall band score of all live interactions; with no live interactions, L = contextual capability % (A-06).
- **Weekly stars:** week score = 0.5 × weekly style fit % + 0.3 × mean band score of that week's live interactions + 0.2 × min(100, week's final stage output / weekly ideal × 100); with no live interaction that week, 0.8 × weekly style fit %. 1 star at 50, 2 at 70, 3 at 85.
- **Streak:** 3 weeks in a row at 2 stars or more earns +25, then +25 per extra week, capped at +100. A broken streak resets the counter at no cost.
- **Sponsor confidence:** starts 50. Sponsor briefing band +20, +5, −10, −25. Week revenue at or above the weekly ideal +5, below −5. Escalation to the sponsor −10. Crossing 70 upward offers one unlock (bonus day once, extra hire budget, or a team activity without cooldown); dropping below 30 schedules a CEO check in that costs one day.
- **Team Pulse:** mean of team Morale and team Trust, with a weekly trend arrow.
- **Tiers:** Platinum 850 or more, Gold 700 to 849, Silver 500 to 699, Bronze below 500.
- **Leaderboard:** ranked by Leadership Score; ties by conversions, then contextual capability %. Off by default when the use declaration is selection.

### 6.1 Badge rules (default library)

Each badge is earned once. Conditions use the engine's expression language over the event log.

| Badge | Event | Condition |
| --- | --- | --- |
| First Close | `conversion` | `run.conversions >= 1` |
| Read the Room | `week_end` | `week.style_fit_pct >= 90` (9 or 10 of 10 for a team of 10) |
| Flex Master | `week_end` | `run.min_correct_per_style >= 2` |
| Concern Uncovered | `interaction_end` | `run.concerns_surfaced >= min(5, team.size)` |
| Promise Keeper | `run_end` | `run.promises_made >= 3 and run.promises_broken == 0` (promises due after the run ends are not counted) |
| Fair Hand | `interaction_end` | `run.recognitions_without_negative_fairness_ripple >= 3` |
| Turnaround | `week_end` | `any_member(morale_was_below_30_then_above_60)` |
| Change Champion | `interaction_end` | `run.strong_change_communications >= 2` (Strong overall band in an interaction that rates Communicating change) |
| Steady Hand | `run_end` | `run.harmful_bands == 0` |
| Target Crusher | `week_end` | `run.revenue >= target.value` |

## 7. Report 2.0, section by section

Each section lists its content, computation and trace. Sections can be switched off or reordered (`report.sections`); a Lite mode default omits sections 5 and 8.

| # | Section | Content and computation | Trace |
| --- | --- | --- | --- |
| 1 | Executive summary | Overall level (5.4); 3 strengths = top 3 rated skills by score (ties: more observations, then framework order); 3 priorities = the 3 lowest rated skills not already listed; one business line from a template sentence filled with revenue vs target, conversions and the bottleneck stage; narrative for the overall level from the bank | Skill scores, funnel totals, template copy |
| 2 | Style flexibility and fit | Style shares, dominant style, contextual capability %, the 4 by 4 used vs needed grid; narrative by capability band (below 40%, 40% to 69%, 70% and above; Teardown) and by dominant style | Style tagged choice log |
| 3 | Intent vs action | Per member: intent, style shown, status (aligned, gap, or no evidence), and for a gap one quote from the most recent interaction whose style shown differs from intent; Trust cost of repeated gaps | Weekly settings, evaluator style shown, quotes |
| 4 | Skills profile | Per skill: level, behavioural anchor, observation count, up to 2 evidence quotes, or "Not enough evidence" | Observations, transcripts, anchors |
| 5 | Key moments | 5 to 7 incidents in SBI form. Candidates: interactions with a Strong, Weak or Harmful band; ignored events that escalated; prerequisite misses; ripples of 5 points or more; promises kept or broken. Ranked by impact (sum of absolute stat changes across affected members, then sim time). Each shows Situation (event or context copy), Behaviour (action, with quote when live), Impact (changes and follow up events) and Intent (declared style) | Event log, ripples, promises |
| 6 | People outcomes | Per member weekly trajectory of Morale, Trust and Result (plus Engagement when on); actions taken and days spent per member; average Result and Result change (A-10) | Member state history, action log |
| 7 | Business outcomes | Funnel by stage against cumulative ideal, revenue against target, conversions; the bottleneck = the stage that was the bottleneck in the most weeks, with "why" = its lowest productivity owner's weakest stat; rework per stage when Quality is on | Funnel history |
| 8 | Conversation analytics | Descriptive only, never scores: talk to listen ratio (participant words / NPC words in spoken or role play interactions), open questions (participant questions starting with an open opener such as what, how, why, tell me, describe), recognition statements (authored phrase list per language). Computed deterministically from transcripts | Transcripts |
| 9 | Development plan | 3 priorities = the 3 lowest rated skills (then skills with not enough evidence, marked so); each with the authored practice activity, on the job action and check in date (report date + check in days) | Skill scores, template copy |
| 10 | Methodology and data use | Template copy plus filled facts: how AI scoring works, calibration agreement per interaction at publish, human review tier and status, retention period, how to query a result | Template copy, publish record |

**Narratives.** The narrative bank is keyed by section and one of: overall level, capability band, dominant style, or skill level. Selection takes the first authored match; when several variants exist the session's seeded RNG picks one. With no match the section shows its data without a narrative.

**Delivery.** In app and PDF by default (Config Spec); manager and cohort audiences see only what `report.audiences` allows.

## 8. Cohort Results (Products, after publish)

| View | Metrics |
| --- | --- |
| Cohort overview | Starts; completions (run ended); mean active minutes; mean Leadership Score; tier spread |
| Skills view | Mean score and level per skill over participants with enough evidence; the 3 weakest skills |
| Interaction quality | Band spread per live interaction; human audit sample status |
| Experience feedback | Mean 1 to 5 rating and comments from the end screen |
| Content health | Per interaction, share of audited samples where the assessor's band differs from the AI's; flagged for rubric tuning when it exceeds 15% (the mirror of the 85% calibration gate) |

**Human audit sample** (`report.humanReview` = sample audit, the Config Spec default): 10% of live interactions per cohort, at least 5 per interaction type, stratified by AI band, assigned to users with the reviewer role. Full review: every live interaction is reviewed and reports are released only after review.

## 9. Tests that lock these rules (M2, M7, M9)

- Teardown fixtures: style shares 29, 13, 36, 22; capability 69%; Leadership Score 425, Bronze; attention 42.18 and 93.82.
- Each dial: start rule, update rule, clamps, effects, and that switching it off restores iLead original behaviour byte for byte.
- Skill rating: evidence minimum, mean, Harmful cap, thresholds at every boundary (39, 40, 59, 60, 74, 75, 89, 90), overall level half rule, human band replacement.
- Every badge condition true and false.
- Report: every element has a resolvable trace; quotes are verbatim; no section renders LLM text.
