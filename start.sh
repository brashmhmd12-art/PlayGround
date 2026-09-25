#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
time -p pwd
PROJECT_DIR="$(pwd)"
STATIC_DIR="$PROJECT_DIR/exam-system"
export PROJECT_DIR STATIC_DIR
/usr/bin/time -p test -f "$STATIC_DIR/index.html"
PORT="${PORT:-3000}"
export PORT
OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
export OPENCODE_WEB_DIR
/usr/bin/time -p mkdir -p "$OPENCODE_WEB_DIR"
/usr/bin/time -p bash -c 'printf "%s" "{\"project\":\"$PROJECT_DIR\",\"directory\":\"$STATIC_DIR\"}" > "$OPENCODE_WEB_DIR/deployment-output.json"'
/usr/bin/time -p cat "$OPENCODE_WEB_DIR/deployment-output.json"
/usr/bin/time -p bash -c 'if [ -f "$PROJECT_DIR/package.json" ]; then echo "package.json found, installing"; else echo "no package.json, pure static, skipping install/build"; fi'
/usr/bin/time -p node -e '
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.STATIC_DIR;
const port = Number(process.env.PORT || 3000);
const mime = {".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf"};
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(root, "." + rel);
    if (file !== path.resolve(root) && !file.startsWith(path.resolve(root) + path.sep)) { res.writeHead(404); res.end("Not found"); return; }
    let target = file;
    try { if (fs.statSync(target).isDirectory()) target = path.join(target, "index.html"); } catch {}
    const data = fs.readFileSync(target);
    res.writeHead(200, {"Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache"});
    res.end(data);
  } catch { res.writeHead(404, {"Content-Type": "text/plain"}); res.end("Not found"); }
});
server.listen(port, "0.0.0.0", () => console.log(`exam-system static server on :${port} root=${root}`));
'
