# MOHAMMAD ABRASH OS — محمد ابراش · Personal Digital Command Center

Run locally (offline-capable, no build):
```bash
python3 -m http.server -d abrash-os 8080
# open http://localhost:8080 — signup (12+ char password) → login
```

## Modules (14 per spec order)
Auth → Dashboard → Notes → Files → Projects → Tasks → Vault → Search(Ctrl+K)
→ AI → Security Center → Knowledge → Analytics → Backup → Settings
+ Calendar, Goals, Idea Lab, Memory Graph, Profile.

Highlights: dark-first + 3 themes, AR/EN + full RTL, collapsible sidebar,
customizable widgets, Kanban IDEA→COMPLETED, vault AES-GCM + auto-lock,
global search + natural commands («أنشئ مشروع باسم X»), local AI
(summarize/org/note→project), audit log, export/import 100% (no lock-in).

## Extras
- PWA offline: `manifest.webmanifest` + `sw.js` (cache-first shell). Serve over
  http(s) — service workers don't run on `file://`.
- Shortcuts: `Ctrl/⌘+K` palette (↑/↓ + Enter now work), `?` help, `g d/n/t/p/v`.
- Tests: `node tests/smoke.mjs` (61) + `node tests/server.mjs` (22) + `node tests/webauthn.mjs` (11).

## Production server (zero-dep)
```bash
AI_KEY=sk-... PORT=3001 node server/server.js
# → serves frontend + /api/auth/signup|login (PBKDF2 + timingSafeEqual +
#    5/min rate-limit + file audit) + /api/ai proxy (key stays in env)
```
Point the in-app ☁ button at `/api/ai` (Settings → AI endpoint).
Also new: ✨ one-click demo data (Settings), ⬇ note→Markdown, 🖨 note→PDF via print CSS.

## 2FA (real TOTP) + E2E sync
- TOTP RFC 6238 in `js/totp.js` (pure JS, verified vs RFC vectors) — enforced
  in browser login AND server login; setup/verify flow in Security Center.
- E2E sync (Backup page): PBKDF2(password) + AES-GCM in browser; server keeps
  only `{salt,iv,ct}` + rev counter. Stale push → 409 → pull, newest-wins merge.
- Server endpoints: `/api/auth/totp/setup|verify`, `/api/sync` (Bearer token).
- Round 5: per-item conflict UI (mine/theirs) in sync, app idle screen-lock
  (Settings → minutes, 0 disables; session survives, password re-entry unlocks),
  server tokens expire in 24h + `/api/auth/logout` revocation.

## Security (honest)PBKDF2-210k, rate-limit 5/min + lockout, attempt log, sessions revoke,
escapeHTML everywhere, upload allowlist, CSP meta. See `docs/SECURITY.md`.
Not "unhackable" — least-privilege + audit + encrypted backups.
Production: `server/server.js` (helmet, argon2, TOTP/WebAuthn, RLS in schema.sql).

## Tech why
No-build static ES modules = instant load + offline + zero supply-chain.
Same UI ports to Postgres/Express/S3 via `server/` without rewrite.
AI pluggable: local heuristics now, `/api/ai` proxy later (key server-side only).

## Round 6 — remainder
- Recurring tasks engine (daily/weekly/monthly templates spawn missed instances,
  idempotent, runs on tasks view).
- Retention controls (Settings): auto-purge trash + audit/login logs after N days,
  manual clean + runs on boot.
- File versioning that works: re-uploading the same name snapshots the old bytes
  (≤500KB, last 5) with one-click restore.
- Calendar day/week/month views with click-to-drill.
- Opt-in weather widget (Open-Meteo, no key; CSP allowlisted in page + server).
- Roles matrix `js/perms.js` (owner/admin/editor/viewer) gating destructive UI;
  single-user now, multi-user ready.

## Deploy (verified)
Docker image builds clean and serves: `healthz ✅ · UI 200 · signup/login ✅`
(verified by actually running the container). See `docs/DEPLOY.md`:
`docker compose up -d --build` (Caddy HTTPS) or systemd unit, plus
cron-ready `deploy/backup.sh` (plain or openssl-encrypted + sha256 + prune)
and `deploy/restore.sh` (hash-verified restore — tested round-trip).

## Round 7 — Passkey/WebAuthn (verified with a simulated authenticator)
- `server/webauthn.js`: registration (fmt `none` only) + ES256 assertion verify +
  challenge binding + origin/rpId checks + signature-counter clone detection.
- `server/cbor.js`: minimal zero-dep CBOR for attestation parsing.
- Endpoints: `/api/webauthn/register|login/begin|finish`. Client: `js/webauthn.js`
  ceremony + Passkey card in Security Center (HTTPS/localhost only).
- `tests/webauthn.mjs` forges a REAL P-256 authenticator in-test: 11/11
  (register, duplicate reject, login token, stale-counter reject, bad-challenge
  reject, wrong-key reject, unknown user). Env: `RP_ID`, `ORIGIN`.
- Honest limits: no attestation CA verification (self-use), no UV enforcement
  server-side; TOTP remains as fallback second factor.

## Round 8 — field-level 3-way merge (last deferred item, done)
- `syncBaseV2`: per-field VALUE HASHES (fnv1a) instead of whole values — light,
  no blob duplication. Transparent: no module rewrites needed.
- `mergeFields()`: local==remote → keep · local==base → take remote ·
  remote==base → keep local · both differ → field conflict only (item survives).
  Arrays merge atomically; unknown history keeps local (safe); items predating
  V2 fall back to item-level newest-wins.
- UI: each conflicted field shows mine/theirs previews with per-field buttons.
- Honest limits: no delete propagation (soft-delete flag merges as a field),
  arrays are atomic, base hashes live client-side (lost base → safe fallback).

## Round 9 — remaining gaps closed
- Password change (Security Center, old-verify + 12+ rule + audit).
- Notes folders + `[[wikilinks]]` with outgoing/incoming links and click-through
  (preview escapes HTML first, links injected after — XSS-safe by construction).
- Files: favorites + move + copy + REAL preview (image/audio/video/PDF, data-URL
  allowlisted to media/pdf only).
- Tasks: categories + due-soon (≤48h) reminder badge/toast.
- Projects: custom Kanban stages + people/links fields; destructive actions gated
  by `can(role,·)`.
- Dashboard widgets reorder (↑↓ persisted) + duplicate-note detection in suggestions.
- Browser auto-backup daily (24h check, capped at 30) instead of first-run only.
