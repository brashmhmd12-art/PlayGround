#!/usr/bin/env bash
# Restore a backup created by backup.sh. Verifies sha256 first.
#   deploy/restore.sh backups/abrash-20260101-000000.tar.gz [BACKUP_PASS=...]
set -euo pipefail
F="${1:?usage: restore.sh <backup-file>}"
DATA_DIR="${DATA_DIR:-./server/data}"
sha256sum -c "$F.sha256"
mkdir -p "$(dirname "$DATA_DIR")"
if [[ "$F" == *.enc ]]; then
  : "${BACKUP_PASS:?encrypted backup needs BACKUP_PASS}"
  openssl enc -d -aes-256-cbc -pbkdf2 -pass "env:BACKUP_PASS" -in "$F" | tar -xzf - -C "$(dirname "$DATA_DIR")"
else
  tar -xzf "$F" -C "$(dirname "$DATA_DIR")"
fi
echo "restored to $DATA_DIR — restart the server"
