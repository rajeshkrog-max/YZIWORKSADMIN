# HANDOFF — read this first

**Last updated: 2026-09-24 11:38 IST**

A new chat should be able to resume from this file without asking the owner.

## Rules for the next AI (non-negotiable)

1. **Read this file first**, then `CLAUDE.md` (the Meet Sera interview / cost-control notes).
2. **Do not revert theme work.** The light/dark theme is intentional and site-wide.
3. **Do not commit, push, merge or open a PR unless the owner says so in chat.** Never force-push. Never delete `main`.
4. **Do not touch the dashboard.** Another person owns it.
5. **Do not merge old PRs #1 or #2.**
6. Do not change interview, upload or OTP logic, or anything in `netlify/`, unless the owner asks. Colour/theme changes only.
7. **After finishing each block of work, update this file** (the Log below and anything that changed) with an **IST timestamp**. Get the time from Windows, because Git Bash `date` prints UTC:
   `powershell -c "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'India Standard Time').ToString('yyyy-MM-dd HH:mm')"`

## Where things are

| | |
|---|---|
| Repo | https://github.com/rajeshkrog-max/YZIWORKSADMIN.git |
| Working folder | `C:\Users\WCL CHA 28\Desktop\YZIWORKSADMIN` (git clone; ignore the old `YZIWORKSADMIN-main` ZIP folders) |
| Checked-out branch | **`main`**. `feat/theme-landing-sera` on GitHub is one commit behind, at `e9702ee`. |
| Last pushed commit | `f38da63` "2026-09-24 logos + Sera light theme + handoff" (on `origin/main` only) |
| Live site | https://yziworks.youngzoneindia.com (an Apache proxy in front of Netlify; the old Netlify URL is https://yziworks.netlify.app) |

**Uncommitted right now (2026-09-24 11:38 DPDP notice):** `Footer.jsx`, `EarlyBuildersForm.jsx`, `EarlyPartnersForm.jsx`, `sera/SeraUpload.jsx`, and this file. Check with `git status`. Don't lose it: no `git checkout .`, `stash` or `reset`.

## Run and preview locally

```bash
npm install        # first time only
npm run dev        # http://localhost:5173
```

`npm run dev` does **not** run Netlify functions. Real sign-in, upload, call and report don't work locally, so use the preview links below.

- Home: http://localhost:5173/
- About: http://localhost:5173/about
- Meet Sera marketing: http://localhost:5173/meet-sera
- Meet Sera flow screens, **dev-only preview** (sample data, no sign-in/upload/call, stripped from production builds):
  - http://localhost:5173/meet-sera?preview=signin — add `&error=1` for the error line
  - http://localhost:5173/meet-sera?preview=upload — add `&file=1` (file chosen) and/or `&error=1`
  - http://localhost:5173/meet-sera?preview=preparing
  - http://localhost:5173/meet-sera?preview=interview — add `&muted=1`
  - http://localhost:5173/meet-sera?preview=wrapup
  - http://localhost:5173/meet-sera?preview=report — add `&variant=incomplete` or `&variant=error`
  - http://localhost:5173/meet-sera?preview=blocked

Theme toggle: small pill, top right (Home header far right; floating on About / Application / Meet Sera). Saved in `localStorage['yzi-theme']`; default **dark**.

Before any commit: `npm run build` must pass, and `npm run lint` must show 0 errors (1 existing warning in `PoweredBy.jsx` is expected).

## Log (IST)

### 2026-09-23 — pushed to `main` as `e9702ee` at 20:03 IST
- **Theme system:** `data-theme` on `<html>`, a no-flash script in `index.html`, `src/theme/*` (store, `useTheme`, `ThemeToggle`, `FloatingThemeToggle`), colour tokens in `src/index.css`, and a `light:` variant.
- **Home:** slider dark `src/assets/slide1-4.png` / light `src/assets/slides-light/slide1-4.png`; all sections themed; Hero copy "WORK IS CHANGING. / BE PART OF WHAT’S NEXT."
- **Forms:** Builders/Partners/Choice modal themed (className-only); form photos dark `youth.png`/`partner.png`, light `slides-light/youth.png`/`partner.png`.
- **About:** themed; "Join as Early Partner" opens `EarlyPartnersForm`; "← Back to YZI Works" pill top-left.
- **Meet Sera marketing:** hero slider (same component and layout as Home, images `src/assets/sera_hero/slide{1-4}{dark,light}.png`); orb in a dark well with a neon frame; animated 7-step stepper ending "Join YZI Works"; Footer.
- **Nav:** "Application Process" removed from the Navbar only (page and route still exist); hover underline glow on About Us / Meet Ai Sera.
- **Footer legal:** "© 2026 YZI Productions Private Limited. All rights reserved."

### 2026-09-24 11:10 IST — pushed to `main` as `f38da63` at 11:28 IST
- **Logos:** dark `src/assets/logo.png`, light **`src/assets/logo_light.jpeg`** (a JPEG, not `.png`: 1000×1000 on a white background). Used as-is via `src/components/Logo.jsx`, which frames the logo area to `logo.png`'s 520×354 so the size and position are unchanged, and multiply-blends the white away. Used in Navbar and Footer, the only two places a logo image renders. The old light-mode logo chip and its token are removed.
- **Meet Sera flow screens** themed for light (colours only): sign-in, upload, preparing, interview, network background. The orb uses deeper colours and normal blending on light; the engine-well orb is pinned with `tone="dark"`.
- **Report and after-call screens** themed: `SeraReport` (including the incomplete/error states), `SeraWrapup`, `SeraBlockedScreen`.
- **Dev preview:** `?preview=` in `MeetSera.jsx`, dev-only, not in the production bundle.
- Checked: a contrast scan of all 11 preview variants in both themes found nothing below 3:1; build and lint pass; hooks, utils, netlify and package files untouched.

### 2026-09-24 11:38 IST — DPDP notice, not committed yet
- **Exact text, used unchanged in all four places:** "This site processes personal data under the Digital Personal Data Protection Act, 2023. Unauthorised extraction or copying of records is prohibited."
- **Where it appears (only these four):**
  - **Footer**, under the copyright. The copyright and the notice now share one column (`max-w-xl sm:flex-1`). Without `flex-1`, the "Made with ❤ … Backed by" block squeezed the notice to about 74px wide.
  - **Early Builder form**, the last element in the `<form>`, directly under Submit Application.
  - **Early Partner form**, in the same place.
  - **Sera upload**, directly under "Begin the interview". The wrapper changed from `flex justify-end` to `flex flex-col items-end`, so the button stays right-aligned.
- **Not added to:** Home hero, Meet Sera slider, Navbar, announcement bar or the report screen.
- **Style:** `text-xs text-fg/60 leading-relaxed`, with no box, border, icon or heading. `fg/55` came out at 4.25:1 on the light footer, so it was raised to `/60`.
- **Measured contrast:** footer 7.3 (dark) / 5.0 (light); forms 7.2 / 5.1; Sera upload 7.3 / 5.1. At 375px it wraps with no horizontal scroll. Build and lint pass.

## Roadmap — still open

1. **Live domain not always on latest `main`.** The owner's friend has to publish; a push alone doesn't update https://yziworks.youngzoneindia.com. After any push, ask the owner to confirm it's live.
2. **Meet Sera "Failed to fetch" on CV upload (live domain).** The browser uploads the PDF directly to Cloudflare R2 (`src/utils/seraUpload.js:39`). The R2 bucket `yzi-application-files` CORS must allow `https://yziworks.youngzoneindia.com` (method PUT, header Content-Type), keeping `https://yziworks.netlify.app`. This is a Cloudflare dashboard setting, not code. The same bucket serves Builders/Partners file uploads. Also check that the Retell webhook URL isn't only on `yziworks.netlify.app`.
3. **Dashboard:** another person's work. Do not touch.
4. **Old PRs #1 and #2:** do not merge.
5. **Small leftovers, owner to decide:**
   - Home mobile slider hint is low-contrast on light slides.
   - Mobile menu still has a "Theme" row.
   - `skillzone.png` (About verticals) is partly white; there's no light version.
   - About still says "Choose Work Independence." twice.
   - Application Process "← Back to Home" pill sits under the announcement bar (`top-6`).
   - On mobile, the Meet Sera hero uses Home's crop, which cuts wide headlines (tap opens the full image).

## How the theme works (short)

- **Tokens** (in `src/index.css`): `surface`, `surface-2`, `card`, `fg`, `fg-muted`, `pure` (black↔white), `accent-cyan-fg`, `accent-orange-fg`. The `yzi-*` neutrals map to them. Dark values equal the original colours.
- **Rules:**
  - neutral `white/NN` → `fg/NN`;
  - panel/input `black/NN` → `pure/NN`;
  - keep `text-white` on brand-gradient buttons and on photos with dark overlays;
  - modal backdrops and image viewers stay dark.
- **Never name a colour token after a Tailwind utility.** A token called `base` broke `text-base`; it's now `pure`.
- **Files are CRLF.** Git Bash `sed -i` converts to LF; fix with `perl -0pi -e 's/(?<!\r)\n/\r\n/g' <file>`.
- **Earlier planning docs:** `docs/superpowers/specs/2026-09-23-light-dark-theme-design.md`, `docs/superpowers/plans/2026-09-23-light-dark-theme.md`.
