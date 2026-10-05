# Decisions and conflicts

The rule from the brief: the design wins on visuals, the docs win on behavior, and every conflict is logged here.
Status is **Decided** (applied), **Proposed** (my recommendation, needs your approval) or **Open** (blocked on a doc or a product call).

Sources: the Claude Design handoff (`project/`, `chats/chat1.md`), the Participant Interface Spec (`docs/iLead 2.0 Participant Interface Spec.pdf`), and the M0 brief.
The Teardown, the iLead 2.0 Simulation Design and the GenieKreator Configuration Spec are not in the repo yet.

## Setup

**D1. Extend the Vite app instead of scaffolding Next.js 14.** Decided.
The repo already had a working app (Vite, React 19, TypeScript strict) that matches every design frame. The brief says to extend an existing app, and you confirmed it.
Consequences:
- React 19, not React 18. Radix, Framer Motion, TanStack Query, Zustand, visx and Storybook 10 all support it.
- There is no server rendering. The engine runs behind an HTTP client (or the mock), which suits rule 1.

**D2. Tokens come from `tokens/*.json`, not a handoff JSON.** Decided.
The handoff has no token export. The Foundations frame (1b) names the tokens, but its values are from round 1, and the final screens render different ones (for example text.primary in dark mode is L 0.93 in 1b and 0.94 in the screens).
I wrote the source files by hand:
- Values are exactly what the final screens render.
- Names follow 1b where it has one: text.primary became `color.fg.primary`, accent.default became `color.accent.default`, status.attention became `color.status.attention`, and so on.
The token pipeline reproduces the prototype pixel for pixel. All 52 Screens frames and all 15 States frames were re-diffed after the switch.

**D3. Spacing uses a 4px unit with quarter steps.** Decided.
The design brief asked for an 8pt grid, but the final screens use 2px steps (10, 14, 6 and 18px are common) and a few odd values (3px, 5px). Snapping them to 8pt would break the 2px tolerance.
`--spacing` is 4px, so `p-2.5` is 10px and `p-0.75` is 3px.

**D4. Manrope, not Inter or Geist.** Decided. The Genie design system requires Manrope (chat round 1). The screens use weights 600 and 700, and the design system components add 400 and 800.

**D5. Semantic tokens are scoped to `.il-theme`, not `:root`.** Decided.
A client theme sets `--client-acc` on an ancestor of the app root, and `var()` fallbacks resolve where a property is declared. Declaring the semantic layer on `:root` would ignore the client theme.
Primitives stay on `:root`.

**D6. Tailwind preflight is off during migration.** Decided.
Preflight resets borders, images, headings and buttons, which would move the inline styled screens. It is switched on in M8, once every component is on utilities.

**D7. Migration aliases.** Decided.
`tokens/legacy.json` maps the names the ported screens read (`--ik-*`, `--grad-brand` and similar) onto the token layers. Each milestone removes the aliases for the screens it migrates, and the file must be empty by M8.

## Accessibility vs design

**D8. Light theme contrast: contrast wins.** Decided (4 Oct 2026; it was Proposed).
WCAG 2.2 AA is a hard bar in the brief, and the docs win on behaviour, so the light theme takes darker values where axe found text under 4.5:1 or a control under 3:1. Dark mode and the Halden client theme are unchanged. Only the token layer changed; no component needed a new class.

| Token (light mode) | Before | After | Contrast before | Contrast after |
|---|---|---|---|---|
| `accent.secondary`: eyebrows, "Add a reason", the brief's "Hide", "See why", the award count, "Changed" | `cyan.600`, L 0.60 | `cyan.520`, L 0.52 | 3.75:1 on white, 3.29:1 on `surface.raised` | 5.23:1 on white, 4.58:1 on `surface.raised` |
| `status.attention`: "Bottleneck this week", the urgent inbox label | `amber.550`, L 0.55 | `amber.530`, L 0.53 | 4.48:1 on its soft chip, 4.42:1 on `surface.raised` | 4.88:1 and 4.81:1 |
| `button.ghost.fg` (new `fg.link`): "Continue" on the prerequisite nudge | `#249DFF` | `blue.530` | 2.54:1 on the attention chip, 2.86:1 on white | 4.73:1 and 5.33:1 |
| `button.ghost.fg-hover` (new `fg.link-hover`) | `#43D6E8` | `blue.450` | 1.75:1 on white | 7.55:1 |
| `switch.track-off` (new `control.track-off`, WCAG 1.4.11) | white at 12% | `mist.600` | 1:1 on white; the thumb 1.22:1 on the track | 3.95:1 on white, 3.46:1 on `surface.raised`; the thumb 3.24:1 on the track |

- `status.gain`, `status.decline` and `status.attention` are now checked at 4.5:1, not 3:1, because they are used as 12px text. Gain and decline already passed.
- The token build checks many more pairs (`tokens/contrast.json`): text on every surface and on the status chips, the primary button label at every stop of the gradient, the switch, and the focus ring at 3:1, in light, dark and the Halden client theme (`tokens/themes/halden.json`).
- Parity: frame b14 (light theme) moves by up to 25/255 per channel on about 0.5% of its pixels. That is under the harness's per pixel tolerance (40/255), so b14 still measures 0.00% and needs no allowance. `tests/visual/parity.ts` now has an `ACCEPTED` list for frames that must differ, each with a reason that names its decision. Every other frame stays at the strict 0.05%.

## Copy rules vs spec

**D9. Minus signs in deltas.** Proposed.
The spec says "deltas carry + and - signs", and the copy rules ban every dash character. The prototype already writes "Trust −3" with U+2212 MINUS SIGN, which is a math symbol in Unicode (category Sm), not a dash.
Proposal:
- The catalog lint fails on hyphen-minus U+002D and every Unicode dash (category Pd: hyphen, en dash, em dash and others).
- U+2212 is allowed for numbers.
- One number formatter swaps the hyphen-minus that `Intl.NumberFormat` produces for U+2212, so engine values never show a hyphen.

## Architecture vs prototype

**D10. Move the prototype's game logic into the mock engine (M2 to M5).** Decided.
The prototype computes state in the UI, which breaks rule 1. These calculations move behind the engine client, and the UI renders engine payloads only:
- outcome moves (`applyMoves` in `src/app/App.tsx`)
- capacity spend (`act.spend`)
- the KPI trend labels
- the week end KPIs and stars
- the report series
- the live interaction scripts (`src/screens/live/content.ts`)

## Design vs spec (behavior follows the spec unless you say otherwise)

**D11. Skill bars on the board.** Resolved by D39: the bars show once the profile has been opened, as the spec's member card says. The report's skill ratings are a different thing (leadership skills, M6).
The spec says "skill ratings appear only in the report" (principle 4), and card stats should be hidden until a profile is first opened. The design shows Skill, Morale and Result bars on every board card from the start.
Following the spec would visibly change the main board. I need a product call.

**D12. HUD week label.** Proposed.
The spec asks for "Week x of 8". The design shows "Week 2 · Day 3". Proposal: keep the design's layout and use the string "Week 2 of 8 · Day 3", which takes about 30px more in the HUD.

**D13. Clock pausing.** Decided, following the spec.
The spec pauses the clock in live screens, modals, event cards and tours. There are two clocks:
- **Simulation time** (period, sub-period, the days an action costs) is the engine's clock (rule 1). It only moves when the engine applies an intent, so it never runs while the participant reads or talks.
- **The session clock** is the app shell's wall time (`src/app/App.tsx`), the countdown in the HUD. Pausing and resuming it is client side: it runs while the board is on screen and stops while an overlay (pause, settings) is open. The spec's other pauses (live screens and event cards on the engine board, tours) are not wired to it yet.

**D14. Live formats without a design.** Resolved in M4, see D52.
The spec defines 7 formats. The design covers 4: 1:1 RolePlay, email, team meeting and sponsor briefing.
- Chat is in M4 but has no screen of its own. The inbox's "Reply now" opens a 1:1 in the prototype.
- Interview and Written plan have no design and are not in the milestones.

Proposal: build chat in the shared shell, reusing the transcript bubble and input bar from the 1:1, and show you a frame before going further. Interview and plan stay out of scope until designed.

**D15. Breakpoints with no design.** Open.
The brief asks for visual regression at 1440, 1024 and 390 for every screen. The design defines:
- 1440 for every screen
- 1280 only for the client theme board
- 390 only for live interactions, the outcome and the report
- nothing at 1024

The spec describes tablet as "board scrolls by stage" and mobile as "lite mode, team board becomes a list".
Proposal:
- The 2px bar applies only where a design frame exists.
- 1024 and the other 390 screens get layouts derived from the spec, approved through Storybook screenshots, then locked as baselines.

**D16. Optional Week 0 practice chat** (spec onboarding step 7). Open. It is not designed. It depends on configuration that lives in the missing GenieKreator Configuration Spec.

## Design bugs carried over as is

**D17. Client theme nav is empty.** Proposed. The prototype renders three blank, invisible nav buttons on the client theme (frame b15), but the design chat intended "Objective, History and More". Proposal: fix it in M7 with the theme loader.

**D18. Prototype interactions that do nothing.**
- "Hold Space" is shown, but Space does nothing.
- "Add from team" in the email does nothing.
- "Discard" on an email ends the interaction like End.
- Captions and the waveform keep animating in frozen gallery frames.

Each is fixed when its milestone rebuilds the component: Space as a push to talk shortcut is required by the spec's keyboard play, and the rest follow it.

## M1

**D20. Parity is measured, not eyeballed.** Decided.
`npm run parity` renders every frame of the prototype and of the app and diffs them.
- A pixel counts as different only when no pixel within 1px in the other image matches it. That absorbs subpixel compositing under `backdrop-filter`, but not a 2px shift.
- A frame fails above 0.05% of its pixels, which is less than one short label.
- p1 (live clock), z5 and z14 (random waveform) and x2 (blurred board behind a dialog) allow 0.4%. They are listed, with these reasons, in the harness's `ACCEPTED` list (D8).
- `--prod` checks the production bundle.

I confirmed it catches a 2px wider chip and a 2px smaller font.

**D21. Production builds keep `light-dark()` native.** Decided.
The CSS minifier lowered `light-dark()` into variables that only resolve when `color-scheme` is set in a stylesheet. The app sets it at runtime, so every color broke in production and in the static Storybook.
- `build.cssTarget` is now Chrome 123, Edge 123, Firefox 120 and Safari 17.5, the first versions with native `light-dark()`.
- Older browsers are not supported.

**D22. Style tooltip is hand built; the toggle group is Radix.** Decided.
The Radix tooltip closes on any ancestor scroll and on pointer down, but the design keeps the tooltip open when you click a letter.
- Arrow keys move focus within D, G, P and E, and Enter or Space picks. That's the Radix toggle group behavior. Selecting on every arrow press would fire a toast per key.

**D23. Command palette uses a non-modal Radix dialog.** Proposed.
Modal mode sets `pointer-events: none` on the body, which changes the board's gradient pills behind the scrim by up to 28/255.
- Focus is still trapped (Tab loops inside), Escape closes, and focus returns to whatever opened it.
- But the page behind is not hidden from screen readers.

In M8 I'll make the board behind `inert` while the palette is open, which keeps the pixels and restores the modal semantics.

**D24. Motion durations snapped to tokens.** Decided. Durations of 160, 200 and 320ms became 150, 220 and 300ms (`duration.fast`, `base` and `slow`), inside the brief's 150 to 300ms range. No frame changes.
Later component tokens followed the same rule (4 Oct 2026): the action and inbox drawers (240ms), the profile panel (260ms), the team legend and the toast (200ms) use `duration.base`; the badge award (400ms) and the stars (500ms) use `duration.slow`, keeping their overshoot curves as `easing.overshoot` and `easing.overshoot-strong`. Parity stops animations, so no frame changes. Looping pulses (rings, dots, the caret) and the waveform's 90ms follow of mic levels are not transitions and keep their timing.

**D25. Copy duplicated until M2.** Decided. Style names and descriptions, and mood names, are now in the catalog. The legend, profile, style setting definitions and some toasts still read the scenario data until the engine takes over in M2.

**D26. End screen badges disagree with the data.** Open.
The design marks the first 4 badges as earned on the End screen, but the scenario has 2 earned. "Pipeline builder" and "Steady hand" show as earned with a "Hint:" detail. Kept as designed; the engine decides in M5.

**D27. AI labels.** Decided.
NPC transcript turns carry the design's visible "AI persona" label. Captions in the 1:1, meeting and sponsor screens have no visible label in the design, so they carry a visually hidden "AI persona voice" note. Adding a visible label to captions would be a design change; I'll raise it in M4.

## Simulation rules (your direction, 4 Oct)

The full rule set is in `docs/SIMULATION.md`. It is built from the iLead 1.0 Model doc and content workbook (`docs/ilead-1/`), plus the 2.0 additions.

**D28. Money, time and stages are storyline config.** Decided, per your direction. Schema: `src/engine/config.ts`.
- **Money:** any ISO 4217 currency (USD, GBP, JPY, SGD, INR, MYR, AED and more), the locale's own formatting (₹41,20,000, ￥4,120,000), and symbol or code display.
- **Time:** years, months, weeks or days, 1 to 10 periods.
- **Stages:** 3 to 6, with conversion ratios.
- **UI copy** with a unit in it ("Week 2", "End week", "½ day") becomes ICU messages with the unit as an argument (M2).
- **Stage limit:** 6 is the most the board fits at 1280 wide. Tell me if you need more.

**D29. Stars can be 0 to 3 per period.** Decided (your call, 4 Oct). Each star has its own rule (People, Leadership, Business), so a period can end with none. This supersedes the spec's "1 to 3".

**D30. Trust rules are new.** Proposed (SIMULATION.md section 3).
- It moves with style match, how a conversation lands, promises kept or broken, responsiveness, and fairness.
- It changes play three ways: it scales how well positive actions land (0.8 to 1.2), it makes misreads likelier under 30, and it gates hidden concerns.
- It also feeds mood and the resignation and complaint triggers.

**D31. iLead 1.0 sources disagree in two places; the Model doc wins.** Decided, per your direction.
- Repeat limits: the Model doc's (Hire 8 days, Team building 8 days), not the workbook's.
- The workbook's style sheet lists Partnering as high skill and high morale. The Model doc says high skill and low morale, which is followed.

**D32. Action costs are whole days.** Decided (your call, 4 Oct).
- The workbook's costs: 1 day for every action, 2 for Hire member. `costStep` defaults to 1.
- The design's half day labels ("½ day") stay only in the `/screens` design fixtures (D34). The playable app shows whole days.
- A storyline can still opt into half days through config.

**D33. Weekly style values are new defaults.** Proposed. The Model doc defines the weekly style rule but gives no numbers, so SIMULATION.md 4.4 sets defaults inside the workbook's bounds. Calibration may tune them.

**D34. Two data sets.** Decided.
- The `/screens` and `/states` galleries keep the prototype's numbers, so design parity stays provable.
- The playable app runs the calibrated Sales Elevator storyline from the workbook. Its numbers and stages will differ from the design frames by intent.

**D35. Live interactions use 1.0's maths.** Proposed.
- In 1.0 you picked one of four written options; in 2.0 you speak or write freely.
- The AI evaluator classifies your words as one of the four styles, and 1.0's mismatch maths then applies unchanged.
- A Strong conversation improves the mismatch by one step; a Weak one worsens it by one.
- The evaluator only reads; authored rules decide the consequences (brief, rule 1).

**D36. Funnel formula normalized.** Decided.
- The Model doc's funnel step is `input × ratio × (average result + buffer) / 100`. Performance compounds across all 5 stages, so in the uncalibrated storyline good play earned 10× what passive play did. The buffer is the Model doc's lever to soften that.
- But with a positive buffer the factor goes above 1, and a stage outputs more than its conversion ratio allows.
- The engine divides by `100 + buffer` instead. A buffer of 0 gives exactly the Model doc formula; any buffer keeps every stage at or below its ratio.

**D37. Thoughtless play can do worse than doing nothing.** Proposed.
- Calibrated Sales Elevator: passive play reaches 54% of target, random play 49%, good play 110%.
- Random styles and random actions mostly mismatch, and the Model doc punishes mismatches, so random play ends below passive play.
- I set the random band to 35 to 65% (it was 55 to 80%). If you want busy play to be gentler than idle play, the lever is the size of the mismatch penalties in the effect tables.

**D38. Stand-ins on the engine board until their milestones.** Decided.
- Live interactions use a plain text composer in the actions panel. M4 replaces it with the live shell (voice, streaming AI, the designed screens). The engine contract is the same either way.
- Until M4 streams AI replies, the heuristic evaluator supplies a short, in-character reply line that fits how the words landed.
- Events show as a plain card with reason chips; M5 brings the designed event art. When more than three people move on one metric, the chips collapse to one team chip per metric showing the average change.
- Week end and run end are a plain panel with stars, value earned, the sponsor's reward offer and the next step. M5 and M6 bring the designed screens.
- The HUD nav (objective, funnel, history, badges) is hidden on the engine board until its panels exist. They are planned with M5 (events, gamification) and M6 (the report).

**D39. Stats stay hidden until the profile is first opened.** Decided, from the spec. Before that, the card shows "Open the profile to see stats" in place of the three bars, and hides the trust ring. The card keeps its height so cards still line up. Opening the profile sends the `openProfile` intent; the engine reveals the stats.

**D40. Member card selection moved off the card root.** Decided.
- Axe flagged `nested-interactive` (WCAG 4.1.2): the card was a `role="button"` with the profile button and style control inside it.
- The card is now a plain container. A visually hidden toggle button carries selection, `aria-pressed` and the card's label, and the card draws that button's focus ring. A click anywhere on the card still selects it.
- The change is pixel-identical: all 67 parity frames still match.

**D41. Why an action is unavailable is data, not text.** Decided. The engine returns a reason code with values (locked until period 3, cooldown 4 days, away for 2 days, and so on). The board words it from the catalog in the storyline's units, so a monthly storyline reads "Available again in 2 weeks".

**D42. Sponsor and portraits come from the storyline config.** Decided.
- The Sales Elevator sponsor is Paula Jacob, Regional Sales Director (your call; the 1.0 documents name none). The `/screens` design fixtures keep the design's Priya Nair (D34).
- Portraits are real photographs, per the Configuration Spec (art style Photographic, portrait source Stock photo by default, an optional five mood expression set). Hire candidates get faces like everyone else, not 1.0's placeholder avatars.
- Portraits are optional per person, with an optional portrait per mood. `scripts/portraits/prepare.py` crops any photo to the card frame and links it into the storyline without touching calibration. `scripts/portraits/CASTING.md` describes the ten candidate photos needed.
- Until those photos are in the repo, candidates show a neutral silhouette. This environment cannot reach stock photo sites.

**D43. Phones keep the prototype board.** Decided, until the 390 board is designed (D15). Desktop plays on the engine. `?engine=off` opens the prototype's fixed board, and `?start=board` skips onboarding.

**D44. The GenieKreator docs join the sources.** Decided.
- The Configuration Spec, the 2.0 Design doc, the Teardown and the GenieKreator repo's scoring rules are in `docs/genie/`. They describe 2.0 behaviour, so they outrank the 1.0 Model doc where they differ (tag [G] in SIMULATION.md).
- `docs/genie/RECONCILIATION.md` lists 22 differences. Each lands in the milestone that builds that part of the game: gamification and Team Pulse in M5, live consequences, hire and the sponsor briefings in M4, ranges in M7.
- Done in M3 because the drawer and style setting need them: role coverage (at most 2 per stage, nobody leaves a stage empty, training needs a peer to cover, no hiring into a full team), GK costs (team building and one week workshop 2 days) and cooldowns (energize 10 days), weekly style deltas of about +3 and −1 to −2, weekly drift of 3 morale, averages over available people, team feedback by share, and $30,000 per conversion.
- The storyline was recalibrated: doing nothing reaches 55% of target, random play 52%, good play 107% (`calibration/sales-elevator.md`). D29 stands (a period can end with no stars); D33 is superseded.
- Both questions answered in D49.

**D45. Swap and reassign are options with their own pick rules.** Decided. "Swap roles" picks 2 people in different stages; "Reassign role" picks 1 person and a stage to move them to. The engine refuses a move into a full stage or out of a stage that would be left empty. The drawer shows the rules and the prerequisite nudge ("You have not assessed Justin for Conversion. Assess first, 1 day?").

**D46. Weekly style setting on the engine.** Decided.
- Style setting is its own screen at the start of each period, before any action, as the spec says. It replaced the M2 banner.
- The cards show Skill, Morale and Trust, as the design does (not Result). Stats stay hidden until that person's profile has been opened (D39).
- "6 of 10 styles set" shows only while some are unset; when all are set it is announced to screen readers only, so the design frames do not change.
- The link to the style definitions is visible on focus only, since the definitions are already on screen.
- Reasons typed per person go to the engine with the styles (`notes`), ready for the report's intent vs action insight. The voice note is a slot for M4.
- After confirming, the sponsor's team message shows how the team took it, with reason chips. Three or more people moving the same way read as one chip ("6 people morale down").

**D47. Profile panel on the engine.** Decided.
- The timeline is the engine's history for that person, newest first, with each change and the participant's own words where there were any. Promises show open, kept or broken.
- The career goal shows "Not shared yet. It may come up in conversation." until a conversation surfaces it, together with the hidden concern.
- Live actions in the profile keep the design's compact tile without the voice and text icon the spec mentions, to keep frame b7 identical. Proposed: add the icon when the live shell lands in M4.
- An away member's profile shows "In training" and a grey portrait, matching the card.

**D48. Pushing to the GenieKreator repo.** Decided. `maverick-nair/Macro_sim_iLead_GK` holds the GenieKreator authoring monorepo on its own history (Next.js, pnpm, Prisma). The participant app is pushed to its own branch, `ilead-participant`, without touching that history. Moving it into that monorepo as `apps/participant`, with the engine as a shared package, is a later step to agree with that team.

**D49. Scoring rules and trust rules.** Decided (your answers, 4 Oct).
- `scoring-and-report.md` is binding where it goes beyond the Design doc. Everyone starts at trust 50 (a storyline may set a lower start per person, as the Configuration Spec allows for wary archetypes). A live interaction's band is Harmful on any red flag, otherwise the median of the dimension bands, ties to the lower band.
- The D30 trust rules stay as configurable defaults in `trustRules`: erratic style change −2, the 0.8 to 1.2 multiplier on positive changes, more misreads below trust 30, the ±12 cap per sub-period. The GenieKreator intent vs action rule (−4) joins them.
- Recalibrated: doing nothing reaches 57% of target, random play 59%, good play 112%.

**D50. Live interactions are conversations.** Decided. See SIMULATION.md 5.0. The engine keeps the turns; the NPC's words come from an `NpcModel` (an AI model on the server, a persona stand in for the mock); ending the interaction evaluates everything the participant said. Email and written plan are submitted once. The live cap, the week 4 and 8 sponsor briefings and the two candidate interview follow the GenieKreator docs.

**D51. Live shell components.** Decided. The live screen renders `src/components/liveshell/` (LiveShell, LiveBriefCard, LiveInputBar, RolePlayStage, EmailStage, MeetingStage, SponsorStage, ReactingScreen). All 67 parity frames are unchanged.
- One component per piece with a `layout: 'desktop' | 'phone'` prop, not separate phone components: the 390 frames differ only in sizes and in what the header shows.
- The brief is data with optional rows (agenda, what you know, mood, open promises, declared style, tone). The row labels follow the format ("Watch for" in a meeting, "She cares about" for the sponsor), so the design's per format briefs come from one shape.
- The 1:1 mood ring has three steps (frustrated, guarded, more open), as designed, separate from the five member moods.
- NPC turns can stream (`streaming`) and be cut off (`interrupted`, shown as "Interrupted" beside the AI persona label). Pressing the mic or Escape while the NPC speaks calls `onInterrupt`.
- Screen readers hear each NPC line once, when it has finished: the captions announce it, or the transcript does while captions are hidden (D57).
- A long transcript now scrolls inside the window (capped at the window height minus the header and reply bar) instead of growing the page. At 900 tall the cap is above the designed height.
- The mood ring's 600ms colour change is snapped to `duration.slow` (300ms), per D24.
- Still open: Space as push to talk (D18), and chat in the shell (D14). `LiveTranscript` and `LiveInputBar` are ready for chat.

**D52. The three undesigned live formats.** Decided (built in M4 in the designed live screens' visual language; please review with design).
- **Chat:** a thread like Teams or Slack. Sim time shows as dividers ("Week 2, Day 3") rather than a stamp per message. A streaming NPC turn with no words yet shows "Kent is typing" outside the log, so screen readers hear only finished turns. The thread ends with "Kent signed off" or "You closed the chat".
- **Interview:** the candidate portrait has a neutral ring with no mood read, plus a CV card and private question notes. After two candidates, a comparison table with no portraits: CV fields, your notes, then Hire or Pass for each. Exactly one hire or a pass on both, confirmed with one button. A line reads "Decide on the CV and what you hear, nothing else."
- **Written plan:** goals, measures, owner, due (the sub-periods left in this period) and support needed; each field can be dictated. Required fields are checked on submit, with focus moving to the first gap. After submitting, the plan is read only beside the NPC's short check in.
- The TranscriptBubble's Replay link now uses its own colour token, because the light theme failed contrast (3.64:1). Dark is unchanged.

**D53. The live screen on the engine.** Decided.
- Every live and hybrid action, inbox reply and sponsor briefing opens the shell. The NPC's words stream in as the AI writes them, with the AI persona label. Speaking, pressing the mic or Escape interrupts, and the engine keeps only what was shown.
- Voice needs the consent given in onboarding (or Settings). Without it the mic says "Voice is off. You can turn it on in Settings." and everything works in text. With a transcription server configured (`VITE_ILEAD_SPEECH_URL`) the microphone is real; otherwise a scripted mock voice stands in.
- After the participant ends the conversation, "The team is reacting" shows for at least 1.6 seconds while the engine evaluates, then the board shows the outcome.
- The live screen loads on demand, so the board's first load stays at 178 KB gzipped (budget 200).
- `?period=N` opens the mock engine at a later period, for demos and tests (the week 4 sponsor briefing). The real engine ignores it.
- Hiring needs an open seat: with 10 people in 5 stages of 2, the team starts full (role coverage, D44), so the interview appears once someone leaves. The `Board/Engine board/Interview open` story shows it with room in every stage.

**D54. Onboarding on the engine.** Decided.
- Onboarding is components (`src/components/onboarding/`): one flow component holds the step, tab and mic check state; the storyline arrives as props. The `/screens` frames (o1 to o6, p1) render it from the design fixture (`src/data/fixtures.ts`), pixel identical. The playable app renders it from the engine view (`src/app/EngineOnboarding.tsx`): Paula Jacob, Innov8 Elevators, the storyline's stages, team and profiles.
- The view gains `storyline: { name, organisation }`, and the storyline config an optional `organisation` (Configuration Spec, Organisation name). Nothing else in the view changed.
- Sales Elevator has no authored welcome letter, so the letter is worded from the view: organisation, team size, stages, role coverage, target, run length and days per week. When GenieKreator sends a welcome message, it replaces these paragraphs.
- No welcome video is configured, so the sponsor step shows initials on the brand fill (or the portrait, when the storyline has one) with no play button, caption bar or "avatar video" annotation. Next unlocks after 4 seconds, as in the prototype.
- One language is configured, so the language picker is hidden (spec: shown only if more than one language is configured). The welcome text on that step stays.
- Reading a profile in "Meet your team" sends `openProfile`, so its stats show on the board afterwards (D39).
- Each new step moves focus to its heading. Tabs and radio groups follow the arrow keys.
- Still simulated: the mic test and the sample voice (a toast with the caption). The speech layer (`src/speech/`) can take them over.

**D55. App dialogs on Radix.** Decided. Settings, pause, resume and session timed out are `src/components/settings/`, on a shared non modal Radix dialog (as D23) with `aria-modal`, while everything behind it is `inert`. Focus moves in, Tab loops inside, Escape and a click on the scrim close it, and focus returns to the opener. The session timed out dialog is an alert dialog that only "Sign in again" closes. Frames x1 to x4 are unchanged.
- Settings offers the voice consent switch in the playable app, where the live screen points to it. The design frame x1 has no such row, so the gallery leaves it out.
- The design system Switch is a button with `role="switch"` and `aria-checked`, pixel identical.

**D56. Text size scales fonts, not the layout.** Decided. CSS zoom on the app root scaled the layout too. Now the token pipeline redeclares every font size inside the app root as `calc(<size> * var(--il-text-scale, 1))`, the app sets `--il-text-scale` from the setting, and `css()` does the same for the ported screens' pixel font sizes. Spacing, widths and heights stay put, so text wraps instead of pushing layouts off screen. Onboarding and the dialogs fit at 200% (measured at 1440 wide, no horizontal scroll). Still overflowing at 200%, all fixed heights or fixed columns sized for 100%: the style radios on member cards (`style/StyleControl`), the mood pill on the card portrait and the metric labels and values (`member/MemberCard`, `metric/MetricBar`), the reason chips (`reason/ReasonChip`), HUD pills (score, Cmd K), the outcome panel's close button, the style setting view toggle, letter avatars and "No style last week" tag (`stylesetting/`), and the legend button (`team/TeamBoard`). Text spills out of the pill or into the next column; nothing is clipped. Each needs `min-h` in place of `h`, or a column that grows, in the board work. Update: fixed in D57, except the trust ring's number.

**D57. Accessibility review fixes.** Decided. All 67 parity frames are unchanged.
- Streamed text is never inside a live region. Captions, the 1:1 transcript, the chat thread and the interview transcript keep their visible text out of live regions and announce each finished NPC line once ("Kent, AI persona: ...") from a visually hidden polite region; a line you interrupt is not read out. One streamed reply went from one announcement per token to one.
- Meeting and sponsor stages have no transcript; with captions off the page can pass `spokenLine` so the line is still announced.
- Tiles and meters that were named with `aria-label` on a plain div are now groups (KPI tiles, Team Pulse, target, HUD days left) or images (metric bars, trust ring, streak, report meters), named in words with the trend ("Team skill 57, rising"). Arrow and dot glyphs are hidden from screen readers.
- The style setting screen is the main landmark, headed by its visible "Week 2 of 8 · Style setting" line. On the engine board, which has its own `main` and `h1` ("Set your leadership styles for week 1"), it is `embedded`: a plain region with that line as an `h2`. Components that render headings on the board take a `headingLevel`; the outcome headline is an `h2` there.
- The HUD score is a disclosure: Enter or Space toggles the breakdown (focus no longer opens it). The style control can be locked (`disabled`, aria-disabled with the reason as description). The palette search box has a focus ring.
- On narrow cards (a 1024 wide board) the trust ring moves above the mood pill instead of covering it, and the profile button moves under the name so the name keeps the card's width.
- At 200% text (D56) the member card's style letters, mood pill and tags, the reason chips, the HUD pills (clock, score, Cmd K, nav) and the legend button use minimum heights instead of fixed ones, and the metric bar's label and value columns grow (`minmax(46px, max-content)`), so text no longer spills out of pills or into the bar. At 100% they render exactly as before. The trust ring's number still runs past its 38px ring at 200%.

**D58. Board and live screen behaviour from the review.** Decided.
- One modal at a time: the event card first, then the period panel, both Radix modals with focus on the title. Escape on an event card is Got it; at a period end it does nothing.
- The end of the run offers "Look at the board": a read only board (tiles say "The run is over", End week does nothing) with a banner back to the results, until the M6 report replaces it.
- Inbox Later snoozes a message until the next sub period, and is not offered when the message is due now.
- End in the interview compare view asks first: Keep comparing, or Pass on both.
- Static decisions (energize, training, assess, confirm styles) show the outcome panel with chips and See why, not a toast.
- Sends are guarded against double clicks (a double click spends 1 day, not 2). A failed send keeps the draft.
- Ctrl K opens the palette on the plain board only.
- Focus is managed at every step of a week (the keyboard only E2E walks it). In voice mode focus starts on the heading so Space is free for push to talk.
- At 1024 the team board keeps 176px cards and scrolls sideways in a named region; the Actions panel sits over the last stages. A narrower card or a collapsible Actions panel at 1024 is a design question for the 1024 frames.
- Outside style setting the style letters are locked (`aria-disabled`, focusable, the reason as description); picking one says why in a toast.
- The style setting cards say "Stats show once you open their profile on the board", since they have no profile button. The board cards keep "Open the profile to see stats".

**D59. Quality review before M5.** Decided. A full review of M0 to M4 across the engine, architecture, tokens and docs, app shell and onboarding, components and accessibility, and the board and live screens. What was found and fixed:
- Engine: 20 defects, each with a regression test (`src/engine/sim/review.test.ts`, `coverage.test.ts`): a message answered twice, interactions surviving the period end, drift skipped, briefings due late and not scaling with the run, training cover per person, unlocks crossing periods, stats leaking before the profile is read, assess revealing nothing, hiring ignoring the band, the importer reverting GenieKreator values, leave length, cooldown units, fire with no ripple, uncoded errors, pronoun grammar, unsanitized profile text and more. Calibration still passes (passive 56%, random 60%, good 111%).
- Architecture: one sanitizer for every engine and AI string (dash look alikes, emoji, "competency"); evidence on every decision, event and trigger; See why lists every distinct reason; the participant id from the launch link; captions and voice consent wired; ESLint and CI added; the build runs every unit test.
- Tokens: light theme contrast fixed in tokens; 139 contrast checks in the token build; control borders get their own `line.control` token at 3:1 (WCAG 1.4.11), panels keep the decorative `line.strong`; the light earned star uses the darker cyan.
- App shell and onboarding: onboarding on the engine (D54), dialogs on Radix (D55), text size without zoom (D56).
- Components and accessibility: D57. Board and live screens: D58.
- Visual regression: the design frames stay held by `npm run parity` (67 frames). The engine screens now have Playwright baselines (`tests/e2e/visual.spec.ts`): onboarding, style setting, board and the 1:1, at 1440 and 1024 (390 for onboarding and the phone board) in dark, light and the client theme. Refresh with `npx playwright test visual --update-snapshots` after an intended change, and review the images in the diff.

**D60. Engine text is server content.** Decided for now. Headlines, reasons, causes, event cards and NPC lines come from the engine in English and are sanitized by the client, not looked up in the ICU catalog. The UI chrome is fully in the catalog. When a second language is configured, the engine either localizes on the server (GenieKreator authors per language) or sends codes with parameters that the client words. The view contract keeps them as plain strings until that choice is made.

**D61. Still open after the review.** The engine HUD has no Pause button (the prototype HUD does); the onboarding mic test is simulated; the resume recap uses fixture data; phones keep the prototype board (D43) until the 390 board is designed; the trust ring number overflows at 200% text; Halden's second accent is 4.03:1 on raised surfaces (Halden is a sample client theme; a real client theme is checked by the token build when it is added); the onboarding step dots carry `aria-label` on a plain div; the /screens and /states intro links are 4.3:1 (review tools, not participant screens).

**D62. M5 game rules on the GenieKreator formulas.** Decided. `docs/genie/scoring-and-report.md` section 6 replaces the 2.0 scoring designed here (SIMULATION 7, rewritten). The engine computes everything; `npm run calibrate` now also reports the score and tier spread per player type (good play: Platinum in 60 of 60 runs; passive and random: Bronze, with 2 Silver runs for random).
- **Week score with no live interaction:** the doc says "0.8 × weekly style fit %". Read literally, the funnel part would vanish too. The engine moves only the live weight to style fit (0.8 × fit + 0.2 × funnel), the same way L falls back to capability % with no live interaction. Say if you meant the literal reading.
- **Badges:** the 8 badges designed for 2.0 (First word, Listener, Pipeline builder, Clear voice, Right style and others) are replaced by the 10 badge library. Change Champion counts Strong team meetings, emails, swap talks and exit talks, from the linkage matrix (5.2), since actions do not yet carry their rated skills.
- **Unlock rewards:** the design's three (an extra half day, a quiet word, team lunch) become GenieKreator's: a bonus day, extra hire budget (one seat past a full team, before Hire unlocks, no days) and a team activity without cooldown. The design's reward cards keep their look.
- **Sponsor meter:** shows its value (Configuration Spec, CEO meter). Level words follow the rule lines: Low under 30, Wavering, Steady from 50, Confident from 70, Champion from 85. The −5 for an unanswered sponsor message stays as a configurable default with no GenieKreator source.
- **Team Pulse:** the mean of morale and trust with a trend, as GenieKreator says; the design's mood counts stay beside it.
- **Events:** six card types, fixed, random and conditional timing, stage and sponsor targets, delivery as card, bulletin, chat, email or sponsor call, expected responses with a window and a bonus, escalation to the sponsor and follow up events. Sales Elevator keeps its 12 workbook events with delivery set per event and gains two GenieKreator style ones (a random opportunity and a conditional sponsor call). The importer carries these settings, so a re-import keeps them.
- **Week end text:** the banner headline and sentence are worded by the engine (D60).

**D63. M5 on screen: the week end, the score and events.** Decided. Everything shown comes from the engine (D62); the design frames are unchanged (67 of 67).
- **Week end** (`src/components/weekend/`, frames w1 to w5 from a fixture): at a period end the board gives way to banner, report, each new badge, the unlock offer, next week's bulletins, then "Set styles for week N". At the run's end: banner, report and badges, then the results panel (M6 replaces it).
- **Stars:** the design's three named stars (people, leadership, business) become the three thresholds of one week score; under them, what made the score (style fit, live conversations, deals against ideal).
- **Streak:** in periods, not the design's "days replied on time", with the next bonus in words.
- **Rewards:** the design's three reward cards carry GenieKreator's unlocks (D62).
- **Sponsor confidence:** level words with the numbers ("Steady to Confident, 62 to 71"); the engine sends the level words. The board tile reads "Confident, 72" and its popover says what 70 and 30 mean.
- **Team Pulse:** the value and trend lead; the mood bar stays and the counts move into the tile's name and tooltip. "Up from 3 struggling last week" is not shown (the summary has no previous counts).
- **Funnel:** "This week" (the design) and "So far" (against the cumulative ideal, GenieKreator) on a toggle.
- **CEO check in:** a notice in the report, a note under the days left, and a news message in the inbox (Mark as read, no reply).
- **Score breakdown:** the HUD score opens the pillars 0 to 100 with their weights, what feeds each, the streak bonus and the tiers with "You are here". The prototype's 1,240 out of a pillar scale of 1,000 stays in the frames only.
- **Badge shelf:** opens from the score breakdown (the engine HUD has no nav); earned badges with their reason and week, the rest with their description. One UI owned icon per badge rule (`gamification/badgeIcons.tsx`) until GenieKreator sends authored icons.
- **Events:** opportunity and crisis cards get art bands in the design's language (need a design review). The person's portrait fills the illustration slot until cards carry an image. A sponsor call rings over the board like frame b13 (not a modal): Take the call opens the reply conversation, Later leaves the urgent message in the inbox with its due.
- **Perks:** the engine sends each action's cost now and its perk; the hire on the extra budget reads "No days, one seat past a full team", a team activity "No cooldown this time".
- **Budget:** first load is 193.2 KB of 200 KB. The week end and the live screen load on demand; M6 must keep the report out of the first load.

**D64. M6 report engine.** Decided.
- **Skills are rated beside the rubric.** scoring-and-report.md treats the rubric dimensions as the skills. Our storyline rubrics (listening, clarity, agenda and so on) are calibrated and drive each conversation's overall band and consequences, so the evaluator now returns both: the rubric dimensions (game) and one band per linked skill (report). A real evaluator gets the linked skills in its input. Say if the rubric should become the skills; that recalibrates the game.
- **Defaults authored here:** the 8 skill anchors, the narrative bank, the development plan copy, the recognition phrases, the methodology lines and the two reflection questions (taken from the design). All are config; GenieKreator authors replace them.
- **Change Champion** (D62) now reads the linkage matrix: a Strong conversation that rates Communicating change.
- **Not in the engine:** the participant's name and the report date come from the launch (LMS or GenieKreator), not the engine; minutes of play come from the client. Human review is not built: methodology says "not yet reviewed".

## Blocked on missing docs

**D19.** Mostly resolved by the iLead 1.0 documents (D28 to D35). Still open:
- Resolved: the GenieKreator Configuration Spec and the other GenieKreator source docs are in `docs/genie/`, copied from the GenieKreator authoring repo.
- Sales Elevator money values (target, value per deal, lead input). Calibration will propose them; confirm or replace.
