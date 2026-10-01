# Genie Design System (GenieKreator Guidelines)

The single source of truth for the **Genie** ecosystem's visual identity — the AI-powered experiential-learning suite by **KNOLSKAPE**. Genie ships as three sub-brands: **Genie Kreator** (AI creation studio: simulations, AI roleplays, assessments, AI Koach), **Genie Orchestrator** (learning-journey orchestration), and **Genie Tracker** (readiness signals & analytics).

## Sources
- `uploads/Kreator_Brand Book.pdf` — Genie Brand Guidebook & Design Standards (logo system, color system, typography). Primary source; all tokens here are copied verbatim from it.
- `uploads/welcome brochure.pdf` — Genie Kreator customer welcome brochure (voice/tone reference).
- Logo PNGs, 3 background images, Manrope TTFs (7 weights) — copied to `assets/`.
- GitHub repo `maverick-nair/GenieKreator-Kit.zip` was attached but is empty (only `.gitattributes`); nothing could be read from it. Explore it at https://github.com/maverick-nair/GenieKreator-Kit.zip if it gets re-uploaded — a populated kit would let designs be grounded in real product UI.

## CONTENT FUNDAMENTALS
- **Voice**: warm, confident, partner-like. "We" (Genie/KNOLSKAPE) speaks directly to "you/your team". Never third-person corporate.
- **Outcome-led**: readiness over activity. Signature framing: "real readiness — not just completion", "readiness signals to show, not just activity logs", "days, not quarters".
- **Casing**: sentence case everywhere — headings, buttons, labels. Uppercase reserved for eyebrow labels (11px, +0.12em tracking).
- **Headlines**: short declarative or invitational phrases: "Let's build experiences that matter.", "Your authors take the lead".
- **Eyebrows** introduce sections: "Welcome aboard", "What to expect", "Your key contacts".
- **No emoji.** Checkmarks (✓/✕) appear only in do/don't lists.
- **Product names**: always "Genie Kreator", "Genie Orchestrator", "Genie Tracker" (two words, K in Kreator). Suite = "Genie". Attribution: "Genie · Powered by KNOLSKAPE". Never invent new sub-brand names.

## VISUAL FOUNDATIONS
- **Palette (5 colours, strict roles)**: Electric Blue `#249DFF` (CTAs, links, active, gradient origin) · Cyber Cyan `#43D6E8` (hover, highlights, icon fills) · Mint Green `#00F2AD` (success, progress, sub-brand names) · Deep Space `#0A081B` (the default background — every interface is dark) · Pale Lavender `#DEE9FF` (text on dark). Never interchange roles.
- **Gradients are the primary brand vehicle**, always 135deg: Brand (Blue→Cyan: logo, primary buttons, h1), Product (Cyan→Mint: sub-brand names, progress fills), Full Spectrum (Blue→Cyan→Mint: hero accents, celebration).
- **Surfaces**: layered opacity above Deep Space — Surface 1 `#111029` (nav/sidebars), Surface 2 `rgba(255,255,255,.04)` (cards), Surface Active `rgba(36,157,255,.08)` (selected). **Never flat grey** — transparency lets background glows bleed through.
- **Backgrounds**: full-bleed dark imagery — starfield glows and flowing flame silhouettes (`assets/backgrounds/`). Busy images get a dark overlay before any logo sits on them.
- **Type**: Manrope only, 200–800. Display 54/800/-0.03em, H1 36/800, H2 28/700, H3 20/700, Body-lg 17/400/1.7, Body 15/400/1.65, Caption 12/500, Label 11/700/+0.12em uppercase. Negative tracking on headings, generous line-height on body.
- **Hover**: shift toward Cyber Cyan (links, buttons); surfaces brighten via opacity. **Press**: no spec — keep subtle (slight darken).
- **Cards**: Surface 2 fill, 1px `rgba(255,255,255,.08)` hairline border, 12–16px radius, no drop shadows (glow `--shadow-glow` only for emphasis moments).
- **Radii/spacing/shadows/animation** are NOT specified by the brand book — the `tokens/shape.css` values are intentional additions derived from the book's own layout (rounded 12–16px cards, 4px-based rhythm, soft blue glow). Animation: assume quiet fades/eases (`--ease-brand`), no bounces.
- **Imagery vibe**: cool, deep-blue, subtle grain/starfield; no photography in sources.

## ICONOGRAPHY
- **No icon set exists in the provided sources.** No icon font, no SVG library, no PNG icons — only the flame logo mark and ✓/✕ glyphs in the brand book.
- **Substitution (flagged)**: use **Lucide** from CDN (`https://unpkg.com/lucide@latest`) — 1.5–2px stroke, rounded terminals match Manrope's geometry. Color icons `--pale-lavender` at 60–100% opacity or `--cyber-cyan` for accents. If a real Genie icon set exists, please provide it.
- The flame mark (`assets/Genie_Logo_Mark.png`) is **not an icon** — app icons/favicons/avatars only; in all primary applications it appears within the full wordmark lockup.
- Unicode ✓ / ✕ acceptable in do-don't contexts (per brand book usage). No emoji.

## Logo rules (from brand book)
Approved backgrounds: `#0A081B` or white only. Clear space = "G" cap-height. Gradient always left-to-right Blue→Cyan; never recreate, recolor, stretch, rotate, or shadow it. Sub-brand name sits below the wordmark, italic Manrope 600, Cyan→Mint gradient, left-aligned to the "G".

## Index
- `styles.css` — global entry (imports everything below)
- `tokens/` — `colors.css`, `typography.css`, `shape.css` (additions), `fonts.css` (@font-face), `base.css`
- `assets/` — `Genie_Logo.png`, `Genie_Logo_Mark.png`, `Genie_Kreator_Logo.png`, `Genie_Orchestrator_logo.png`, `Genie_Tracker_logo.png`, `backgrounds/` (3 full-bleed), `fonts/` (Manrope ×7)
- `guidelines/` — foundation specimen cards (Design System tab)
- `components/` — Button, IconButton, Input, Select, Checkbox, Radio, Switch, Card, Badge, Tag, Tabs, ProgressBar, Dialog, Toast, Tooltip (standard set — no component inventory existed in sources; see "Intentional additions")
- `SKILL.md` — agent skill entry point

## Intentional additions
- Component set above: authored from foundations because no source defines product components. Simulations/roleplay/assessment UI patterns should be rebuilt from real product code when available.
- `tokens/shape.css`: radii, spacing, shadow, easing (brand book silent on these).
- Lucide icons via CDN (no brand icon set provided).

## Caveats / gaps
- No product UI source → **no UI kits**; recreating GenieKreator screens without code or Figma would be invention.
- No slide templates provided → no sample slides.
- Fonts are the real Manrope TTFs (no substitution needed).
