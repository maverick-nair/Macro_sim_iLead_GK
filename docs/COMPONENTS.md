# Component conventions

How components in `src/components` are built. The reference implementations are `metric/` (MetricBar, KpiTile) and `reason/` (ReasonChip, ReasonDetail). Read them before writing a new one.

## The workflow for every component

1. **Find it in the ported screens** (`src/screens/*`). The ported markup is the visual spec: its inline CSS strings are exactly what the design renders.
2. **Build it** in `src/components/<area>/<Name>.tsx` with Tailwind utilities on tokens. It is presentational: props in, events out, no game logic and no engine calls.
3. **Replace the ported markup** in the screen with the component, keeping the screen's own data shaping: the ported screens serve the design fixtures for `/screens` and `?engine=off`. On the playable board, `src/components/board/` shapes the engine view into the same props.
4. **Prove parity** with `npm run parity` (or `npm run parity -- b1 b4` for the frames that show it). Every frame must still pass. `tests/visual/probe.ts <frame> '<selector>'` prints computed style differences against the prototype when one fails.
5. **Write stories** in `<Name>.stories.tsx` next to the component, covering every state and variant (default, hover or focus where it matters, selected, disabled, low or empty values, tablet size, 834 wide, long text).
6. `npm test` and `npx tsc -b` pass. The guard test (`src/components/guard.test.ts`) catches the common hardcoded values and inline strings (see below for what it does not catch).

## Rules

The guard test checks some of these rules, not all. It scans `src/components` only (not stories or tests, and not `src/ds`, `src/screens` or `src/app`), one line at a time, with regular expressions for:
- hex colours and colour functions (`#fff`, `oklch(`, `rgba(`, `color-mix(`)
- `px`, `rem` and `em` values, and arbitrary Tailwind values (`w-[46px]`)
- the legacy `css()` helper and `--ik-` variables
- numeric style values for common box and type properties (`fontSize: 12`, `padding: '4px'`)
- visible text written inside JSX on one line, and literal `aria-label`, `title`, `placeholder` and `alt` attributes

It does not see text split across lines, strings held in variables or passed as props, `aria-*` values in expressions, or arbitrary properties such as `[transition:200ms]` (only the `name-[value]` form is caught). Review those by hand. The copy rules (no dashes, no emoji, "skills") are checked on the catalog by `src/i18n/catalog.test.ts`.

- **No literal colors, pixel values or arbitrary Tailwind values** (`w-[46px]`, `#fff`, `oklch(...)`, `fontSize: 12`). Use token utilities:
  - colors: `text-fg-primary`, `bg-surface-raised`, `border-line-default`, `text-status-gain`, `bg-brand-deep-space`
  - type: `text-12`, `text-13`, `font-700`, `font-600`
  - spacing on the 4px unit with quarter steps: `h-6.5` = 26px, `p-2.5` = 10px, `gap-0.75` = 3px, `size-3` = 12px
  - radius: `rounded-14`, `rounded-pill`, `rounded-round`
  - blur: `backdrop-blur-12`
  - fills: `bg-(image:--il-fill-brand)`, `bg-(image:--il-metric-bar-fill)`
- **Composite values** (grid templates, gradients, shadows, transitions) become component tokens in `tokens/component/<area>.json` and are used as `grid-cols-(--il-metric-bar-columns)`, `shadow-(--il-card-glow)` or `[transition:var(--il-metric-bar-transition)]`. New raw colors go in `tokens/primitive/<area>.json`, new meanings in `tokens/semantic/<area>.json`. Never edit `base.json` files or the `*.generated.*` files; run `npm run tokens` after changing tokens.
- **No inline strings.** Every visible string, `aria-label`, `title`, `placeholder` and `alt` comes from `t()` (`useT()` or `useI18n()` from `src/i18n`). Add keys to `src/i18n/messages/en/<area>.json` and import the file in `messages/en/index.ts`. Messages are ICU (`{count, plural, one {# day} other {# days}}`, `{x, select, ...}`). Copy rules apply: no dash characters at all, no emoji, "skills" never "competency". Numbers go through `number()` and deltas through `delta()`, which use the minus sign U+2212.
- Strings that arrive from data (names, titles, engine text) are props, not catalog entries.

## Things that are easy to get wrong

- **Tailwind preflight is on** (since M8, D78): margins, paddings and borders start at 0, headings and buttons inherit the font, lists have no markers (`list-disc` brings them back), images and SVGs are blocks, and `border`, `border-t` and the like draw only the sides they name. A button's padding is whatever its classes say, so give it `px-*`/`py-*` when the design has padding.
- Global resets live in `@layer base`, so utilities always win over them. Inline styles still beat utilities, so don't mix a component's utilities with a leftover inline style for the same property.
- **Runtime whitespace:** the ported markup sometimes keeps a literal space between inline elements (`<span>▲</span> {text}`). Keep it: it is part of the design.
- Tailwind `text-*` sets font size only; line height is inherited (1.5 from the app root), matching the design.
- **Interactive elements** need visible focus (`focus-visible:` utilities with `outline-accent-secondary`), keyboard support and an accessible name. Use Radix primitives (`@radix-ui/react-tooltip`, `react-dialog`, `react-toggle-group`) where they fit, styled to the design. Radix must not change the pixels of the default state.
- **Motion** only explains change, 150 to 300ms (`duration.fast/base/slow`, `easing.spring/settle` tokens). The global reduced motion rules already turn transitions and animations off.
- Data-driven values (a bar width from a score, a ring dash from trust) are fine as inline styles. Fixed design values are not.

## Stories

Stories live next to their component, import fixtures inline, and may use literal strings and numbers. The Storybook decorator wraps every story in `.il-theme` and the i18n provider. Use the toolbar to check dark, light and the client theme.
