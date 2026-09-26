#!/usr/bin/env bash
# ABRASH OS scheduled backup: tar.gz + sha256 + prune. Cron-ready.
#   DATA_DIR=/opt/abrash-os/server/data OUT_DIR=/opt/abrash-os/backups KEEP=14 deploy/backup.sh
# Optional encryption: BACKUP_PASS=... (uses openssl AES-256-CBC)
set -euo pipefail
DATA_DIR="${DATA_DIR:-./server/data}"
OUT_DIR="${OUT_DIR:-./backups}"
KEEP="${KEEP:-14}"
mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
tar -czf "$TMP/abrash-$TS.tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
OUT="$OUT_DIR/abrash-$TS.tar.gz"
if [ -n "${BACKUP_PASS:-}" ]; then
  openssl enc -aes-256-cbc -salt -pbkdf2 -pass "env:BACKUP_PASS" -in "$TMP/abrash-$TS.tar.gz" -out "$OUT.enc"
  OUT="$OUT.enc"
else
  mv "$TMP/abrash-$TS.tar.gz" "$OUT"
fi
sha256sum "$OUT" > "$OUT.sha256"
# prune old (keep newest $KEEP)
ls -t "$OUT_DIR"/abrash-*.tar.gz* 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -t "$OUT_DIR"/*.sha256 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
echo "backup: $OUT ($(du -h "$OUT" | cut -f1))"
