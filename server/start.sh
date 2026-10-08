#!/usr/bin/env bash
# start.sh: lifecycle for the YZI Works Meet Sera backend (port 4005). Spec 0001.
# The backend runs under a watchdog (server/supervise.mjs) that cron keeps alive through server/ensure.sh.
# This script never starts Node itself, so nothing can start a second, unsupervised server.
#
#   start     make sure the watchdog is running and wait for the backend to answer
#   stop      create run/stop: the watchdog stops Node and exits, and nothing brings them back
#   restart   remove run/stop, ask the running server to exit; the watchdog starts the new one in seconds
#   check     what cron runs: ensure.sh (does nothing when the watchdog is alive or run/stop exists)
#   status    is the backend answering
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$APP_DIR/.." && pwd)"
PORT="${SERA_PORT:-4005}"
RUN_DIR="$ROOT_DIR/run"
STOP_FILE="$RUN_DIR/stop"

cd "$ROOT_DIR" || exit 1
mkdir -p "$RUN_DIR"

is_healthy() {
    curl -s -m 2 "http://127.0.0.1:$PORT/health" | grep -q '"ok":true'
}

# Ask the running server to exit on its own (each ssh login has its own process id space, so it cannot be killed from here).
ask_exit() {
    local secret
    secret=$(grep '^VAPI_WEBHOOK_SECRET=' "$ROOT_DIR/.env" 2>/dev/null | cut -d= -f2-)
    [ -n "$secret" ] || return 1
    curl -s -o /dev/null -m 5 -X POST -H "Authorization: Bearer $secret" "http://127.0.0.1:$PORT/api/sera/admin/restart"
}

wait_for() { # wait_for healthy|down SECONDS
    local want="$1" secs="$2" i
    for ((i = 0; i < secs; i++)); do
        if [ "$want" = healthy ] && is_healthy; then return 0; fi
        if [ "$want" = down ] && ! is_healthy; then return 0; fi
        sleep 1
    done
    return 1
}

case "$1" in
    start)
        if [ -e "$STOP_FILE" ]; then
            echo "YZI Backend was stopped on purpose (remove $STOP_FILE, or run restart, to bring it back)"
            exit 0
        fi
        bash "$APP_DIR/ensure.sh"
        if wait_for healthy 30; then
            echo "YZI Backend is running and healthy on port $PORT"
        else
            echo "Warning: the watchdog is started but port $PORT does not answer yet (see $ROOT_DIR/yzi-backend.log)"
        fi
        ;;

    stop)
        touch "$STOP_FILE"
        ask_exit || true
        if wait_for down 50; then
            echo "YZI Backend stopped. It stays stopped until $STOP_FILE is removed."
        else
            echo "Stop requested; the watchdog is still stopping the server (see $ROOT_DIR/yzi-backend.log)"
        fi
        ;;

    restart)
        rm -f "$STOP_FILE"
        bash "$APP_DIR/ensure.sh"
        ask_exit || true
        wait_for down 10 || true
        if wait_for healthy 40; then
            echo "YZI Backend restarted and healthy on port $PORT"
        else
            echo "Warning: port $PORT does not answer yet (see $ROOT_DIR/yzi-backend.log)"
        fi
        ;;

    status)
        if is_healthy; then
            echo "OK: YZI Works Sera Backend is healthy on port $PORT"
            exit 0
        else
            echo "DOWN: YZI Works Sera Backend is stopped or not answering on port $PORT"
            exit 1
        fi
        ;;

    check)
        exec bash "$APP_DIR/ensure.sh"
        ;;

    *)
        echo "Usage: $0 {start|stop|restart|status|check}"
        exit 1
        ;;
esac
