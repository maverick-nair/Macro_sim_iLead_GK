# iLead 2.0 participant interface: audit and plan

## Repo audit (M0)

**What exists:**
- **App:** Vite 8, React 19 and TypeScript strict, in `src/`.
  - Seven screens (`src/screens/*`) and the app shell (`src/app/App.tsx`), ported from the Claude Design prototype.
  - All 52 frames in iLead Screens and all 15 in iLead States match the prototype, checked by a pixel diff with Playwright. The only differences are antialiasing and timers.
- **Data and API:**
  - A typed scenario (`src/data`), ported from the prototype's `ilead-data.js`.
  - A typed `IleadApi` with a mock and an HTTP adapter (`src/api`). It is not yet the engine contract that rule 1 needs.
- **Styling:**
  - The design's inline CSS, kept as strings through `css()`.
  - 166 hex and 93 OKLCH literals, 349 font size declarations and 237 radius declarations remain in screen code. The milestones remove them.
  - Colors already flow through 20 semantic variables.
- **Docs:**
  - The Participant Interface Spec only.
  - The Teardown, the Simulation Design and the GenieKreator Configuration Spec are missing (see DECISIONS D19).
- **Missing from the brief's stack at M0:** Radix, Framer Motion, Zod, TanStack Query, Zustand, visx, Playwright tests, axe and i18n.
  - Since added: Radix (dialog, toggle group), Zod, TanStack Query, Zustand, Playwright with axe, and the ICU catalog (`intl-messageformat`).
  - Still missing: Framer Motion and visx (visx comes with the report charts in M6).

**Built in M0:**
- **Token pipeline.**
  - The source is `tokens/primitive.json`, `tokens/semantic.json`, `tokens/component.json` and `tokens/legacy.json`.
  - `scripts/tokens/build.ts` turns them into:
    - `src/styles/tokens.generated.css`: primitives on `:root`, semantic and component layers on `.il-theme`, colors as `light-dark()`.
    - `src/styles/tailwind-theme.generated.css`: a Tailwind v4 theme that only exposes tokens, with all defaults reset.
    - `src/styles/tokens.generated.ts`: a typed manifest.
  - The build validates references, modes and alpha, and checks the WCAG contrast pairs declared in `semantic.json`.
  - `npm run build` fails if the generated files are stale or a contrast pair is below its minimum.
- **App on generated tokens.**
  - The app shell now reads the generated tokens instead of a hand written variable block.
  - Button and Switch read component tokens.
  - Re-diffed: zero visual change.
- **Storybook 10** (`npm run storybook`), with a theme toolbar for dark, light and the Halden client theme.
  - Foundations stories: semantic colors, primitives, type scale and radii.
  - Button and Switch stories with all their states.
- **Vitest:** 12 pipeline tests.

## Approach for the remaining milestones

**Visual parity:**
- Each component is rebuilt on Tailwind utilities and Radix primitives, inside the screen it serves.
- It is checked against the prototype frame with the pixel diff harness, which moves into `tests/visual` as Playwright tests.
- No screen is migrated without a green diff, so the 2px bar holds throughout.

**Engine:**
- `src/engine` will hold:
  - a Zod schema for every engine payload (the contract)
  - a typed client using TanStack Query
  - a mock engine running in the browser from fixtures
- The UI sends intents (set style, plan action, submit turn, end week, pause) and renders engine state, including reason chips and evidence.
- The game logic in the prototype moves into the mock (DECISIONS D10).

**State:**
- Zustand (`src/app/uiStore.ts`) holds UI state only: the selected people, the chosen action and option, the open panel (inbox or profile), whether the outcome's "See why" is open, and whether reason chips show numbers.
- The command palette and the action drawer's flow (picks, the prerequisite nudge) are local state in `src/components/board/EngineBoard.tsx`. Settings, such as the input mode, live in the app shell.
- Engine state lives in TanStack Query (`src/engine/react.tsx`).

**Strings:**
- ICU messages live in one file per feature, `src/i18n/messages/en/<area>.json`, merged in `messages/en/index.ts`. They are read through a small `t()` with `Intl` formatting.
- The `I18nProvider` wrapper sets `lang` and `dir` (RTL locales get `rtl`).
- The catalog lint (DECISIONS D9) runs in Vitest, and `npm run build` runs it too.

**Performance:**
- The board route's initial JS stays under 200 KB gzipped. The mock engine, the live screen, the galleries and every ported screen past onboarding load on demand.
- `npm run build` fails if the initial JS goes over budget (`scripts/budget.ts`). It was 178 KB gzipped at M4 and is 176 KB now (4 Oct 2026).

## Status

| Milestone | Status |
|---|---|
| M0 | Done |
| M1 | Done |
| M2 | Done |
| M3 | Done |
| M4 | Done, approved |
| Quality review | Done (D57 to D61) |
| M5 | Done, approved |
| M6 | Done, awaiting approval |
| M7 to M8 | Not started |

## Milestones

Each one ends with a demo, a summary and a stop for approval.

**M1. Foundations and core components in Storybook.**
- i18n catalog and lint, plus the Zod engine contract skeleton.
- Components with all their states: member card, metric bar, reason chip, style segmented control, action tile, drawer, transcript bubble, mic control, outcome band, badge, star meter, toast and command palette.
- Each is extracted from the ported screens and pixel checked against them.

**M2. Main board on the mock engine.**
- HUD, metrics strip, team board, actions panel and inbox.
- Engine client and fixtures. The board reads only engine state.
- Needs D19 for fixtures beyond week 2.

**M3. Member peek and profile, weekly style setting, action drawer and reason chips.**
- Selection, drawer and keyboard paths.
- Needs D11.

**M4. Live interaction shell.**
- Email, chat, 1:1 RolePlay by voice and text, team meeting, sponsor briefing and the outcome panel.
- `SpeechProvider` (MediaRecorder plus streaming transcription), with the mock provider for tests.
- AI streaming that can be cancelled and is labeled as AI generated.
- Needs D14.

**M5. Events, week end and gamification, all rendered from engine values.**

**M6. End screen and development report.**
- Web and print views.
- Every chart is built with visx and has a data table alternative.

**M7. Theme loader.**
- GenieKreator config validated with Zod.
- Automatic contrast correction using the same OKLCH maths as the token build.
- Falls back to the default theme on any invalid value.
- The Halden sample theme. Fixes D17.
- Needs D19 for the config schema.

**M8. Hardening.**
- axe on every route, Web Vitals budgets and visual baselines for light, dark and client at 1440, 1024 and 390 (see D15).
- Preflight on and legacy aliases removed (D6, D7).
- Handoff docs.

## Running M0

```bash
npm install
npm run tokens        # regenerate token CSS and TS from tokens/*.json
npm test              # Vitest
npm run storybook     # http://localhost:6006
npm run dev           # app on http://localhost:5173, galleries at /screens and /states
```
