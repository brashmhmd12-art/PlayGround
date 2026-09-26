#!/usr/bin/env bash
# Custom start for MOHAMMAD ABRASH OS (static, no build step).
# Serves abrash-os/ in the foreground on PORT (default 3000) and records
# the built static directory for the deployment controller.
set -euo pipefail
cd "$(dirname "$0")/abrash-os"
/usr/bin/time -p pwd
/usr/bin/time -p mkdir -p "${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
/usr/bin/time -p sh -c 'printf "%s" "{\"project\":\"/home/runner/work/PlayGround/PlayGround\",\"directory\":\"/home/runner/work/PlayGround/PlayGround/abrash-os\"}" > "${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}/deployment-output.json"'
/usr/bin/time -p test -f index.html
/usr/bin/time -p sh -c 'if [ -f package.json ]; then npm install --no-audit --no-fund; fi'
/usr/bin/time -p sh -c 'if [ -f package.json ] && node -e "try{const p=require(\"./package.json\");process.exit(p.scripts&&p.scripts.build?0:1)}catch(e){process.exit(1)}"; then npm run build; fi'
/usr/bin/time -p sh -c 'echo "Serving $(pwd) on PORT=${PORT:-3000}"'
/usr/bin/time -p python3 -m http.server "${PORT:-3000}"
