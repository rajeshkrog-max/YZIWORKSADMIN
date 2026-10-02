#!/usr/bin/env bash
# start.sh — Lifecycle management for YZI Works Meet Sera Backend (Port 4005)
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$APP_DIR/.." && pwd)"
PORT="${SERA_PORT:-4005}"
PID_FILE="$ROOT_DIR/yzi-backend.pid"
LOG_FILE="$ROOT_DIR/yzi-backend.log"
NODE_BIN="$(which node 2>/dev/null || echo "/home3/veywkomy/bin/node")"

cd "$ROOT_DIR" || exit 1

is_healthy() {
    curl -s -m 2 "http://127.0.0.1:$PORT/health" | grep -q '"ok":true'
}

case "$1" in
    start)
        if is_healthy; then
            echo "YZI Backend is already running and healthy on port $PORT"
            exit 0
        fi

        # Clean stale process if any
        if [ -f "$PID_FILE" ]; then
            OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
            if [ -n "$OLD_PID" ]; then
                kill -9 "$OLD_PID" 2>/dev/null || true
            fi
            rm -f "$PID_FILE"
        fi

        # Truncate log if > 5MB
        if [ -f "$LOG_FILE" ]; then
            LOG_SIZE=$(wc -c < "$LOG_FILE" 2>/dev/null || echo 0)
            if [ "$LOG_SIZE" -gt 5242880 ]; then
                tail -n 1000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
            fi
        fi

        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting YZI Works Sera Backend on port $PORT..." >> "$LOG_FILE"

        # Load environment from .env if present
        if [ -f "$ROOT_DIR/.env" ]; then
            set -a
            source "$ROOT_DIR/.env"
            set +a
        fi

        export SERA_PORT="$PORT"
        nohup "$NODE_BIN" server/index.js </dev/null >>"$LOG_FILE" 2>&1 &
        NEW_PID=$!
        echo "$NEW_PID" > "$PID_FILE"
        disown "$NEW_PID" 2>/dev/null || true

        # Wait up to 5 seconds for health
        for i in 1 2 3 4 5; do
            sleep 1
            if is_healthy; then
                echo "YZI Backend started successfully with PID $NEW_PID on port $PORT (healthy in ${i}s)"
                exit 0
            fi
        done

        echo "Warning: YZI Backend process spawned ($NEW_PID), waiting on port $PORT..."
        ;;

    stop)
        if [ -f "$PID_FILE" ]; then
            OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
            if [ -n "$OLD_PID" ]; then
                kill -9 "$OLD_PID" 2>/dev/null || true
            fi
            rm -f "$PID_FILE"
        fi
        pkill -u veywkomy -9 -f "server/index.js" 2>/dev/null || true
        echo "YZI Backend stopped"
        ;;

    restart)
        bash "$APP_DIR/start.sh" stop
        sleep 2
        bash "$APP_DIR/start.sh" start
        ;;

    status)
        if is_healthy; then
            echo "✓ YZI Works Sera Backend: Healthy on port $PORT"
            exit 0
        else
            echo "✗ YZI Works Sera Backend: STOPPED or unresponsive on port $PORT"
            exit 1
        fi
        ;;

    check)
        if ! is_healthy; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend down. Auto-recovering..." >> "$LOG_FILE"
            bash "$APP_DIR/start.sh" restart
        fi
        ;;

    *)
        echo "Usage: $0 {start|stop|restart|status|check}"
        exit 1
        ;;
esac
