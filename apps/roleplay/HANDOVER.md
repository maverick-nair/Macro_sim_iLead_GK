# AI RolePlay Training App - Handover

## What it is
Premium AI RolePlay training product. Scenario: **Renewal Negotiation with Margaret Hale** (VP Procurement, Northwind Freight). The player is a Cloudline account executive defending a $1.2M/yr renewal against a competitor quote 22% lower with a Friday deadline. One attempt per roleplay (no retries, no "New Call"). No emojis. Dark and light themes, WCAG AA 2.2.

## Run
```
pnpm install
pnpm dev        # Vite dev server
pnpm build      # production build
npx tsc --noEmit
```
Stack: React 19, TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`, no config file), jsPDF (lazy-loaded).

## Files
- `src/App.tsx` - everything: `LandingPage`, `SessionPage`, `SummaryPage`, and helpers (`TenPointScale`, `SkillScore`, `SkillRadar`, `VoiceWave`, `BoxField`, `ConfettiBurst`, `BadgeMedal`, `RollingNumber`, `EmailDialog`, `buildReportPdf`). All mock data is constants near the top (`SKILLS`, `ASSESSED_SKILLS`, `LANDING_OBJECTIVES`, `BADGES`, `PEERS`, `NPC_REPLIES`, `FULL_TRANSCRIPT`, `CEFR`, `SENTIMENT`, `TONE`, `CLARITY`).
- `src/index.css` - theme tokens, box pattern, animations, reduced-motion rules.
- `src/main.tsx` - entrypoint.

## Theme tokens (index.css)
- `:root` = dark, `:root.light` = light.
- `--ink` is RGB channels: use `rgb(var(--ink) / a)`. `--bg` is hex: use `color-mix(in srgb, var(--bg) X%, transparent)`, never `rgb(var(--bg)/a)`.
- Dark: bg `#0e0d0c`, brand `#ff8a4c`, accent `#c2410c`. Light: bg `#f4f2ef`, brand `#b8320f`.
- Secondary text must be `text-ink/70` or stronger (lower fails AA in light theme).

## Knolskape 10-point bands
Novice 1-2 `#b5472f`, Emerging 3-4 `#e07b2e`, Competent 5-6 `#efc23a`, Proficient 7-8 `#8dc063`, Role Model 9-10 `#2f7a34`. Use `bandFor(score)` and `readableOn(hex)`. Only the band containing the score is elevated.

## Flows
**Landing:** hero, Role / Goal / Scene, 6 Skills being Assessed (tiles with descriptions, no proficiency levels), 3 outcome-only Objectives with XP (criteria hidden: Break the Deadlock 60, Protect the Margin 50, Win Her Over 40), player card, badges, animated tile background with cursor spotlight.

**Session:**
- Strict turn-taking: NPC speech streams word by word; mic, composer and send are locked while she speaks. Voice input auto-submits on finish or stop.
- `VoiceWave` live meter for NPC and player.
- Gamification: XP HUD with level ring, rolling XP, streak (x1.5 at 3+), badges, floating +XP, unlock toasts. Objective confetti originates from the objective row (sidebar open) or the top-bar Objectives button (sidebar closed).
- Leaderboard shows peer XP, not levels.

**Report (4 tabs):** Performance Overview (scale, percentile, Rewards Earned, KPIs, Skill Snapshot with radar and summary stats, strengths/development, feedback, recommendations); Detailed Analysis (skills and sub-skills only, evidence, drills); Communication (CEFR, sentiment, tone, clarity); Transcript (tagged turns, key moments). PDF download and email (mailto). "Compare with peers / Just me" toggle; peer mode is enabled only when `PLAYERS_COMPLETED > PEER_THRESHOLD` (50).

## What is mocked (needed before production)
1. Scoring is keyword/regex based (`TOPIC_RX`, `OBJECTIVE_TESTS`). Replace with an LLM or validated rubric scorer.
2. NPC replies cycle 3 scripted lines; dictation types a fixed phrase; camera is a stock image. Wire real LLM, STT and TTS.
3. All report, peer, leaderboard and season data are constants. Needs a backend, auth and persistence.
4. Email uses `mailto:`; real sending with the PDF attached needs a server.

## Suggested next steps
- Split `App.tsx` into `pages/` and `components/`, and move mock data to `data/`.
- Add an API layer for scenarios, sessions, scoring and reports.
- Run a screen-reader and keyboard audit, and check mobile layout of the session screen.

## Code rules
Default exports; double quotes for strings with apostrophes; global CSS and fonts in `index.css`; respect `prefers-reduced-motion`.
