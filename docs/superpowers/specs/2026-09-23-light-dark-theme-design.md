# Light / Dark Theme — Design Spec

Date: 2026-09-23 · Branch: `feat/theme-landing-sera` · Status: approved design, spec uncommitted

## Goal

A first-class light and dark theme across every visible page and overlay in this
repo, switched by one toggle control. Dark stays the default and must look
exactly as it does today.

## Hard constraints

- Colour tokens and colour classes only. No changes to form submit logic,
  validation, OTP, R2 upload, the Sera interview flow, or anything in `netlify/`.
- Do not touch dashboard work, `package.json`, `package-lock.json`,
  `vite.config.js`, `eslint.config.js`, `netlify.toml`.
- `index.html`: exactly one added inline `<script>` in `<head>`. MSG91 loader untouched.
- No commits, no pushes.
- Hero slider always shows 4 slides. Theme chooses the set; index `i` in dark == index `i` in light.

## In scope (every file whose colours change)

| Area | Files |
|---|---|
| Theme core (new) | `src/theme/theme.js`, `src/theme/useTheme.js`, `src/theme/ThemeToggle.jsx`, `src/theme/FloatingThemeToggle.jsx` |
| Global | `src/index.css`, `index.html` (no-flash script only) |
| Home | `src/pages/Home.jsx`, `AnnouncementBar`, `Navbar`, `HeroSlider`, `Hero`, `Programs`, `PoweredBy`, `AIAdvantage`, `FinalCTA`, `Footer` (incl. contact modal) |
| About | `src/pages/AboutUs.jsx`, `OurVerticals`, `PhotoWall` |
| Application | `src/pages/ApplicationProcess.jsx` |
| Overlays | `ChoiceModal`, `EarlyBuildersForm`, `EarlyPartnersForm` (className strings only) |
| Meet Sera | `src/pages/MeetSera.jsx`, all `src/components/sera/*.jsx`, `src/components/sera/orbMath.js` (colour/blend only) |

Not touched: `VideoModal.jsx` (not rendered anywhere), `src/hooks/*`, `src/utils/*`,
`netlify/**`, `App.jsx`, `main.jsx` (no provider needed — see Theme state).

## Theme state

- Source of truth: `document.documentElement.dataset.theme` = `'dark' | 'light'`.
- Persistence: `localStorage['yzi-theme']`. Every access wrapped in try/catch.
  Missing/invalid/unavailable → `'dark'`.
- **No-flash script** (in `index.html` `<head>`, before the module script): reads
  storage, sets `data-theme` and `style.colorScheme` on `<html>`. Runs before CSS
  and React, so first paint is correct.
- `src/theme/theme.js`: `getTheme()`, `setTheme(t)`, `subscribe(fn)`. `setTheme`
  updates the attribute, `colorScheme`, storage, notifies subscribers, and
  suppresses CSS transitions for one frame (temporary `<style>` removed after two
  `requestAnimationFrame`s) so sections do not fade at different speeds.
- `useTheme()` = `useSyncExternalStore(subscribe, getTheme)` → `{ theme, isDark, toggle }`.
  No React context/provider, so `App.jsx`/`main.jsx` stay untouched.

## Colour tokens (`src/index.css`)

Existing `@theme` brand tokens (`yzi-orange`, `yzi-pink`, `yzi-purple`,
`yzi-blue`, `yzi-cyan`) are unchanged. `yzi-black`, `yzi-dark`, `yzi-card`,
`yzi-text`, `yzi-muted` keep their names but are re-pointed at theme variables so
existing usages flip automatically.

| Token (Tailwind name) | Dark | Light | Replaces |
|---|---|---|---|
| `pure` | `#000000` | `#FFFFFF` | `bg-black/NN` used as bar/panel/input fills (keeps dark pixel-identical) |
| `surface` / `yzi-black` | `#05050A` | `#F7F7FB` | `bg-yzi-black`, `bg-[#05050A]` page fills |
| `surface-2` / `yzi-dark` | `#0B0B14` | `#EFEFF5` | `bg-yzi-dark`, `bg-[#0B0B14]` |
| `card` / `yzi-card` | `#11111B` | `#FFFFFF` | `bg-yzi-card` |
| `fg` / `yzi-text` | `#FFFFFF` | `#0B0B14` | `text-white`, `text-white/NN`, `border-white/NN`, `bg-white/NN` (opacity kept) |
| `fg-muted` / `yzi-muted` | `#A1A1AA` | `#52525B` | `text-yzi-muted`, `text-gray-300/400/500` |
| `accent-cyan-fg` | `#22D3EE` | `#0E7490` | `text-yzi-cyan` used as text |
| `accent-orange-fg` | `#FB923C` | `#C2410C` | `text-orange-400` used as text |
| `logo-chip` | `#0B0B14` | `#0B0B14` | new: chip behind `logo.png`, applied only via `light:` |

Mechanism: `@theme` entries reference CSS variables; `:root` holds dark values,
`:root[data-theme="light"]` holds light values. Tailwind v4 opacity modifiers
(`text-fg/60`) use `color-mix` on the variable, so opacity steps work in both themes.

Custom variant for the few per-theme exceptions:
`@custom-variant light (&:where([data-theme=light], [data-theme=light] *));`
Used for things like darker gradient stops on small gradient text
(`light:from-orange-600`) and canvas-adjacent overlays.

`body` background/text use `var(--color-surface)` / `var(--color-fg)`.

### Mapping rules (applied file by file)

1. Neutral **foreground/line/fill** white → `fg` with same opacity
   (`text-white/60` → `text-fg/60`, `border-white/10` → `border-fg/10`, `bg-white/5` → `bg-fg/5`).
2. **Literal white stays white** on brand-gradient buttons/badges, on dark scrims,
   and on text sitting directly on photos that keep a dark overlay.
3. **Modal scrims stay dark** in both themes (`bg-black/80`, `bg-black/90`): unchanged.
4. **Input/panel/bar fills** `bg-black/NN` → `bg-pure/NN`.
5. **Photo overlays that fade into the page** (About hero `to-[#05050A]`, slider
   gradient) → `surface`-based so they fade into the page colour in both themes.
6. **White logo chips** in PoweredBy stay `bg-white` (logos are designed for white).
7. Inline style / `<style>` / canvas colours read CSS variables or a JS palette
   keyed by theme (see Canvases).

## Toggle control (`ThemeToggle.jsx`)

- Pill track (~52×28), circular thumb (~22). Dark: thumb right, moon + two small
  stars inside the thumb, track `surface-2` with `fg/15` border. Light: thumb
  left, sun inside thumb, track light grey with `fg/15` border. High contrast in both.
- Label `DARK MODE` / `LIGHT MODE` (10–11px, tracking-wide, `fg/70`), below the
  pill (`variant="stacked"`) or beside it (`variant="inline"`); `variant="compact"` hides
  the visible label.
- `<button type="button" role="switch" aria-checked={isDark} aria-label="Dark mode">`.
  Space/Enter via native button. `focus-visible` ring in `yzi-orange`.
  Thumb slide `transition-transform 200ms`, disabled under `motion-reduce`.
- Icons are inline SVG, `aria-hidden`.

## Placement

| Where | Position |
|---|---|
| Home desktop header | Right group: after "Application Process" links group, immediately left of "Apply Now"; vertically centred; `stacked` label |
| Home mobile header | Immediately left of the hamburger; `compact` |
| Home mobile menu | Row below "Application Process", above "Apply Here"; `inline` label |
| Meet Sera, About, Application | `FloatingThemeToggle`: `fixed top-16 right-6 z-50`, pill in a small `card/80` backdrop-blur capsule; `inline` label on ≥sm, `compact` below sm. `top-16` clears the fixed AnnouncementBar (same reasoning as Sera's back link). |

Known pre-existing issue, not fixed here (layout, not colour): Application Process
"← Back to Home" pill is `top-6`, inside the AnnouncementBar band.

## Logo

`logo.png` has a white "WORKS" wordmark. Wrap it (Navbar, Footer) in
`light:bg-logo-chip light:rounded-xl light:px-2 light:py-1`. Dark: no chip, no
padding — pixel-identical to today. Light: near-black rounded chip.

## Hero slider (`HeroSlider.jsx`)

- Import 4 dark and 4 light PNGs into `darkSlides` / `lightSlides`.
- `const slides = isDark ? darkSlides : lightSlides` — length always 4; `current`
  is preserved across a theme switch; the mobile full-screen viewer uses `slides[current]`.
- Letterbox `bg-black` → `bg-pure`. Per-slide overlay: dark keeps current
  `from-black/70 via-black/10 to-black/30`; light uses a faint `from-surface/40`
  fade only. Dots: `bg-fg` / `bg-fg/40`, and each dot gets `aria-label="Go to slide N"`
  (a11y label only, no behaviour change). Swipe hint keeps a dark pill in both.
- Preload the inactive set on `requestIdleCallback` (fallback `setTimeout`), skipped
  when `navigator.connection?.saveData` is true.
- Pairs verified same dimensions: slide1 1810×869, slides 2–4 1915×821.

## Meet Sera canvases

- `SeraNetworkBackground`: palette by theme. Light: lines `rgba(109,40,217,a*1.3)`,
  dots `rgba(8,145,178,0.8)`, vignette built from `247,247,251` instead of `5,5,10`.
- `SeraOrb` / `orbMath.js`: accept a `blendMode` option. Light: always
  `source-over` (additive `lighter` washes out on white) and deeper colours
  (`#7c3aed` → `#0891b2`). Dark: unchanged behaviour. Error colours unchanged.
- `SeraHero` headline gradient starts at `var(--theme-fg)` instead of `#fff`.
- Glow `shadow-[...]` colours: unchanged (brand glows read fine on both).

## Verification (no test runner exists in this repo)

1. `npm run build` and `npm run lint` pass.
2. Grep gate: in-scope files contain no `bg-yzi-black`-style hardcoded page fills
   and no `text-white/`, `border-white/`, `bg-white/` except the allowed exceptions
   (brand buttons, scrims, PoweredBy logo chips) — each remaining hit reviewed.
3. Browser (built-in pane, `npm run dev`), at 375px and 1280px, both themes:
   `/`, `/about`, `/application-process`, `/meet-sera`; open ChoiceModal,
   Builders form, Partners form, Footer contact modal (open only; do not submit).
4. Reload in light mode → no dark flash; clear storage → dark default.
5. Toggle by keyboard (Tab, Space, Enter); screen-reader name/state via accessibility tree.
6. Slider: switch theme on slide 3 → still slide 3, 4 dots.
7. Dark mode matches the current look, apart from the added toggle controls.
