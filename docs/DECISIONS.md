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

## Blocked on missing docs

**D19.** These are needed from the Teardown, the Simulation Design and the GenieKreator Configuration Spec:
- 8 weeks of fixtures: events, news, inbox and metric ranges per week. The prototype only has week 2.
- The engine rules and payload shapes for outcomes, reason chips and evidence.
- The action list with costs, cooldowns and prerequisites. The prototype has 13 actions (6 team, 7 member), which matches the brief's count, but not their rules.
- The theme config schema: brand, logo, avatars, illustrations, voices and strings.
- The tier names (Bronze to Platinum) and the badge rules.
