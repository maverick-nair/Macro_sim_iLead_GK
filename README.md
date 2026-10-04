# iLead, a Business Simulation: participant app

React 19 + Vite + TypeScript implementation of the iLead 2.0 participant interface designed in Claude Design.
The original design bundle (prototypes, chat transcript, design system) lives in `project/` and `chats/` and is the visual source of truth. The bundle's handoff notes are in `HANDOFF.md`.

## Run it

```bash
npm install
npm run dev              # http://localhost:5173 (regenerates tokens first)
npm run storybook        # http://localhost:6006
npm test                 # Vitest
npm run lint             # ESLint (TypeScript, React hooks, jsx-a11y)
npm run build            # token check, unit tests, typecheck, production build to dist/, bundle budget
npm run parity           # every frame vs the Claude Design prototype (add --prod for the build)
npm run storybook:smoke  # every story in dark, light and client theme, fails on render errors
npm run e2e              # Playwright flows on the mock engine, with axe (WCAG 2.2 AA)
npm run calibrate -- sales-elevator   # tune a storyline so it plays well (add --check to verify)
```

CI (`.github/workflows/ci.yml`) runs on every push and pull request: token check, lint, build, Storybook smoke, the Playwright flows and parity.

Component rules: `docs/COMPONENTS.md`.

Plan and status: `docs/PLAN.md`. Simulation rules: `docs/SIMULATION.md`. Design and spec conflicts: `docs/DECISIONS.md`.

| Route      | What it is |
|------------|------------|
| `/`        | The playable app, full screen. Starts at onboarding, then the board runs on the engine. `?participant=<id>` names the participant (the launch link from the LMS or GenieKreator), so settings and the session are theirs; it defaults to `local`. `?start=board` skips onboarding, `?period=4` opens the mock engine at period 4 (the real engine ignores it), `?engine=off` shows the prototype's fixed board, `?theme=light` the light theme, `?client=halden` the sample client theme. Phones (600px and below) get the 390 layouts. |
| `/screens` | Every screen, each frame the live app opened at that state. Port of `project/iLead Screens.dc.html`. Frame ids (`b4`, `l1`, ...) match the design and are linkable, for example `/screens#b4`. |
| `/states`  | Edge states: loading, empty, offline, mic denied, slow AI. Port of `project/iLead States.dc.html`. |

## Layout

```
src/
  ai/         Streamed AI text: server sent events, mock token stream, cancellable useAiStream hook (docs/SPEECH.md)
  api/        App shell API: IleadApi interface, mock adapter (default), HTTP adapter
  app/        App shell (port of iLeadApp): state, navigation, overlays, toast, session clock, UI store
  components/ Token and catalog only components; `board/` is the engine driven board and live screen
  data/       Scenario types and the design fixture scenario (port of ilead-data.js), for the galleries
  ds/         Genie design system components used by the screens (Button, Switch)
  engine/     Engine contract (Zod), client (mock and HTTP adapters), React hooks, the simulation (`sim/`) and storylines
  gallery/    /screens and /states review canvases
  i18n/       ICU message catalog (one file per feature), copy rules, money formatting
  lib/        css() and pseudo() helpers (see below), and a clock abstraction that makes timed behaviour testable
  screens/    Ported prototype screens: Onboarding, StyleSetting, Board, Live, WeekEnd, End, Report
  speech/     Voice input: SpeechProvider, MediaRecorder with server transcription, mock voice, voice activity, consent (docs/SPEECH.md)
  stories/    Foundation stories (tokens, Button, Switch); component stories sit next to their component
  styles/     Generated token CSS, Tailwind theme, fonts, global keyframes
tokens/       Token source: primitive, semantic and component layers, migration aliases, contrast pairs, client themes
scripts/      Token pipeline, calibration, bundle budget, storyline import, portrait preparation
tests/        Playwright flows (e2e/) and the design parity harness (visual/)
calibration/  Calibration reports, one per storyline
docs/         Spec, plan, decision log
public/       NPC portraits, backgrounds, Manrope fonts
```

## Backend

Two clients talk to the server. Each has an in-browser mock, used when nothing is configured, and an HTTP adapter.

- **Engine** (`EngineClient`, `src/engine/client.ts`). The playable board reads only engine state and sends intents: `view()`, `send(intent)` and `streamTurn()`, which streams an NPC turn's words as server sent events. Every payload is parsed by the Zod contract (`src/engine/contract.ts`). With no configuration the mock engine runs the same simulation code in the browser, loaded on first use. `VITE_ILEAD_ENGINE_URL` switches to the HTTP adapter.
- **App shell API** (`IleadApi`, `src/api/types.ts`): `getScenario`, `getSession`, `saveSettings`, `setStyle`, `planAction`, `submitInteraction` and `endWeek`. The shell loads the scenario, the saved session and settings through it, and the prototype board (`?engine=off`, phones) persists through it. `VITE_ILEAD_API_URL` switches to `createHttpApi`. Its endpoint paths are a proposal, kept in `src/api/http.ts` so they are easy to align with the real service.

Voice and AI text on the engine board use `src/speech` and `src/ai` (`docs/SPEECH.md`). `VITE_ILEAD_SPEECH_URL` turns on real microphone capture with server transcription; without it a scripted mock voice stands in. The prototype's live screen (`src/screens/Live.tsx`, used by the galleries, `?engine=off` and phones) still simulates voice, NPC speech and the waveform in `src/screens/live/useLiveSession.ts`.

The three variables are listed in `.env.example`; copy it to `.env.local` to set them.

## Design tokens

Edit `tokens/**/*.json`, then run `npm run tokens`. The pipeline writes `src/styles/tokens.generated.css`, a Tailwind theme that exposes only tokens, and a typed manifest. It fails on unknown references, missing light or dark values, and any contrast pair below its WCAG minimum. Pairs are declared on semantic tokens and in `tokens/contrast.json`, and are checked in light, dark and every client theme in `tokens/themes/`. Never edit the generated files.

## Styling approach

Colour tokens are `--il-*` custom properties generated from `tokens/`, declared on the app root (`.il-theme`) with `light-dark()`, so light and dark modes share one set of styles. A client theme only overrides the `--client-acc*` and `--client-grad` brand variables, which the accent tokens fall back from.

Components in `src/components` use Tailwind utilities on those tokens (`docs/COMPONENTS.md`). The ported screens in `src/screens` keep the design's inline CSS as strings passed through `css()`, which converts them to React style objects (memoised). Pixel font sizes follow the text size setting (`--il-text-scale` on the app root, like the font size tokens; D56). This keeps every value diffable against the design source. Hover and focus styles use `pseudo('hover', '...')`, which generates a class, matching how the design runtime applied `style-hover`. Those screens still read the legacy `--ik-*` names, migration aliases onto the `--il-*` tokens (`tokens/legacy.json`, D7) that go as each screen moves to components.
