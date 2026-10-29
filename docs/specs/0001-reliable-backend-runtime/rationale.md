# 0001. Rationale: self healing backend runtime on YZIServer

## Context

> ⚠️ Premise note: YZIServer was described as an always on VPS, but a read only probe shows shared cPanel hosting with no root and no systemd. A supervisor that needs root (systemd, pm2 as a service) cannot exist here, so the design must work from a normal user account and must not trust process ids. If the owner later has a real VPS, the same recovery code applies there unchanged.

Meet Sera is live and takes payments, so an outage costs people money and trust. The backend (`server/index.js`) is a plain Node server that holds some state only in memory: the round timers that send "time is nearly up" and "time is up" notes into a live call, and a map from call id to session. Everything else is a JSON file on disk.

The host is not what it was described as. It is shared cPanel hosting (`sh101.webhostingservices.com`), checked over ssh on 2026-10-08: the login is `uid 1346`, `sudo` does not work, `systemctl` is denied, each login sees only its own processes, and a firewall answers HTTP 406 to some uploads. Cron is the only supervisor. The log shows 202 recoveries since 2026-10-01 (57 on 2026-10-02 alone), most on the `:19` slot of each hour, which suggests something ends the process about once an hour. The cron check runs only every 19 minutes (`*/19`), so each outage lasts up to 19 minutes. On 2026-10-08 at 16:2x the API was down again, and the cron runs at 16:19 and 16:38 wrote nothing to the log, so cron itself may have stopped.

A restart today also hurts a live interview: timers are lost, a report that was being built stays in state `running` forever, and an end of call that arrives while the server is down is lost if Vapi does not retry (its docs do not say). One older app (`~/sera-app`, with its own cron lines and a WhatsApp daemon) runs on the same account and may compete for the host's limits.

## Options considered

### Option 1: Cron only, every minute

Replace `*/19` with `* * * * *` on the existing `start.sh check`. The smallest change.

**Pros**:
- One line to change, nothing new to run.
- Outage drops to about a minute.

**Cons**:
- If cron stops firing, as it appears to have, there is no supervisor at all.
- Every recovery costs up to a minute even when the process died instantly.
- Does nothing for the in memory state lost on restart.

### Option 2: Watchdog loop plus a one minute cron, with restart safe recovery (chosen)

A detached watchdog restarts Node within seconds and checks that it answers. Cron keeps the watchdog alive. The server saves its timer progress and catches up on what it missed.

**Pros**:
- Two independent layers, so one failing does not leave you with none.
- Recovery in seconds in the common case.
- Works with no root and no systemd, and detached processes were observed to survive a login ending.
- Makes a restart safe for a paying candidate, not just for the port.

**Cons**:
- A home made supervisor, on a host that can still kill it.
- Needs a new Vapi key and touches the "report only in the webhook" rule (with the owner's approval).

### Option 3: cPanel Node app manager

Use the host's own application manager so it starts and restarts the app.

**Pros**:
- The host does the supervision, the most robust option on shared hosting.

**Cons**:
- The home folder has no `nodevenv`, so it is probably not enabled. Not confirmed, because the owner's screenshot showed only account statistics.
- Ties the app to the host's Node versions and proxy rules.

### Option 4: Move the API to a real VPS

A small VPS (for example DigitalOcean Bangalore, about $12 a month for 1 vCPU and 2 GB RAM, per its pricing page) with systemd and `Restart=always`, and the whole site served by Caddy.

**Pros**:
- The standard, most reliable answer, with root, systemd and automatic certificates.

**Cons**:
- Costs money every month and needs a DNS change and data move.
- The owner chose to stay on YZIServer, and said "use ssh YZIServer, nothing else".
- Does not remove the need for restart safe recovery, so that work is shared with Option 2 anyway.

## Rationale

The owner first answered "move now" to a VPS, then said to use only `ssh YZIServer`. The later, clearer instruction wins, so the design stays on this host. The VPS stays recorded here as the escalation if the drills show the host still kills the process on a schedule.

Option 1 fails on the one fact that matters most: the log shows cron may have stopped, and a single supervisor that can stop silently is the problem we are solving. Option 3 would be best on this host, but there is no sign it is enabled, so it becomes a check in the first build slice rather than the plan. Option 2 is the strongest design that needs nothing the account does not have: a long lived process that restarts its child fast (the disposable process practice), with cron as the backstop. The watchdog's lock and heartbeat avoid relying on process ids, which are useless here because each login has its own process space.

The restart safe recovery is part of the same decision because a faster restart makes a restart during a call more likely to be survivable, and more frequent. Making the restart harmless is cheaper and safer than trying to prevent every restart. The cost control rule says the report is produced once, in the webhook. The owner chose to catch up from Vapi after a restart, so the rule changes to "once per interview, from the webhook or a recovery sweep, with one retry after a crash". It still never adds an endpoint a stranger can call.

The Node upgrade rides in the same change because Node 20 ended on 2026-04-30 and the host currently runs 20.18.0. The AWS SDK in the logs also warns that it will stop supporting Node 20 in January 2027. Running both changes together costs one round of drills; doing them apart costs two. The host's system library is glibc 2.17 (checked over ssh), so the official Node 22 and 24 builds will not run here, and today's 20.18.0 is itself an unofficial compatibility build. The owner chose the newest unofficial glibc 2.17 build that works, with 20.18 as the fallback, so AC-12 says that instead of naming a version.

The watchdog is a small Node script rather than bash (the owner's choice, on the cross check's advice): a lock handle inherited by the child, exit code parsing and the `PATH` under cron are all easy to get wrong in bash, and a Node script can be unit tested. `ensure.sh` stays bash because cron needs something that runs before Node does.

Later choices from the cross check, all taken as recommended: the restart safe recovery waits 90 seconds after Vapi shows an end so the late webhook can win; a 404 means `incomplete` with no refund; only crash cases get the one report retry; an orphaned slot refunds the seat and payment; deploys also wait for report builds; a restart waits up to 40 seconds for a report in progress; health kills use a 5 second timeout with 5 failures.

## Evidence

**Host probe, 2026-10-08 (read only unless noted)**
- `whoami`: `veywkomy`; `hostname`: `sh101.webhostingservices.com`; kernel `4.19.286-203.ELK.el7`.
- `/usr/local/cpanel` and `~/.cpanel` exist; `~/nodevenv` does not.
- `systemctl --user`: "Failed to get D-Bus connection: Operation not permitted". `sudo -n` fails.
- Tools present: `node` v20.18.0 (in `~/bin`, a link to `~/.nodejs/bin/node`), `screen`, `setsid`, `nohup`, `crontab`, `flock`. Absent: `pm2`, `forever`, `supervisord`, `tmux`.
- `ldd --version`: glibc 2.17, and Node reports `glibcVersionRuntime` 2.17, so the official Node 22 and 24 builds (which need 2.28) will not run.
- Crontab: `*/21` for `~/sera-app/start.sh check`, `*/19` for `~/yzi-backend/server/start.sh check`, and two `@reboot` lines.
- Log: first line 2026-10-01 15:45; 209 "Starting" lines; 202 "Backend down. Auto-recovering" lines (per day: 57, 34, 23, 27, 20, 26, 15 for 10-02 to 10-08).
- No "Backend down" line after 2026-10-08 14:19, yet at 16:28 and 16:41 the public health check returned 503 and the local one returned no answer.
- Test: two detached loops (one `setsid`, one `nohup`) kept running after the ssh session that started them was killed, and were still beating 14 minutes later. They cannot be killed from another login and use almost nothing; they will show whether the host kills processes on a schedule.
- Attempt to restart the backend from this session was blocked by the permission system; it was not worked around.

**Observations about the code that shape recovery**
- Round timers live in an in memory `Map` (`createRoundTimers` in `netlify/lib/seraVapi/rounds.js`) with `setTimeout`; a restart drops them all.
- `processEndOfCall` answers the webhook at once and builds the report in the background; `finalizeReport` refuses to run when `reportState` is `running`, so a crash mid report leaves it stuck. `get-report` already reports it as stuck after 5 minutes but does not retry.
- `/api/sera/admin/restart` makes the server exit and relies on something else to start it; the deploy currently starts it with `start.sh start` over ssh, which can hang the ssh session.
- The server has no `VAPI_PRIVATE_KEY`, only the public key used to create web calls.

## References

**Project sources**:
- `AGENTS.md`, `server/AGENTS.md`, `docs/scope/scope.md` (feature 1), `docs/sera-vapi.md`.
- The log and probe results listed under Evidence.

**Practices & standards**:
- Disposability: processes are cheap to start and stop and survive sudden death.
- A supervisor restarts the process, with a delay that grows so a crash loop does not spin.
- Idempotent handling of events that may arrive twice or not at all.
- The strangler instinct: keep the old `start.sh` in place and add the new layer beside it, so rollback is a crontab edit.

**Links** (web verified):
- [The Twelve-Factor App, Disposability](https://12factor.net/disposability)
- [Node.js release schedule](https://github.com/nodejs/Release)
- [DigitalOcean, Droplet pricing](https://www.digitalocean.com/pricing/droplets) (Option 4 cost)
- [Vapi, webhook logs](https://docs.vapi.ai/observability/logs/webhook-logs)
