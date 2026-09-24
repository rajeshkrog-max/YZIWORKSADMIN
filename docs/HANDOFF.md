# Handoff — light/dark theme + landing/Sera work

Last updated: 2026-09-23

- **Repo:** https://github.com/rajeshkrog-max/YZIWORKSADMIN.git
- **Branch:** `feat/theme-landing-sera` (branched from `main` at `1ebc290`)
- **Rules:** never push or merge to `main` until the owner says so. No "Create PR". No commit until the owner says so.
- **Out of scope:** the dashboard (another person owns it), `netlify/`, `package.json` / `package-lock.json`, `src/hooks/useSeraInterview.js`, `src/utils/seraUpload.js`.

> ⚠️ **Nothing below is committed yet.** All of this work exists only as
> uncommitted changes in the working copy at
> `C:\Users\WCL CHA 28\Desktop\YZIWORKSADMIN`. A fresh clone or checkout of
> `feat/theme-landing-sera` from GitHub will **not** contain it until it is
> committed and pushed. Do not run `git checkout .`, `git stash`, `git reset`
> or switch branches in that folder without committing first.

## Resume

```bash
cd "C:\Users\WCL CHA 28\Desktop\YZIWORKSADMIN"
git branch --show-current        # must print feat/theme-landing-sera
git status --short               # the uncommitted work listed below should be there
npm install
npm run dev                      # http://localhost:5173
```

Then read this file. Do not revert any theme work.

`npm run dev` serves the site only. Netlify functions (`/.netlify/functions/*`) do **not**
run under it. Anything that calls them (application form submit, Meet Sera sign-in /
upload / interview) will fail locally with plain `npm run dev`.

Note: `.claude/launch.json` for the in-app preview still points at the old ZIP folder
(`Desktop\YZIWORKSADMIN-main`). Start the dev server from this folder instead.

## Done (uncommitted, working copy)

| Area | What | Main files |
|---|---|---|
| Theme system | `<html data-theme>` set before first paint (no flash), saved in `localStorage['yzi-theme']`, default **dark**. `useTheme()` hook, no provider. | `index.html` (one `<script>` in `<head>`), `src/index.css`, `src/theme/theme.js`, `src/theme/useTheme.js` |
| Toggle | Small pill (moon/sun thumb), `role="switch"`, keyboard, focus ring. Home desktop: pinned to header's far right. Home mobile: left of hamburger (+ "Theme" row in mobile menu). About / Application / Meet Sera: small pill top-right. | `src/theme/ThemeToggle.jsx`, `src/theme/FloatingThemeToggle.jsx`, `src/components/Navbar.jsx` |
| Navbar | "Application Process" link removed (desktop + mobile). Page and route still exist. | `src/components/Navbar.jsx` |
| Home slider | Dark `src/assets/slide1-4.png`, light `src/assets/slides-light/slide1-4.png`. Same index, always 4, slide kept on theme switch. | `src/components/HeroSlider.jsx` |
| Home sections | Hero, Programs, PoweredBy, AIAdvantage, FinalCTA, Footer (incl. contact modal) themed. | those components + `src/pages/Home.jsx` |
| Hero copy | "WORK IS CHANGING." / "BE PART OF" + gradient "WHAT’S NEXT." / new body line. Buttons unchanged. | `src/components/Hero.jsx` |
| Forms | ChoiceModal, EarlyBuildersForm, EarlyPartnersForm themed (className only; logic verified identical by stripping classNames and diffing). | those 3 components |
| Form photos | Dark `src/assets/youth.png` / `partner.png`, light `src/assets/slides-light/youth.png` / `partner.png`. Light mode: no dark overlay, text on a frosted panel. | `EarlyBuildersForm.jsx`, `EarlyPartnersForm.jsx` |
| About | Themed. Closing "Application Process" link → **Join as Early Partner** button opening `EarlyPartnersForm`. | `src/pages/AboutUs.jsx`, `src/components/OurVerticals.jsx` |
| AnnouncementBar | Themed (all routes). | `src/components/AnnouncementBar.jsx` |
| Meet Sera landing | **Built, awaiting owner review.** (1) slider from `src/assets/sera_hero/slide{1-4}{dark,light}.png` (2) orb + "YZI Works · AI Interviewer" + SERA + body + Meet Sera button in a dark well under the hero (3) animated steps Sign up → Upload CV → Payment → Analysis → Interview → Report → Community, no buttons in that block (4) existing Footer. Sign-in / upload / interview / report screens keep their old layout. | `src/pages/MeetSera.jsx`, `src/components/sera/SeraHero.jsx`, `src/components/sera/SeraSteps.jsx` (new), `src/components/HeroSlider.jsx` (`fit="contain"` props) |

Design spec and task plan (also uncommitted):
`docs/superpowers/specs/2026-09-23-light-dark-theme-design.md`,
`docs/superpowers/plans/2026-09-23-light-dark-theme.md`.

## Next / open

1. **Owner review of `/meet-sera`** in both themes, desktop and mobile.
2. **Sera flow screens in light mode** (plan Task 7, paused): sign-in, upload, preparing,
   interview, wrap-up, report and blocked screens are still dark-styled. Their network
   background and orb still use the dark palette. Colours only. Do not change the
   interview fetch/upload logic.
3. **"Failed to fetch" after résumé upload:** later, when the owner asks. Not investigated
   further on purpose. Notes so far: the flow is `useSeraInterview.js` `beginInterview()`
   → `seraUpload.js` POST `sera-create-upload`, then a direct browser PUT to Cloudflare
   R2 → `sera-extract-resume`. "Failed to fetch" is a network/CORS-level failure, most
   likely the R2 PUT from an origin the bucket's CORS doesn't allow. Plain `npm run dev`
   gives a JSON parse error instead, because functions don't run. First question to
   answer: which URL the failing screenshot was taken on.
4. Small leftovers, owner to decide:
   - Home mobile slider hint "Swipe or tap to view full image" is hard to read on the light slides.
   - Keep or remove the "Theme" row in the Home mobile menu.
   - `src/assets/sera_hero/slide3light.png` is 1916×821 while the other seven are ~1670×941. It displays uncropped but with wider bands; re-export at 1670×941 to match.
   - About still says "Choose Work Independence." twice (`AboutUs.jsx` ~409, ~451).
   - Application Process "← Back to Home" pill sits under the announcement bar (`top-6`). Existing, layout-only.

## How the theme works (for whoever continues)

- **Tokens** in `src/index.css`:
  - `surface` / `surface-2` / `card`: page, section and card fills.
  - `fg` / `fg-muted`: text.
  - `pure`: black in dark, white in light.
  - `accent-cyan-fg` / `accent-orange-fg`: readable accent text.
  - `logo-chip`.
  - The existing `yzi-black`, `yzi-dark`, `yzi-card`, `yzi-text` and `yzi-muted` point at the same variables, so they switch too.
  - Dark values equal the original colours exactly.
- **`light:` variant** for light-only overrides, e.g. `light:text-red-600`.
- **Rule of thumb:**
  - neutral `white/NN` → `fg/NN`;
  - `black/NN` panel/input fills → `pure/NN`;
  - keep literal `text-white` on brand-gradient buttons and on photos with dark overlays;
  - keep modal backdrops (`bg-black/80`, `/90`) and full-screen image viewers dark.
- **Lesson learned:** never name a colour token after an existing Tailwind utility.
  Naming one `base` made `text-base` set a colour (fixed by renaming it to `pure`).
- **Line endings:** files are CRLF in this working copy. Git-bash `sed -i` silently
  converts to LF. Convert back with `perl -0pi -e 's/(?<!\r)\n/\r\n/g' <file>`.

## Before any commit

```bash
npm run build     # must pass
npm run lint      # 0 errors; 1 pre-existing warning in PoweredBy.jsx is expected
git diff --stat -- netlify package.json package-lock.json src/hooks src/utils   # must be empty
```
