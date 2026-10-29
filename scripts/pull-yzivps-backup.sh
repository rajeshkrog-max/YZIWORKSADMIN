#!/usr/bin/env bash
# Copies the newest nightly backup set from YZIVPS to this computer, so a copy exists off the server.
# The set holds databases, Sera candidate data and .env, mail and configs: keep the folder private and out of git.
#
#   bash scripts/pull-yzivps-backup.sh                 # into ~/yzivps-backups/<set>
#   bash scripts/pull-yzivps-backup.sh --files         # also the newest WordPress/site file snapshot (about 2.5 GB)
#   DEST=/d/backups bash scripts/pull-yzivps-backup.sh
set -euo pipefail
HOST=YZIVPS
DEST=${DEST:-$HOME/yzivps-backups}
mkdir -p "$DEST"
chmod 700 "$DEST" 2>/dev/null || true

SET=$(ssh "$HOST" 'ls -1t /var/backups/yzi | head -1')
[ -n "$SET" ] || { echo "no backup set found on $HOST"; exit 1; }
STATUS=$(ssh "$HOST" 'cat /var/lib/yzi/backup.status 2>/dev/null' || true)
echo "newest set: $SET (server status: ${STATUS:-unknown})"

if [ -d "$DEST/$SET" ]; then echo "already have $DEST/$SET"; else
  mkdir -p "$DEST/$SET"
  ssh "$HOST" "tar -C /var/backups/yzi/$SET -cf - ." | tar -C "$DEST/$SET" -xf -
  # prove the copy is readable before trusting it
  for f in "$DEST/$SET"/*.gz; do gzip -t "$f"; done
  for f in "$DEST/$SET"/*.tgz; do tar -tzf "$f" >/dev/null; done
  echo "saved and verified: $DEST/$SET ($(du -sh "$DEST/$SET" | cut -f1))"
fi

if [ "${1:-}" = "--files" ]; then
  SNAP=$(ssh "$HOST" 'ls -1t /var/backups/yzi-files | head -1')
  if [ -d "$DEST/files-$SNAP" ]; then echo "already have files-$SNAP"; else
    mkdir -p "$DEST/files-$SNAP"
    ssh "$HOST" "tar -C /var/backups/yzi-files/$SNAP -cf - ." | tar -C "$DEST/files-$SNAP" -xf -
    echo "saved: $DEST/files-$SNAP ($(du -sh "$DEST/files-$SNAP" | cut -f1))"
  fi
fi

# keep the 7 newest copies here
ls -1dt "$DEST"/20*/ 2>/dev/null | tail -n +8 | xargs -r rm -rf
