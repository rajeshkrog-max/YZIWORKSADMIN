# 0001. Self healing backend runtime on YZIServer

**Date**: 2026-10-08
**Status**: Accepted

## Summary

The Sera backend keeps stopping, and the only thing that restarts it is a cron job (a timer on the host) that runs every 19 minutes and appears to have gone quiet. This spec keeps the backend on YZIServer, as you asked, and adds two layers: a small watchdog script that restarts Node within seconds, and a one minute cron that restarts the watchdog if it dies. It also makes a restart safe in the middle of an interview, by saving what the server only held in memory (the round timers) and by catching up on anything missed while it was down (an end of call report, a report that stopped half way, a slot left half taken). The first build step is a short proof of what this host really allows (cron every minute, which Node runs on its old system library), because the rest depends on it.

## Requirements

**User stories**:
- As a candidate in a paid interview, I want a server restart to leave my rounds, my slot and my report intact, so that I do not lose what I paid for.
- As the owner, I want an outage to last seconds, not up to 19 minutes, with nobody logged in, so that applications and interviews keep working.
- As the owner, I want a deploy to replace the code without a manual restart, and I want to be able to stop the backend on purpose without it coming back.

**Acceptance criteria** (the contract; each one can be checked on its own):
- **AC-1**: With no ssh session open, killing the Node process on purpose (`kill -9`) leaves `GET /health` answering again within 30 seconds, and always within 60 seconds.
- **AC-2**: Killing both the watchdog and Node leaves `/health` answering again within 90 seconds, restarted by cron. If Slice 0 shows the host runs cron less often than every minute, this becomes "within 6 minutes" for a 5 minute cron, and the spec is updated before the build.
- **AC-3**: A server that is running but not answering (a 5 second health timeout, 5 checks in a row, 10 seconds apart) is replaced within 70 seconds. A server that is busy but answering is never killed. A new Node gets a 30 second startup grace before health counts.
- **AC-4**: Two `ensure.sh` runs at the same moment, or a cron run while the watchdog is alive, never produce two watchdogs or two Node processes. A Node left over from a dead watchdog is asked to exit through the admin restart route and replaced, never looped on "port in use".
- **AC-5**: A server that exits straight after starting is retried with a growing delay (1, 2, 4, 8, then every 15 seconds), never in a tight loop. A run that stays healthy for 60 seconds resets the delay.
- **AC-6**: Every start and exit is written to `yzi-backend.log` in UTC with the build id, and the reason (`exit`, `signal`, `health-kill`, `startup-timeout`) with the exit code or signal. No secret, résumé text, transcript, `controlUrl` or provider response body is ever logged, and a repeating error is logged once an hour.
- **AC-7**: A deploy loads the new code and `/api/sera/health` shows the new build id, with no manual restart and no `start.sh start` over ssh. The deploy refuses to restart while an interview is live, a report is being built, or a call has ended without a finished report (`FORCE=1` overrides).
- **AC-8**: After a restart during a live call, each round timer step that was not yet sent fires once, in order: "nearly up" is dropped if "up" is also due, "up" and the backstops are sent straight away, and a step already recorded is never sent again. A step is recorded before it is sent, so a crash can lose one note but never repeat it.
- **AC-9**: An end of call that arrived while the server was down is found, once Vapi shows an end time plus a 90 second wait, and produces exactly one report and one PDF, the same as the webhook would. This happens within 4 minutes of the later of the server starting and the call ending. A call Vapi says does not exist (404) is set to `incomplete` with no refund.
- **AC-10**: A report that was `running` before this server started, or a session with the end handled but no report state, is retried once. Nothing is retried a second time, and a report that failed on an LLM error (`failed`) is not retried. One interview costs at most two report runs, and only after a crash.
- **AC-11**: A reservation left behind by a crash before the Vapi call existed is released after 5 minutes, with the seat and the payment refunded the same way `forgiveEarlyStall` does it. A reservation for a call that exists is never released.
- **AC-12**: The backend runs on the newest Node that works on this host's glibc 2.17 (an unofficial glibc 2.17 build of Node 24, else 22, else the current 20.18). `npm test`, `npm run lint` and `npm run build` pass, and going back is one setting.
- **AC-13**: The old `~/sera-app` cron lines are removed, and the backend cron entries are replaced by one `ensure.sh` entry plus `@reboot`.
- **AC-14**: Creating `run/stop` stops the watchdog and Node and nothing brings them back until the file is removed. `start.sh start`, `stop`, `check` and `restart` use the same scripts and flag, so nothing can start a second, unsupervised Node.

## Decision

**Chosen option**: Option 2, a watchdog script plus a one minute cron, with restart safe recovery inside the server.

Keep the backend on YZIServer. Run it under a detached watchdog written as a small Node script (`server/supervise.mjs`) that restarts it in seconds, keep that watchdog alive with a one minute cron (`server/ensure.sh`), and make the server recover its own state after any restart (`server/recovery.js`). If the proof step shows cron does not fire, use the contingency in the build plan instead of guessing.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**How it runs** (new files first; the few edits to working code are small and listed):

| File | Job |
|---|---|
| `server/supervise.mjs` | The watchdog, in Node. Takes its single instance lock by binding `127.0.0.1:4006` (`SERA_WATCHDOG_PORT`). Loads `.env` on every Node start. If port 4005 already answers, asks that Node to exit through `/api/sera/admin/restart`. Starts Node with `NODE_BIN`, gives it a 30 second startup grace, then calls `/health` every 10 seconds with a 5 second limit. Five failures in a row sends `SIGTERM`, then `SIGKILL` after 2 seconds. Touches `run/watchdog.beat` every 5 seconds. Exits when `run/stop` exists. |
| `server/ensure.sh` | Run by cron every minute and at reboot. Sets its own `PATH` and uses `$HOME`. If `run/stop` exists, does nothing. If `run/watchdog.beat` is missing or older than 20 seconds, starts the watchdog detached (`setsid nohup`). Writes to `run/ensure.log` only when it starts something. |
| `server/recovery.js` | Runs once at server start and every 2 minutes. Rearms round timers, catches up missed ends, retries a stuck report, releases orphaned reservations. |
| `server/shutdown.js` | On `SIGTERM`, `SIGINT` and `/admin/restart`: stop accepting connections, close idle keep alive sockets, wait up to 40 seconds for a report in progress and in flight requests, exit. Adds an `uncaughtException` handler that logs and exits with code 1. |
| `server/start.sh` (edit) | `start`, `stop`, `check` and `restart` call `ensure.sh` and the `run/stop` flag instead of starting Node themselves. Log rotation happens only between runs. |
| `scripts/deploy-sera-vapi.sh` (edit) | Step 5c becomes: confirm the watchdog is alive (run `ensure.sh` through `timeout 25 ssh -n` only if it is not), then wait for the new build id. The live check also counts running reports and ended calls with no finished report. |
| `netlify/lib/seraVapi/rounds.js` (edit) | `createRoundTimers.start` accepts optional `elapsedSeconds` and `done`, so the timers can start part way through. Defaults keep today's behaviour and tests. |
| `netlify/lib/seraVapi/call.js` (edit) | New `getCall(callId)` and an adapter from Vapi's call shape to what `parseEndOfCall` expects. |
| `server/index.js` (edit) | One import and one call each for `shutdown.js` and `recovery.js`; `finalizeReport` gets a `stale` parameter; the timer `onEvent` path records `timerSteps` before each send. Nothing else changes. |

**State transitions** (the watchdog):
`starting` (30 s grace) → `running` (health ok) → `exited` (any reason) → `backoff` (1, 2, 4, 8, 15 s) → `starting`. A run healthy for 60 seconds resets the backoff. Five failed health checks in a row moves `running` to `exited` by killing Node. `run/stop` moves any state to `stopped`.

**Data additions** (extra fields in the existing session JSON, no new entity, no migration, old files stay valid):
- `session.vapi.timerSteps`: `{ [round]: { [step]: ISO time recorded } }`, written before each step is sent.
- `session.reportAttempts`: a number, 0 if missing, raised inside the same claim that starts a report.

**API surface**: no new HTTP route. `/health` and `/api/sera/admin/restart` already exist. Recovery uses the existing internal paths (`enterRound`, `processEndOfCall`, `finalizeReport`, the early stall release) and one new outbound call.

| Outbound call | Method | Used by | Auth | Key errors |
|---|---|---|---|---|
| Vapi `GET /call/{id}` | GET | recovery catch up | `Bearer VAPI_PRIVATE_KEY` | 404 sets the session `incomplete` (no refund); 401, 5xx and timeouts are retried next sweep and logged once an hour |

**Value sourcing** (where every value the ACs need comes from):
| Action | Value produced or used | Source |
|---|---|---|
| Watchdog health check | Is the server alive | `GET http://127.0.0.1:4005/health`, `"ok":true` |
| Cron liveness check | Age of the watchdog | mtime of `run/watchdog.beat`, written by `supervise.mjs` |
| Exit log line | Reason, exit code or signal | the `exit` event of the Node child process |
| Exit log line | Build id | the `BUILD` file next to `server/`, read when Node starts |
| Exit log line | Time | `new Date().toISOString()` (UTC) |
| Timer rearm | Seconds already elapsed in the round | now minus `vapi.roundStartedAt[round]`; for screening (never set) `vapi.startedAt`; for HR, `vapi.handoffAt` when `roundStartedAt.hr` is missing |
| Timer rearm | Which steps are left | `planRoundTimers(round, ROUND_SECONDS[round])` minus `vapi.timerSteps[round]`, still gated by `isCurrent` |
| Timer rearm | Where to send the note | `session.vapi.controlUrl` (existing, server only) |
| Catch up | Which calls to check | every session with `vapi.callId` and no `vapi.endHandled`, no age limit; a call not ended and older than 30 minutes is logged once and left |
| Catch up | Is the call over | Vapi `status === 'ended'` and `endedAt` set, plus a 90 second wait after `endedAt` |
| Catch up | End reason, transcript and session id | Vapi call `endedReason`, `artifact.messages`, `metadata.sessionId`, through the new adapter into the existing `processEndOfCall` |
| Stuck report | Is it stuck | `reportState === 'running'` and `reportStartedAt` earlier than this process's start time; or `vapi.endHandled` with no `report` and no `reportState`, where `decideOutcome` said `report` |
| Stuck report | Whether a retry is allowed | `reportAttempts < 2` and `reportState !== 'failed'` |
| Orphan reservation | Is the slot orphaned | reservation `status === 'reserved'`, `reservedAt` older than 5 minutes, and no session with a `vapi.callId` for that email |
| Orphan reservation | What to refund | the seat and order the reservation and session record, through the existing `forgiveEarlyStall` release |
| Backoff | Current delay | a counter in `supervise.mjs`, reset after 60 healthy seconds |
| Deploy guard | Is anything unfinished | sessions with a live call, `reportState === 'running'`, or `endHandled` with no `report` (extends the existing check) |

**Key invariants**:
- There is at most one watchdog (the port lock) and at most one Node (port 4005). The server is a single process, and the `mutateSession` lock is per process, so this spec assumes exactly one.
- One interview produces one report. A retry after a crash is allowed once, claimed inside `mutateSession`, with `reportAttempts` raised in the same claim.
- Recovery never makes an LLM call of its own. Only `finalizeReport`, the existing path, does.
- The catch up step creates no route a stranger can call. It only reads Vapi with the server's own key.
- A timer note is recorded before it is sent and never sent twice.

**Security model**: no new public surface. `run/` files hold no secrets. The log carries session ids shortened to 8 characters and short error messages only, never résumé text, transcripts, keys, `controlUrl` or provider response bodies. `VAPI_PRIVATE_KEY` lives only in the server `.env` (mode 600), never in a `VITE_` variable, the repo or the log. The compliance scope is personal candidate data (résumés, transcripts): recovery reads it only inside the server process and writes nothing new that contains it.

**Configuration required**:
- `VAPI_PRIVATE_KEY`: a Vapi private API key used only to read a call back for catch up. Added by the owner to the server `.env`; name in `.env.example` with no value; `/api/sera/diagnostics` shows whether it is set.
- `NODE_BIN` (optional, read by `supervise.mjs`): path to the Node binary. Defaults to the Node chosen in Slice 0; set it to `~/bin/node` to go back to 20.18.
- `SERA_WATCHDOG_PORT` (optional, default 4006): the local port the watchdog binds as its lock.

**Critical test scenarios** (each maps to an acceptance criterion):
- Kill drill: start the watchdog with `setsid` in the drill's own ssh session, `kill -9` Node from that session, log out, then poll `/health` from outside; it answers within 30 seconds, verifies **AC-1**.
- Cron drill: kill watchdog and Node the same way, wait; both return within 90 seconds, verifies **AC-2**.
- Hang drill: `SIGSTOP` Node; it is replaced within 70 seconds. A slow but answering Node is not killed, verifies **AC-3**.
- Race drill: run `ensure.sh` ten times at once, and start a second watchdog by hand; one watchdog and one Node remain. A leftover Node is asked to exit and replaced, verifies **AC-4**.
- Crash loop drill on a copy: a build that exits at once gets growing delays and an idle CPU, verifies **AC-5**, **AC-6**.
- Stop drill: create `run/stop`; nothing returns, `start.sh start` does nothing; remove it and cron restores the server, verifies **AC-14**.
- Deploy drill: a trivial change goes live with a new build id and no manual step; a fake live interview, a running report and an ended call without a report each block it, verifies **AC-7**.
- Unit tests (`node --test`, fake Vapi, fake clock, temp data folder) in `server/recovery.test.js` and `server/supervise.test.js`: overdue timers (**AC-8**), a missed end with a fixture of Vapi's call shape and the 404 case (**AC-9**), stuck and stranded reports and the no retry for `failed` (**AC-10**), orphan versus real reservations and the refund (**AC-11**), backoff and exit reasons (**AC-5**, **AC-6**).
- Restart during a fake call, extending `server/vapiFlow.test.js`, verifies **AC-8**, **AC-9**.
- Full suite on the chosen Node, verifies **AC-12**.

## Build plan

Order follows Tracer Bullet (your scope's approach): prove the pipe first, then thicken. Each step is finished and proven on the host before the next starts.

**Slice 0: prove the facts (no repo code)**
1. On the host, write a timestamp to a file from a one minute cron entry and read it for 15 minutes. Confirm `flock` is not needed (the port lock replaces it), `setsid` and `curl` work under cron, and note the cron `PATH`. If the host runs it less often, update AC-2. Satisfies **AC-2**.
2. Ask the owner to look in cPanel for Resource Usage (limit hits) and for Setup Node.js App or Application Manager. If a Node app manager exists, stop and revisit this spec. Satisfies **AC-1**.
3. Find the newest Node that runs on glibc 2.17: try an unofficial glibc 2.17 build of Node 24, then 22, install it in `~/.local/` and run the test suite on it; if none works, keep 20.18 and record that. Also confirm whether `node_modules` is built on the host or uploaded (native modules). Satisfies **AC-12**.

**Slice 1: the thin thread (watchdog and cron)**
4. Write `server/supervise.mjs`, `server/supervise.test.js` and `server/ensure.sh`. Satisfies **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-14**.
5. Save the old crontab to `~/crontab.before-0001`. Remove the old backend and `~/sera-app` lines first, wait 60 seconds, then add `* * * * * bash $HOME/yzi-backend/server/ensure.sh` and an `@reboot` line. Satisfies **AC-13**.
6. Edit `server/start.sh` so `start`, `stop`, `check` and `restart` use the new scripts and the `run/stop` flag. Satisfies **AC-14**.
7. Run the kill, cron, hang, race, crash loop and stop drills on the real host, each in its own session as described. Satisfies **AC-1** to **AC-6**, **AC-14**.

**Slice 2: deploys and Node**
8. Change step 5c of `scripts/deploy-sera-vapi.sh`, extend its live check, and check the script for a repeated restart block (the file appears to contain one). Satisfies **AC-7**.
9. Switch `NODE_BIN` to the Node chosen in step 3, run `npm test`, `npm run lint`, `npm run build`, then the drills again. Satisfies **AC-12**.

**Slice 3: restart safe server**
10. Add `server/shutdown.js` (including the `/admin/restart` path and the `uncaughtException` handler). Satisfies **AC-5**, **AC-6**, **AC-10**.
11. Extend `createRoundTimers` (`elapsedSeconds`, `done`) and record `timerSteps` before each send. Satisfies **AC-8**.
12. Add `getCall` and the Vapi call adapter with a fixture test. Before relying on them, verify the real response with one read only request for a past call. Satisfies **AC-9**.
13. Write `server/recovery.js` and `server/recovery.test.js` (timers, catch up, stuck reports with the `stale` parameter on `finalizeReport`, orphan reservations), and start it from `server/index.js` after `listen`. Satisfies **AC-8** to **AC-11**.
14. Add `VAPI_PRIVATE_KEY` to `.env.example`, to the diagnostics output, and (owner) to the server `.env`. Satisfies **AC-9**.

**Slice 4: prove it live**
15. Deploy with the new script in a quiet hour, run a fake interview, restart the server in the middle, and check the timers, the end of call and the report. Record the result. Satisfies **AC-7** to **AC-11**.
16. Write the finding about the host and the new run model into `AGENTS.md` and `server/AGENTS.md` through `/sync`.

**Contingency (only if step 1 shows cron does not fire at all):** add `public_html/revive.php`, protected by a long random token, that runs `ensure.sh`, and have the uptime monitor (scope feature 3) call it every minute. If PHP cannot run programs on this host, escalate to moving the API to a real VPS, which the rationale records as the next step.

## Migration plan

**Strategy**: strangler. The new layer runs beside the old `start.sh` and replaces it only after the drills pass.
**Phases**:
1. Slice 0 and 1: add the watchdog and the new cron line, with the old crontab saved to `~/crontab.before-0001`. The old lines come out first, then a 60 second wait, then the new line goes in, so two supervisors never overlap.
2. Slice 2: switch deploys and Node, one at a time, with the drills after each.
3. Slice 3: ship the restart safe server code through the normal deploy, in a quiet hour with no live interview.
**Rollback**: restore the saved crontab (`crontab ~/crontab.before-0001`), set `NODE_BIN` back to `~/bin/node`, and redeploy the previous build. No data changes, so nothing to undo in the session files.
**Risks**: the host killing the watchdog on a schedule (the drills, the exit reasons in the log and the heartbeat test reveal it); the Vapi `GET /call` response not matching the assumed shape (checked before it is relied on); an unofficial Node build behaving differently from the official one (the full test suite and the drills run on it first).

## Consequences

**Positive**:
- An outage drops from up to 19 minutes (and a long one today) to seconds.
- A deploy no longer needs a manual restart or a hanging ssh command, and you can stop the backend on purpose with one file.
- A restart during an interview no longer loses the round timers, the report or the interview slot.

**Negative / tradeoffs**:
- The watchdog is a home made supervisor on a host that can still kill it. Cron is the last line, so a host that stops cron removes the safety net.
- Restart safety protects your data and the report, not the live call itself. While the server is down, Vapi's tool calls (such as `show_offers`) go unanswered and webhooks get a 503, so a call in progress can still degrade.
- Detached processes are not visible from other ssh sessions. Status is read from `run/watchdog.beat` and the log, not from `ps`.
- Recovery loosens the cost control rule that the report is made only in the webhook. It now also runs from a sweep, still once per interview, with one allowed retry after a crash (at most two report runs for one interview). The server must stay a single process for the lock to hold.
- A new secret (`VAPI_PRIVATE_KEY`) must be kept on the server.
- If only Node 20.18 runs on this host, the backend stays on a version that no longer gets security fixes.
- The host can still be down or throttled as a whole, which this spec cannot fix.

**Neutral**:
- Existing session files stay valid because the new fields are optional.
- The recovery sweep reads every session file every 2 minutes. That is fine now; an index or an age filter is needed if sessions grow into the thousands.
- Uptime alerts, error alerts and backups stay with scope features 3, 4 and 5.

## Follow-up

- [ ] Owner: check cPanel Resource Usage and Setup Node.js App or Application Manager, and tell me what they show (build step 2).
- [ ] Owner: create a Vapi private API key and add `VAPI_PRIVATE_KEY` to the server `.env` (build step 14).
- [ ] Confirm with Vapi support whether a failed webhook is retried, and for how long. The docs do not say, so recovery assumes no retry.
- [ ] Kill the old `sera-app` processes through cPanel Process Manager, since they cannot be killed from another ssh login, and decide with the owner what to do with the `~/sera-app` files (scope feature 10).
- [ ] If the log shows the host kills the process on a schedule, revisit with the Move to another host item in the scope's Deferred list.
- [ ] If no newer Node runs on glibc 2.17, track the move off Node 20 as its own item (a VPS would solve it).
- [ ] `/sync` should update `AGENTS.md` (the host is shared cPanel hosting, glibc 2.17, no root, no systemd, each login has its own process space) and `server/AGENTS.md` (new run model, `run/stop`, Node version) after the build.

## References

**Project sources**:
- `AGENTS.md` and `server/AGENTS.md`: the deploy flow, the restart endpoint and the host facts.
- `docs/scope/scope.md`, feature 1: the goal and the done when conditions.
- `server/index.js` (round timers, `processEndOfCall`, `finalizeReport`, `forgiveEarlyStall`, `/admin/restart`), `server/store.js`, `server/start.sh`, `netlify/lib/seraVapi/rounds.js`, `netlify/lib/seraVapi/call.js`.
- Live findings on 2026-10-08: 202 recoveries in `~/yzi-backend/yzi-backend.log`, no root or systemd, glibc 2.17, per login process spaces, detached processes surviving a login ending.

**Practices & standards**:
- Disposable processes that start fast and stop gracefully, and recover from sudden death.
- Supervise the process and restart it, with a backoff so a crash loop does not spin.
- Idempotent handling of repeated or missed events; record before you send for at most once effects.

**Links** (web verified):
- [The Twelve-Factor App, Disposability](https://12factor.net/disposability): fast start, graceful stop, robust to sudden death.
- [Node.js release schedule](https://github.com/nodejs/Release): Node 20 reached end of life on 2026-04-30; Node 24 is Active LTS.
- [Vapi, webhook logs](https://docs.vapi.ai/observability/logs/webhook-logs): a non 2xx reply is a failed delivery; the docs do not state the retry count.
