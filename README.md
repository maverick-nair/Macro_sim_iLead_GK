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
npm run storybook:smoke  # every story in dark, light, the Halden and the corrected Brightwater client themes, fails on render errors
npm run e2e              # Playwright flows on the mock engine, axe on every route (tests/e2e/a11y.spec.ts, WCAG 2.2 AA) and visual baselines
npm run vitals           # Web Vitals budgets on a throttled production build (scripts/vitals.ts, D78)
npm run schemas          # regenerate the handoff JSON Schemas in docs/schemas from the Zod contracts
npm run calibrate -- sales-elevator   # tune a storyline so it plays well (add --check to verify)
```

CI (`.github/workflows/ci.yml`) runs on every push and pull request: token check, lint, build, Storybook smoke, the Playwright flows, parity and the Web Vitals budgets.

For the server and GenieKreator teams: `docs/HANDOFF.md` (architecture, the engine contract, every proposed endpoint, the config and report schemas, how to run, test and release, budgets, known limits).

Component rules: `docs/COMPONENTS.md`.

Plan and status: `docs/PLAN.md`. Simulation rules: `docs/SIMULATION.md`. Design and spec conflicts: `docs/DECISIONS.md`.

| Route      | What it is |
|------------|------------|
| `/`        | The playable app, full screen. Starts at onboarding, then the board runs on the engine. `?participant=<id>` names the participant (the launch link from the LMS or GenieKreator), so settings and the session are theirs; it defaults to `local`. `?start=board` skips onboarding, `?period=4` opens the mock engine at period 4 (the real engine ignores it), `?engine=off` shows the prototype's fixed board, `?theme=light` (or `dark`) the mode, over the client theme's preference, `?client=halden` the sample client theme and `?themeUrl=/path.json` any theme JSON, both served by the mock API (see Themes). Laptops, desktops and tablets only (D69): narrower than 744, or shorter than 500 on a touch screen, a notice asks to open the link on a bigger screen; the app stays mounted underneath. In development only, `?report=1` plays a whole mock run with the good player and opens its development report (`&policy=random` or `passive`, `&seed=N`, `&print=1`, `&client=halden`, `&themeUrl=`). |
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
tokens/       Token source: primitive, semantic and component layers, contrast pairs
scripts/      Token pipeline, calibration, bundle budget, storyline import, portrait preparation
tests/        Playwright flows (e2e/) and the design parity harness (visual/)
calibration/  Calibration reports, one per storyline
docs/         Spec, plan, decision log
public/       NPC portraits and backgrounds (WebP, with their PNG sources), Manrope fonts (WOFF2, with their TTF sources); `python3 scripts/assets/optimize.py` makes the compressed variants
```

## Backend

Two clients talk to the server. Each has an in-browser mock, used when nothing is configured, and an HTTP adapter.

- **Engine** (`EngineClient`, `src/engine/client.ts`). The playable board reads only engine state and sends intents: `view()`, `send(intent)` and `streamTurn()`, which streams an NPC turn's words as server sent events. Every payload is parsed by the Zod contract (`src/engine/contract.ts`). With no configuration the mock engine runs the same simulation code in the browser, loaded on first use. `VITE_ILEAD_ENGINE_URL` switches to the HTTP adapter.
- **App shell API** (`IleadApi`, `src/api/types.ts`): `getScenario`, `getSession`, `saveSettings`, `setStyle`, `planAction`, `submitInteraction`, `endWeek` and `getTheme` (the client theme, see Themes). The shell loads the scenario, the saved session and settings through it, and the prototype board (`?engine=off`) persists through it. `VITE_ILEAD_API_URL` switches to `createHttpApi`. Its endpoint paths are a proposal, kept in `src/api/http.ts` so they are easy to align with the real service.

Voice and AI text on the engine board use `src/speech` and `src/ai` (`docs/SPEECH.md`). `VITE_ILEAD_SPEECH_URL` turns on real microphone capture with server transcription; without it a scripted mock voice stands in. The prototype's live screen (`src/screens/Live.tsx`, used by the galleries and `?engine=off`) still simulates voice, NPC speech and the waveform in `src/screens/live/useLiveSession.ts`.

The variables are listed in `.env.example`; copy it to `.env.local` to set them.

## Author chat prototype

`/author` is GenieKreator's author chat for iLead (D70, D74), for L&D authors rather than participants. It asks 5 to 10 questions, recommends a leadership lens, previews the build, then locks the lens and drafts a storyline. "Play this draft" opens the participant app on it (`/?storyline=draft&start=onboarding`); "Download config" saves the storyline JSON. `?theme=light` and `?client=halden` theme it.

- Code: `src/author` (question policy, recommendation, lens library, mock drafter, copy guard) and `src/author/ui` (components, with stories under "Author chat"). API shapes: `src/api/author.ts`. Server prompts: `docs/genie/prompts/author-chat.md` and `docs/genie/prompts/leadership-lens.md`.
- `VITE_GENIE_URL` points the chat at the server (`POST /author/turn`, `POST /author/draft`). Unset, or when the server answers 404 or 501, the chat drafts from templates and says so.
- It is lazy loaded and adds about 0.1 KB to the participant's first load.

## Group report

`/group` is the organization's group report (D75, D77): a cohort's results against the benchmark of everyone who has played, web and print, for L&D and leaders rather than participants. It is lazy loaded and stays out of the participant's first load.

- Engine: `buildGroupReport` and `summarizeBenchmark` in `src/engine/report/group.ts`, pure functions of run summaries the server can reuse; contract in `src/engine/groupContract.ts`; narrative bank `report.group.copy` (defaults in `src/engine/report/groupDefaults.ts`). Rules: `docs/SIMULATION.md` 8.5.
- API: `getGroupReport(cohortId)`, proposed `GET /cohort/{id}/report` (404 is none), or `POST /cohort/report` with `GroupReportRequest` for a server that stores only summaries.
- Mock: a cohort played by the calibration's AI players (strong, one style, careless, random, passive; every ninth stops part way): 37 participants for development, 18 for assessment. `?purpose=assessment`, `?lens=six_styles`, `?size=3` (under the minimum cohort size), `?print=1`, `?theme=light`, `?client=halden`. The benchmark is 300 seeded runs per lens, cached in `src/api/samples`: `npm run benchmark` rewrites it, `npm run benchmark -- --check` fails when it no longer matches the engine.
- Download PDF opens the print view (letter pages, a page per section, tables where charts would not print) and the browser's print dialog. Code: `src/group`, stories under "Report/Group report".

## Design tokens

Edit `tokens/**/*.json`, then run `npm run tokens`. The pipeline writes `src/styles/tokens.generated.css`, a Tailwind theme that exposes only tokens, and a typed manifest. It fails on unknown references, missing light or dark values, and any contrast pair below its WCAG minimum. Pairs are declared on semantic tokens and in `tokens/contrast.json`, and are checked in light and dark. It also writes `src/theme/tokens.generated.ts`, the pairs and token table the runtime theme loader corrects against (see Themes). Never edit the generated files.

## Themes

A client theme is GenieKreator configuration (Configuration Spec, "Brand and theme"), loaded at runtime, never built in (M7, DECISIONS D72). The schema is `src/theme/schema.ts`; the samples are `src/theme/samples/halden.json` (Halden Group, frame b15) and `brightwater.json` (a deliberately bad palette the loader corrects).

| Field | Type | What it sets |
|---|---|---|
| `version` | `1` | Required. Any other value rejects the theme. |
| `id`, `name` | text | The client's name labels the logo ("Halden Group logo"). |
| `mode` | `dark`, `light`, `system` | The mode the app opens in. `?theme=` wins. |
| `colors.accent` | colour | `color.accent.default`: bars, selected state, links. |
| `colors.accentSecondary` | colour | `color.accent.secondary`: eyebrows, text links, the focus ring. |
| `colors.accentSoft` | colour | `color.accent.soft`: selected backgrounds. |
| `colors.brand` | `{ from, to, angle? }` | `fill.brand`: the primary button, wordmark, on switch and progress. |
| `colors.surface` | `{ solid?, card?, raised?, material? }` | The surface tokens. |
| `logo` | `{ src?, alt?, text? }` | The brand mark beside the iLead wordmark: an image (https, a site path or a data:image URI), or a text mark. With neither, the design's placeholder names the client. |
| `font` | allowlist | Manrope (default), Inter, IBM Plex Sans, Source Sans 3, Nunito Sans, Work Sans, Lato, Open Sans, System. Web fonts load from Google Fonts. |
| `radiusScale` | 0 to 2 | Multiplies every numbered radius token; pills stay pills. |

A colour is `oklch()`, `#hex` or `rgb()`, either one value or `{ "light": …, "dark": … }`. Theme text follows the copy rules (no dashes as punctuation, no emoji).

**Loading.** The bootstrap (`src/theme/bootstrap.ts`, the only theme code in the first load) reads an inline theme from the launch payload (`<script type="application/json" id="il-launch">{"theme": …}</script>` on the host page), or calls `getTheme` (proposed `GET /theme`, 404 means none). The mock serves Halden for `?client=halden` and any JSON for `?themeUrl=/path.json`. It then imports the loader (`src/theme/loader.ts`, a lazy chunk with the schema, the contrast table and the maths), which writes the result as custom properties on `:root`: `--il-theme-<token>` for colours, `--il-radius-*` and `--il-font-family-sans`. No rebuild. `<html data-il-theme>` names the theme once it has settled (`default` when there is none). The default theme shows until then.

**Correction.** Every pair the token build checks is measured again with the theme's colours, in light and dark, with the build's own code (`src/theme/color.ts` and `src/theme/paint.ts`, shared with `scripts/tokens`). A failing pair moves the lightness of the theme colour involved (the text first, otherwise the surface), keeping hue and chroma (chroma drops only where the sRGB gamut needs it), by the smallest step that reaches 4.5:1 for text or 3:1 for controls and graphics. Corrections are listed in a console warning in development. A colour no lightness can fix falls back to the default.

**Fallback.** A theme that is not an object, or not version 1, is ignored. Any other invalid field falls back on its own and the rest applies. A failed request, broken JSON or any error in the loader means the default theme, never a broken screen.

**Previewing.** In Storybook, the toolbar picks Halden or Brightwater in either mode; `withClientTheme()` (`src/stories/clientTheme.tsx`) pins one story to a client theme. `tests/e2e/theme.spec.ts` serves Brightwater from the mock API and runs axe on the board and the report.

## Styling approach

Colour tokens are `--il-*` custom properties generated from `tokens/`, declared on the app root (`.il-theme`) with `light-dark()`, so light and dark modes share one set of styles. Tokens marked `themable` read a `--il-theme-<token>` variable first, which a client theme sets at runtime (see Themes).

Components in `src/components` use Tailwind utilities on those tokens (`docs/COMPONENTS.md`). The ported screens in `src/screens` keep the design's inline CSS as strings passed through `css()`, which converts them to React style objects (memoised). Pixel font sizes follow the text size setting (`--il-text-scale` on the app root, like the font size tokens; D56). This keeps every value diffable against the design source. Hover and focus styles use `pseudo('hover', '...')`, which generates a class, matching how the design runtime applied `style-hover`. They read the `--il-*` tokens directly: the migration aliases (`--ik-*`, D7) and the preflight switch (D6) were retired in M8 (D78), and Tailwind preflight is on.
