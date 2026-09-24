# Light / Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page and overlay in this repo renders in a dark theme (default, pixel-identical to today) or a light theme, switched by one accessible toggle, with no flash on load.

**Architecture:** Theme lives on `<html data-theme>`, set before first paint by an inline script in `index.html` and changed at runtime by a tiny external store (`src/theme/theme.js`) read through `useSyncExternalStore`. Colours come from `--theme-*` CSS variables exposed as Tailwind v4 tokens (`fg`, `surface`, `pure`, …); existing hardcoded `white`/`black`/hex classes are rewritten to those tokens. Canvases and inline styles read the theme from the same hook.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), react-router-dom 7. No test runner exists and `package.json` may not change, so verification is `npm run build`, `npm run lint`, grep gates, and scripted checks in the built-in browser pane.

**Spec:** `docs/superpowers/specs/2026-09-23-light-dark-theme-design.md`

## Global Constraints

- Branch `feat/theme-landing-sera`. **No `git commit`, no `git push`.** Every "Commit" step in this plan is replaced by "Checkpoint": run `git status --short` and confirm only the task's listed files changed.
- Change colour tokens / colour classes / colour inline styles only. Do not change form submit logic, validation, OTP, R2 upload, interview flow, JSX structure of forms, or anything in `netlify/`.
- Do not touch: dashboard work, `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`, `netlify.toml`, `src/hooks/*`, `src/utils/*`, `src/App.jsx`, `src/main.jsx`, `src/components/VideoModal.jsx`.
- `index.html`: add exactly one inline `<script>` in `<head>`. The MSG91 loader script stays byte-identical.
- Default theme `dark`. Storage key `yzi-theme`, values `'dark' | 'light'`.
- Dark theme must be pixel-identical to today, apart from the new toggle controls.
- Hero slider: always 4 slides; `isDark ? darkSlides[i] : lightSlides[i]`.
- Logo: no new asset. Light theme only: near-black chip (`#0B0B14`) behind `logo.png`.

### Recolour rules (apply in every recolour task)

Tokens (defined in Task 1). Dark values equal today's values exactly.

| Token | Dark | Light |
|---|---|---|
| `pure` | `#000000` | `#FFFFFF` |
| `surface` (= `yzi-black`) | `#05050A` | `#F7F7FB` |
| `surface-2` (= `yzi-dark`) | `#0B0B14` | `#EFEFF5` |
| `card` (= `yzi-card`) | `#11111B` | `#FFFFFF` |
| `fg` (= `yzi-text`) | `#FFFFFF` | `#0B0B14` |
| `fg-muted` (= `yzi-muted`) | `#A1A1AA` | `#52525B` |
| `accent-cyan-fg` | `#22D3EE` | `#0E7490` |
| `accent-orange-fg` | `#FB923C` | `#C2410C` |
| `logo-chip` | `#0B0B14` | `#0B0B14` |

- **R1** `white` as neutral text / border / fill / ring / placeholder / `file:` → `fg`, same opacity. `text-white/60`→`text-fg/60`, `border-white/10`→`border-fg/10`, `bg-white/[0.03]`→`bg-fg/[0.03]`, `hover:bg-white/10`→`hover:bg-fg/10`, `placeholder:text-white/30`→`placeholder:text-fg/30`, `file:text-white`→`file:text-fg`, `via-white/10`→`via-fg/10`.
- **R2** `black` used as a panel / input / bar fill that should flip → `pure`, same opacity. `bg-black/50`→`bg-pure/50`, `bg-black`→`bg-pure`.
- **R3** Hex page fills: `bg-[#05050A]`→`bg-surface`, `bg-[#0B0B14]`→`bg-surface-2`, `to-[#05050A]`→`to-surface`.
- **R4 KEEP `text-white`** on elements with a brand fill (`bg-gradient-to-*` whose stops are yzi/orange/pink/purple/blue/cyan, or solid `bg-yzi-orange|pink|purple|blue`, `bg-orange-500` etc.). **ADD `text-white`** to any such brand-filled element that currently has no text colour (it inherits `fg`, which is dark in light theme).
- **R5 KEEP dark:** modal scrims (`fixed inset-0 … bg-black/80|/90`), full-screen image viewers/lightboxes (`bg-black/95`) and every control/text inside a viewer, the slider swipe-hint pill, the About hero photo overlay and the text on it.
- **R6 KEEP `bg-white`** on the PoweredBy logo tiles and the Footer partner-logo chip (logos are designed for white).
- **R7** Grey text: `text-gray-300`→`text-fg/80`, `text-gray-400`→`text-fg-muted`, `text-gray-500`→`text-fg-muted` (keep any prefix: `placeholder:`, `hover:`).
- **R8** Coloured text readable on white: `text-orange-400`→`text-accent-orange-fg` (also `marker:`), `text-yzi-cyan`→`text-accent-cyan-fg`. Append a light override to: `text-red-400`→`text-red-400 light:text-red-600`, `hover:text-red-300`→`hover:text-red-300 light:hover:text-red-700`, `text-green-400`→`text-green-400 light:text-green-700`, `text-yzi-pink`→`text-yzi-pink light:text-pink-600`, `text-yzi-orange` (as text)→`text-yzi-orange light:text-orange-600`, `text-yzi-purple` (as text)→`text-yzi-purple light:text-purple-700`.
- **R9** `bg-yzi-*`/`text-yzi-muted` classes already flip via Task 1; leave them.
- **R10** Never change class order, layout, spacing, or non-colour classes (except the explicit toggle/logo insertions in Tasks 2–3).

**Grep gate** (run per file after recolouring; every hit must be on that task's KEEP list):

```bash
grep -nE "(^|[\" :])(text|bg|border|from|via|to|ring|divide|outline|placeholder:text|file:bg|file:text)-(white|black)(/|\b)|#05050A|#0B0B14|text-gray-[345]00|text-orange-400|text-yzi-cyan|rgba\(255, ?255, ?255|rgba\(5, ?5, ?10" <FILE>
```

## Review Focus

1. **Brand buttons that inherit text colour** (e.g. Navbar "Apply Now", Programs CTAs): in light theme they would render dark text on orange. Expected: white text. Pinned by R4 and the brand-button checks in Task 2 Step 6, Task 4 Step 7, Task 5 Step 6.
2. **Storage unavailable** (private mode / blocked site data / `localStorage` throws): expected dark theme, toggle still works for the page view, no console error. Pinned in Task 1 Step 6.
3. **Reduced motion** (`prefers-reduced-motion: reduce`): canvases draw once; after a theme switch they must redraw in the new palette, and the toggle thumb must not animate. Pinned in Task 7 Step 8 and Task 2 Step 6.
4. **Theme switched while an overlay is open** (form modal, image viewer, lightbox): expected the overlay recolours in place (or stays dark per R5), slide index and typed form values are preserved. Pinned in Task 3 Step 6, Task 4 Step 7, Task 5 Step 6, Task 6 Step 6.
5. **Muted mic button icon on cyan fill** (`SeraInterview` line 81 uses `text-yzi-black` on `bg-yzi-cyan` when muted): `yzi-black` flips to near-white in light, making the mic icon invisible. Expected: stays dark in both. Pinned in Task 7 Step 5.

---

### Task 1: Theme core — tokens, no-flash script, store, hook

**Files:**
- Modify: `src/index.css` (whole file, 30 lines)
- Modify: `index.html:6-7` (insert script after the viewport meta)
- Create: `src/theme/theme.js`
- Create: `src/theme/useTheme.js`

**Interfaces:**
- Produces: `getTheme(): 'dark'|'light'`, `setTheme(t: 'dark'|'light'): void`, `subscribe(fn: () => void): () => void` from `src/theme/theme.js`; `useTheme(): { theme: 'dark'|'light', isDark: boolean, toggle: () => void }` from `src/theme/useTheme.js`; Tailwind tokens `pure surface surface-2 card fg fg-muted accent-cyan-fg accent-orange-fg logo-chip`; variant `light:`; CSS vars `--theme-fg`, `--theme-surface`, etc.; attribute `data-theme-thumb` exempt from transition suppression.

- [ ] **Step 1: Baseline.** Run `npm install` (clone has no `node_modules`), then `npm run build` and `npm run lint`. Record whether lint is clean today so later tasks compare against it. Expected: build succeeds.

- [ ] **Step 2: Replace `src/index.css` with:**

```css
@import "tailwindcss";

/* `light:` variant — applies when <html data-theme="light"> */
@custom-variant light (&:where([data-theme="light"], [data-theme="light"] *));

@theme {
  /* Main Gradient Colors (from your posters) — identical in both themes */
  --color-yzi-orange: #FF5E00;
  --color-yzi-pink: #FF008A;
  --color-yzi-purple: #8B5CF6;
  --color-yzi-blue: #3B82F6;
  --color-yzi-cyan: #22D3EE;

  /* Chip behind logo.png in light theme (its "WORKS" wordmark is white) */
  --color-logo-chip: #0B0B14;
}

/* Theme-switched colours. `inline` makes utilities read --theme-* directly,
   so opacity modifiers (text-fg/60) work in both themes. */
@theme inline {
  --color-yzi-black: var(--theme-surface);
  --color-yzi-dark: var(--theme-surface-2);
  --color-yzi-card: var(--theme-card);
  --color-yzi-text: var(--theme-fg);
  --color-yzi-muted: var(--theme-fg-muted);

  --color-pure: var(--theme-pure);
  --color-surface: var(--theme-surface);
  --color-surface-2: var(--theme-surface-2);
  --color-card: var(--theme-card);
  --color-fg: var(--theme-fg);
  --color-fg-muted: var(--theme-fg-muted);
  --color-accent-cyan-fg: var(--theme-accent-cyan-fg);
  --color-accent-orange-fg: var(--theme-accent-orange-fg);
}

:root {
  --theme-pure: #000000;
  --theme-surface: #05050A;
  --theme-surface-2: #0B0B14;
  --theme-card: #11111B;
  --theme-fg: #FFFFFF;
  --theme-fg-muted: #A1A1AA;
  --theme-accent-cyan-fg: #22D3EE;
  --theme-accent-orange-fg: #FB923C;
}

:root[data-theme="light"] {
  --theme-pure: #FFFFFF;
  --theme-surface: #F7F7FB;
  --theme-surface-2: #EFEFF5;
  --theme-card: #FFFFFF;
  --theme-fg: #0B0B14;
  --theme-fg-muted: #52525B;
  --theme-accent-cyan-fg: #0E7490;
  --theme-accent-orange-fg: #C2410C;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--theme-surface);
  color: var(--theme-fg);
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 3: Insert the no-flash script in `index.html`** directly after line 6 (`<meta name="viewport" …>`), before `<title>`. Touch nothing else.

```html
    <script>
      (function () {
        var theme = 'dark';
        try {
          if (localStorage.getItem('yzi-theme') === 'light') theme = 'light';
        } catch (e) {}
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
      })();
    </script>
```

- [ ] **Step 4: Create `src/theme/theme.js`:**

```js
// Theme state lives on <html data-theme>. The inline script in index.html sets
// it before first paint; this module reads and changes it after that.
const STORAGE_KEY = 'yzi-theme'
const listeners = new Set()

export function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

// Swap every colour in one frame instead of letting each element run its own
// transition. The toggle thumb keeps its slide animation.
function suppressTransitions() {
  const style = document.createElement('style')
  style.textContent = '*:not([data-theme-thumb]),*::before,*::after{transition:none!important}'
  document.head.appendChild(style)
  requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
}

export function setTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark'
  if (next === getTheme()) return
  suppressTransitions()
  const root = document.documentElement
  root.dataset.theme = next
  root.style.colorScheme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage blocked (private mode etc.): the theme still applies for this page view.
  }
  listeners.forEach((fn) => fn())
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
```

- [ ] **Step 5: Create `src/theme/useTheme.js`:**

```js
import { useCallback, useSyncExternalStore } from 'react'
import { getTheme, setTheme, subscribe } from './theme'

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark')
  const toggle = useCallback(() => setTheme(getTheme() === 'dark' ? 'light' : 'dark'), [])
  return { theme, isDark: theme === 'dark', toggle }
}
```

- [ ] **Step 6: Verify in the browser.** `npm run build` and `npm run lint` pass. Start `yzi-dev` via `preview_start`, open `/`. In `javascript_tool` run each and compare:
  - `document.documentElement.dataset.theme` → `"dark"`; page looks exactly as before.
  - `localStorage.setItem('yzi-theme','light'); location.reload()` then `[document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor]` → `["light", "rgb(247, 247, 251)"]`. Home is partly unthemed at this point — expected.
  - `localStorage.setItem('yzi-theme','bogus'); location.reload()` → theme `"dark"`.
  - Blocked storage: `Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})` cannot persist across reload, so verify the script's `try` path by reading the `index.html` source: the `getItem` call is inside `try`, and the default is `'dark'`. In `theme.js`, `setItem` is inside `try`.
  - Reset: `localStorage.removeItem('yzi-theme'); location.reload()`.

- [ ] **Step 7: Checkpoint.** `git status --short` shows only `index.html`, `src/index.css`, `src/theme/` (plus the existing untracked `src/assets/slides-light/` and `docs/`).

---

### Task 2: Toggle control + Navbar + AnnouncementBar + logo chip

**Files:**
- Create: `src/theme/ThemeToggle.jsx`
- Create: `src/theme/FloatingThemeToggle.jsx`
- Modify: `src/components/Navbar.jsx` (lines 16–91)
- Modify: `src/components/AnnouncementBar.jsx` (lines 6–55)

**Interfaces:**
- Consumes: `useTheme()` from Task 1; `data-theme-thumb` attribute contract.
- Produces: `<ThemeToggle variant="stacked"|"inline"|"compact" className? labelClassName? />` (default export of `src/theme/ThemeToggle.jsx`); `<FloatingThemeToggle />` (default export of `src/theme/FloatingThemeToggle.jsx`, fixed `top-16 right-6 z-50`).

- [ ] **Step 1: Create `src/theme/ThemeToggle.jsx`:**

```jsx
import { useTheme } from './useTheme'

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
      <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </svg>
  )
}

// variant: 'stacked' (label under pill), 'inline' (label beside), 'compact' (no visible label)
function ThemeToggle({ variant = 'stacked', className = '', labelClassName = '' }) {
  const { isDark, toggle } = useTheme()
  const layout = variant === 'inline' ? 'flex-row gap-2.5' : 'flex-col gap-1'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggle}
      className={`inline-flex items-center ${layout} rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yzi-orange ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative block w-[52px] h-7 rounded-full border ${
          isDark ? 'bg-[#16162A] border-white/25' : 'bg-zinc-200 border-black/15'
        }`}
      >
        {isDark && (
          <>
            <span className="absolute left-[10px] top-[7px] w-[3px] h-[3px] rounded-full bg-white/90" />
            <span className="absolute left-[17px] top-[15px] w-[2px] h-[2px] rounded-full bg-white/70" />
            <span className="absolute left-[7px] top-[17px] w-[2px] h-[2px] rounded-full bg-white/50" />
          </>
        )}
        <span
          data-theme-thumb
          className={`absolute top-[2px] left-[2px] w-[22px] h-[22px] rounded-full grid place-items-center shadow-md transition-transform duration-200 ease-out motion-reduce:transition-none ${
            isDark
              ? 'translate-x-6 bg-[#0B0B14] text-yellow-200 ring-1 ring-white/40'
              : 'translate-x-0 bg-white text-orange-500 ring-1 ring-black/10'
          }`}
        >
          {isDark ? <MoonIcon /> : <SunIcon />}
        </span>
      </span>
      {variant !== 'compact' && (
        <span
          aria-hidden="true"
          className={`text-[10px] font-semibold tracking-[0.14em] leading-none text-fg/75 ${labelClassName}`}
        >
          {isDark ? 'DARK MODE' : 'LIGHT MODE'}
        </span>
      )}
    </button>
  )
}

export default ThemeToggle
```

- [ ] **Step 2: Create `src/theme/FloatingThemeToggle.jsx`:**

```jsx
import ThemeToggle from './ThemeToggle'

// For pages without the Navbar (About, Application Process, Meet Sera).
// top-16 clears the fixed AnnouncementBar (~45–49px tall).
function FloatingThemeToggle() {
  return (
    <div className="fixed top-16 right-6 z-50 rounded-full bg-card/80 backdrop-blur-md border border-fg/15 px-2.5 py-1.5 shadow-lg">
      <ThemeToggle variant="inline" labelClassName="hidden sm:inline" />
    </div>
  )
}

export default FloatingThemeToggle
```

- [ ] **Step 3: Edit `src/components/Navbar.jsx`.** Add `import ThemeToggle from '../theme/ThemeToggle'` after line 6. Then apply exactly:
  - Line 16: `bg-black/80 … border-white/10` → `bg-pure/80 … border-fg/10`.
  - Line 20 logo wrapper: `<div className="flex items-center">` → `<div className="flex items-center light:bg-logo-chip light:rounded-xl light:px-2.5 light:py-1">`.
  - Line 29: `text-white/80` → `text-fg/80`; lines 30, 31, 34: `hover:text-white` → `hover:text-fg`.
  - Replace the Desktop CTA block (lines 39–45) with:

```jsx
          {/* Desktop: theme toggle + CTA */}
          <div className="hidden md:flex items-center gap-6">
            <ThemeToggle variant="stacked" />
            <button 
              onClick={() => setIsChoiceOpen(true)}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-white text-sm font-medium hover:scale-105 transition-transform"
            >
              Apply Now
            </button>
          </div>
```

  - Replace the Mobile Hamburger block (lines 47–55) with (hamburger button unchanged except `bg-white`→`bg-fg` on its three spans):

```jsx
          {/* Mobile: theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-3">
            <ThemeToggle variant="compact" />
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex flex-col gap-1.5 p-2"
            >
              <span className={`w-6 h-0.5 bg-fg transition-all ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
              <span className={`w-6 h-0.5 bg-fg transition-all ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
              <span className={`w-6 h-0.5 bg-fg transition-all ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
            </button>
          </div>
```

  - Line 60: `bg-black/95 border-t border-white/10` → `bg-pure/95 border-t border-fg/10`. Lines 64, 71, 78: `text-white/90` → `text-fg/90`.
  - After the Application Process `<Link>` (ends line 81), insert:

```jsx
            <div className="flex items-center justify-between py-2">
              <span className="text-fg/90">Theme</span>
              <ThemeToggle variant="inline" />
            </div>
```

  - Line 87 Apply Here button: add `text-white` after `to-yzi-pink` (R4).

- [ ] **Step 4: Edit `src/components/AnnouncementBar.jsx`.**
  - Line 55: `bg-black border-b border-white/10` → `bg-pure border-b border-fg/10`.
  - Lines 10, 16, 24, 30, 38, 44, 50: `text-white/30` → `text-fg/30`. Lines 12, 26, 40: `text-white/80` → `text-fg/80`. Line 46: `text-white/40` → `text-fg/40`.
  - Gradient text, add light stops so small text stays readable on white:
    - line 6: append ` light:from-orange-600 light:via-pink-600 light:to-purple-600`
    - line 20: append ` light:from-cyan-600 light:via-blue-600 light:to-purple-600`
    - line 34: append ` light:from-pink-600 light:via-orange-600 light:to-yellow-600`

- [ ] **Step 5: Grep gate** on `Navbar.jsx` and `AnnouncementBar.jsx`. KEEP list: none, except `text-white` on the two brand buttons.

- [ ] **Step 6: Browser check** at 1280×800 and 375×812 (`resize_window`), both themes:
  - Desktop header order: logo · About Us · Meet Ai Sera · Application Process · [toggle over "DARK MODE"] · Apply Now; toggle vertically centred.
  - Mobile header: logo · toggle · hamburger. Open menu: "Theme" row with toggle + label, between Application Process and Apply Here.
  - `find` "Dark mode" → role `switch`; Tab to it, press Space, then Enter: theme flips each time; `aria-checked` flips (`read_page`).
  - Brand-button text check: `getComputedStyle([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Apply Now')).color` → `rgb(255, 255, 255)` in light.
  - Light theme: logo sits on a dark rounded chip; "WORKS" readable. Dark theme: no chip visible.
  - Reduced motion: emulate via DevTools not available — instead confirm the thumb has class `motion-reduce:transition-none` via `read_page`/DOM query.

- [ ] **Step 7: Checkpoint.** `git status --short` adds only the four files above.

---

### Task 3: Hero slider — theme-selected slide set

**Files:**
- Modify: `src/components/HeroSlider.jsx` (lines 1–7, 11–35, 74, 106, 119–131)

**Interfaces:**
- Consumes: `useTheme()`.
- Produces: nothing new.

- [ ] **Step 1: Replace lines 1–7 with:**

```jsx
import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../theme/useTheme'
import slide1 from '../assets/slide1.png'
import slide2 from '../assets/slide2.png'
import slide3 from '../assets/slide3.png'
import slide4 from '../assets/slide4.png'
import slideLight1 from '../assets/slides-light/slide1.png'
import slideLight2 from '../assets/slides-light/slide2.png'
import slideLight3 from '../assets/slides-light/slide3.png'
import slideLight4 from '../assets/slides-light/slide4.png'

// Same index = same slide in both themes. Pairs share dimensions
// (slide1 1810×869, slides 2–4 1915×821), so layout never shifts.
const darkSlides = [slide1, slide2, slide3, slide4]
const lightSlides = [slideLight1, slideLight2, slideLight3, slideLight4]
const SLIDE_COUNT = darkSlides.length
```

- [ ] **Step 2:** Inside `HeroSlider()`, as the first lines add:

```jsx
  const { isDark } = useTheme()
  const slides = isDark ? darkSlides : lightSlides
```

  Replace `slides.length` with `SLIDE_COUNT` in the autoplay effect (line 32) and `goTo` (line 37) so those callbacks do not depend on the per-render array.

- [ ] **Step 3:** After the autoplay effect, add the idle preload of the inactive set:

```jsx
  // Warm the other theme's slides so a switch is instant. Skipped on Data Saver.
  useEffect(() => {
    if (navigator.connection?.saveData) return
    const inactive = isDark ? lightSlides : darkSlides
    const run = () => inactive.forEach((src) => { new Image().src = src })
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run)
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(run, 2000)
    return () => clearTimeout(id)
  }, [isDark])
```

- [ ] **Step 4: Recolour.**
  - Line 74: `bg-black` → `bg-pure`.
  - Line 106 overlay: replace the static className with

```jsx
                <div className={`absolute inset-0 bg-gradient-to-t pointer-events-none ${
                  isDark
                    ? 'from-black/70 via-black/10 to-black/30 md:to-black/40'
                    : 'from-black/15 via-transparent to-transparent'
                }`}></div>
```

  - Lines 110 swipe hint, 138–155 viewer: KEEP (R5).
  - Indicators, lines 121–130: add `aria-label={`Go to slide ${index + 1}`}` to the `<button>`; `'bg-white w-7' : 'bg-white/50 w-2.5'` → `'bg-fg w-7' : 'bg-fg/40 w-2.5'`.

- [ ] **Step 5: Grep gate.** KEEP: line with `bg-black/40` (swipe hint), `text-white/70` (hint), `bg-black/95` + `bg-white/10`/`bg-white/20`/`text-white` + `text-white/50` inside the viewer, and the `from-black/70`/`from-black/15` overlay strings.

- [ ] **Step 6: Browser check.**
  - `document.querySelectorAll('section img[alt^="YZI Works slide"]').length` → `4` in both themes.
  - Click dot 3, toggle theme: the 3rd dot is still active and the `src` of slide 3 now contains `slides-light` (light) / not (dark).
  - Mobile 375: tap slide → viewer opens; toggle theme via DevTools-free route: `javascript_tool` `document.querySelector('[role=switch]').click()` while viewer is open → viewer image switches to the other set, still slide 3.
  - Network (`read_network_requests` filter `slides-light`): in dark, light PNGs load only after idle, not before first render completes.

- [ ] **Step 7: Checkpoint.**

---

### Task 4: Home sections — Home, Hero, Programs, PoweredBy, AIAdvantage, FinalCTA, Footer

**Files:**
- Modify: `src/pages/Home.jsx:12`
- Modify: `src/components/Hero.jsx`, `Programs.jsx`, `PoweredBy.jsx`, `AIAdvantage.jsx`, `FinalCTA.jsx`, `Footer.jsx`

**Interfaces:**
- Consumes: tokens + `light:` variant (Task 1).

- [ ] **Step 1: `Home.jsx` line 12:** `bg-yzi-black text-white` → `bg-yzi-black text-fg`.

- [ ] **Step 2: Apply R1–R10 to `Hero.jsx`, `Programs.jsx`, `FinalCTA.jsx`.** Specifically check every `bg-gradient-to-r from-yzi-orange to-yzi-pink` / `from-yzi-purple to-yzi-blue` button or badge: if it has no `text-*` colour, add `text-white` (R4). `text-yzi-cyan` (FinalCTA eyebrow) → `text-accent-cyan-fg` (R8).

- [ ] **Step 3: `PoweredBy.jsx`.**
  - Line 90: `bg-[#05050A] border-t border-white/5` → `bg-surface border-t border-fg/5`. Line 93 `text-white` → `text-fg`.
  - Lines 114–118 tile: KEEP `bg-white` (R6); `border-white/10` → `border-fg/10`.
  - Line 79 JS shadow: soften in light theme. Replace line 78 `const glow = 0.25 + eased * 0.55 // 0.25 -> 0.8` with

```js
        const lightFactor = document.documentElement.dataset.theme === 'light' ? 0.35 : 1
        const glow = (0.25 + eased * 0.55) * lightFactor // dark: 0.25 -> 0.8
```

- [ ] **Step 4: `AIAdvantage.jsx`.** R1–R10 on classes (line 24 `via-white/10` → `via-fg/10`). In the `<style>` block replace:
  - `border-color: rgba(255, 255, 255, 0.1);` → `border-color: color-mix(in srgb, var(--theme-fg) 10%, transparent);`
  - `border-color: rgba(255, 255, 255, 0.35);` → `border-color: color-mix(in srgb, var(--theme-fg) 35%, transparent);`
  - `box-shadow: 0 0 30px rgba(255, 255, 255, 0.08);` → `box-shadow: 0 0 30px color-mix(in srgb, var(--theme-fg) 8%, transparent);`

- [ ] **Step 5: `Footer.jsx`.**
  - Line 163: `bg-[#05050A]` → `bg-surface`. Line 170: `bg-[#0B0B14] border border-white/10` → `bg-surface-2 border border-fg/10`.
  - Logo (lines 346–350): its parent is a flex column with other children, so put the chip on the `<img>` itself. `className="h-32 md:h-32 w-auto object-contain py-2"` → `className="h-32 md:h-32 w-auto object-contain py-2 light:bg-logo-chip light:rounded-2xl light:px-4"`. The existing `py-2` already gives vertical breathing room; `h-32` is border-box, so the chip stays 128px tall.
  - Line 169 scrim `bg-black/80`: KEEP (R5). Lines 221, 241, 261, 280, 298 inputs: `bg-black/40` → `bg-pure/40` (R2). Line 396 `bg-white` partner chip: KEEP (R6).
  - All other white/grey/orange text per R1, R7, R8; `from-orange-500 to-pink-500` buttons get `text-white` if missing (R4).

- [ ] **Step 6: Grep gate** each file. KEEP: brand-button `text-white`; Footer scrim `bg-black/80`; Footer `bg-white` partner chip; PoweredBy `bg-white` tiles and `shadow-[0_8px_30px_rgba(0,0,0,0.35)]`.

- [ ] **Step 7: Browser check,** both themes, 1280 and 375: scroll the whole Home page; every section background, card, border and text flips; no dark block remains in light. Brand-button text check: every button whose computed `backgroundImage` contains `gradient` has computed `color` `rgb(255, 255, 255)`:

```js
[...document.querySelectorAll('button, a')].filter(e => getComputedStyle(e).backgroundImage.includes('gradient')).map(e => [e.textContent.trim().slice(0,30), getComputedStyle(e).color])
```

  Open the Footer contact modal, type into a field, toggle theme with `document.querySelector('[role=switch]').click()`: modal recolours, typed text preserved. Do not submit.

- [ ] **Step 8: Checkpoint.**

---

### Task 5: Overlays — ChoiceModal, EarlyBuildersForm, EarlyPartnersForm

**Files:**
- Modify: `src/components/ChoiceModal.jsx`, `src/components/EarlyBuildersForm.jsx`, `src/components/EarlyPartnersForm.jsx` — **className strings only.**

**Interfaces:**
- Consumes: tokens + `light:` variant.

- [ ] **Step 1: Snapshot logic for later comparison.** Save a class-stripped copy of each form so Step 5 can prove only classes changed:

```bash
S="C:/Users/WCLCHA~1/AppData/Local/Temp/claude/C--Users-WCL-CHA-28-Desktop-YZIWORKSADMIN-main/8aba6c4e-99fa-41ba-b77e-ca3a6afd660e/scratchpad"
for f in EarlyBuildersForm EarlyPartnersForm ChoiceModal; do perl -0pe 's/className=("[^"]*"|\{`[^`]*`\})//gs' src/components/$f.jsx > "$S/$f.before.txt"; done
```

(`perl -0` strips multi-line className strings too, e.g. the `file:` classes at EarlyBuildersForm 691–692.)

- [ ] **Step 2: `ChoiceModal.jsx`.** Line 5 scrim KEEP. Lines 25, 36 `bg-black/40` → `bg-pure/40`. R1/R4/R7/R8 on the rest; the modal panel `bg-yzi-card` flips automatically (R9).

- [ ] **Step 3: `EarlyBuildersForm.jsx`.** KEEP scrims at lines 353 (`bg-black/80`) and 889 (`bg-black/90`). R2: lines 375 (`/35`), 400–661 and 917 (`/50`), 701, 744 (`/20`), 867 (`/45`) → `bg-pure/<same>`. R1 on all `white` (incl. lines 691–692 `file:bg-white/10 file:text-white hover:file:bg-white/20` → `file:bg-fg/10 file:text-fg hover:file:bg-fg/20`). R7 on the 11 `text-gray-*`. R8 on `text-red-400`, `hover:text-red-300`, `text-green-400`, `text-orange-400`, `text-yzi-cyan`. R4 on submit/verify buttons.

- [ ] **Step 4: `EarlyPartnersForm.jsx`.** Same rules. KEEP scrims at lines 365 and 910. R2: lines 387, 413–683, 938, 722, 765, 888. `file:` classes at 712–713.

- [ ] **Step 5: Prove logic untouched:**

```bash
S="C:/Users/WCLCHA~1/AppData/Local/Temp/claude/C--Users-WCL-CHA-28-Desktop-YZIWORKSADMIN-main/8aba6c4e-99fa-41ba-b77e-ca3a6afd660e/scratchpad"
for f in EarlyBuildersForm EarlyPartnersForm ChoiceModal; do perl -0pe 's/className=("[^"]*"|\{`[^`]*`\})//gs' src/components/$f.jsx | diff "$S/$f.before.txt" - && echo "$f: logic identical"; done
```

  Expected: three "logic identical" lines. Any diff output = revert that hunk.

- [ ] **Step 6: Grep gate + browser.** KEEP: the four scrim lines; brand-button `text-white`. In both themes at 375 and 1280: open Apply Now → Choice modal → Builders form; fill two fields; toggle theme via `document.querySelector('[role=switch]').click()`; values preserved, inputs readable (text, placeholder, border, focus ring), error text (trigger by pressing submit with empty required field only if the form shows client-side errors without sending anything — otherwise skip) readable. Repeat for Partners. **Never complete OTP or submit.** Native `<select>` dropdowns follow `color-scheme` (light list in light theme).

- [ ] **Step 7: Checkpoint.**

---

### Task 6: About + OurVerticals + PhotoWall + Application Process

**Files:**
- Modify: `src/pages/AboutUs.jsx`, `src/components/OurVerticals.jsx`, `src/components/PhotoWall.jsx`, `src/pages/ApplicationProcess.jsx`

**Interfaces:**
- Consumes: tokens, `light:` variant, `<FloatingThemeToggle />` (Task 2).

- [ ] **Step 1: `AboutUs.jsx`.** Add `import FloatingThemeToggle from '../theme/FloatingThemeToggle'`; render `<FloatingThemeToggle />` as the last child of the root `<div>`.
  - Line 42: `bg-[#05050A] text-white` → `bg-surface text-fg`.
  - Hero (lines 44–70) R5: overlay line 51 becomes `from-black/70 via-black/50 to-surface`; the hero text block (lines 53–69) KEEPS `text-white/80`, `text-white/50`; the `<h1>` gets explicit `text-white`; `text-orange-400` there KEEPS (sits on dark photo overlay).
  - Rest of page (line 76 onward): R1, R2 (lines 263, 274 `bg-black/20` → `bg-pure/20`), R4, R7, R8.

- [ ] **Step 2: `OurVerticals.jsx`.** Classes: R1/R4/R7/R8/R9. Inline:
  - Holo sheen `rgba(255,255,255,0.14)` (line 62): KEEP (reads on both).
  - `dotGlow` stops (lines 96–97): replace `stopColor="#FFFFFF"` with `style={{ stopColor: 'var(--theme-fg)' }}` on both `<stop>`s (keep `stopOpacity`).
  - Base line (line 104): replace `stroke="rgba(255,255,255,0.08)"` with `style={{ stroke: 'color-mix(in srgb, var(--theme-fg) 8%, transparent)' }}`.
  - `<style>` block orange rgba values: KEEP (brand).

- [ ] **Step 3: `PhotoWall.jsx`.** Lightbox (line 81 `bg-black/95`) and its controls (lines 86, 93, 100): KEEP (R5). Everything else R1–R10; check any edge-fade gradient that uses `from-[#05050A]`/`from-yzi-black` → `from-surface` (R3/R9).

- [ ] **Step 4: `ApplicationProcess.jsx`.** Add `FloatingThemeToggle` import and render it after the back-link `<div>` (line 75). Line 14: `bg-[#05050A] text-white` → `bg-surface text-fg`. Lines 28, 37, 52, 71: R1. Line 39 number badge: add `text-white` (R4). Line 43 `text-orange-400` → `text-accent-orange-fg`. Back-link `top-6` position: unchanged (layout; spec lists it as a known issue).

- [ ] **Step 5: Grep gate.** KEEP: About hero overlay `from-black/70 via-black/50` and hero text `text-white*`; hero `text-orange-400`; OurVerticals holo sheen; PhotoWall lightbox lines; brand-button `text-white`.

- [ ] **Step 6: Browser check** `/about` and `/application-process`, both themes, 375 and 1280: floating toggle at top-right below the announcement bar, label hidden below 640px; whole page flips; About hero stays photographic with white text and fades into the page colour; PhotoWall lightbox opens dark in both themes; toggle while lightbox is open → page behind recolours, lightbox stays dark. `Applytop.png`/`Applybottom.png` banners are artwork and do not change.

- [ ] **Step 7: Checkpoint.**

---

### Task 7: Meet Sera — page, UI components, canvases

**Files:**
- Modify: `src/pages/MeetSera.jsx`, `src/components/sera/SeraNetworkBackground.jsx`, `SeraOrb.jsx`, `orbMath.js:94,154`, `SeraHero.jsx`, `SeraSignIn.jsx`, `SeraUpload.jsx`, `SeraPreparing.jsx`, `SeraInterview.jsx`, `SeraWrapup.jsx`, `SeraReport.jsx`, `SeraBlockedScreen.jsx`

**Interfaces:**
- Consumes: `useTheme()`, tokens, `<FloatingThemeToggle />`.
- Produces: `createOrbRenderer({ ctx, points, size, colorsRef, stateRef, additive })` — `additive: boolean`, default `true`.

- [ ] **Step 1: `MeetSera.jsx`.** Import and render `<FloatingThemeToggle />` right after the back-link `<div>` (line 32). Line 17: `text-white` → `text-fg`. Line 28: `bg-white/15 … border-white/25 … hover:bg-white/25` → `bg-fg/10 … border-fg/25 … hover:bg-fg/20`.

- [ ] **Step 2: `SeraNetworkBackground.jsx`.** Add `import { useTheme } from '../../theme/useTheme'` and above the component:

```js
const PALETTES = {
  dark: { line: '139,92,246', lineAlpha: 0.35, dot: 'rgba(34,211,238,0.75)', edge: '5,5,10', opacity: 0.55 },
  light: { line: '109,40,217', lineAlpha: 0.45, dot: 'rgba(8,145,178,0.8)', edge: '247,247,251', opacity: 0.7 },
}
```

  In the component: `const { theme } = useTheme()` and `const palette = PALETTES[theme]`. In `drawNet`, line 51 `* 0.35` → `* palette.lineAlpha`; line 52 → ``ctx.strokeStyle = `rgba(${palette.line},${alpha})` ``; line 62 → `ctx.fillStyle = palette.dot`. Effect deps `[]` → `[palette]` (a switch redraws, including the reduced-motion single frame). Canvas style `opacity: 0.55` → `opacity: palette.opacity`. Vignette background →

```js
            `radial-gradient(60% 50% at 50% 38%, rgba(${palette.edge},0) 0%, rgba(${palette.edge},0.55) 68%, rgba(${palette.edge},0.96) 100%)`,
```

  `PALETTES[theme]` is a stable object per theme, so the effect only re-runs on an actual switch.

- [ ] **Step 3: `orbMath.js`.** Line 94 signature → `export function createOrbRenderer({ ctx, points, size, colorsRef, stateRef, additive = true }) {`. Line 154 → `ctx.globalCompositeOperation = additive && glow > 0.5 ? 'lighter' : 'source-over'`. Nothing else in this file changes.

- [ ] **Step 4: `SeraOrb.jsx`.** Add `import { useTheme } from '../../theme/useTheme'`. Change the defaults `colorFrom = '#8b5cf6', colorTo = '#22d3ee'` to `colorFrom, colorTo` (no default), then at the top of the body:

```jsx
  const { isDark } = useTheme()
  const from = colorFrom ?? (isDark ? '#8b5cf6' : '#7c3aed')
  const to = colorTo ?? (isDark ? '#22d3ee' : '#0891b2')
```

  Use `from`/`to` in `colorsRef` init (line 14) and the colours effect (lines 20–22, deps `[from, to]`). Line 38 → `createOrbRenderer({ ctx, points, size, colorsRef, stateRef, additive: isDark })`. Main effect deps `[size]` → `[size, isDark]`.

- [ ] **Step 5: UI components.** Apply R1–R10 to `SeraHero`, `SeraSignIn`, `SeraUpload`, `SeraPreparing`, `SeraInterview`, `SeraWrapup`, `SeraReport`, `SeraBlockedScreen`, plus:
  - `SeraHero.jsx` line 14: `#fff 0%, #fff 38%` → `var(--theme-fg) 0%, var(--theme-fg) 38%`.
  - `SeraInterview.jsx` line 81: `text-yzi-black` → `text-[#05050A]` (dark mic icon on cyan fill when muted, in both themes — Review Focus 5). Line 46 `bg-white/20`, 60 `bg-white/10`, 82 `bg-white/5 border-white/15 text-white hover:border-white/30` → `fg` equivalents.
  - `SeraReport.jsx` line 165 `bg-black/40` → `bg-pure/40`. Glow shadows (lines 90, 102) and the radial background (line 190): KEEP.
  - `SeraSignIn.jsx` Google logo path fills (lines 32–35): KEEP.

- [ ] **Step 6: Grep gate** on all Sera files. KEEP: `SeraSignIn` Google colours and cyan glow shadow; `SeraInterview` cyan glow shadows; `SeraReport` glow/radial rgba; `SeraHero` purple drop-shadow; brand-button `text-white`.

- [ ] **Step 7: Browser check** `/meet-sera`, both themes, 375 and 1280. Only the **hero** screen is reachable without signing in — do not sign in, upload, or start a call (live Retell cost). Check: network lines/dots visible on light; vignette fades to the page colour, no dark ring; orb particles visible (not washed out) in light; "Sera" heading fully readable; floating toggle top-right, back pill top-left, neither overlapping the announcement bar. For the other screens (sign-in, upload, interview, report), verify by code review against the rules plus the grep gate — they cannot be driven without real sign-in.

- [ ] **Step 8: Reduced motion check.** `resize_window` cannot emulate it; instead confirm by code: in both canvases the reduced-motion branch draws once inside the effect whose deps now include the theme (`[palette]` / `[size, isDark]`), so a switch re-runs it and redraws in the new palette.

- [ ] **Step 9: Checkpoint.**

---

### Task 8: Final sweep

**Files:** none new.

- [ ] **Step 1:** `npm run build` → success. `npm run lint` → no new errors vs Task 1 baseline.
- [ ] **Step 2:** Run the grep gate across every modified file; every hit is on its task's KEEP list.
- [ ] **Step 3:** Scope check: `git status --short` lists only: `index.html`, `src/index.css`, `src/theme/*` (4 new), `src/pages/{Home,AboutUs,ApplicationProcess,MeetSera}.jsx`, `src/components/{AnnouncementBar,Navbar,HeroSlider,Hero,Programs,PoweredBy,AIAdvantage,FinalCTA,Footer,ChoiceModal,EarlyBuildersForm,EarlyPartnersForm,OurVerticals,PhotoWall}.jsx`, `src/components/sera/*` (listed in Task 7), plus untracked `src/assets/slides-light/` and `docs/`. `git diff --stat -- netlify package.json src/App.jsx src/main.jsx src/hooks src/utils` → empty.
- [ ] **Step 4:** `index.html` diff: only the added `<script>` block; MSG91 block unchanged (`git diff index.html`).
- [ ] **Step 5:** No-flash: set light, hard-reload `/`, `/about`, `/application-process`, `/meet-sera`; screenshot immediately after navigation — no dark frame. Clear storage → dark.
- [ ] **Step 6:** Dark parity: with dark theme, screenshot each route at 1280 and compare against the same routes on a clean `main` worktree build (or production) — only the toggle controls differ.
- [ ] **Step 7:** Report to the user: files changed, checks run with results, anything not verifiable (Sera screens behind sign-in, form submit paths). No commit.
