#!/usr/bin/env bash
# ensure.sh: makes sure the backend watchdog (server/supervise.mjs) is alive. Spec 0001.
# Cron runs it every minute and at reboot. It is safe to run any time, from anywhere, as often as you like:
# the watchdog takes a port lock, so a second one exits at once and two Nodes can never run.
#
#   run/stop      if this file exists nothing is started (the way to stop the backend on purpose)
#   run/config    optional KEY=VALUE lines, no secrets. NODE_BIN=<path> picks the Node that runs the
#                 watchdog and the server (default ~/bin/node). Delete the line to go back.
#   run/ensure.log   written only when this script starts something
set -u
export PATH="/usr/local/bin:/usr/bin:/bin:${HOME:-/home3/veywkomy}/bin:${HOME:-/home3/veywkomy}/.local/bin"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="$ROOT/run"
mkdir -p "$RUN" 2>/dev/null || exit 0

[ -e "$RUN/stop" ] && exit 0

BEAT="$RUN/watchdog.beat"
if [ -f "$BEAT" ]; then
  now=$(date +%s)
  seen=$(stat -c %Y "$BEAT" 2>/dev/null || echo 0)
  [ $((now - seen)) -le 20 ] && exit 0
fi

NODE_BIN=""
if [ -f "$RUN/config" ]; then
  NODE_BIN=$(grep -E '^NODE_BIN=' "$RUN/config" | tail -n 1 | cut -d= -f2-)
fi
[ -z "$NODE_BIN" ] && NODE_BIN="${HOME:-/home3/veywkomy}/bin/node"
[ -x "$NODE_BIN" ] || NODE_BIN="$(command -v node 2>/dev/null || true)"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "$(date -u +%FT%TZ) ensure: no Node found, nothing started" >> "$RUN/ensure.log"
  exit 0
fi

export NODE_BIN
# Cron limits a job tree to 25 processes and threads here, so the watchdog also runs with the fewest threads
# Node allows (4 instead of 7), and so does the server it starts (5 or 6 instead of 11).
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-2}"
cd "$ROOT" || exit 0
setsid nohup "$NODE_BIN" --v8-pool-size=1 "$ROOT/server/supervise.mjs" </dev/null >>"$RUN/supervise.out" 2>&1 &
echo "$(date -u +%FT%TZ) ensure: started watchdog with $NODE_BIN" >> "$RUN/ensure.log"
exit 0
