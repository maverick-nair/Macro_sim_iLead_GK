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

**D8. Light mode `accent.secondary` is 3.75:1.** Proposed.
That passes the 3:1 bar for UI and large text. But the design also uses it for 12px uppercase eyebrows ("WELCOME ABOARD", "FOR KENT"), and text needs 4.5:1 under WCAG 2.2 AA.
Proposal: darken the light value from L 0.60 to about L 0.52 (around 4.6:1) in M8, or use `fg.secondary` for eyebrows in light mode. This is a visible change, so it needs your approval.

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

**D11. Skill bars on the board.** Open.
The spec says "skill ratings appear only in the report" (principle 4), and card stats should be hidden until a profile is first opened. The design shows Skill, Morale and Result bars on every board card from the start.
Following the spec would visibly change the main board. I need a product call.

**D12. HUD week label.** Proposed.
The spec asks for "Week x of 8". The design shows "Week 2 · Day 3". Proposal: keep the design's layout and use the string "Week 2 of 8 · Day 3", which takes about 30px more in the HUD.

**D13. Clock pausing.** Decided, following the spec.
The spec pauses the clock in live screens, modals, event cards and tours. The prototype only pauses it for overlays. The engine owns the clock (rule 1), and the UI sends pause and resume intents.

**D14. Live formats without a design.** Open.
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
- p1 (live clock), z5 and z14 (random waveform) and x2 (blurred board behind a dialog) allow 0.4%.
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
- The HUD nav (objective, funnel, history, badges) is hidden on the engine board until its panels exist (M3).

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

## Blocked on missing docs

**D19.** Mostly resolved by the iLead 1.0 documents (D28 to D35). Still open:
- Resolved: the GenieKreator Configuration Spec and the other GenieKreator source docs are in `docs/genie/`, copied from the GenieKreator authoring repo.
- Sales Elevator money values (target, value per deal, lead input). Calibration will propose them; confirm or replace.
