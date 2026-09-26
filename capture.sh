#!/usr/bin/env bash
# Capture desktop + mobile screenshots of the exact CAPTURE_URL into CAPTURE_DIR.
# Delegates browser work to the runtime default-capture (own browser instance,
# closed afterwards), then validates output. Temp infra failures -> 75,
# script/rendering defects -> 1. Leaves the app server running.
set -euo pipefail
/usr/bin/time -p test -n "${CAPTURE_URL:?Set CAPTURE_URL}"
/usr/bin/time -p test -n "${CAPTURE_DIR:?Set CAPTURE_DIR}"
/usr/bin/time -p test -n "${RUNTIME_DIR:?Set RUNTIME_DIR}"
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
set +e
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
rc=$?
set -e
/usr/bin/time -p test "$rc" -eq 0
/usr/bin/time -p test -f "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-mobile.png"
/usr/bin/time -p sh -c 'test $(stat -c%s "$CAPTURE_DIR/final-desktop.png") -gt 5000 && test $(stat -c%s "$CAPTURE_DIR/final-mobile.png") -gt 5000'
/usr/bin/time -p ls -la "$CAPTURE_DIR"
