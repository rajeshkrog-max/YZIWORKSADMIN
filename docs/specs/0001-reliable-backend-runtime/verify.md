# Verify: Reliable backend runtime · spec 0001 · updated 2026-10-08
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Host: `ssh YZIServer`, app in `~/yzi-backend`. A new ssh login cannot see or signal a watchdog started by cron or by another login, so a drill that kills a process must start its own watchdog in the same login, or use `run/stop`. Run drills only when no interview is live. Use `timeout N ssh -n ...`, because a login stays open while anything started from it runs.

## UI / manual
- [ ] Open https://yziworks.com/meet-sera and sign in with the demo code. Expect the page loads and the login works (the API answers) → AC-7
- [ ] Take a test interview with the admin or demo account. During the HR round, `kill -9` the server from a login that started it. Expect the page recovers, Vinit's "time is up" note arrives once, and no note is repeated → AC-8
- [ ] After that interview ends, restart the server before the report is ready. Expect exactly one report and one PDF, and one LLM call in the usage dashboard → AC-9, AC-10

## Commands
- [ ] `ssh YZIServer 'curl -s http://127.0.0.1:4005/health'`, then from a login that started its own watchdog, `kill -9` Node and poll `https://yziworks.com/api/sera/health` from outside with no ssh open. Expect 200 again within 30 s, always within 60 s → AC-1
- [ ] `touch run/stop`, wait for the beat to go stale, `rm run/stop`, then kill the watchdog and Node. Expect `/health` answers again within 90 s, started by cron (see `run/ensure.log`) → AC-2
- [ ] `kill -STOP <node pid>` from the login that owns it. Expect it is replaced within 70 s (`exit reason=health-kill`), and a `snapshot` line is logged. Then slow the server on purpose and expect it is not killed → AC-3
- [ ] `for i in $(seq 10); do bash server/ensure.sh & done; wait`, and start a second `node server/supervise.mjs` by hand. Expect one watchdog and one Node. Start a Node by hand first, then the watchdog; expect "leftover-node asking it to exit" and no "port in use" loop → AC-4
- [ ] Copy the app to a scratch folder with a server that exits at once. Expect restarts at 1, 2, 4, 8, then 15 s, idle CPU, and the delay resets after a 60 s healthy run → AC-5
- [ ] `grep "\[watchdog\]" ~/yzi-backend/yzi-backend.log | tail`. Expect UTC time, build id, `reason=exit|signal|health-kill|startup-timeout` with code or signal. `grep -c "<any secret value>" yzi-backend.log` is 0 → AC-6
- [ ] `bash scripts/deploy-sera-vapi.sh` for a trivial change. Expect the new build id on `/api/sera/health` with no manual restart and no `start.sh start`. Then fake a live call, a running report and an ended call with no report (one at a time). Expect the deploy refuses each, and `FORCE=1` overrides → AC-7
- [ ] `npm test`, `npm run lint`, `npm run build` on Node 24. Expect all pass; `cat ~/yzi-backend/run/config` shows `NODE_BIN`; deleting that line and restarting returns to Node 20 → AC-12
- [ ] `crontab -l`. Expect exactly the `ensure.sh` entry every minute plus `@reboot`, and no `sera-app` lines → AC-13
- [ ] `touch run/stop`. Expect Node and the watchdog stop and stay stopped across several cron ticks, `bash server/start.sh start` prints that it was stopped on purpose, and `rm run/stop` lets cron bring it back → AC-14
- [ ] `node --test server/recovery.test.js server/restartRecovery.test.js netlify/lib/seraVapi/roundsResume.test.js netlify/lib/seraVapi/callLookup.test.js server/shutdown.test.js server/supervise.test.js`. Expect all pass → AC-5, AC-6, AC-8, AC-9, AC-10, AC-11
- [x] (2026-10-08, one past call, field names only) With `VAPI_PRIVATE_KEY` set on the host, read one past call: `GET /call/{id}` with the private key. Expect the response has `status`, `endedAt`, `endedReason`, `artifact.messages` and the session id in the metadata, matching the fixture in `callLookup.test.js`. This confirms the assumed shape → AC-9
- [x] (2026-10-08, checked on the host) `curl -H "Authorization: Bearer <webhook secret>" https://yziworks.com/api/sera/diagnostics`. Expect `vapi.privateKey: true` once the key is added → AC-9

## Value sourcing (one step per row of the spec's table)
- [ ] Watchdog health check: stop the server answering `ok:true` (hang drill). Expect the watchdog counts it as a failure; a server answering `ok:false` or an empty body also counts → "Is the server alive"
- [ ] Cron liveness: set `watchdog.beat` mtime 30 s into the past. Expect `ensure.sh` starts a watchdog. At 10 s old, it starts nothing → "Age of the watchdog"
- [ ] Exit log line: `kill -9`, `kill -TERM`, `process.exit(3)` each give `reason=signal`, `reason=signal` (or `exit` on a clean stop), `reason=exit code=3` → "Reason, exit code or signal"
- [ ] Build id in the log: change `BUILD`, restart. Expect the new id on the next line → "Build id"
- [ ] Time: every watchdog line starts with a `Z` suffixed UTC time, whatever the host timezone → "Time"
- [ ] Timer rearm, elapsed: restart 100 s into screening, 30 s into HR (with `roundStartedAt.hr`), and in HR with only `handoffAt`. Expect the remaining delay of each next step to match → "Seconds already elapsed in the round"
- [ ] Timer rearm, steps left: after a restart, `timerSteps` lists every step that was sent, and none is sent twice → "Which steps are left"
- [ ] Timer rearm, where to send: the notes go to the call's stored `controlUrl`, which is never in a response or the log → "Where to send the note"
- [ ] Catch up, which calls: a session with `vapi.callId` and no `endHandled` is checked, however old; a call not ended and older than 30 minutes is logged once and left → "Which calls to check"
- [ ] Catch up, is the call over: ended 30 s ago → not yet; ended 100 s ago → handled → "Is the call over"
- [ ] Catch up, end details: the report built after a catch up has the same transcripts and outcome as one built by the webhook for the same call → "End reason, transcript and session id"
- [ ] Stuck report: `reportState: running` older than the process start is retried once; one started by this process is not → "Is it stuck"
- [ ] Stuck report, allowed: `reportAttempts` 2, or `reportState: failed`, is never retried → "Whether a retry is allowed"
- [ ] Orphan reservation: reserved, older than 5 min, no call for that session → released; younger, or with a call → kept → "Is the slot orphaned"
- [ ] Orphan refund: a student seat recorded in the reservation (`seatConsumedFor`) goes back; no record, no refund → "What to refund"
- [ ] Backoff delay: 1, 2, 4, 8, 15, 15 s, reset after 60 s healthy → "Current delay"
- [ ] Deploy guard: live call, `reportState: running` (under 10 min old) and an ended call with no report each block the deploy; a `failed` report, an `incomplete` session and anything older than 24 h do not → "Is anything unfinished"

## Acceptance-criteria coverage
- AC-1 covered by step 1 (Commands) · AC-2 by step 2 · AC-3 by step 3 · AC-4 by step 4 · AC-5 by step 5 and the unit tests · AC-6 by step 6 · AC-7 by step 7 and the UI step 1 · AC-8 by UI step 2 and the unit tests · AC-9 by UI step 3, the key check and the diagnostics check · AC-10 by UI step 3 and the unit tests · AC-11 by the unit tests · AC-12 by step 8 · AC-13 by step 9 · AC-14 by step 10
- Known not yet run on the real host: the hang drill (AC-3) and the race drill (AC-4) (covered by unit tests against a fake server only), the mid interview restart with a real call (AC-8 to AC-10), (the Vapi `GET /call` shape check is done: it matches the adapter).
