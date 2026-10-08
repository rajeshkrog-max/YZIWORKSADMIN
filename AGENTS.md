# YZI Works

Marketing site and AI interview product for Young Zone India. It is live and real people use it to apply for programs and to take interviews, so treat changes with care: add new files for new features, do not touch working code unless asked, and verify locally before shipping.

## Stack

- **Language / Runtime**: JavaScript (ES modules), Node 20 on the server
- **Frontend**: React 19, Vite 8, Tailwind 4, react-router-dom 7 (SPA in `src/`)
- **Backend**: `server/index.js`, plain Node `http` with a file store, self hosted on YZIServer (not Netlify). See [server/AGENTS.md](server/AGENTS.md)
- **Voice interview**: one Vapi squad call via `@vapi-ai/web`. See [docs/sera-vapi.md](docs/sera-vapi.md)
- **Services**: OpenAI Responses API, Cloudflare R2, Razorpay, MSG91, Resend, Google sign in
- **Package manager**: npm

## Build approach

<TBD, set by /scope>

## Commands

```bash
npm install
npm run dev       # Vite; /api and /.netlify proxy to the backend on 127.0.0.1:4005
npm run server    # backend on :4005
npm run build
npm run lint
npm test          # node --test, no framework
npm run sample:pdf
```

## Product areas

- **Marketing site and application forms**: Home, About, Application Process. `EarlyBuildersForm.jsx` and `EarlyPartnersForm.jsx` collect applications through MSG91 OTP and R2 uploads. Do not change them without explicit instruction.
- **Meet Ai Sera** (`/meet-sera`): a paid or code based AI interview. Google or WhatsApp login, one PDF résumé, three offers built from it, then Screening (Sera, 5 min), Offer pick (no timer), HR round (Vinit, 4 min) and Final round (Sonia, 4 min). It ends with an on screen report and a PDF. Round config is in `src/config/seraRounds.js`.

## Rules

- The browser talks to the backend only through `src/services/*`. The shared session shape is in `src/shared/seraSession.js`.
- Server logic lives in pure, unit tested modules in `netlify/lib/*`. `server/index.js` is the thin wrapper that reads input, loads the session, calls a module and stores the result.
- Cost control: one interview per email, reserved before the Vapi call is created. The report and PDF are generated once per interview, in the Vapi webhook only (one exception, confirmed with the owner on 2026-10-08, spec 0001: after a restart `server/recovery.js` may run a report that the restart cut short once more, never one that failed, so at most two runs per interview). The browser polls a plain read endpoint. Never add a client side analysis call or an unauthenticated endpoint that calls an LLM.
- Never put a secret in a `VITE_` variable or in `src/`. `.env.example` lists names only. Never print or commit secret values.
- Candidate data (résumés, sessions, orders) is personal. Keep it out of git, logs and chat.
- Change the interview rounds, timings, squad prompts or cost control rules only after confirming with the user.
- Before shipping run `node --check server/index.js`, `npm test`, `npm run lint` and `npm run build`.
- A passing local build is not enough. Check the real environment (server logs, `/api/sera/diagnostics`) when something fails only in production.
- Verify a provider's current documentation, or test against its real API, before concluding an integration is broken.

## Operations

- Backend host: `ssh YZIServer`, app in `~/yzi-backend`. Restart with `bash ~/yzi-backend/server/start.sh restart`, not pm2.
- Deploy with `bash scripts/deploy-sera-vapi.sh`, and add `--frontend` whenever `src/` changed. It runs the tests first and stops on a failure, uploads, loads the new code on the server, restarts, waits for the new build to answer, then checks the live site. Deploy the backend before the frontend.
- The `--frontend` upload sends only new `dist/assets/*` files, `index.html` and the site icon files named in `ICONS` in `scripts/deploy-sera-vapi.sh`. Any other new file in `public/` (an image, a video) is not uploaded; add it to that list or copy it to both site folders by hand.
- Backend and frontend stay in sync through three checks: `server/frontendContract.test.js` (every endpoint `src/` calls must be served; runs in `npm test`), `npm run smoke` (the same list against the live site, plus a comparison of live and local `dist/` files with `--dist`), and the build id in `GET /api/sera/health` (written to `BUILD` by the deploy).
- Health check: `curl https://yziworks.com/api/sera/health` (also `/health` on the server itself).
- Restarts: every ssh session on the host has its own process id space, so `start.sh stop` cannot kill a server another session started. The deploy asks the running server to exit (`POST /api/sera/admin/restart`, same credential as the Vapi webhook). The watchdog then starts the new code within seconds; the deploy never starts Node itself. It refuses while an interview is live, a report is being built, or a call ended without a finished report (`FORCE=1` overrides). A new ssh session cannot see the node process in `ps`; that is normal.
- The host is shared cPanel hosting (CloudLinux, jailshell, glibc 2.17, no root, no systemd). The backend runs under a watchdog, `server/supervise.mjs`, that restarts Node within seconds. Cron runs `server/ensure.sh` every minute and at reboot to keep the watchdog alive. Status is the age of `~/yzi-backend/run/watchdog.beat` and the `[watchdog]` lines in `~/yzi-backend/yzi-backend.log`. To stop the backend on purpose, create `~/yzi-backend/run/stop`; remove it and cron brings it back within about a minute. See [docs/specs/0001-reliable-backend-runtime](docs/specs/0001-reliable-backend-runtime/index.md).
- Cron jobs on this host get at most 25 processes and threads, and a default Node hangs silently under that limit (a stuck Node showed `nproc_limit=25`; a login has 174720). The watchdog and the server therefore start with `--v8-pool-size=1` and `UV_THREADPOOL_SIZE=2` (`ensure.sh`, `supervise.mjs`). Keep anything started from cron small. The host also kills the watchdog and its server at unpredictable times with no log line, whether cron or a login started them (seen after 35 min, 62 min and 4 min on 2026-10-08). Cron brings them back within about 80 seconds, so an outage is short but real. The cause is not known; the suspect is a cPanel resource limit, so check cPanel Resource Usage for faults at the death times.
- Production runs the unofficial glibc 2.17 build of Node 24.21.0 in `~/.local/node-v24.21.0/`. `~/yzi-backend/run/config` (`NODE_BIN=...`) picks the Node and is read at every server start; delete the line to go back to `~/bin/node` (Node 20.18).
- Scripts that run on the host (`server/ensure.sh`, `server/start.sh`, `server/supervise.mjs`) must have Unix line endings (LF). Windows line endings stop the host's bash from running them, and the deploy refuses them.
- The host firewall answers HTTP 406 to request bodies typed `application/pdf` or `application/msword`. Send files as `application/octet-stream` (what `src/utils/r2Upload.js` does) and JSON for everything else.
- Too many ssh logins in a row make the host refuse connections for about a minute. The deploy script keeps ssh calls few and retries.
- The website forms need `RESEND_API_KEY`, `MSG91_AUTH_KEY` and `MSG91_WIDGET_ID` in the server `.env`; until set, those endpoints answer 503. Export them before running the deploy script and it adds them.

## Legacy

`netlify/lib/gemini.js` and the `netlify/functions/sera-*` files are leftover from the Netlify and Retell era and are not used. Three handlers in `netlify/functions/` are still live: `send-otp`, `verify-otp` (the Early Builder and Early Partner application email) and `send-contact`. `server/formEndpoints.js` runs them inside the backend, so the forms keep calling `/.netlify/functions/<name>` and Apache forwards that path to the server. Application file uploads are written in `server/applicationUploads.js`: the forms get signed upload URLs that point at this server (`/.netlify/functions/r2-upload`), which stores the file in R2. Do not rename these paths without updating the forms.

## Specs and docs

- [docs/sera-vapi.md](docs/sera-vapi.md) (call flow, offer handoff, webhook, squad rules)
- [docs/BACKEND_HANDOFF.md](docs/BACKEND_HANDOFF.md) (endpoint table; the Retell parts are history)
- [docs/sera-interview-contract.md](docs/sera-interview-contract.md), [docs/sera-login-contract.md](docs/sera-login-contract.md), [docs/sera-payment-contract.md](docs/sera-payment-contract.md), [docs/sera-report-spec.md](docs/sera-report-spec.md)
- Specs go in `docs/specs/` as `NNNN-title.md`.

## Context files

- [server/AGENTS.md](server/AGENTS.md) (live Sera backend on YZIServer: routes, store, deploy, restart)
- [netlify/lib/AGENTS.md](netlify/lib/AGENTS.md) (shared pure modules: Vapi, offers, report, OpenAI client)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
