#!/usr/bin/env bash
# Deploys the backend (and optionally the frontend) to YZIServer, restarts it with the host's own
# server/start.sh (not pm2: pm2's daemon is reaped when the SSH session ends), and then proves the
# live site works: the new build is the one running, and every endpoint the frontend calls exists.
# Secrets come from the environment of whoever runs this; nothing is printed or committed.
#
#   bash scripts/deploy-sera-vapi.sh              # backend only
#   bash scripts/deploy-sera-vapi.sh --frontend   # also builds and ships dist/ (do this whenever src/ changed)
#
# Optional, exported before running. A key already in the server .env is never overwritten:
#   VAPI_PUBLIC_KEY VAPI_SQUAD_ID OPENAI_API_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET
#   RESEND_API_KEY RESEND_FROM_EMAIL (website forms and contact emails)
#   MSG91_AUTH_KEY MSG91_WIDGET_ID (send-otp) SERA_ADMIN_EMAILS SERA_DEMO_CODE SERA_DEMO_SEATS
# VAPI_WEBHOOK_SECRET is generated on the server if missing and shown ONCE at the end, to paste into
# Vapi's Bearer credential.
set -euo pipefail

HOST=YZIServer
STAMP=$(date +%Y%m%d-%H%M)
cd "$(dirname "$0")/.."
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo nogit)
[ -n "$(git status --porcelain 2>/dev/null)" ] && SHA="$SHA+local"
BUILD="$SHA-$STAMP"
FRONTEND=no
[ "${1:-}" = "--frontend" ] && FRONTEND=yes

echo "1/7 checking the code (build $BUILD)"
node --check server/index.js
node --check server/supervise.mjs
# Windows line endings (CRLF) make the host's bash refuse a script, and the watchdog with it.
if grep -lqUP '\r' server/ensure.sh server/start.sh server/supervise.mjs 2>/dev/null; then echo "server/ensure.sh, start.sh or supervise.mjs has Windows line endings (CRLF). Convert them to LF, nothing was deployed."; exit 1; fi
bash -n server/ensure.sh && bash -n server/start.sh
TEST_OUT=$(npm test --silent 2>&1 || true)
echo "$TEST_OUT" | grep -E "^ℹ (tests|pass|fail)"
echo "$TEST_OUT" | grep -q "^ℹ fail 0" || { echo "Tests failed, nothing was deployed."; echo "$TEST_OUT" | grep -E "^✖" | head; exit 1; }

echo "2/7 backing up and uploading the server files"
# Everything the server imports at run time (tests excluded), so the host never runs a mix of old and new files.
RUNTIME="server/index.js server/store.js server/shutdown.js server/recovery.js server/supervise.mjs server/ensure.sh server/start.sh server/formEndpoints.js server/applicationUploads.js netlify/lib src/config src/shared netlify/functions/send-otp.js netlify/functions/verify-otp.js netlify/functions/send-contact.js"
# shellcheck disable=SC2086
tar --force-local --exclude='*.test.js' -czf - $RUNTIME | ssh "$HOST" "cd ~/yzi-backend && (umask 077; tar czf ~/yzi-backend-backup-$STAMP.tgz server src netlify .env ecosystem.config.cjs) && mkdir -p netlify/functions && tar xzf - && echo '$BUILD' > BUILD && echo uploaded"

echo "3/7 setting the server env (existing keys are kept)"
ENV_NAMES="VAPI_PUBLIC_KEY VAPI_SQUAD_ID OPENAI_API_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RESEND_API_KEY RESEND_FROM_EMAIL MSG91_AUTH_KEY MSG91_WIDGET_ID SERA_ADMIN_EMAILS SERA_DEMO_CODE SERA_DEMO_SEATS"
ENV_OUT=$(
  {
    for name in $ENV_NAMES; do
      [ -n "${!name:-}" ] && echo "$name=${!name}"
    done
    true
  } | ssh "$HOST" 'cd ~/yzi-backend && export PATH=$PATH:/home3/veywkomy/.nodejs/bin &&
  [ -n "$(tail -c1 .env)" ] && echo >> .env
  while IFS= read -r line; do
    key=${line%%=*}
    if grep -q "^$key=" .env; then echo "  kept existing $key"; else printf "%s\n" "$line" >> .env; echo "  added $key"; fi
  done
  if grep -q "^VAPI_WEBHOOK_SECRET=" .env; then echo "  kept existing VAPI_WEBHOOK_SECRET"
  else echo "VAPI_WEBHOOK_SECRET=$(node -e "process.stdout.write(require(\"crypto\").randomBytes(32).toString(\"hex\"))")" >> .env; echo "  generated VAPI_WEBHOOK_SECRET (shown at the end)"; fi
  chmod 600 .env'
)
echo "$ENV_OUT"
echo "  keys the website forms still need on the server:"
ssh "$HOST" 'cd ~/yzi-backend && for k in RESEND_API_KEY MSG91_AUTH_KEY MSG91_WIDGET_ID; do grep -q "^$k=" .env && echo "    $k set" || echo "    $k MISSING (that form answers 503 until it is set)"; done'

echo "4/7 loading the new code on the server before touching the running one"
ssh "$HOST" 'export PATH=$PATH:/home3/veywkomy/.nodejs/bin:/home3/veywkomy/bin && cd ~/yzi-backend && node --check server/index.js && node --input-type=module -e "await import(\"./server/formEndpoints.js\"); await import(\"./server/applicationUploads.js\"); await import(\"./server/shutdown.js\"); await import(\"./server/recovery.js\"); await import(\"./netlify/lib/seraReport/pdfAssets.node.js\"); await import(\"./netlify/lib/seraVapi/index.js\"); console.log(\"  all modules load\")"'

echo "5/7 restarting the backend and waiting for the new build"
# 5a. never cut off work in progress (FORCE=1 overrides): a live call, a report being built, or a call that
# ended and has no finished report yet (a restart now would lose the timers or the report run).
GUARD_OUT=$(ssh "$HOST" 'bash -s' <<'GUARD' 2>/dev/null | tail -n 1
export PATH=$PATH:/home3/veywkomy/.nodejs/bin
cd ~/yzi-backend/server/data/sessions 2>/dev/null || { echo "0 0 0"; exit 0; }
node -e '
const fs=require("fs");const now=Date.now();let live=0,running=0,unfinished=0;
for(const f of fs.readdirSync(".")){ if(!f.endsWith(".json"))continue;
  try{const s=JSON.parse(fs.readFileSync(f,"utf8"));const age=(now-fs.statSync(f).mtimeMs)/60000;const v=s.vapi;
    if(v&&v.callId&&!v.endHandled&&age<=30)live++;
    if(s.reportState==="running"&&age<=10)running++;
    if(v&&v.endHandled&&!s.report&&s.reportState!=="failed"&&s.reportState!=="running"&&s.status!=="incomplete"&&s.status!=="dropped"&&age<=1440)unfinished++}catch{} }
console.log(live+" "+running+" "+unfinished)'
GUARD
)
read -r LIVE_COUNT RUNNING_COUNT UNFINISHED_COUNT <<<"${GUARD_OUT:-0 0 0}"
if { [ "${LIVE_COUNT:-0}" != "0" ] || [ "${RUNNING_COUNT:-0}" != "0" ] || [ "${UNFINISHED_COUNT:-0}" != "0" ]; } && [ "${FORCE:-}" != "1" ]; then
  echo "  Nothing was restarted: ${LIVE_COUNT:-0} interview(s) live, ${RUNNING_COUNT:-0} report(s) being built, ${UNFINISHED_COUNT:-0} ended call(s) without a finished report."
  echo "  Run again later, or with FORCE=1 to restart anyway."
  exit 1
fi
# 5b. ask the running server to exit. Each ssh session on this host has its own process id space, so the
# deploy cannot kill a server that another session started; the server exits itself (credential never leaves the host).
# The watchdog (server/supervise.mjs, kept alive by cron through server/ensure.sh) then starts the new code.
ssh "$HOST" 'bash -s' <<'STOP'
cd ~/yzi-backend
secret=$(grep '^VAPI_WEBHOOK_SECRET=' .env | cut -d= -f2-)
old_build=$(curl -s -m 3 http://127.0.0.1:4005/health | grep -o '"build":"[^"]*"')
code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST -H "Authorization: Bearer $secret" http://127.0.0.1:4005/api/sera/admin/restart || true)
if [ "$code" = "404" ]; then
  # A server from before the restart endpoint existed: stop it with a malformed request it cannot parse. Needed once, ever.
  echo "  running server predates the restart endpoint, stopping it the old way"
  curl -s -m 3 -H 'Host: bad host' http://127.0.0.1:4005/health >/dev/null 2>&1 || true
else
  echo "  restart request -> HTTP ${code:-none}"
fi
for _ in 1 2 3 4 5 6 7 8 9 10; do
  now_build=$(curl -s -m 2 http://127.0.0.1:4005/health | grep -o '"build":"[^"]*"')
  [ "$now_build" = "$old_build" ] || { echo "  old server stopped"; exit 0; }
  sleep 1
done
echo "  old server did not stop"; exit 1
STOP
# 5c. the watchdog starts the new code within seconds. Only when the new build has not appeared after 20 s is the
# watchdog itself checked: ensure.sh starts one if its heartbeat is stale (a login stays open while it runs,
# so a time limit ends the ssh call, and the health poll below is the real check).
healthy=no
live=""
for n in $(seq 1 30); do
  live=$(curl -s -m 5 https://yziworks.com/api/sera/health || true)
  case "$live" in
    *"\"build\":\"$BUILD\""*) healthy=yes; echo "  healthy through Apache: $live"; break ;;
  esac
  if [ "$n" = 10 ]; then
    echo "  new build not up after 20 s, making sure the watchdog is alive"
    timeout 25 ssh -n "$HOST" 'bash ~/yzi-backend/server/ensure.sh </dev/null >/dev/null 2>&1' || true
  fi
  sleep 2
done
if [ "$healthy" != yes ]; then
  echo "  NOT HEALTHY after 60 s (last answer: ${live:0:120})"
  ssh -n "$HOST" 'tail -n 25 ~/yzi-backend/yzi-backend.log'
  exit 1
fi

if [ "$FRONTEND" = "yes" ]; then
  echo "6/7 frontend: building and shipping dist/ (backs up index.html first)"
  npm run build --silent
  # Only files the server does not have yet (the hashed JS/CSS that changed), with index.html last in the
  # same archive. One ssh call per site folder, retried: the host refuses a burst of logins for a minute or so.
  ls dist/assets | sort > /tmp/sera-local-assets.txt
  # The site icons live in the folder root, not in assets/, so they are always sent (a few KB), before index.html.
  ICONS=$(cd dist && ls favicon.svg favicon.ico favicon-96x96.png apple-touch-icon.png web-app-manifest-192x192.png web-app-manifest-512x512.png site.webmanifest | tr '\n' ' ')
  for root in public_html/yziworks.com public_html; do
    for attempt in 1 2 3 4 5 6; do
      ssh "$HOST" "cd ~ && cp $root/index.html $root/index.html.bak-$STAMP && mkdir -p $root/assets && ls $root/assets | sort" > /tmp/sera-remote-assets.txt 2>/dev/null && break
      echo "  host refused the connection, retrying in 45 s ($attempt/6)"; sleep 45
    done
    MISSING=$(comm -23 /tmp/sera-local-assets.txt /tmp/sera-remote-assets.txt | sed 's#^#assets/#' | tr '\n' ' ')
    echo "  $root: uploading index.html + $(echo $MISSING | wc -w) new asset files + $(echo $ICONS | wc -w) icon files"
    for attempt in 1 2 3 4 5 6; do
      # shellcheck disable=SC2086
      tar --force-local -C dist -czf - $MISSING $ICONS index.html | ssh "$HOST" "cd ~/$root && tar xzf -" 2>/dev/null && break
      echo "  host refused the connection, retrying in 45 s ($attempt/6)"; sleep 45
    done
  done
else
  echo "6/7 frontend NOT deployed (pass --frontend to ship dist/ when src/ changed)"
fi

echo "7/7 checking the live site: the build behind Apache, and every endpoint the frontend calls"
live=$(curl -s -m 10 https://yziworks.com/api/sera/health || true)
case "$live" in
  *"\"build\":\"$BUILD\""*) echo "  public API runs build $BUILD" ;;
  *) echo "  PUBLIC API DOES NOT SHOW BUILD $BUILD (got: ${live:0:120})"; exit 1 ;;
esac
code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -X POST -H "Content-Type: application/json" -d '{}' https://yziworks.com/api/sera/vapi-webhook || true)
echo "  webhook with no credential -> HTTP $code (expect 401)"
if [ "$FRONTEND" = "yes" ]; then node scripts/smoke-live.mjs https://yziworks.com --dist; else node scripts/smoke-live.mjs https://yziworks.com; fi

if echo "$ENV_OUT" | grep -q "generated VAPI_WEBHOOK_SECRET"; then
  echo
  echo "Paste this into Vapi -> Integrations -> Custom Credential -> Bearer Token (header Authorization), then attach it to the server URL:"
  ssh "$HOST" 'cd ~/yzi-backend && grep "^VAPI_WEBHOOK_SECRET=" .env | cut -d= -f2-'
fi
echo
echo "Deployed build $BUILD"
