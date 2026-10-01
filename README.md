# iLead, a Business Simulation: participant app

React 19 + Vite + TypeScript implementation of the iLead 2.0 participant interface designed in Claude Design.
The original design bundle (prototypes, chat transcript, design system) lives in `project/` and `chats/` and is the visual source of truth. The bundle's handoff notes are in `HANDOFF.md`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck and production build to dist/
```

| Route      | What it is |
|------------|------------|
| `/`        | The playable app, full screen. Starts at onboarding. `?theme=light` for the light theme, `?client=halden` for the sample client theme. Phones (600px and below) get the 390 layouts. |
| `/screens` | Every screen, each frame the live app opened at that state. Port of `project/iLead Screens.dc.html`. Frame ids (`b4`, `l1`, ...) match the design and are linkable, for example `/screens#b4`. |
| `/states`  | Edge states: loading, empty, offline, mic denied, slow AI. Port of `project/iLead States.dc.html`. |

## Layout

```
src/
  api/        Typed API layer: IleadApi interface, mock adapter (default), HTTP adapter
  app/        App shell (port of iLeadApp): state, navigation, overlays, toast, contract types
  data/       Scenario types and the default scenario (port of ilead-data.js)
  ds/         Genie design system components used by the screens (Button, Switch)
  gallery/    /screens and /states review canvases
  lib/css.ts  css() and pseudo() helpers, see below
  screens/    Onboarding, StyleSetting, Board, Live, WeekEnd, End, Report
  styles/     Genie tokens, fonts, global keyframes
public/       NPC portraits, backgrounds, Manrope fonts
```

## Backend

All persistence and AI judging goes through `IleadApi` (`src/api/types.ts`):
`getScenario`, `getSession`, `saveSettings`, `setStyle`, `planAction`, `submitInteraction` (returns the Outcome the board shows) and `endWeek`.

- With no configuration the app uses `createMockApi`, which serves the design's scenario in memory.
- Set `VITE_ILEAD_API_URL` (see `.env.example`) to switch to `createHttpApi`. Its endpoint paths are a proposal, kept in `src/api/http.ts` so they are easy to align with the real service.

Voice capture, NPC speech streaming and the waveform are simulated in `src/screens/live/useLiveSession.ts` (`simulateNpcSpeechTick`, `simulateMicCapture`, `simulateWaveformTick`), ready to be replaced by a speech service.

## Styling approach

The screens keep the design's inline CSS as strings passed through `css()`, which converts them to React style objects (memoised). This keeps every value diffable against the design source. Hover and focus styles use `pseudo('hover', '...')`, which generates a class, matching how the design runtime applied `style-hover`.
Color tokens are `--ik-*` custom properties defined on the app root with `light-dark()`, so light and dark modes share one set of styles. A client theme only overrides the `--client-acc*` and `--client-grad` accent tokens.
