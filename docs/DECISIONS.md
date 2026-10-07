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

**D6. Tailwind preflight is off during migration.** Closed by D78: preflight is on.
Preflight resets borders, images, headings and buttons, which would move the inline styled screens. It is switched on in M8, once every component is on utilities.

**D7. Migration aliases.** Closed by D78: the aliases are gone.
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

**D9. Minus signs in deltas.** Decided in D88 (as proposed).
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

**D12. HUD week label.** Decided in D88: on screen as designed, the spec's wording for screen readers.
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

**D15. Breakpoints with no design.** Decided in D88 (settled by D69 and D73). The 390 items are superseded by D69: phones are not supported, and the 390 frames are retired.
The brief asks for visual regression at 1440, 1024 and 390 for every screen. The design defines:
- 1440 for every screen
- 1280 only for the client theme board
- 390 only for live interactions, the outcome and the report
- nothing at 1024

The spec describes tablet as "board scrolls by stage" and mobile as "lite mode, team board becomes a list".
Proposal:
- The 2px bar applies only where a design frame exists.
- 1024 and the other 390 screens get layouts derived from the spec, approved through Storybook screenshots, then locked as baselines.

**D16. Optional Week 0 practice chat** (spec onboarding step 7). Decided: built in D84. Was open: It is not designed. It depends on configuration that lives in the missing GenieKreator Configuration Spec.

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

**D23. Command palette uses a non-modal Radix dialog.** Decided in D88: the board behind is inert.
Modal mode sets `pointer-events: none` on the body, which changes the board's gradient pills behind the scrim by up to 28/255.
- Focus is still trapped (Tab loops inside), Escape closes, and focus returns to whatever opened it.
- But the page behind is not hidden from screen readers.

In M8 I'll make the board behind `inert` while the palette is open, which keeps the pixels and restores the modal semantics.

**D24. Motion durations snapped to tokens.** Decided. Durations of 160, 200 and 320ms became 150, 220 and 300ms (`duration.fast`, `base` and `slow`), inside the brief's 150 to 300ms range. No frame changes.
Later component tokens followed the same rule (4 Oct 2026): the action and inbox drawers (240ms), the profile panel (260ms), the team legend and the toast (200ms) use `duration.base`; the badge award (400ms) and the stars (500ms) use `duration.slow`, keeping their overshoot curves as `easing.overshoot` and `easing.overshoot-strong`. Parity stops animations, so no frame changes. Looping pulses (rings, dots, the caret) and the waveform's 90ms follow of mic levels are not transitions and keep their timing.

**D25. Copy duplicated until M2.** Decided. Style names and descriptions, and mood names, are now in the catalog. The legend, profile, style setting definitions and some toasts still read the scenario data until the engine takes over in M2.

**D26. End screen badges disagree with the data.** Closed (2026-10-06): since M5 the engine decides badges from the 10 badge rules (D62), so the end screen shows what was earned.
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

**D30. Trust rules are new.** Decided in D88 (SIMULATION.md section 3).
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

**D33. Weekly style values are new defaults.** Decided in D88. The Model doc defines the weekly style rule but gives no numbers, so SIMULATION.md 4.4 sets defaults inside the workbook's bounds. Calibration may tune them.

**D34. Two data sets.** Decided.
- The `/screens` and `/states` galleries keep the prototype's numbers, so design parity stays provable.
- The playable app runs the calibrated Sales Elevator storyline from the workbook. Its numbers and stages will differ from the design frames by intent.

**D35. Live interactions use 1.0's maths.** Decided in D88.
- In 1.0 you picked one of four written options; in 2.0 you speak or write freely.
- The AI evaluator classifies your words as one of the four styles, and 1.0's mismatch maths then applies unchanged.
- A Strong conversation improves the mismatch by one step; a Weak one worsens it by one.
- The evaluator only reads; authored rules decide the consequences (brief, rule 1).

**D36. Funnel formula normalized.** Decided.
- The Model doc's funnel step is `input × ratio × (average result + buffer) / 100`. Performance compounds across all 5 stages, so in the uncalibrated storyline good play earned 10× what passive play did. The buffer is the Model doc's lever to soften that.
- But with a positive buffer the factor goes above 1, and a stage outputs more than its conversion ratio allows.
- The engine divides by `100 + buffer` instead. A buffer of 0 gives exactly the Model doc formula; any buffer keeps every stage at or below its ratio.

**D37. Thoughtless play can do worse than doing nothing.** Decided in D88.
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

**D43. Phones keep the prototype board.** Superseded by D69 (phones are not supported). Decided, until the 390 board is designed (D15). Desktop plays on the engine. `?engine=off` opens the prototype's fixed board, and `?start=board` skips onboarding.

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
- One component per piece with a `layout: 'desktop' | 'phone'` prop, not separate phone components: the 390 frames differ only in sizes and in what the header shows. Superseded by D69: the phone layouts and the `layout` prop are gone.
- The brief is data with optional rows (agenda, what you know, mood, open promises, declared style, tone). The row labels follow the format ("Watch for" in a meeting, "She cares about" for the sponsor), so the design's per format briefs come from one shape.
- The 1:1 mood ring has three steps (frustrated, guarded, more open), as designed, separate from the five member moods.
- NPC turns can stream (`streaming`) and be cut off (`interrupted`, shown as "Interrupted" beside the AI persona label). Pressing the mic or Escape while the NPC speaks calls `onInterrupt`.
- Screen readers hear each NPC line once, when it has finished: the captions announce it, or the transcript does while captions are hidden (D57).
- A long transcript now scrolls inside the window (capped at the window height minus the header and reply bar) instead of growing the page. At 900 tall the cap is above the designed height.
- The mood ring's 600ms colour change is snapped to `duration.slow` (300ms), per D24.
- Still open: Space as push to talk (D18), and chat in the shell (D14). `LiveTranscript` and `LiveInputBar` are ready for chat.

**D52. The three undesigned live formats.** Decided (built in M4 in the designed live screens' visual language; please review with design). The interview and the written plan were finished in D85.
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

**D60. Engine text is server content.** Superseded by D83 (engine copy is message codes the client words). Was: Headlines, reasons, causes, event cards and NPC lines come from the engine in English and are sanitized by the client, not looked up in the ICU catalog. The UI chrome is fully in the catalog. When a second language is configured, the engine either localizes on the server (GenieKreator authors per language) or sends codes with parameters that the client words. The view contract keeps them as plain strings until that choice is made.

**D61. Still open after the review.** Closed: the mic test and the resume recap were built in D68, the rest in D68 and D78 (D88). Was: The engine HUD has no Pause button (the prototype HUD does); the onboarding mic test is simulated; the resume recap uses fixture data; phones keep the prototype board (D43) until the 390 board is designed; the trust ring number overflows at 200% text; Halden's second accent is 4.03:1 on raised surfaces (Halden is a sample client theme; a real client theme is checked by the token build when it is added); the onboarding step dots carry `aria-label` on a plain div; the /screens and /states intro links are 4.3:1 (review tools, not participant screens).

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

**D65. M6 on screen: the end screen and the development report.** Decided. Frames e1, e2, e3 and the phone report render the new components from fixtures, pixel identical (67 of 67).
- **End screen** (`src/components/end/`): after the last week end. Tier, score, results, up to 4 moments (each opens to its situation, behaviour and impact), badges, the reflection (authored questions, 0 to 3, by voice or text) and the 1 to 5 rating, saved with `submitReflection`. "Look at the board" replaces the D58 results panel; the read only board leads back.
- **Report** (`src/components/report/`, loaded only when opened, with visx): all ten sections in the authored order. Every chart has a "Show as table" toggle with a real table; print shows tables where a chart would not read in black and white. Download PDF opens the print view (letter pages, "Page N of M") and the browser's print dialog. Email me goes through the API (`POST /report/email`, proposed).
- **Design vs docs:** the engine's 5 skill levels replace the design's 4 (one bar segment each); the score is the engine's 0 to 1000; the design's chart notes ("Dip in week 4 after the price war") are authored commentary the engine does not send, so the report says "Up from 57"; "You did" is worded from the styles intended and shown; "98 minutes of play" is dropped (client data, not engine data); the conversions note reads against the ideal pace instead of "week 1 pace". The undesigned sections (moments, people, business, analytics, methodology, the shares and grid charts) follow the design's card language and need design review.
- **Not engine data yet:** the participant's name (the report says "Your development report" until the launch sends it), the report date (the client's today), the report's audience, per level colours, calibration agreement and retention for methodology.
- **Budget:** first load is 196.8 KB of 200 KB. The catalog is one chunk; M7 should split the end, report and week end copy into their lazy chunks.

**D66. Your answers before M7.** Decided (2026-10-05).
- **Rubric and skills stay separate (D64):** storyline rubrics decide the game band; the 8 skills are rated alongside for the report. No recalibration.
- **Week score with no live conversation (D62):** 0.8 × style fit + 0.2 × funnel, as built.
- **Engine text in other languages (D60):** the server localizes. GenieKreator authors each language and the engine words its text in the participant's language; the contract keeps plain strings.
- **Sales Elevator money (D19):** keep the calibrated values: $240,000 target, $30,000 per deal, 8 leads a day.
- **Before M7:** close every gap left from M0 to M6 (the phone board, leaderboard and celebration level, assessor review, Pause, raised hands, the mic test, the resume recap, PDF and email contracts, launch name and date, 200% text, the accessibility leftovers, the board at 1024, the bundle budget).

**D67. Closing the M0 to M6 gaps: engine and services.** Decided.
- **Team meetings:** the meeting has a floor. Calling someone by first name gives them the floor; after each reply up to two people who have not spoken raise a hand (anyone carrying an unshared concern first, then the lowest morale); with nobody named, the first hand speaks up. Deterministic, so replays match. The view sends `live.raisedHands`.
- **Assessor review** (scoring-and-report.md 4.5): `engine.review({ recordId, band, skills })` is assessor tooling, not a participant intent; on the server it sits behind the reviewer role. The assessor's band replaces the AI's overall and skill bands in the score, badges read afterwards and the report; consequences already applied stay. The report says "Reviewed by an assessor: N conversations of M". Sample audit and assignment to reviewers are server work.
- **Leaderboard and celebration:** `gamification.leaderboard` (scope, size, anonymous; on for development use, off for selection use via the storyline's `use`) and `gamification.celebration` (none, subtle, full). Ranks need other participants, so they come from the cohort API (`getLeaderboard`, proposed `POST /cohort/leaderboard`); the mock serves a sample cohort.
- **Launch data and files:** `getProfile` (proposed `GET /profile`) gives the participant's name for the report; with the mock, `?name=` stands in. `reportPdf` (proposed `GET /report.pdf`) gives a server rendered PDF; without one, Download PDF opens the print view and the browser saves it. Email stays `POST /report/email`. All paths are proposals in `src/api/http.ts`.
- **First load:** the end screen, report and week end copy now load with their screens (`registerMessages`), taking the first load from 196.8 KB to 193.5 KB.

**D68. Closing the M0 to M6 gaps: screens.** Decided.
- **Phones play on the engine** (superseded by D69: phones are not supported) (600px and below): compact HUD, KPI tiles in a sideways scroller, the team as a list by stage, and a dock for the inbox and actions. Actions, the action drawer, profile, inbox and the score breakdown open in a bottom sheet. 44px touch targets, safe areas, no sideways page scroll. `?engine=off` still opens the prototype.
- **Pause:** the HUD Pause pill carries the session clock. While any dialog is open nothing moves: the clock stops and a live conversation holds its streamed words, its clock and push to talk.
- **Welcome back:** a run in progress on load opens on the board with a recap built from the engine view (period, time left, last outcome, urgent inbox, open promises, KPIs).
- **Mic test:** onboarding records with the real speech layer; a blocked or missing mic continues in text.
- **Board at 1024:** under 1280 wide the Actions panel folds to a rail with the number of actions open; the choice is kept per participant.
- **Cohort and celebration:** a "Your cohort" table on the end screen and "Rank N of M" in the score breakdown, hidden for selection use. `celebration: full` adds a short burst behind stars and badges, only with motion allowed.
- **Accessibility:** 200% text reflows at 1440 and 1024; step dots read "Step n of 6"; Halden's second accent darkened to pass 4.5:1.
- **Bundle:** initial JS 198.0 KB of the 200 KB budget, so M7 must load theme code lazily.

**D69. Laptop, desktop and tablet only.** Decided (2026-10-05, the product owner).
- **Phones removed.** The phone board, its HUD, dock and bottom sheets, phone style setting, and every phone layout (`layout: 'phone'`, `'sheet'`, `'row'`, `'list'`, the outcome `card`) are gone, with their stories, the phone E2E flow, the phone only tokens and catalog keys. The design's seven 390 frames (m1 to m7) are retired from `/screens` and from `npm run parity` (`RETIRED` in `tests/visual/parity.ts`): parity now holds 60 frames (52 screens, 15 states, less the 7).
- **The notice.** Narrower than 744, or shorter than 500 on a touch screen (a phone held sideways), the app shows a full screen notice instead: the brand mark, a laptop and phone line icon, "iLead works best on a bigger screen", why, Copy link (copies the page's own address and says "Link copied"), and "Tablets work in portrait and landscape." Query `SMALL_SCREEN` in `src/lib/useMediaQuery.ts`; the gate is `src/app/SmallScreenGate.tsx`. The app stays mounted underneath, `inert` and hidden, with its clocks held, so turning the device or widening the window resumes exactly where it was, focus included. It follows the dark, light and client themes.
- **Breakpoints.** 1440 and up is the design. 1024 to 1279 folds the Actions panel to a rail (D58). 744 to 1023 (tablets, small windows) uses the 1024 layouts: the HUD may wrap to two rows, a live stage narrower than 560 stacks its columns (a container query), and the outcome's faces wrap. Nothing scrolls sideways.
- **Tablets by touch.** Under a coarse pointer every control is at least 44 by 44 (WCAG 2.5.5), taps do not wait for a double tap zoom, the app root keeps clear of the status bar and home indicator (safe area insets, 0 on laptops), and the score breakdown toggles on a tap instead of relying on hover.
- **Baselines** are now 1440 and 1024 for every engine screen, plus the 390 notice, in dark, light and the client theme (`tests/e2e/visual.spec.ts`). The 1440 and 1024 baselines did not change.
- **Next.** Tablet portrait layouts at 834 follow the design review of the Tablet page in the design canvas; until then tablets use the 1024 layouts as above.
- **Bundle:** initial JS 196.3 KB of the 200 KB budget (was 198.0 KB).

**D70. Leadership lens and the author chat.** Decided 2026-10-06 (product owner).
- **The lens drives the simulation.** GenieKreator's Leadership Lens module (8 lenses: Readiness Based, Six Leadership Styles, Inspire and Deliver, Servant, Five Leadership Practices, Adaptive, Team Amplifier, Client Leadership Model) becomes authoring step 2, right after the brief, and replaces the old step 4. One primary lens (mandatory), one optional secondary lens that adds report only dimensions.
- **Style names follow the lens.** The engine no longer fixes four styles. A lens brings 2 to 6 styles (key, letter, name, short line, description); the author chat's model renames them to fit the lens and the client's context. The participant UI reads every style name from config. Readiness Based with Directing, Guiding, Partnering, Entrusting stays the default and the Sales Elevator storyline.
- **Fit stays one engine rule.** A member's need comes from their skill and morale (the four quadrants of SIMULATION.md 2). The lens names the needs and gives a fit table: for each need, each style's difference (0, 1 or 2). Readiness Based's table reproduces today's rule exactly, so calibration holds.
- **Scoring follows the lens.** The primary lens's scoring dimensions become the report's skills (anchors, linkage, at least 2 observations from 2 interactions). The secondary lens's dimensions are marked report only: scored from conversations, shown in the report, never in the Leadership Score or badges, and shown as "Not enough evidence" under 2 observations.
- **Scenario copy follows the lens and the brief.** Intro screens, sponsor lines, event and email text are authored copy in the storyline, drafted by the author chat for the lens, industry, role level and challenge.
- **The author chat.** GenieKreator starts with a short chat of 5 to 10 questions (fewer when uploads or answers already cover them). It recommends the lens with the module's rules (client framework first, then the challenge, then role level), and drafts the storyline: company and product, sponsor, intro screens, team, lens styles and fit, scoring dimensions. The author confirms, then edits in the workspace. A working prototype lives in this repo at `/author` (lazy, not in the participant bundle); the real drafting runs on the server (`POST /author/draft`), and the prototype's mock drafts from the lens library without a model.
- **Guardrails** from the module apply: KNOLSKAPE lens titles only, original sources only in "Based on" (author facing), no certification claims, "skills" never "competency", no em dashes.

**D71. The lens in the engine and the participant UI.** Decided (2026-10-06), building D70.
- **Config:** the storyline's `lens` block (id, title, author description, author only `basedOn`, 2 to 6 styles, the names of the four needs, the fit table, an optional secondary). Left out, it is Readiness Based Leadership, so existing storylines parse unchanged. Action options' `style` and the dominant style narratives are keyed by lens style keys; option tags are checked against the lens, narrative lines for styles the lens lacks are simply never used.
- **Engine:** a member's need is their skill and morale quadrant; the style difference is the fit table lookup (SIMULATION 2). Readiness Based Leadership's table is the quadrant rule, the random draws keep their order, and seeded runs replay exactly (`src/engine/sim/replay.test.ts`, recorded before the change); `npm run calibrate -- sales-elevator --check` prints the same report. The engine refuses a style key the lens lacks (`unknownStyle`). The mock evaluator keeps its cues for the default keys and reads any other style from the words of its name and short line.
- **View:** `lens: { id, title, styles, needs }`; never the fit table or the source. The report adds the lens with its secondary and the fit table in the grid's shape, once the run has ended. The UI reads every style name, letter and description from the lens (`LensProvider`, `useLens`); the catalog's `style.name`, `style.letter`, `style.description` and the live brief's per style lines are gone.
- **Report:** the used against needed grid has the four needs as rows (their lens names) and one column per style, with the fitting cells outlined. Report only skills (a secondary lens) carry a "Report only" tag and stay out of the score, badges, the summary and the development plan; they always need 2 observations from 2 conversations. Confirmed by the product owner (2026-10-06): report only skills stay out of the development plan, and the default need labels ("Learning and unsure", "Keen to learn", "Capable but cautious", "Ready to run with it") are approved. Methodology opens with "This simulation looks at leadership through the {title} lens."
- **Layout:** five or six styles: the segmented control shrinks its letters in one row, and on a touch screen wraps to rows of three 44px letters; the style definitions sit under the sponsor's prompt (one row from 1280 wide, rows of three below); the list view heads its radio columns with letters. Four styles are pixel identical to before.
- **Proof:** `src/engine/storylines/sixStyles.ts` turns Sales Elevator into a Six Leadership Styles run (Vision Setter, Coach, Harmoniser, Collaborator, Pace Setter, Commander; Inspire and Deliver secondary with two report only skills), played end to end in `src/engine/lens.test.ts` and in the browser with `?lens=six_styles` (`tests/e2e/lens.spec.ts`).
- **Bundle:** initial JS 197.9 KB of 200 KB (the base commit measures 197.6 KB in the same environment).
**D72. Theme loader (M7).** Decided 2026-10-06; M7 approved by the product owner the same day.
- **Config.** A GenieKreator theme (`src/theme/schema.ts`, README "Themes"): version, name, mode (dark, light, system), accent, second accent, soft accent, brand gradient, four surfaces, logo (image or text), font from an allowlist, radius scale. Status colours stay iLead's: they carry meaning.
- **Runtime, not build.** Semantic tokens marked `themable` read `--il-theme-<token>` first; the loader writes those on `:root`, from `getTheme` (proposed `GET /theme`, 404 is none) or an inline theme in the launch payload. Only a small bootstrap is in the first load (197.3 KB of 200 KB, was 196.3 KB); the loader, schema and contrast table are a lazy chunk (8.5 KB). `tokens/themes` is gone.
- **Contrast.** The build's maths moved to `src/theme/color.ts` and `src/theme/paint.ts`, which both the build and the loader use (culori stays only to test them). It now gamut maps OKLCH by chroma, as CSS does: build ratios moved by up to 0.07, all still pass. The loader corrects every pair the build checks, by lightness only, smallest change first, and warns in development.
- **Fallback.** Not an object or not version 1: default theme. Any other bad field: that field's default. A colour no lightness can fix: that token's default.
- **Halden** is a sample config (`src/theme/samples/halden.json`) through the same path, output identical to the old build time theme, so its baselines hold. **D17 fixed:** its prototype nav reads Objective, History and More (b15 still within 0.05%).
- **Brand mark.** The client's logo shows before the iLead wordmark in the HUD, onboarding, the small screen notice and the report header. The client onboarding baselines were refreshed for it (reviewed). Style setting, week end, the end screen and the loading screen keep the wordmark alone for now.

**D73. Tablet portrait layouts.** Decided 2026-10-06 (product owner approved the Tablet frames, kept in `docs/design/tablet/`); awaiting approval.
- **When.** 744 to 1023 wide and taller than wide (`TABLET` in `src/lib/useMediaQuery.ts`). Landscape tablets and short windows in that range keep the 1024 layouts (D69). The board marks its root `data-tablet`; the `tablet-portrait:` variant styles everything inside it, so stories can show the layout at any size.
- **Board.** HUD with week, day and days left, score, streak, settings, Pause with the clock, End week (nav, bolts and Cmd K drop out, by classes only). KPI tiles 4 by 2 (the target spans two). The team as stage columns of 168px tappable cards (photo in the mood ring, name, title, mood, style tag). The outcome under the team, then a dock: Inbox with its count and "Actions · N open · X days left". The team scrolls; the dock stays in reach.
- **Actions drawer.** Tapping a person opens a 440 wide modal panel from the right over the dimmed board (Radix: focus inside, Escape or a tap on the board closes it, focus returns to the card). Tabs For {name}, For the team, Profile; a due notice with Reply now; the actions as 64px radio rows (`OptionCards` size `lg`); the chosen action's flow and a 56px confirm with the cost. The same flow props as the Actions panel's `ActionDrawer`, the same profile pieces as `ProfilePanel`. Picking several people: "Pick people on the board" lowers the drawer, a pick bar takes the dock's place, Done brings the drawer back.
- **Live.** One column for every format: header with title, time, Hint, Pause, voice or text and End; the brief's goal always shows (beside the 200px portrait in the 1:1), the rest opens under it; the log fills the screen; mic and send are 56px.
- **Style setting** (classes only): the styles as a strip of four, cards three a row, a confirm bar at the bottom. **Week end** in one column, **end screen** tiles three a row; the report already fits.
- **Bundle.** The tablet board, drawer, dock, pick bar and their copy (`tablet.json`) are a lazy chunk; the badge shelf and the command palette now load when first opened. Initial JS 198.7 KB of 200 (was 199.0 KB on ilead-app).
- **Tests.** `tests/e2e/tablet.spec.ts` plays a week by touch at 834 by 1194 with axe in dark, light and client; baselines at 834 for the board, drawer, 1:1 and style setting in the three themes.
**D74. The author chat prototype.** Decided 2026-10-06, building D70.
- **Where.** `/author`, for authors only, lazy loaded (`src/author`). The participant first load grows by 0.1 KB (the route), measured 199.0 KB before and 199.1 KB after on the D72 base.
- **Flow.** 5 to 10 questions (role level, industry, challenge, client, team size, work process, duration, language and region, framework, tone), skipping what answers or uploads cover and confirming covered ones when fewer than 5 would be asked; then the lens step (module steps 1 to 5, D70 precedence), the build preview, confirm and lock, the module JSON and a drafted storyline. Changing the lens after the draft warns first.
- **Drafting.** `Drafter`: `ServerDrafter` (proposed `POST /author/turn` and `POST /author/draft`, Zod shapes in `src/api/author.ts`, prompts in `docs/genie/prompts/`; 404 or 501 falls back) or `MockDrafter` (rules and templates, no model: "Draft made from templates"). Every draft must pass the storyline schema and the copy guard (`src/author/copyGuard.ts`), or the templates draft instead. Sales Elevator supplies the calibrated mechanics; drafts are `calibrated: false`.
- **Storyline.** New optional `intro` (the sponsor's welcome letter); onboarding uses it when present. A Client Leadership Model plays on the Readiness Based styles; its confirmed dimensions become the skills.
- **Play this draft** stores the storyline (`ilead.author.draft`, session and local storage) and opens `/?storyline=draft&start=onboarding`; the mock engine (already lazy) parses it and falls back to Sales Elevator with a console warning.

**D75. Report 3.0: the full individual report, the group report, and purpose aware findings.** Decided 2026-10-06 (product owner; samples in `docs/reports/`).
- **Purpose drives the report.** The storyline's purpose is `development` or `assessment` (today's `use: 'selection'` reads as assessment). Assessment reports carry verdicts and the full findings. Development reports carry no verdict words: they frame every finding as the next step and lead into practice in the real job.
- **Verdicts (assessment).** An overall verdict against an authored bar (default: overall level Proficient, no skill below Developing): "Exceeds the bar", "Meets the bar", "Approaching the bar", "Below the bar". Each skill also gets Strength, Meets or Development need. Labels and the bar are config. Every verdict cites its evidence and says whether an assessor reviewed it.
- **Individual report, added from the 1.0 sample** (lens aware, so style grids use the lens's needs and styles):
  - About the simulation and how to read the report, and a confidentiality note.
  - Skills with a score out of 10 beside the level, and a narrative per skill.
  - Objectives: revenue against target, conversions, team skill, morale and result at start and end.
  - Overall leadership adaptability (share of style choices that fitted).
  - Styles summary: proportion and accuracy per style with a narrative, and the preferred style.
  - Consistency: needed against used, intended against used, needed against intended, as deviations with narratives.
  - Summary of actions: impact (none, very low, low, moderate, high) and frequency per action, with a narrative.
  - Distribution of actions across team members: a member by action matrix of counts coloured by impact, members ordered by impact.
  - Food for thought: reflective questions with a guiding line each.
  - Key takeaways.
  - Progress over time: the development plan with real world practice and check ins, and a comparison with earlier attempts when there are any (`getHistory`, proposed).
- **Group report (new), for the organisation:**
  - Cover with the number of participants.
  - Skills: group average against the benchmark, with level and narrative.
  - The share of the group at each level per skill.
  - Completion rate.
  - Business achievement: best revenue against target, average conversions and revenue against the benchmark, the share who beat the target, and skill, morale and result against the benchmark.
  - Leadership style adaptability and preferred styles.
  - Styles distribution and consistency.
  - The funnel, ideal against actual, week by week.
  - Actions by frequency and impact.
  - Time spent with top, average and bottom performers.
  - Key takeaways as organisational questions by section.
  - Assessment purpose adds the verdict distribution and a participant table.
  - The benchmark is everyone who has played the simulation (server data). The aggregation is a pure function (`buildGroupReport`) the server can reuse.
  - The prototype lives at `/group` (lazy), with a mock cohort played by the calibration AI players.
- **Copy:** "skills", never "competency"; no dashes as punctuation; no emojis.

**D76. The individual report 3.0, built.** Decided 2026-10-06, building D75 (SIMULATION 8.4). Defaults chosen here, all config:
- **Impact bands** (`report.impact`): the mean net skill + morale + result change per person an action reached. Very low under −2, low −2 to under 3, moderate 3 to under 10, high 10 and up; never used or no change is no impact. A weekly style fit is +6, a fitting 1:1 about +16, a missed one about −10, so the bands split helping from harming.
- **1.0 actions mapped:** Meet the Team `meet`, Meet Face to Face `f2f`, Set Goals `goals`, Coach Member `coach`, Give Feedback `feedback` (`report.consistencyActions`). Team meetings count as style uses for consistency only (the score still ignores them). Deviations are shares of uses or settings, not of members, so they move smoothly (1.0 printed 18.99%).
- **Time spent:** share of one to one actions with the top three, the bottom three and the rest, ranked by result at each period start. Team actions are left out: they reach everyone equally.
- **Score out of 10** is the skill score divided by 10, one decimal, beside the level.
- **Verdict rules** as in SIMULATION 8.4; default bar Proficient with no skill below Developing; evidence is the live record ids, up to 3 quotes and the review status (assessor, partly, AI only).
- **Development copy** has no verdict words, so the summary's boxes read "What you do well" and "What to grow next"; assessment reads "Strengths" and "Lowest rated skills", and its business line says "The team".
- **The report's schema left the first load:** `ReportView`, `RunSummary` and `History` live in `src/engine/reportContract.ts`; `EngineView.report` is checked only as an object and parsed (copy rules applied) by the end screen and the report, both lazy. Initial JS 198.6 KB (was 198.8 KB).
- **`getHistory`** (proposed `GET /history`, 404 is none): earlier attempts as `{ attempt, endedAt, headline, summary: RunSummary }`. The mock serves one, played by the random player, with `?history=1`; `?purpose=assessment` plays the mock storyline as an assessment.
- **Print:** each section starts a new page; the distribution matrix, the deviations and progress print as tables. US spelling in the report copy ("Behavior", "favorites", "Practice").
- **Not built:** the group report (`/group`, `buildGroupReport`) is the next step; it reads `RunSummary`.

**D77. The group report, built.** Decided 2026-10-06, building D75 (SIMULATION 8.5, README "Group report"). Defaults chosen here, all config (`report.group`):
- **Aggregation** is `buildGroupReport` over run summaries, pure, with `summarizeBenchmark` the server's stored benchmark (averages and distributions only); the group's numbers use the same function. The completion rate counts everyone; other averages read runs completed to `completeAt` (default 100%).
- **Privacy:** development shows no verdicts, names or ranking, and withholds aggregates below `minimumCohort` (default 5) participants who completed. Assessment adds the verdict distribution and a participant table in name order, and has no minimum.
- **Defaults:** group levels from the mean score on the storyline's scale; "in line with the benchmark" within 0.5 of 10 for skills and 3 points for adaptability; style and consistency bands as the individual report; time spent "evenly" within 10 points. Organizational takeaways in six groups, adapted from the 1.0 sample.
- **Run summary** gains `review` (conversations and how many an assessor reviewed), optional for summaries stored before. `Engine.summary()` summarizes a run at any point, so unfinished runs count in the completion rate.
- **Mock:** two more AI players (one style, careless) and `stopAfter`, leaving the calibration players' draws as they were (calibration unchanged); the benchmark is 300 seeded runs per lens, cached (`npm run benchmark`).
- **Bundle:** `/group` is lazy; initial JS 198.8 KB of 200 (was 198.6 KB: the route and `getGroupReport` on the API adapters).

**D78. M8 hardening.** Decided 2026-10-06; done, awaiting approval.
- **Accessibility.** `tests/e2e/a11y.spec.ts` runs axe (WCAG 2.2 AA, no rule disabled) on every route and major state in dark, light and the client theme at 1440, 1024 and 834: onboarding (every step and the letter's tabs), style setting and its summary, the board, the actions drawer, inbox, profile, score breakdown, badge shelf, settings, pause, every live format (1:1 with a hint, email, chat, team meeting, written plan and its check in, sponsor briefing, sponsor call, letting someone go, interviews and the comparison), event cards, the team reacting, outcomes, every week end step, the end screen, the development report and its print view, the assessment report (web and print), the group report (development, assessment, both prints, under the minimum size), every author chat step, the small screen notice at 390, and Brightwater (a deliberately bad palette) through the theme loader on onboarding, the board and the group report. 91 tests, each scanning every state it walks. Violations found: none; the earlier milestones' fixes (D8, D57, D61) hold with preflight on. A keyboard only test plays a full week with a live conversation (styles by arrows and Enter, a person, an action and its option, the conversation, a team action, the week end into week 2).
- **Preflight on, aliases gone (D6, D7 closed).** Tailwind preflight is in the base layer; `tokens/legacy.json` and the pipeline's alias output are removed, and the prototype board reads the `--il-*` tokens. Fallout, found by screenshotting all 448 stories and the reports before and after: the week end's prototype shortcut lost its button padding (parity w1, w2, w5 at 0.06%, fixed with explicit padding), the report's and group report's bullet lists lost their markers (`list-disc`), story controls lost their button look (a Storybook style). Intended changes kept: `border-b` and `border-t` no longer draw 3px user agent borders on their other sides (author chat header and framework table), native radios lose their user agent margin (style list view, lens cards), placeholders use preflight's half strength text colour. Parity 60 of 60; the 45 existing visual baselines pass unchanged.
- **Web Vitals.** `npm run vitals` (`scripts/vitals.ts`, in CI) measures a production build behind `vite preview`, gzipped, with the CPU 4x slower and a Fast 3G like network (150 ms latency, 1.44 Mbps down, 675 Kbps up), 3 runs per page, medians; the build talks to a stub server through the HTTP adapters, running the engine in Node. Before and after (LCP, CLS, TBT, transfer): first load 2824 ms, 0.002, 216 ms, 1733 KB to 2416 ms, 0.002, 219 ms, 353 KB; board 7624 ms, 0.001, 488 ms, 2733 KB to 2856 ms, 0, 504 ms, 384 KB (INP 144 ms); report (opened from the end screen) 1197 ms, 0, 213 ms, 46 KB to 1181 ms, 0, 217 ms, 46 KB; group report 3840 ms, 0.008, 700 ms, 1870 KB to 2684 ms, 0.007, 523 ms, 386 KB. Fixes: WOFF2 fonts (94 to 30 KB each) with the heading weight preloaded; WebP portraits (about 90 to 3 KB each) and backdrop (1.3 MB to 7 KB) from `scripts/assets/optimize.py` (the PNGs stay for the design gallery and parity; new portraits are prepared as WebP); the view, session, scenario and theme requested while the scripts evaluate (`src/app/prefetch.ts`), the group report as soon as a small launch chunk lands, the team's portraits as soon as the view names them; Zod without its JIT (`z.config({ jitless: true })`: compiling was most of the parse cost for a payload parsed a few times a minute); money formatters and the message locale lookup made once; the first onboarding step shows at once instead of rising in (its heading is the largest paint).
- **Budgets** (`BUDGETS` in `scripts/vitals.ts`): first load LCP 2.5 s, CLS 0.1, TBT 300 ms, 450 KB; board LCP 3 s, TBT 600 ms, INP 200 ms, 450 KB; report 2.5 s, TBT 300 ms, 100 KB; group report LCP 3 s, TBT 600 ms, 450 KB. They are above the usual 2.5 s and 200 ms where a measured floor is above them: compiling the first load's scripts is a 200 to 250 ms task at this CPU, the board's largest paint is a portrait that needs the view first, and the board and group report each render in one long task. Splitting those renders is the next step (HANDOFF "Known limits").
- **Bundle:** initial JS 199.7 KB of 200 (was 198.8 KB): the launch prefetch and memoized formatters.
- **Visual baselines.** 78 new (123 in all, `tests/e2e/visual.spec.ts`), each reviewed: event card, inbox (week 4), profile, sponsor call, week end banner and its report step, the report's first page, at 1440, 1024 and 834 in the three themes; the end screen at 834; `/group` and `/author` at 1440 and 834. Dates are fixed with Playwright's clock and the session clock is masked.
- **Lint:** 32 warnings to 0. Fixed: refs synced in layout effects (`App`, `useSpeech`, `useLiveSession`), state adjusted while rendering instead of in effects (the style setting summary's focus, a new period's reset, the author chat's framework), launch clients made once in `main.tsx`, an unused directive. Kept with a reason beside each: speech results arriving from the speech controller (an external store) in `EngineEnd`, `EngineLive` and `LiveVoiceStep`; the author chat's first question on mount; announcing an outcome when focus cannot move; the props of `App` and the tablet board that carry handlers reading refs when called; one story.
- **US spelling** in lens, author and report copy: Harmonizer, practice, recognize, modeling, Mobilizing change, Talent utilization, judgment, behavior; the sample storyline and tests follow. Contract field names keep their spelling (`organisation`, `behaviours`), and the design fixture in `src/data` keeps the prototype's text so parity holds.
- **Flaky tests.** The board's inbox test clears the outcome and event cards (which take focus as they come) before opening the inbox; the pause tests read the held clock and the held line after a tick or word already on its way.
- **Handoff.** `docs/HANDOFF.md` for the server and GenieKreator teams, and `docs/schemas/*.json`, JSON Schemas generated from the Zod contracts (`npm run schemas`; a unit test fails when they drift).

**D79. Bundle budget raised to 250 KB.** Decided 2026-10-07 (product owner), with M8 approved. The participant's initial JS budget (`scripts/budget.ts`) goes from 200 KB to 250 KB gzipped, to leave room for the interface work that follows. It was 199.7 KB at M8. The Web Vitals budgets (D78) are unchanged, so new first load code still has to keep LCP and TBT within them.

**D80. UI improvements: the design canvas becomes the visual source.** Decided 2026-10-07 (product owner chose to apply the canvas, all areas).
- The approved canvas (`docs/design/canvas/`) replaces the original handoff design as the visual source for every screen: Night Studio (dark) for play, Paper (editorial light) for the reports, the canvas palette, Manrope with Newsreader, and the canvas layouts.
- Order: foundations first (tokens, type, Paper theme, shared components), then four areas in parallel (board and actions; conversations; onboarding, style setting and week end; end screen and reports, individual and group).
- The parity check against the original 60 frames is retired as screens move to the canvas; Playwright baselines, reviewed image by image, take over. Behaviour, copy rules, accessibility, the client theme loader (D72), the lens (D71) and the budgets (D78, D79) still hold.

**D81. The reference server.** Decided 2026-10-07 (product owner: build every remaining aspect so an engineer only configures it). Built in `server/`; details in `docs/SERVER.md`.
- **Framework: Hono** on `@hono/node-server`, over Fastify: web standard `Request` and `Response` (the same types as the app's adapters, so tests call the app without a socket), built in SSE, cookies, CORS, secure headers, request ids, compression and HS256 JWT. Each route is declared once with the app's own Zod schemas, which validate every request and generate `/openapi.json`. TypeScript runs under tsx, so the server imports `src/` (engine, contracts, report builders, author drafter, theme schema) and loads `ai/` dynamically; nothing is copied.
- **Engine, authoritative.** A run is a seed, a storyline snapshot and an append only event log of intents and assessor reviews, each with the model answers it used, so replays are exact and never call a model. Live engines sit in an LRU cache and are rebuilt by replay anywhere; intents on a run apply one at a time; a refused or failed intent changes nothing; the event sequence number guards against two writers. One additive engine seam, `Engine.records()`, gives assessors the conversation records `review` takes.
- **Paths** are the app's proposals under base prefixes: `/engine`, `/api`, `/speech`, `/genie` (`.env.server`, `npm run build:server-app`); plus start a new attempt, assessor review, storylines (drafts and published versions), themes, cohorts, benchmarks, privacy export and deletion, retention, `/launch`, `/auth`, health and readiness. The prototype board's writes answer 501.
- **Auth:** a signed launch link (HS256 JWT with `LAUNCH_SECRET`: participant, name, email, cohort, storyline, purpose, theme, locale, roles, attempt, expiry) opens a server side session in an HTTP only cookie; roles participant, assessor, cohort admin, author, cohort scoped; bearer launch tokens for machines; `ADMIN_TOKEN` for operators. LTI 1.3 and SSO are an `IdentityProvider` seam, documented, not built.
- **Storage:** one `Repository` over SQLite (`node:sqlite`, the zero config default) and Postgres (`DATABASE_URL`), shared SQL, append only migrations; runs, events, summaries, reviews, cohorts, storylines, themes, benchmarks, the email log, sessions and a PDF cache.
- **Reports:** group report, history, leaderboard (from stored scores, not the browser's) and benchmarks (`summarizeBenchmark` over every stored run per lens, refreshed on a schedule or on demand; the cached sample until `BENCHMARK_MIN_RUNS`). The PDF is the app's own print view at the new lazy route `/report/print`, printed by headless Chromium and cached per run version; the email goes over SMTP with the PDF attached, logged and capped.
- **AI** through ports that are the engine's own `NpcModel` and `Evaluator`, plus `AuthorDrafter` and `Transcriber`; `AI_PROVIDER=mock` (the default without a key) uses the engine's stand ins; `anthropic` loads `ai/` with its own `configFromEnv`; HTTP speech via `ai/`'s transcriber. A configured provider that is missing stops the server at startup. NPC words stream after the line is decided (`docs/AI.md` option 1): streaming as the model writes needs a contract change, listed in `docs/SERVER.md` 15.
- **Ops:** config only from the environment (`.env.example` documents every variable; a test checks it), JSON logs with request ids, health and readiness, rate limits on model calls, emails and launches, CORS, CSP and security headers, an origin check against cross site requests, a multi stage `Dockerfile` with Chromium, `docker-compose.yml` with Postgres and fake mail profiles, `npm run dev:full`.
- **Bundle:** the print route is a lazy chunk; the first load is 199.8 KB of 250 KB (199.7 KB before). Gate on this branch: typecheck (app, node, ai, server) and lint clean, 660 unit tests, 64 server tests (one skipped: rollback on pg-mem), 304 app E2E unchanged, 3 server E2E.

**D82. The AI layer.** Decided 2026-10-07 (product owner: build every remaining aspect so an engineer only configures it). Built in a top level `ai/` package the server loads; nothing in it reaches the participant bundle (a test fails if `src/` imports it). Details: `docs/AI.md`.
- **Interfaces** extend the engine's (`NpcModel`, `Evaluator`) and the author chat's shapes (`AuthorDrafter`), plus a server side `Transcriber`. Factories `createNpcModel`, `createEvaluator`, `createAuthorDrafter`, `createTranscriber` take `provider: 'mock' | 'anthropic'` (speech: `mock | http`) and a config object; `configFromEnv` is the recommended mapping (`ANTHROPIC_API_KEY`, `AI_MODEL_NPC`, `AI_MODEL_EVALUATOR`, `AI_MODEL_AUTHOR`, `SPEECH_URL`, `SPEECH_KEY` and tuning variables). Model ids appear only as configuration defaults.
- **Anthropic implementations** use the official SDK: every call streams, effort per role (NPC low, evaluator and author high), timeouts and retries per role, a cache breakpoint after the stable prefix (rules, storyline, persona, rubric), structured output with a JSON Schema then Zod, one repair retry, then the mock with a logged error. Server side refusal fallback is on by default (config).
- **The AI judges, rules decide, code verifies.** The evaluator's overall band is the engine's rule, not the model's; quotes must be verbatim in the participant's words or are dropped; a band above Weak or a red flag without a verified quote does not stand; the model never sees whether the words were spoken. The NPC's reveal and sign off are proposals that rules confirm; every NPC sentence passes out of role, scoring and leak checks and the copy rules before it is shown. The author drafter keeps the question policy, the lens precedence and the template's mechanics as rules, grounds framework extraction in the text, and returns the templates draft when copy fails the schema or the copy guard after a repair.
- **Prompts** are versioned files in `ai/prompts/`; the version (with a text hash) is recorded on every evaluation's audit record and NPC reply.
- **Localization:** replies and the evaluator's reasons in the storyline's locale; content scored the same in any language.
- **Quality gates:** `npm run ai:calibrate` (85% per rubric, a starter set of 8 labelled samples per Sales Elevator live action) and `npm run ai:persona-check` (9 probes per NPC). Both pass on the mock (88 of 88, 189 of 189) and run on the real model when a key is set. Not yet run on the real model: no key in this environment.
- **Speech:** a vendor neutral HTTP adapter that speaks the browser's chunked contract to `SPEECH_URL` with `SPEECH_KEY`; other vendors need a shim.
- **Repo:** `ai/` is an npm workspace with its own `package.json`; its tests run with the root Vitest and it typechecks with `tsc -b`. Initial JS unchanged at 199.7 KB.

**D83. Engine copy as message codes, worded in the participant's language.** Decided 2026-10-07 (product owner asked for codes the client words; supersedes D60 and D66's "the server localizes"). The product owner can revisit any default below.
- **Contract.** Every sentence the engine writes is `{ code: 'engine.*', params }` (`src/engine/copy.ts`). The contract's `Text` accepts a plain string (authored or AI text), a message or an authored template, and words messages from the ICU catalog as it parses (`src/i18n/engineCopy.ts`), so components still get strings and none changed. Codes outside `engine.*` are refused. Parameters nest: messages, lists (joined with the locale's "and", "or" or commas), money (formatted in the participant's locale) and templates (authored copy whose placeholders hold engine words, such as the assessment bar in the report's about lines). The engine's logic no longer compares English labels: it checks codes (`hasCode`), and moments are de-duplicated by code and parameters.
- **What stays authored.** Event titles and bodies, trigger messages, emails, persona lines, profiles and every report narrative bank are the storyline's strings, in the storyline's language: `StorylineConfig.locale` (default `en`), sent in the view as `storyline.locale`. GenieKreator authors one storyline per language. NPC words are model output; the mock's persona lines are English only.
- **Replays.** The seeded replay hashes (`src/engine/sim/replay.test.ts`) did not change: the test words the codes in English before hashing, so they also prove the English catalog reproduces, byte for byte, the text the engine wrote before. Calibration is unchanged (`--check`: passive 57%, random 62%, good 112% of target).
- **Locales.** `?locale=` on the launch sets the language, the page's `lang` and `dir`, and the locale numbers, dates and money format in. With no `?locale=`, English copy and the storyline's own money locale (lakh grouping stays for `en-IN`). A language's catalog may leave keys out; they fall back to English one by one. Shipped: `es`, a skeleton (the HUD, time, settings, the inbox, the outcome, the palette, the small screen notice, the offline banner, and the whole engine catalog), loaded on demand. Pseudo locales, built from English at run time: `en-XA` (accented, a third longer, in brackets: overflow and copy missing from the catalog show) and `ar-XB` (every message forced right to left, the page in `dir="rtl"`).
- **Right to left.** 109 physical utilities became logical ones (`ps`, `pe`, `ms`, `me`, `start`, `end`, `text-start`, `text-end`, `rounded-es` and so on), identical in left to right. Kept physical on purpose: safe area padding (it is physical), centered overlays (`left-1/2` with a translate) and the style tooltip's anchoring. Not mirrored yet: slide animations and charts.
- **Copy lint** (`src/i18n/catalog.test.ts`) covers every locale and both pseudo locales: ICU parses, no dashes, emoji or "competency" in visible text, keys only from English, arguments only from the English message, and a language's `engine.json` complete.
- **Load.** The engine catalog is not in the first load: it loads beside the first view, preloaded (D87). Server side code that needs plain text (the AI layer's prompts and history, the server's token stream of a turn) uses `wordEnglish` (`src/i18n/engineCopyEn.ts`).
- **Tests.** `tests/e2e/locale.spec.ts`: Spanish HUD and engine copy, `en-XA` without sideways scroll at 1440 and 1024, `ar-XB` right to left.

**D84. The Week 0 practice conversation.** Decided 2026-10-07 (resolves D16 with defaults; the product owner can revisit).
- After onboarding, week 1's style setting offers "Practice before week 1" (also `?practice=1` for demos and tests): a short 1:1 with a team member in the live shell, then back to style setting with one coaching tip. It is never evaluated, logged, scored or counted against the live cap, and nothing on the team moves. "Skip practice" closes the offer for the run. It is offered only before anything has happened in week 1.
- Storyline config `practice`: `enabled` (default true), `with` (a member id, default the first member), `format` (`roleplay` or `chat`), `goal`, `turnLimit` (4), `minutes` (3). Intents `startPractice` and `skipPractice`; `endInteraction` and `abandonInteraction` close it; the view says `practice.available` and `live.practice`.
- The offer is a plain card from the board's existing tokens and buttons; the canvas (D80) will design it. Story `Board/Practice offer`, `Board/Engine live/Practice`; unit tests `src/engine/sim/practice.test.ts`; E2E `tests/e2e/practice.spec.ts`.

**D85. The interview and the written plan, finished.** Decided 2026-10-07 (building D52 in the shared shell, no new visual language).
- **Interview.** The brief lists structured questions, the same for both candidates: authored per action (`live.questions`), otherwise three general ones. The candidate persona answers from the CV. Acceptance follows SIMULATION 4.3 (Strong or Adequate yes, Weak half the time, Harmful no), and the outcome now says what the decision came to: "{name} accepted the offer and joins {stage}", turned it down, no room, or "You passed on both candidates."
- **Written plan.** Submitted once with its fields (`submitPlan`: goals, measures, owner, due, support); the NPC answers with the check in, and End evaluates the fields alone, like an email: specific (goals of six words or more Strong, three Adequate), measurable (a number in the measures and a due date), involvement (an owner and the support you give). Goals, measures and owner are required; the due date must be in this period. The due date becomes a promise to check in with that person (SIMULATION 5.4). The automated players still submit text, so calibration and replays are unchanged.
- Tests: `src/engine/sim/formats.test.ts`; E2E in `tests/e2e/live.spec.ts` (structured questions, a hire that lands, passing on both, the plan's promise); stories `Board/Engine live/Written plan submitted`.

**D86. Save and resume on the client.** Decided 2026-10-07 (the server stays authoritative; the product owner can revisit).
- **Intent queue** (`src/engine/resilient.ts`): intents leave strictly in order. While the browser is offline, or a request fails on the network, they wait and go out on reconnect; a server run keeps the queue in local storage, so a reload sends what was left before it reads the view. Every intent carries an `Idempotency-Key`, the same on every retry. 5xx answers are retried three times (1, 3, 8 seconds), refusals are reported at once. TanStack Query's own offline pause is off (`networkMode: 'always'`), so the queue is the one place that decides.
- **Offline banner** (`src/components/shell/ConnectionBanner.tsx`): a status region that says "You are offline. 1 action is saved here and goes out when you reconnect." or "Reconnecting.", in the existing notice style.
- **Remembered run:** the launch's participant id is kept, so a reload without the launch link resumes the same run.
- **Drafts and the unload guard** (`src/components/board/liveDraft.ts`): what is written in a live conversation and not sent (reply, email, sponsor notes, plan, interview notes) is kept in session storage per interaction and comes back after a reload; leaving the page asks first while there are unsent words or a conversation under way.
- Tests: `src/engine/resilient.test.ts`, `tests/e2e/resume.spec.ts` (offline mid run on the mock, the unload prompt).

**D87. Performance: lighter first load, split first renders.** Decided 2026-10-07.
- **First load:** Zod and every schema left it: the engine client loads the contract beside the first request, the SSE reader with the first stream, and the transcription client checks its two response shapes by hand. The engine catalog loads the same way. Both are `modulepreload`ed (a small Vite plugin), so they download with the first load but are not compiled into its long task. Initial JS (preloads counted) 199.7 KB before this work, 205.6 KB with the engine catalog (D83), now 209.7 KB (preloads counted; 174.4 KB of it is the code the first load compiles).
- **Early first view:** `index.html` asks for the first view in an inline script before the app's code has downloaded (server runs only), and `main.tsx` starts the team's portraits as soon as the code runs. Preloading portraits from the head was tried and dropped: on this network it only slowed the code.
- **Split renders:** the board's first render runs in a transition (React builds it in slices that yield), and the actions panel and inbox rail build in their own render after the first paint (`Deferred`, `src/lib/useAfterPaint.ts`). The group report renders its cover and first sections at once and the rest after the first paint (print renders everything).
- **Numbers** (medians of 3, same machine and settings, LCP / CLS / TBT / INP / transfer): first load 2436 ms, 0.002, 166 ms, 353 KB before, 2364 ms, 0.002, 185 ms, 364 KB after; board 2764 ms, 0, 353 ms, INP 152 ms, 384 KB before, 2804 ms, 0, 309 ms, INP 144 ms, 396 KB after; report (click to title) 1104 ms, 0, 136 ms, 46 KB before, 1133 ms, 0, 188 ms, 46 KB after; group report 2576 ms, 0.007, 401 ms, 386 KB before, 2728 ms, 0.007, 252 ms, 398 KB after. Board TBT measured 228 to 309 ms over the runs here. Transfer grew by the engine catalog and the Spanish and pseudo locales' loaders. LCP moved within run to run noise (about 150 ms). The report's TBT varies between 90 and 190 ms run to run.
- **Budgets:** board TBT 600 to 400 ms, group report TBT 600 to 300 ms. LCP stays 3 s for both: the first load's bytes alone take about 2 s on this network and the board's largest paint is a portrait after them. No budget was loosened. `npm run vitals -- --page board` measures one page.

**D88. The open decisions, decided with defaults.** Decided 2026-10-07 (product owner: decide with sensible, documented defaults; each can be revisited).
- **D9 minus signs:** as proposed and as built: the lint fails on hyphen-minus and every Unicode dash; numbers use U+2212, and every formatter (catalog, deltas, money, engine copy) swaps Intl's hyphen for it.
- **D12 HUD week label:** the HUD keeps the design's "Week 2 · Day 3" on screen, and screen readers hear the spec's "Week 2 of 8, Day 3". The canvas (D80) settles the visible label.
- **D15 breakpoints:** settled by D69 and D73: 1440 is the design, 1024 to 1279 folds the actions panel, 744 to 1023 portrait uses the tablet layouts, narrower shows the notice. Every engine screen has Playwright baselines at 1440, 1024 and 834; no more frames are needed until the canvas.
- **D16 Week 0 practice:** built, D84.
- **D23 command palette:** the board behind it is `inert` while it is open (no focus, no clicks, hidden from screen readers), keeping the non modal Radix dialog and its pixels. Checked with axe in `tests/e2e/board.spec.ts`.
- **D30 trust rules, D33 weekly style values, D35 live interactions on 1.0's maths, D37 thoughtless play:** each was already implemented as proposed (SIMULATION 3, 4.4, 5.2 and 9) and is now Decided. Calibration `--check` passes unchanged for Sales Elevator: passive 57%, random 62%, good 112% of target, good play Platinum in 60 of 60 runs. The levers stay config (`trustRules`, `weeklyStyle`, the effect tables).
- **D61 leftovers:** the mic test and the resume recap were built in D68; the rest of D61 was closed in D68 and D78.
- **E2E port:** the gate asks for `E2E_PORT=5741`; the server's tests held that port during this work, so the runs here used 5747. The suite is the same on any port.

## The original flow gaps and viewport fit (7 Oct)

The product owner asked for every gap in `docs/ORIGINAL-FLOW-GAPS.md` except Help and Support, in the current visual language (D80: no restyle, existing tokens and components), and for the participant app and /author to fit the window at every laptop and tablet size. Each decision below can be revisited.

**D89. The in play menu, Exit and full screen; Help, Support and Logout dropped.** Decided 2026-10-07 (lifts D38's hidden menu).
- **Menu** (`src/components/hud/GameMenu.tsx`): a Menu button in the HUD opens a disclosure list (not an ARIA menu: plain buttons, Tab and Escape) with Objectives, Tutorial and video, History, Results and stages, Leaderboard (only when the cohort leaderboard is on, D69's setting), About these actions, Guided tour, Settings, Full screen and Exit (when the launch gives a return address). Each item opens a panel in one shell (`src/components/panels/PanelShell.tsx`, a Radix dialog with tabs where a panel has them); the session clock pauses while a panel is open. The panels load on demand (`PlayPanels.tsx`), so the first load does not grow.
- **Full screen** asks the browser (`requestFullscreen`), the item reads "Leave full screen" while it is on, and a refusal shows a toast.
- **Exit** asks first (the same dialog look as Pause), saves nothing new (every intent is already saved, D86) and goes to the launch's return address: the signed launch claim `exit` (an http or https URL), returned by `GET /api/profile` as `exit`, `?exit=` on the mock. Exit is in the menu only when the launch gives that address; without one there is nowhere to return to, and Pause already saves.
- **Dropped by the product owner:** Help and Support (the form and the Help panel), and the Logout menu. The launch owns sign in; the session timed out dialog stays.

**D90. Objectives, Tutorial and the video during play.** Decided 2026-10-07.
- **Objectives** rereads the targets (the Your targets tab) and the sponsor's letter, with each stage's info (D97).
- **Tutorial and video** has three tabs: Video (the storyline's welcome video, with captions), Transcript (the storyline's transcript paragraphs, also the accessible alternative to the video) and How to lead (the lens's styles with worked examples, D91), plus Replay the guided tour.
- **Config:** `StorylineConfig.video` `{ src?, poster?, captions?, transcript: Copy[] }`, sent in the view as `storyline.video`. Onboarding's sponsor step plays the same video. Without a video the Video tab is left out and the Transcript tab holds the words. Sales Elevator sets none (D54); `?video=1` on the mock plays a 4 KB sample with captions (`public/assets/video/sample-welcome.*`) for stories and tests.

**D91. Worked examples for the lens.** Decided 2026-10-07.
- 1.0's transcript taught its model with examples. A lens may author `examples: [{ need, person, style, why }]` (validated: the style must be one of the lens's); without them the view builds one example per style from its archetype: the need it suits, a person described by that need and a sentence on why (engine copy `engine.example.*`, worded per locale). The default lens (Readiness Based) authors four (Tom, Asha, Ravi, Mei). The view sends `lens.examples`, not the fit table, so the scoring table stays on the server.

**D92. The demo round, and how it relates to the Week 0 practice.** Decided 2026-10-07 (the product owner asked for both to be weighed).
- **What it is.** After onboarding, "Try the demo first?" offers a guided, unscored demo of the board: set a style for one person (the others are set), confirm, select a person, take an action, read the impact, then "You are ready" and Play simulation. A coachmark leads each step with "Show me"; Exit demo asks first ("You cannot come back to the demo once you leave it") and is always in the banner. It takes about three minutes and can be played once.
- **It never touches the real run.** The demo runs on its own engine: the mock makes a separate in memory engine; the server serves `GET /engine/sessions/{session}/demo/view`, `POST .../demo/intents` and `DELETE .../demo` on an in memory engine with a fixed seed (7), never written to the database or the event log. Only `confirmStyles`, `openProfile`, `planAction`, `clearOutcome` and `dismissCard` are allowed, and `planAction` only for instant actions (`src/engine/demo.ts`); anything else is refused with `notInDemo`.
- **Relation to D84.** The demo teaches the board (styles, actions, impact) with instant decisions; the Week 0 practice teaches a conversation. They are complementary, so both are kept: the demo is offered first, after onboarding; the practice offer then sits on week 1's style setting as before. Live actions in the demo say "Conversations are practiced before week 1, not in the demo." 1.0's demo was a full scored week; ours is shorter and unscored because the real week 1 already starts gently.
- **Config:** `demo: { enabled (default true), with (a member id, default the first member), action (an instant member action, default the first) }`, validated against the storyline; the view says `guide.demo`. `?start=demo` opens it directly.

**D93. Progress milestones.** Decided 2026-10-07.
- The engine records a milestone when revenue passes 25, 50, 75 and 100% of the run's target and when a stage's output so far reaches half and all of its ideal output for the whole run (1.0's module completion) (`milestones: { target, stages }` in config, those defaults). Each is sent once in the view (`milestones`), with the period it was reached in, and the board shows it as a notice under the KPI strip (no confetti, no big numbers: D80 and the spec's fixes table), with Leaderboard when the cohort board is on. Celebration settings and reduced motion apply.
- Recording milestones does not change the simulation: replay hashes and calibration are unchanged.

**D94. The guided tours.** Decided 2026-10-07.
- Three tours in 1.0's tip order, worded for 2.0 and for the storyline's lens and clock words (`src/components/tour/steps.ts`): the board (Objectives and Tutorial in the menu, Tick tock, Time to act, Your session, Team areas, Know your team member, Notifications, Team performance, Module progress, Results and stages, Actions, Action duration, End of the week), a short one on style setting (the lens's styles, choose, reason, confirm) and one on the live screen (brief, speak or type, hints, end). A step whose element is not on screen is skipped.
- **When.** Each tour starts by itself the first time its area shows (not over a dialog, not in the demo), once per participant; Skip tour ends it, "Do not show tips again" turns every tour and tip off, and Guided tour in the menu (or Replay in Tutorial) replays the board's tour at any time. Kept in local storage (`ilead.guide`), per participant.
- **Access.** The tip is a non modal dialog that takes focus when it opens and on each step, is read by screen readers ("Board tour · 3 of 13"), keeps its buttons 44 pixels on touch, and Escape ends the tour. The target is ringed and the rest dimmed; the page behind is inert while the tip shows. Reduced motion skips the movement.
- **Config:** `tour: { enabled (default true), steps: { "<area>.<step>": { title?, body? } } }` rewords any step. The session clock pauses during a tour.
- The E2E suites start with tours off (`GUIDE_OFF` in `playwright.config.ts`); `tests/e2e/guide.spec.ts` starts with no storage, as a first run does.

**D95. Team wide History.** Decided 2026-10-07.
- The History panel lists the run week by week, newest first: each action, who it involved and each person's skill, morale and result change with its reasons (the outcome's See why lines). Filters by person and by action. Opened from the menu and from View history on the outcome panel (filtered to that outcome's people).
- The engine's log entries carry the action key (`LogEntry.action`) so History can name and filter them. The replay test's digest strips that label before hashing, so the seeded hashes are unchanged; it is a label, not a rule.

**D96. Result and stage overviews during play, and the result trend.** Decided 2026-10-07.
- **Results and stages** (a button on the board's stage header row, and in the menu): a Results tab (each person's result week by week with the team average, from the people revealed) and a Stages tab (each stage this week and so far against its ideal). Every chart has a table version.
- **Result trend** in the profile: a small line of the person's result by week (from the view's `trends`, only for people whose profile has been opened, D39), with Show as table.

**D97. Stage info, the actions list and optional profile fields.** Decided 2026-10-07.
- **Stage info:** stages may author `about` and `suits` (which skills suit the stage); each stage header has an info button with a popover, and Objectives lists them. Sales Elevator authors all five (in `scripts/storyline/import_ilead1.py` and the storyline file).
- **About these actions:** an info button on the Actions panel (and the menu) opens every action with its description, cost, cooldown and the week it unlocks (the view now sends `cooldown` and `unlockPeriod`).
- **Profile fields:** `attitude`, `awareness` and `responsibilities` are optional on a person's profile; the profile shows the rows that are set.

**D98. Stepping through replies.** Decided 2026-10-07.
- When an outcome has replies from more than one person, the outcome panel steps through them ("Reply 1 of 2", Previous and Next), each with that person's face and line; the changes stay listed below. One reply shows as before.

**D99. Tips at key moments.** Decided 2026-10-07.
- One time tips in the board's notice area, from the view: Hire unlocks (when Hire's unlock week arrives), no days left in the period (end the week), and a seat is open (a stage below its ideal after someone leaves, pointing at Hire, 1.0's vacant seat prompt). Each shows once per participant and is dismissed with Got it. "Do not show tips again" (D94) turns them off.

**D100. The server honors the client's Idempotency-Key.** Decided 2026-10-07 (completes D86 on the server).
- `POST /engine/sessions/{session}/intents` reads `Idempotency-Key` (1 to 200 characters, otherwise 400 `badIdempotencyKey`). The first time a key is seen the intent runs and its result is stored with the event (`intent_keys`, migration 2, keyed by run and key); the same key again returns the stored result without running the intent again. CORS allows the header. Deleting a run deletes its keys. Tests in `server/test/engine.test.ts`.

**D101. Play screens fit the window.** Decided 2026-10-07 (the product owner's laptop is 1513 by 745 at DPR 2; style setting scrolled).
- **Approach.** The play screens (style setting, the board, the live shell, event cards, the sponsor call, the week end) take the window's height (`h-dvh`, `overflow: hidden` on their main, only while they show) and never scroll the page. What can grow scrolls in its own region with a visible fade and keyboard access (`ScrollArea`: a focusable region only when it overflows): the team on the board (sideways too when narrow, each card at least 38 spacing units wide), the style cards, the actions panel, panels and the inbox. Primary actions sit outside those regions.
- **Density steps** by height, not width: two Tailwind variants, `short` (900 pixels tall or less) and `shorter` (780 or less), tighten paddings, gaps, the KPI tiles, the HUD and the outcome band (which also caps its height), and use compact portraits (the face kept in frame with a new token). Nothing changes above 900 pixels tall, so the designed 1440 by 1000 board is as before.
- **Primary actions never scroll away.** The action drawer's details scroll while its summary and Confirm (with the cost) stay pinned below them. The sponsor briefing's avatar shrinks on short windows so the reply bar stays in view. On upright tablets the HUD's Menu button shows its icon only (the word stays for screen readers), and the HUD wraps to a second row when it cannot fit one (a client logo at 744 or 768), so End week is never cut off.
- **Onboarding** fits every size: tighter padding on short windows, and on tablets the team step stacks the cards over the profile instead of squeezing two columns.
- **Documents** (the week end report, the end screen, the report, the group report) scroll as pages: the report's toolbar sticks to the top, the week end's Continue and the end screen's report actions to the bottom, and the end screen keeps a readable width (a new `end.max-width` token; the reports already had one). The app's root now clips with `overflow: clip` instead of `hidden`, which had stopped sticky positioning from working. The week end banner fits as a play screen.
- **200% text** keeps page scroll: at 200% the fit is released (`text-large`), so nothing is cut off.
- **Checked by** `tests/e2e/viewport.spec.ts`: every state at every target size (laptops 1280 by 720 to 2560 by 1440, tablets 1024 by 768, 1180 by 820, 834 by 1194, 768 by 1024, 744 by 1133): no sideways scroll, no page scroll on play screens, the state's primary actions on screen, no clipped labels; with visual baselines at 1513 by 745 and 1366 by 768.
- **Results:** every state passes at all 13 sizes (64 tests: onboarding and the demo, style setting, the board with and without the outcome, the drawer, the inbox, the profile, the menu and each panel, the sponsor call, the event card, the week end and its report, the 1:1, email, chat, team meeting, written plan, sponsor briefing and interviews, the end screen, the report, the group report, and /author's chat, client framework, lens picker, preview and locked draft). The /author steps after the questions have no composer; their action sits in the chat pane and is checked after scrolling within that pane.
- **Bundle and vitals.** The new panels, tours and demo load on demand. Splitting them out had made the bundler put modules the first load shares with them into many small chunks (initial JS 220.1 KB and LCP over budget on the first load and the board); grouping every statically imported module into one first load chunk (`codeSplitting` group on `$initial` in `vite.config.ts`) brought initial JS to 214.3 KB (209.7 KB before this work) and every vitals budget back: first load LCP 2432 ms, TBT 255 ms, 368 KB; board LCP 2872 ms, TBT 367 ms, INP 136 ms, 400 KB; report LCP 1136 ms; group report LCP 2732 ms, TBT 280 ms, 401 KB. Vitals now measure as a returning participant with tours off.

**D102. /author fits the window.** Decided 2026-10-07.
- The author page takes the window's height. Two panes from 1180 pixels wide (the chat with the steps after the questions, and the summary), each scrolling on its own; the composer is always at the bottom of the chat pane. Below 1180, one column with the summary as a collapsible section above the chat (its region capped at 40% of the height). The chat scrolls to the newest message, the lens step, the preview and the locked draft as each appears.

**D103. Not built: the org chart.** Decided 2026-10-07.
- 1.0's org chart note (You, a peer team lead and the COO) is a cast proposal for a new storyline, not a screen. Our board groups people by stage. Decide with the next storyline whether a "You" node or reporting lines belong on the board; it would be a design change for the canvas (D80).

## Lens styles and the authoring tool (7 Oct)

**D104. Every lens has 4 or 5 styles; Six Leadership Styles plays five.** Decided 2026-10-07 (product owner). Changes D70 and D71's "2 to 6 styles".
- **Rule.** The engine's lens schema takes 4 or 5 styles (`MIN_STYLES`, `MAX_STYLES` in `src/engine/lens.ts`) and refuses anything else with "A lens has 4 or 5 styles" at `lens.styles`. Every lens in the library and every fixture complies: Readiness Based 4, Six Leadership Styles 5, Inspire and Deliver 5, Servant 5, Five Leadership Practices 5, Adaptive 4, Team Amplifier 5; the Client Leadership Model plays on the readiness styles (4).
- **Six Leadership Styles.** Pacesetting and Commanding are one style, Drive (key `drive`, letter DR): "You set a high bar and take charge when speed matters." Its fit: a fit for people new and unsure (where Commanding fitted), a partial miss for the eager and for the ready (Pacesetting's high bar stretches them, orders do not), a clear miss for the capable but drained. Every need keeps a fitting style (Drive, Coach, Harmonizer or Collaborator, Vision Setter). Readiness Based option tags map D to Drive. Its narrative: "You lean on Drive. It steadies a crisis and speeds the work, and wears people down when there is none." The scoring dimension Team Climate now reads "Repeated Drive outside crisis events lowers Team Climate". The lens keeps its library title and id (`six_styles`), which name the source model; the product owner can rename the title.
- **Inspire and Deliver** had six styles: individual attention and outcome based recognition are one style, Personal Attention ("You give time to the person and name what they achieved"); both shared the same need.
- **Renamable styles.** A style's `key` is stable and is what actions, fit tables, narratives, runs and benchmarks refer to; its `letter` (1 or 2 characters, unique), `name`, `short` and `description` are the author's to change per lens. So a rename reaches the style controls, the action tags, the report and the drafts. A report line that names a style writes `{style}` (`report.narratives.dominant`), which the report fills with the style's current name; the default narratives and the drafter's use it.
- **Checks.** Unit tests (`src/engine/lens.test.ts`: 3 and 6 styles refused with the message), the group and summary tests for five styles, server tests. `npm run calibrate -- sales-elevator --check` is unchanged (passive 57%, random 62%, good 112%, good play Platinum 60 of 60); the new `--lens six_styles` measures the same storyline on the five style lens: passive 58%, random 60%, good 106%, good play Platinum 55 and Gold 5 of 60, every band passes. The cached six styles benchmark (`npm run benchmark`) and the JSON Schemas (`npm run schemas`) were regenerated. E2E: the lens, report and group specs expect five styles and Drive.

**D105. /author rebuilt to the approved canvas.** Decided 2026-10-07 (product owner: build the GenieKreator canvas in docs/design/genie). Supersedes D74's chat page and D102's layout for /author.
- **What it is.** The journey (the co-creator chat, voice answers, the lens recommendation, First draft ready) and the workspace (Overview, Brief, Story and world, Work process, Team, Leadership lens, Actions and conversations, Events, Scoring and report, Brand and theme, Test with synthetic players, Review and publish), with Ask Kora beside the tabs, and the library admin page. Routes: `/author`, `/author/workspace/<tab>`, `/author/library` (`src/author/ui/route.ts`); main.tsx sends every /author path to the lazy chunk, and index.html's early first view skips them.
- **One typed draft.** `src/author/model/draft.ts` is a Zod schema for the whole draft: the chat, the brief, story, process, team, lens, actions, events, scoring, brand, publish, provenance marks and Kora's suggestions. The store (`model/store.ts`, zustand) keeps it in local storage under `ilead.author.workspace`, parsed back with the schema; storage that is missing, full or blocked never throws: the draft stays in memory and the header says "Not saved: this browser blocks storage". A stored draft that does not parse starts a fresh chat.
- **Offline drafter.** `seedDraft` (model/seed.ts) fills the draft from the chat with no model: the existing mock drafter's storyline (D73, Sales Elevator's calibrated mechanics) plus small deterministic tables (headquarters, selling points, voices, sample answers), so the same answers give the same draft. `toStoryline` (model/export.ts) drafts the mechanics again from the brief and the lens and lays every author field over them; the result is checked with the engine's StorylineConfig and the copy guard. "Play a week" and "Preview week 1 as a participant" leave it under DRAFT_KEY for the participant mock, as before.
- **Provenance, no review step.** Every author facing field has a path and a mark: AI (Kora wrote it), You, or Edited (Kora wrote it and the author changed it). "Needs you" is computed (model/needs.ts): a required field still empty, the scoring samples, an unconfirmed framework. Suggestion is Kora's dashed idea, applied only when the author uses it. There is no "Mark reviewed": an edit marks the field Edited and the checks rerun. Words and marks carry status as well as color.
- **Look.** The canvas's light palette as author tokens (`tokens/primitive/author.json`, `tokens/semantic/author.json`, Tailwind `*-author-*`), contrast checked by the token build. /author is light only and is not themed by a client; `?theme=` and `?client=` no longer apply to it (the Brand and theme tab configures the participant theme). The copilot is "Ask Kora" everywhere.
- **Fit.** Laptops from 1280 by 720 to 2560 by 1440 and tablets down to 1024 by 768 and 834 wide (no phones): the page never scrolls; the chat, the panel, the nav, each tab and Ask Kora scroll in their own regions; the composer, the header's Play a week and Review and publish, and each dialog's footer stay in view. From 1280 three columns; 1024 to 1279 the nav and the tab, Ask Kora as a panel over the tab; below 1024 the sections are a row of links above the tab. Checked in `tests/e2e/viewport.spec.ts` (every state at every size) with baselines at 1513 by 745 and 1366 by 768.
- **Bundle.** /author stays out of the participant's first load (lazy, each tab its own chunk): initial JS 214.6 KB of 250 (214.3 before). Vitals after (`npm run vitals`, medians of 3): first load LCP 2468 ms, CLS 0.002, TBT 241 ms, 372 KB; board LCP 2868 ms, TBT 336 ms, INP 136 ms, 404 KB; report 1075 ms; group report LCP 2756 ms, TBT 240 ms, 405 KB. All within budget.

**D106. The co-creator chat and voice answers.** Decided 2026-10-07.
- The question policy, recommendation and drafter are the existing ones (questions.ts, recommend.ts, drafter.ts with the server when `VITE_GENIE_URL` is set). After the challenge, Kora says what it took from the answers (the stage count, the pressure point, the events) with See it in the draft and Change this. "Your simulation so far" fills as the author answers: the brief as You, company, sponsor and stages as AI, the deal value as Needs you, the team after the team size, the lens's styles once recommended.
- **Voice.** The mic records the author's answer with the participant app's client adapter: the browser's MediaRecorder streams chunks to the speech server's transcription endpoints, where `createTranscriber` from `ai/` turns them into text (docs/SPEECH.md, docs/AI.md 7). Base URL `VITE_GENIE_SPEECH_URL`, else `VITE_ILEAD_SPEECH_URL`. With neither, an offline mock says a plausible answer to the question asked (`src/author/voice.ts`). The click is the consent (the author records their own answer). While recording: the time, a waveform, the live transcript, Cancel and Stop and review, up to two minutes. When it stops, the words land in the answer box marked "Transcribed from your recording", to edit before Send; nothing is sent until Send. The canvas's "Play back" is left out: no audio is kept (SPEECH.md), only text.
- The lens step shows the recommendation with why, two alternatives, all eight on request, the client framework's skills when that lens is chosen, and the "works well with" lens as an optional second lens. Choosing a lens drafts everything and opens First draft ready, whose preview plays week 1 with placeholders for what still needs the author.

**D107. Ask Kora, offline.** Decided 2026-10-07.
- The panel beside each tab holds Kora's suggestions for that tab (dashed; Use or Not now) and plain instructions. Every instruction comes back as a proposed change, the current words struck through, with Apply, Try again and Discard; applied changes are marked AI. With no model, rules read the instruction (`model/kora.ts`): a character's name changes their persona (or hidden concern), "the sponsor" the welcome letter, "shorten" or "Lite" the run length, "add a remote team member" a new character, anything else the tab's main text. A server replaces the rules with the model behind the same panel.
- "Regenerate this tab" redrafts the tab and replaces only what is still Kora's; what the author wrote or edited stays.

**D108. The action library.** Decided 2026-10-07.
- Five core actions are always included (Meet the team, Meet face to face, Coach member, Give feedback, Set goals); the others have switches (Let go starts off). Each action plays as a static decision, a live AI conversation, or a decision then a conversation; only style based rules may switch between them, the others keep their rule's way (the segment says so).
- A conversation's impact by style has one row per lens style, so renames and a fifth style show at once; the cells are text ("Skill +4, result +3") and are read back into the options' effects on export. A static decision lists its options with style, days away and effects.
- Add an action: a template from the library (`model/library.ts`: Sales Elevator's thirteen and ten more, each playing with an engine action's tested rules), or "Describe your own", which Kora sets up (by rule offline) and the author adds, edits first, or saves to their library in this browser. Library admin lists the interaction types and templates and registers a new type as beta; offline that is in memory only.

**D109. Characters: every field.** Decided 2026-10-07.
- The editor has Identity (photo from the portrait library or an upload, names, gender, pronouns, age range, job title, stage), Voice (voice, language, accent, pace, warmth, formality, reply length), Personality (persona, hidden concern and what they say when it comes out, communication styles, motivation, reaction to each lens style, relationships, topics they will not discuss) and Starting stats (skill, morale, result, trust in you, with the need and the style it calls for as you move them, best stage, experience, tenure, previous company, career goal, what the participant is shown, custom fields). Changes stay in the dialog until Save changes, which marks what changed.
- What the engine reads today: name, title, pronoun, stage, starting stats (trust included), persona (remarks), hidden concern and its line, career goal, experience, tenure and previous company when shown, communication styles (attitude), relationships, portrait and voice id. The rest (voice sliders, motivation, reactions, topics, age, custom fields) is kept in the draft for the AI character on the server; the StorylineConfig has no fields for it yet (open item).

**D110. Scoring and report, events, brand.** Decided 2026-10-07.
- Purpose (development or assessment) is the storyline's purpose. Skills come from the lens, or from the author's own framework: upload, check what Kora found (every row cites its page; a skill without behaviors needs the author; nothing invented), confirm; confirmed skills replace the report's skills on export and the sample answers come back. Offline only text files are read; a PDF needs the server.
- Six sample answers from a core conversation, each with GenieKreator's band; the author agrees or picks another. Publishing needs all six answered and 85% agreement.
- Events: cards across the weeks by kind (Impact, Opportunity, People, Sponsor); drag a card to another week or pick its week and day in the editor (the keyboard way); random and conditional events are listed apart. Lead flow is kept in the draft but has no engine field yet.
- Brand and theme: KNOLSKAPE default or the client's brand; colors are checked as the theme loader would (D72); the preview shows the board and the report cover.

**D111. Test with synthetic players and Review and publish.** Decided 2026-10-07.
- The Test with synthetic players tab renders `CalibrateSlot` from `src/author/calibrate/index.ts` when that module exists (found with Vite's glob, loaded lazily), otherwise a coming soon panel. Its props: `{ draft, exported: { storyline, issues, copy }, onResult({ passed, summary }) }`; the result is stored on the draft and shown in Review and publish. The calibration feature is built separately and wired at merge.
- Review and publish runs every check on the draft as it is: blocking (everything required filled, the simulation plays, scoring matches the author's judgment, copy rules) and advisory (synthetic players, characters stay in role, which the server runs on publish, and play it yourself). Publish needs the blocking checks; offline it records the version and offers the configuration to download.

## Synthetic players for GenieKreator (7 Oct)

Details: `docs/CALIBRATION-SYNTHETIC.md`.

**D112. Synthetic players are engine policies at four levels, and speak through one interface.** Decided 2026-10-07.
- Beginner (low performer), Developing (average), Proficient (high) and Expert (exceptional) are policies in `src/engine/sim/synthetic.ts` over the participant's view and intents, never hidden state, like the calibration policies (SIMULATION 9). Each is a set of traits (diagnose, one default style, adapt, answer events, focus, fit the action to the need, keep promises, use spare days well or waste them, lines per conversation, polish, slip), drawn from a seeded stream: playthroughs differ between seeds and replay exactly for one.
- Styles, needs and actions are read from the storyline: the action for a need is the member conversation whose authored effects do most for it in the chosen style. Tested on four styles and on five (Six Leadership Styles without Pace Setter); nothing depends on the six style lens being merged.
- The words come from a `SyntheticSpeaker`: offline the deterministic templates (one script per level, format and style intent), with AI the `ai/` module's `createSyntheticPlayer`, which falls back to the templates. The words are scored by the run's own evaluator, so the scoring pipeline is under test, not only the mechanics. Offline, the plain parts of a line are picked so they carry no other style's cues, so the style meant is the style read.
- Every profile is opened at style setting, as a participant reading the cards would; the level decides what the player does with it. Opening a profile changes only what the view shows.

**D113. What a calibration measures, and its checks.** Decided 2026-10-07.
- Per persona: score range and average, tier, how many reach the target tier, revenue against target, the overall skill level and whether it fits the persona, conversation bands, concerns surfaced. Playthrough i of every persona plays seed + i, so the levels meet the same team and events.
- The target tier is the author's, else the second from the top (Gold), as `npm run calibrate` reads the top two. Expected skill levels are each persona's place on the rating scale, a level either side where it falls between two; a playthrough with too little evidence counts as the lowest level.
- Fail: scores do not rise with proficiency; Experts reach the target tier in under 80% of runs; Beginners in over 10%; skill ratings fit the level in under 50%; a single strategy reaches the target tier. Warn: ratings fit in under 75%; conversation ratings do not rise; neighbours within 5% of the scale; a strategy matches Proficient play; an action nobody used; Experts answered under 80% of the events that call for an answer. Each warning and failure has a suggested fix. The CLI and CI fail on failures only.

**D114. Dominant strategies are found with probes.** Decided 2026-10-07.
- Two seeds each of one style for everyone with otherwise Proficient play, and one action every day with random styles. A probe that averages the target tier is a strategy that wins without good leadership. Probes play on the offline templates and evaluator even on a server with AI: they test mechanics, cost no model calls, and the threshold is absolute.

**D115. A plain "why" for every rating.** Decided 2026-10-07.
- Built from the evaluation and what the player meant (`explain.ts`): what was done, what was missing (no open question, no next step, a concern left hidden), the rubric bands, and whether the style the words showed fit the person's need, or differed from the style meant. The view adds how often Experts surfaced the same person's concern, and opens the Expert's run on the same seed to compare.

**D116. The publish check reads the results, and only a failure blocks.** Decided 2026-10-07.
- `calibrationPublishCheck(results, { draft })`: passed, advisory (warnings only), failed (blocking), not run, or out of date (the draft's hash changed since the run). It imports no engine and no schema library, so the publish screen stays light. Whether not run or out of date block publishing is the /author workspace's call.

**D117. Calibrations on the server are in process jobs.** Decided 2026-10-07.
- `POST /genie/calibrations` (author role, AI rate limit, `Idempotency-Key` answered with the same job, a different body with the same key 422) starts a job; `GET` polls it; a playthrough is read on its own; `DELETE` cancels. `CALIBRATION_CONCURRENCY` (2) run at a time, `CALIBRATION_QUEUE` (20) wait, more is 503 `busy`; each playthrough yields the event loop. They play with the server's NPC model and evaluator and, with AI, the synthetic players. Jobs are in memory (an hour, the newest 50): a calibration is a check to run again, not a record to keep; a store can come later with several instances.
- `npm run synthetic -- --check` plays the bundled storylines offline (about 4 seconds) and runs in CI after the build, beside `npm run calibrate -- sales-elevator --check`.

**D118. `CalibrateSlot` is a lazy slot for /author; offline it runs in a Web Worker.** Decided 2026-10-07.
- `src/author/calibrate/index.ts` exports `CalibrateSlot` (props: `config`, `apiBase`, `results`, `onResults`, `onAsk`, `defaultRuns`, `headingLevel`, `runner`) and `calibrationPublishCheck`. The screen is a lazy chunk; the engine loads only with a run. With `apiBase` it runs on the server, falling back to the browser when the server does not offer calibrations (404, 501, no network). In the browser, a Web Worker. The page fallback (a playthrough at a time, `logic/chunked.ts`) is for tests, Node and Storybook only: importing the engine into the screen's module graph made the bundler split shared modules (the engine copy, a runtime chunk) out of the first load and pushed first load LCP over 2.5 s. For the same reason the engine takes its English wording of engine copy as an option (`word`), and `/author/calibrate` imports its draft statically.
- It uses the app's tokens, so the host's theme applies; persona colours (from the design) mark cards and bars only, never text. The rebuilt /author mounts it in its "Test with synthetic players" tab; until then `/author/calibrate` shows it on the bundled draft for review and the E2E test (with axe, dark and light). Not built: "Add a custom player"; Ask Kora is the host's (`onAsk`).

**D119. /author mounts the synthetic players, and their verdict joins Review and publish.** Decided 2026-10-07.
- The "Test with synthetic players" tab renders `CalibrateSlot` on the storyline the draft exports, on the server when `VITE_GENIE_URL` is set and in a Web Worker otherwise. The tab shows its own title, so the slot's heading is off (`heading={false}`).
- The draft keeps only the verdict: passed or not, advisory, the summary and a hash of the storyline it ran on. The full results stay in memory for the browser session.
- On Review and publish the line is advisory when the test has not run, when it ran on an earlier version of the draft, or when it found things to look at; a failed check blocks publishing, as D118 says.
- `/author/calibrate` stays as a standalone review page for the same screen.

**D120. Hardening after the authoring and calibration review.** Decided 2026-10-07.
- **The draft keeps work.** Author inputs carry the schema's limits (`SHORT_MAX` 400, `TEXT_MAX` 4000: `TextInput` defaults to the short limit, `TextArea` to the text one), every `edit` and `replace` clamps the draft to the schema, and a stored draft that fails to parse is kept as it was under `ilead.author.workspace.backup` and repaired (`src/author/model/repair.ts`): strings and lists over a limit are cut, any other failing section goes back to its default. Only a value that is not a draft at all starts fresh. Saved action templates are parsed with Zod; entries that do not parse are dropped.
- **Cancel is a cancel.** An AbortError from inside a playthrough, or an aborted signal, becomes `CalibrationError('cancelled')`, so a cancel mid playthrough is no longer recorded as failed. The client sends DELETE when a poll fails (code `pollFailed`, which does not fall back to the browser), reads an aborted fetch as cancelled, and removes its abort listeners when a wait ends.
- **Server limits.** `CALIBRATION_PER_OWNER` (2) jobs queued or running per author, more answer 429 `tooManyCalibrations`; action probes cover the first 40 actions (`MAX_PROBE_ACTIONS`) and a run is at most 200 playthroughs (`MAX_PLAYTHROUGHS`); `CALIBRATION_TIME_LIMIT_MS` (10 minutes) stops a job, which fails with `timeLimit`; finished jobs are pruned every minute on an unref'd timer, not only when a job starts.
- **The publish check.** A run in which a level did not play, or with the probes off, is advisory whatever its checks say, with a summary that says it was not a full test.
- **AI players.** The persona description moves from the cached system block into the user message, in a `<how_you_play>` block escaped with `quoteInput`, and the lens, action and people names are quoted too (`synthetic-player` prompt version 2).
- **Accessibility.** Recording an answer moves focus to Stop and review; Cancel returns it to the microphone, and stopping moves it to the answer box.
- Comments and the lens prompt that still said "2 to 6 styles" say 4 or 5 (D104).

**D121. The authoring tool's utilities load with /author, not with the participant's first paint.** Decided 2026-10-07.
- Tailwind scanned src/author into the participant's render blocking stylesheet, which grew by 2.6 KB gzipped and pushed first load LCP to the edge of its budget. `global.css` now skips src/author (`@source not`), and `src/author/author.css`, imported by the /author page and the calibration screen, carries their utilities in the lazy chunk.
- The custom variants (`short`, `tablet` and the rest) moved to `src/styles/variants.css`, shared by both sheets. Storybook loads both.

## Blocked on missing docs

**D19.** Mostly resolved by the iLead 1.0 documents (D28 to D35). Still open:
- Resolved: the GenieKreator Configuration Spec and the other GenieKreator source docs are in `docs/genie/`, copied from the GenieKreator authoring repo.
- Resolved (D66): Sales Elevator money values stay as calibrated.
