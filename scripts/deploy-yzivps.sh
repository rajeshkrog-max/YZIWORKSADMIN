#!/usr/bin/env bash
# Deploys the backend (and optionally the frontend) to YZIVPS (Bluehost VPS, Ubuntu, systemd + Apache), then proves the
# live site works. Replaces scripts/deploy-sera-vapi.sh, which targets the old cPanel host (YZIServer) and stays untouched.
# Secrets are never handled here: the server .env lives on the VPS only and is edited there.
#
#   bash scripts/deploy-yzivps.sh              # backend only
#   bash scripts/deploy-yzivps.sh --frontend   # also builds and ships dist/ (do this whenever src/ changed)
#   FORCE=1 bash scripts/deploy-yzivps.sh      # restart even with an interview live or a report being built
set -euo pipefail

HOST=YZIVPS
SITE=https://yziworks.com
STAMP=$(date +%Y%m%d-%H%M)
cd "$(dirname "$0")/.."
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo nogit)
[ -n "$(git status --porcelain 2>/dev/null)" ] && SHA="$SHA+local"
BUILD="$SHA-$STAMP"
FRONTEND=no
[ "${1:-}" = "--frontend" ] && FRONTEND=yes
APP=/home/yzi/yzi-backend
WEBROOT=/var/www/yziworks.com/public

echo "1/6 checking the code (build $BUILD)"
node --check server/index.js
TEST_OUT=$(npm test --silent 2>&1 || true)
echo "$TEST_OUT" | grep -E "^ℹ (tests|pass|fail)"
echo "$TEST_OUT" | grep -q "^ℹ fail 0" || { echo "Tests failed, nothing was deployed."; echo "$TEST_OUT" | grep -E "^✖" | head; exit 1; }

echo "2/6 backing up and uploading the server files"
# Everything the server imports at run time (tests excluded), so the host never runs a mix of old and new files.
RUNTIME="server/index.js server/store.js server/shutdown.js server/recovery.js server/formEndpoints.js server/applicationUploads.js server/alert.js netlify/lib src/config src/shared netlify/functions/send-otp.js netlify/functions/verify-otp.js netlify/functions/send-contact.js package.json package-lock.json"
OLD_LOCK=$(ssh "$HOST" "sha256sum $APP/package-lock.json 2>/dev/null | cut -d' ' -f1" || true)
# shellcheck disable=SC2086
tar --force-local --exclude='*.test.js' -czf - $RUNTIME | ssh "$HOST" "sudo -u yzi bash -c 'cd $APP && tar czf /home/yzi/backups/yzi-backend-$STAMP.tgz server src netlify package.json package-lock.json .env && mkdir -p netlify/functions && tar xzf - && echo $BUILD > BUILD' && echo uploaded"
NEW_LOCK=$(ssh "$HOST" "sha256sum $APP/package-lock.json | cut -d' ' -f1")
if [ "$OLD_LOCK" != "$NEW_LOCK" ]; then
  echo "  package-lock.json changed, installing production dependencies"
  ssh "$HOST" "sudo -u yzi bash -lc 'cd $APP && npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -n 2'"
fi

echo "3/6 loading the new code on the server before touching the running one"
ssh "$HOST" "sudo -u yzi bash -lc 'cd $APP && node --check server/index.js && node --input-type=module -e \"await import(\\\"./server/formEndpoints.js\\\"); await import(\\\"./server/applicationUploads.js\\\"); await import(\\\"./server/shutdown.js\\\"); await import(\\\"./server/recovery.js\\\"); await import(\\\"./server/alert.js\\\"); await import(\\\"./netlify/lib/seraReport/pdfAssets.node.js\\\"); await import(\\\"./netlify/lib/seraVapi/index.js\\\"); await import(\\\"./netlify/lib/seraPayment/index.js\\\"); console.log(\\\"  all modules load\\\")\"'"

echo "4/6 restarting the backend"
# Never cut off work in progress (FORCE=1 overrides): a live call, a report being built, or a call that ended and has no
# finished report yet (a restart now would lose the round timers or the report run).
GUARD_OUT=$(ssh "$HOST" 'bash -s' <<'GUARD' 2>/dev/null | tail -n 1
cd /home/yzi/yzi-backend/server/data/sessions 2>/dev/null || { echo "0 0 0"; exit 0; }
node -e '
const fs=require("fs");const now=Date.now();let live=0,running=0,unfinished=0;
for(const f of fs.readdirSync(".")){ if(!f.endsWith(".json"))continue;
  try{const s=JSON.parse(fs.readFileSync(f,"utf8"));const age=(now-fs.statSync(f).mtimeMs)/60000;const v=s.vapi;
    if(v&&v.callId&&!v.endHandled&&age<=30)live++;
    if(s.reportState==="running"&&age<=10)running++;
    if(v&&v.endHandled&&!s.report&&s.reportState!=="failed"&&s.reportState!=="running"&&s.status!=="incomplete"&&s.status!=="dropped"&&s.status!=="restart_available"&&s.status!=="report_failed"&&age<=1440)unfinished++}catch{} }
console.log(live+" "+running+" "+unfinished)'
GUARD
)
read -r LIVE_COUNT RUNNING_COUNT UNFINISHED_COUNT <<<"${GUARD_OUT:-0 0 0}"
if { [ "${LIVE_COUNT:-0}" != "0" ] || [ "${RUNNING_COUNT:-0}" != "0" ] || [ "${UNFINISHED_COUNT:-0}" != "0" ]; } && [ "${FORCE:-}" != "1" ]; then
  echo "  Nothing was restarted: ${LIVE_COUNT:-0} interview(s) live, ${RUNNING_COUNT:-0} report(s) being built, ${UNFINISHED_COUNT:-0} ended call(s) without a finished report."
  echo "  The new files are uploaded; run again later, or with FORCE=1 to restart anyway."
  exit 1
fi
# systemd sends SIGTERM; server/shutdown.js waits up to 40 s for requests and a running report, then exits.
ssh "$HOST" "systemctl restart yzi-backend"
healthy=no; live=""
for _ in $(seq 1 30); do
  live=$(ssh "$HOST" "curl -s -m 3 http://127.0.0.1:4005/health" || true)
  case "$live" in *"\"build\":\"$BUILD\""*) healthy=yes; echo "  healthy on the server: $live"; break ;; esac
  sleep 2
done
if [ "$healthy" != yes ]; then
  echo "  NOT HEALTHY after 60 s (last answer: ${live:0:120})"
  ssh "$HOST" "journalctl -u yzi-backend -n 25 --no-pager"
  exit 1
fi

if [ "$FRONTEND" = "yes" ]; then
  echo "5/6 frontend: building and shipping dist/ (backs up index.html first)"
  npm run build --silent
  # Hashed assets first (old ones stay, so open tabs keep working), then everything else with index.html last.
  ssh "$HOST" "cp $WEBROOT/index.html $WEBROOT/index.html.prev-$STAMP 2>/dev/null; mkdir -p $WEBROOT/assets"
  tar --force-local -C dist -czf - assets | ssh "$HOST" "tar xzf - -C $WEBROOT"
  # A file list on stdin, one per line, so names with spaces (public/WhatsApp Image ….jpeg) survive.
  { (cd dist && ls -A | grep -vx -e assets -e index.html); echo index.html; } |
    tar --force-local -C dist -czf - -T - | ssh "$HOST" "tar xzf - -C $WEBROOT && chmod -R a+rX $WEBROOT"
else
  echo "5/6 frontend NOT deployed (pass --frontend to ship dist/ when src/ changed)"
fi

echo "6/6 checking the live site: the build behind Apache, and every endpoint the frontend calls"
live=$(curl -s -m 10 "$SITE/api/sera/health" || true)
case "$live" in
  *"\"build\":\"$BUILD\""*) echo "  public API runs build $BUILD" ;;
  *) echo "  PUBLIC API DOES NOT SHOW BUILD $BUILD (got: ${live:0:120})"; exit 1 ;;
esac
code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -X POST -H "Content-Type: application/json" -d '{}' "$SITE/api/sera/vapi-webhook" || true)
echo "  webhook with no credential -> HTTP $code (expect 401)"
if [ "$FRONTEND" = "yes" ]; then node scripts/smoke-live.mjs "$SITE" --dist; else node scripts/smoke-live.mjs "$SITE"; fi

echo
echo "Deployed build $BUILD"
