# Scope: YZI Works hardening

YZI Works is the live Young Zone India site: marketing pages, the Early Builder, Early Partner and contact forms, and Meet Ai Sera, a paid AI interview. This scope has one goal: make everything that is already built work every time, and keep it that way.

**Build approach:** Tracer Bullet (prove the whole pipe works end to end before thickening any part of it). Each hardening item is finished and proven on the live system before the next one starts. (basis: tracer bullets prove the layers connect early)
**Workflow:** GA (after develop: `/check verify`, `/test`, a fresh model `/check review`, then `/document`). The project default level of rigor, chosen because payments and candidate personal data are involved. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

**One thing to confirm first.** You described YZIServer as an always on VPS. What the session saw behaves like shared cPanel hosting: a jailed shell, a separate process space for every ssh login (so a restart cannot find a server another login started), a firewall that answers HTTP 406 to PDF and Word uploads, and a cron job as the only keepalive. The server was down for about 13 minutes on 2026-10-08 and had been restarted by cron about 200 times. Feature 1 starts by settling this, because it decides how the other reliability items are built.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Marketing site | Existing | existing |
| B | Application and contact forms | Existing | in-progress |
| C | Meet Sera login and student codes | Existing | in-progress |
| D | Meet Sera résumé check and offers | Existing | existing |
| E | Meet Sera payment | Existing | in-progress |
| F | Meet Sera live interview (Vapi squad) | Existing | in-progress |
| G | Meet Sera report and PDF | Existing | in-progress |
| H | Backend service on YZIServer | Existing | in-progress |
| I | Deploy and sync checks | Existing | in-progress |
| 1 | Reliable backend runtime | Foundation | done |
| 2 | Source control and push time checks | Foundation | planned |
| 3 | Uptime monitor and alert | Foundation | planned |
| 4 | Error log and failure alerts | Foundation | planned |
| 5 | Backups of server data | Foundation | planned |
| 6 | Real browser check of the application forms | Slice 1 | planned |
| 7 | Real call end to end test | Slice 1 | planned |
| 8 | Payment safety | Slice 2 | planned |
| 9 | WhatsApp login verification | Slice 2 | planned |
| 10 | Retire legacy code and rotate secrets | Slice 3 | planned |
| 11 | New favicon and app icons | Slice 3 | in-progress |

## Already built (enrolled for context)

### A. Marketing site · existing
Home, About and Application Process pages with the theme toggle and announcement bar. code in `src/pages/`, `src/components/`

### B. Application and contact forms · in-progress
Early Builder, Early Partner and contact forms. They work live as of 2026-10-08 (upload, application email and contact email all proven), but the fix is uncommitted and no browser test guards it. code in `src/components/EarlyBuildersForm.jsx`, `src/components/EarlyPartnersForm.jsx`, `src/utils/r2Upload.js`, `server/formEndpoints.js`, `server/applicationUploads.js`

### C. Meet Sera login and student codes · in-progress
Google sign in, student codes, demo access and WhatsApp login. The server cannot verify the WhatsApp token yet because `MSG91_AUTH_KEY` is missing (feature 9). code in `src/components/sera/login/`, `netlify/lib/seraLogin/`, `server/index.js`

### D. Meet Sera résumé check and offers · existing
PDF upload, the one OpenAI call that checks it is a résumé, and the three offers built from it. code in `src/components/sera/SeraUpload.jsx`, `netlify/lib/seraOffers/`

### E. Meet Sera payment · in-progress
Razorpay order, verify and webhook for the ₹249 New User price. Covered by unit and fake service tests, never run end to end with a real payment. code in `src/components/sera/pay/`, `server/index.js`

### F. Meet Sera live interview (Vapi squad) · in-progress
One squad call: Sera, Vinit, Sonia, with the offer handoff and round timers. Proven against fakes, not against a real call in this pass. code in `netlify/lib/seraVapi/`, `src/components/sera/interview/`

### G. Meet Sera report and PDF · in-progress
One report and PDF per interview, generated once in the Vapi webhook. code in `netlify/lib/seraReport/`, `src/components/sera/report/`

### H. Backend service on YZIServer · in-progress
`server/index.js`, a plain Node server with a file store. It works, but it has gone down and been restarted by cron about 200 times (feature 1). code in `server/`

### I. Deploy and sync checks · in-progress
`scripts/deploy-sera-vapi.sh`, `scripts/smoke-live.mjs` and `server/frontendContract.test.js` keep the backend, the frontend and the live site in step. Built on 2026-10-08, uncommitted. code in `scripts/`, `server/`

## Foundations

### 1. Reliable backend runtime
Settle what YZIServer really is, then make an outage last seconds, not up to 19 minutes, with nobody logged in. (basis: processes should be disposable and restart fast)
**Done when:** the server is killed on purpose and answers again within about a minute with no ssh session open; a deploy never needs a manual restart; the finding about the host is written into `AGENTS.md`.
spec [0001](../specs/0001-reliable-backend-runtime/index.md)
code in `server/supervise.mjs`, `server/ensure.sh`, `server/start.sh`, `server/shutdown.js`, `server/recovery.js` (new); small edits in `server/index.js`, `server/store.js`, `netlify/lib/seraVapi/`, `scripts/deploy-sera-vapi.sh`
- [x] Design it (spec): `/architect reliable backend runtime`
- [ ] Build it: `/develop reliable backend runtime`
  - [ ] Prove the host facts: cron every minute, newest Node that runs on glibc 2.17, the cPanel checks (AC-1, AC-2, AC-12)
  - [ ] Watchdog and one minute cron live, old cron lines removed, kill drills pass (AC-1 to AC-6, AC-13, AC-14)
  - [x] Deploy script and Node version switched (AC-7, AC-12)
  - [x] Restart safe server: graceful stop, saved timers, catch up from Vapi, stuck reports, orphan slots (AC-8 to AC-11)
  - [ ] Proven live with a restart in the middle of a test interview, host finding written into `AGENTS.md` (AC-7 to AC-11)
- [ ] Verify it: `/check verify reliable backend runtime`
- [x] Test it: `/test reliable backend runtime`
- [ ] Review it (fresh model): `/check review reliable backend runtime`
- [ ] Document it: `/document reliable backend runtime`

### 2. Source control and push time checks · needs a decision
Get the hardening work committed and pushed, and run the tests, lint, build and the frontend and backend contract check on every push.
**Done when:** the branch is merged with history intact; a failing test or a frontend call the backend does not serve blocks the merge; the deploy no longer reports `+local`.
- [ ] Design it (spec): `/architect source control and push time checks`

### 3. Uptime monitor and alert · needs a decision
Check the live API and the site every few minutes from outside, and tell you when either fails.
**Done when:** stopping the backend on purpose produces an alert to you within minutes, and recovery produces a second message.
- [ ] Design it (spec): `/architect uptime monitor and alert`

### 4. Error log and failure alerts · needs a decision
Server errors, failed emails and failed R2, OpenAI or Vapi calls land in one place you can read, and the serious ones alert you. (basis: alert on what users feel, not on every error)
**Done when:** a forced email failure and a forced upload failure each appear in the log with the route and time, and the serious one reaches you; no secret or résumé text appears in the log.
- [ ] Design it (spec): `/architect error log and failure alerts`

### 5. Backups of server data · needs a decision
Sessions, orders and student codes copied off the server on a schedule, with a restore you have actually tried. (basis: three copies, one offsite, test the restore)
**Done when:** a backup runs without you, a copy exists off the server, and one restore into a clean folder has been proven to boot the server.
- [ ] Design it (spec): `/architect backups of server data`

## Slice 1: Prove the live flows

### 6. Real browser check of the application forms · needs a decision
A scripted run in a real browser on the live domain submits the Early Builder, Early Partner and contact forms, including a PDF upload, and confirms the team email arrived.
**Done when:** one command prints pass or fail for each form; a PDF and a Word file upload through the real firewall; the test emails are clearly marked so the team can ignore them.
- [ ] Design it (spec): `/architect real browser check of the application forms`

### 7. Real call end to end test · needs a decision
One scripted run of login, résumé, offers, the live call, report and PDF against the real system, so the paid flow is proven and not only simulated.
**Done when:** a run ends with a stored report and a downloadable PDF, reports how many real minutes and rupees it used, and cannot run twice by accident.
- [ ] Design it (spec): `/architect real call end to end test`

## Slice 2: Money and login

### 8. Payment safety · needs a decision
A real test payment goes through create, verify and the webhook once, and a double click or a retry never charges twice or loses a paid order. (basis: verify the signature, make the webhook idempotent)
**Done when:** a test payment creates one order and one interview; a repeated verify or webhook changes nothing; a paid but unused order can still start a call; each case is a test.
- [ ] Design it (spec): `/architect payment safety`

### 9. WhatsApp login verification
Check the WhatsApp login token on the server with the MSG91 auth key, and surface a missing key in diagnostics instead of silently trusting the browser.
**Done when:** a forged token is refused, a real one signs in, and `/api/sera/diagnostics` shows whether the key is set.
- [ ] Build it: `/develop whatsapp login verification`

## Slice 3: Clean up

### 10. Retire legacy code and rotate secrets · Beta
Remove the Retell, Gemini and Netlify leftovers from the repo and the server, delete the old test scripts and archives on the server, rotate every key that appeared in chat or committed scripts, and keep only real student codes.
**Done when:** a search finds no Retell, Gemini or `sera-*` Netlify function code or settings; the old keys no longer work; the server home folder holds only what runs; the placeholder student codes are confirmed real or removed with you.
- [ ] Build it: `/develop retire legacy code and rotate secrets`

### 11. New favicon and app icons · Alpha
Replace the current favicon with the new YZIWorks icon set from `C:\Users\vaibh\Downloads\favicon.zip` (SVG, 96px PNG, ICO, Apple touch icon, two web app icons and a web manifest), and point the site `<head>` at them.
**Done when:** the files from the zip are served from the site root, `index.html` links the icon, shortcut icon, Apple touch icon, manifest and the `YZIWorks` app title, the old icon is gone, and the live site shows the new icon in a browser tab and on a phone home screen.
- [x] Build it: `/develop new favicon and app icons` (deployed to yziworks.com 2026-10-08, build ec3f77e+local-20261008-2223)
- [ ] Verify it: `/check verify new favicon and app icons`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Personal data retention and deletion**: delete old résumés and transcripts on a schedule and remove one person's data on request · needs a decision · GA
- **Move to another host**: only if feature 1 finds this host cannot be made reliable · needs a decision
- **Spend caps and cost alerts**: a monthly limit and an alert for OpenAI and Vapi spend · needs a decision
- **Admin view of interviews and student codes**: see sessions, seats and failures without opening files on the server · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow-up enrolled |
| `in-progress` (building) | `/develop` | milestone sub-boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre-workflow) and `dropped` (de-scoped, kept for history).
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Beta`) sets that one feature's rigor above or below the project default; no tag inherits the default.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing; **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.

## References

**Project sources**
- `AGENTS.md` and `server/AGENTS.md`: the stack, the deploy flow and the host facts this scope starts from.
- Live findings from 2026-10-08: about 200 automatic restarts in `~/yzi-backend/yzi-backend.log`, per session process spaces on YZIServer, HTTP 406 on PDF and Word upload bodies, and the form endpoints that returned 404 before the port.
- `docs/sera-vapi.md`: the call flow that feature 7 must exercise.

**Practices and standards**
- Tracer bullets: build one thin real path end to end first. Foundations before features. Alert on what users feel. Keep three copies of data, one offsite, and test the restore. Verify payment signatures on the server and make webhooks safe to repeat.

**Links** (web verified, except where noted)
- [The Twelve-Factor App, Logs](https://12factor.net/logs): treat logs as an event stream written to standard output.
- [The Twelve-Factor App, Disposability](https://12factor.net/disposability): fast start, graceful stop, and robust to sudden death.
- [Google SRE book, Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/): alert on user visible symptoms, and the four golden signals.
- [CISA, Back Up Business Data](https://www.cisa.gov/audiences/small-and-medium-businesses/secure-your-business/back-up-business-data): the 3, 2, 1 rule and scheduled recovery tests.
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html): revoke an exposed key first, then replace it.
- [Razorpay, build the standard web integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/): verify the payment signature on the server.
- [Razorpay, validate webhook signature](https://razorpay.com/docs/webhooks/validate-test/): check the signature on the raw body, and expect duplicate deliveries.
- [Vapi, server URL events](https://docs.vapi.ai/server-url/events): status updates and the end of call report that feature 7 reads.
- [Tracer bullets and prototypes (Artima)](https://www.artima.com/articles/tracer-bullets-and-prototypes): tracer code is a thin end to end skeleton, not a throwaway.
- [MSG91 OTP widget](https://docs.msg91.com/otp-widget) (partly verified): confirms a "Verify Access Token" step after the widget issues its token. The exact server endpoint was not confirmed on the official page, so feature 9 should check the MSG91 docs before building.
