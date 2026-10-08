# Sera backend (server/)

## Overview

`server/index.js` is the live Meet Sera backend: a plain Node `http` server (no framework) on port 4005, self hosted on `ssh YZIServer` under `~/yzi-backend`. Apache proxies `/api/sera/*` to it. It stores sessions, orders and reservations as JSON files, and imports the pure logic from `netlify/lib/*`.

## Key files

| File | Owns |
|---|---|
| server/index.js | All routes (login, upload, extract-resume, payment, offers, start-call, session, rejoin, vapi-webhook, get-report, report/download, diagnostics, health) |
| server/formEndpoints.js | Runs the four website form handlers from `netlify/functions/` (send-otp, verify-otp, send-contact, r2-create-upload) with per IP rate limits and a 503 when their keys are missing |
| server/applicationUploads.js | Signed upload links for the application forms (HMAC with the R2 secret, 15 minute lifetime, size and type fixed in the link) and the check that a PUT matches its link |
| server/store.js | File store in `server/data/` (sessions, orders, reservations, student codes). Set `SERA_DATA_DIR` to relocate it |
| server/start.sh | `start`, `stop`, `restart`, `check`, `status`. It never starts Node itself: it calls `ensure.sh` and the `run/stop` flag |
| server/supervise.mjs | The watchdog. Holds a port lock (4006), starts Node, health checks it, restarts it with a growing delay (1, 2, 4, 8, then 15 s), logs `[watchdog]` lines with the reason, touches `run/watchdog.beat`, reads `NODE_BIN` from `run/config` |
| server/ensure.sh | What cron runs every minute and at reboot: starts the watchdog when its heartbeat is older than 20 s and `run/stop` does not exist |
| server/shutdown.js | Graceful stop on SIGTERM, SIGINT and the admin restart (waits up to 40 s for requests and a report). An uncaught exception logs one short line and exits with code 1 |
| server/recovery.js | At start and every 2 minutes: re arms round timers part way through, reads calls that ended during an outage back from Vapi, retries a cut short report once, releases a slot left by a crash |
| server/vapiFlow.test.js, loginFlow.test.js, server.test.js | Spawn the real server against fake Vapi and OpenAI. No network, no secrets |
| server/supervise.test.js, shutdown.test.js, recovery.test.js, restartRecovery.test.js | Watchdog drills against a fake server, graceful stop, recovery with fakes, and the real server restarted in the middle of a fake call |
| server/api-proxy.php, ecosystem.config.cjs | Older hosting glue. `start.sh` is what runs in production |

## Commands

```bash
node server/index.js            # run locally on :4005 (npm run server)
node --check server/index.js    # always run before shipping
bash scripts/deploy-sera-vapi.sh [--frontend]   # tests, upload, restart, live checks
npm run smoke                                   # live endpoint check against https://yziworks.com
curl https://yziworks.com/api/sera/health       # {"ok":true,"build":"<commit>-<time>"}
touch ~/yzi-backend/run/stop                    # on the host: stop the backend on purpose (rm it and cron brings it back)
```

On the server restart with `bash ~/yzi-backend/server/start.sh restart`, not `pm2`. pm2's daemon is reaped when the SSH session ends and leaves the API down.

## Conventions

- Env names are listed in `.env.example`. Secrets are server only, never `VITE_`. The website forms need `RESEND_API_KEY`, `MSG91_AUTH_KEY`, `MSG91_WIDGET_ID` and the R2 keys; `/api/sera/diagnostics` shows which are set (`forms`).
- CORS answers only `https://yziworks.com` and `https://www.yziworks.com` (`SERA_ALLOWED_ORIGINS` overrides). Apache serves site and API from one origin, so browsers rarely need it.
- Student codes are not seeded in production. Add real ones to `server/data/student_codes.json` on the host. `SERA_SEED_SAMPLE_CODES=1` seeds the sample codes the tests use.
- Route paths accept both `/api/sera/...` and the old `/.netlify/functions/sera-...` form, so the frontend and Vite dev proxy keep working.
- The report and its PDF are generated once per interview, in the Vapi webhook only, with one confirmed exception: after a restart `recovery.js` may run a cut short report once more (`reportAttempts` caps it at two runs, a `failed` report is never retried). The browser polls `get-report`, which is a plain read with no LLM call. Never add a second analysis call.
- Reserve the one interview per email slot before creating the Vapi call, and release it if Vapi fails. A payment is marked used only after the call exists.
- `GET /api/sera/diagnostics` with `Authorization: Bearer <VAPI_WEBHOOK_SECRET>` checks OpenAI, R2, Vapi, Razorpay and login config.
- `VAPI_PRIVATE_KEY` (server `.env` only) is used for one thing: reading a finished call back (`GET /call/{id}`) after a restart. `/api/sera/diagnostics` shows `vapi.privateKey`.
- Every file the server imports at run time must be in the `RUNTIME` list of `scripts/deploy-sera-vapi.sh`, or the host cannot start after a deploy.
- Tests use `node --test` (no framework). `SERA_SKIP_DOTENV` and `SERA_ROUND_TIME_SCALE` exist for tests.

## Gotchas

- `server/index.js` once shipped with a syntax error and took the API down. Run `node --check` first.
- `server/data/` holds real candidate data and the live student codes. Do not commit it or send it anywhere.
- There is no pid file. A login cannot see or signal a watchdog or Node that cron or another login started. Check `run/watchdog.beat` and the log, and restart through the deploy script or `start.sh restart`, which use the admin restart request.
- `/api/sera/direct-upload` is unused and waits forever, because the router has already read the request body. Fix or remove it before using it.
- The Vapi `controlUrl` is stored on the server session only and never returned to the browser.

## Related specs

- [docs/sera-vapi.md](../docs/sera-vapi.md) (call flow, control payload, squad prompt rules)
- [docs/BACKEND_HANDOFF.md](../docs/BACKEND_HANDOFF.md) (endpoint table; the Retell parts are history)
- [docs/specs/0001-reliable-backend-runtime](../docs/specs/0001-reliable-backend-runtime/index.md) (watchdog, cron, recovery, host limits)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
