# MOHAMMAD ABRASH OS — Architecture

Personal Digital Command Center. Local-first MVP (runs offline, no build step),
production path = same UI + REST backend + Postgres + object storage.

## Principles
- Security-by-design: least privilege, minimize attack surface, never store
  plaintext secrets, PBKDF2 + AES-GCM in browser, rate-limit + lockout,
  sanitize all renders (escapeHTML), audit log for sensitive actions.
  No claim of "unhackable".
- Local-first: IndexedDB/localStorage now → sync later with conflict handling
  (last-write-wins + version history).
- Modular: `js/modules/<name>.js` exposes `render(el)` + actions. No cross-module
  private-state access except via `Store` and `Bus`.
- No secrets in frontend. AI provider key lives only in Settings (local) and
  all AI calls go through `server/` proxy in production.

## Layout
```
abrash-os/
  index.html          shell: sidebar, topbar, view container, palette, toasts
  css/app.css         dark-first, themes, RTL, responsive, micro-interactions
  js/
    app.js            boot, router (hash), guards
    core.js           $, escapeHTML, uid, dates, download, Bus
    store.js          namespaced storage + collections CRUD + audit helper
    crypto.js         PBKDF2, AES-GCM vault, random OTP
    i18n.js           AR/EN dict, dir switching
    auth.js           signup/login/logout, sessions, trusted devices, 2FA demo
    ui.js             toast, dialog, empty/loading states, charts (canvas)
    modules/*.js      dashboard, notes, files, projects, tasks, vault, search,
                      ai, security, knowledge, calendar, goals, ideas, graph,
                      analytics, backup, settings, profile
  server/server.js    production REST stub (Express): auth, rate-limit,
                      security headers, file validation, audit
  server/schema.sql   Postgres schema with RLS-ready owner_id + indexes
```

## Data model (localStorage keys `abrashos.v1.*`)
users, session, devices, logins, audits, notes, noteVersions, files,
projects, tasks, vaultMeta+vaultItems(enc), knowledge, events, goals,
ideas, settings, widgets, backups, aiLog.

Production maps 1:1 to `schema.sql` tables (UUID, owner_id, timestamps,
soft-delete `deleted_at`, FTS index on notes/files).

## Auth flow (local MVP)
1. Signup: salt + PBKDF2(210k, SHA-256) → hash stored. Never plaintext.
2. Login: verify hash (constant-time-ish compare), rate-limit 5 fails/IP+user
   → 60s lockout, record attempt (IP mock via `X` + UA + time).
3. Session: random 128-bit id, stored with device fingerprint (UA+screen+tz),
   trusted-device flag, idle timeout 30m, revoke-one / revoke-all.
4. 2FA demo: TOTP stub — 6-digit OTP hashed, 5-min expiry. Production: real
   TOTP (otplib) + WebAuthn passkeys server-side.
5. Vault: second secret → separate salt/hash + AES-GCM data key. Auto-lock timer.

## Offline / sync (future)
Service-worker stub + `navigator.onLine` badge. Queued mutations get
`pendingSync` flag; on reconnect push in order, conflicts resolved by
`updated_at` with version snapshot kept. Current build fully works offline
except AI-cloud calls.

## AI layer
`modules/ai.js` = local heuristics only (summarize, keyword retrieval,
note→project planner, organizer suggestions). Cloud extension point:
`askCloud(prompt, context)` POSTs to `/api/ai` with user key server-side.
Suggestions fully disable-able in Settings.

## Production hardening checklist (server/)
helmet headers, CORS allowlist, csrf tokens, zod validation, multer
allowlist (ext+magic bytes+size cap), argon2id password hashing, Redis
rate-limit, pino logs, /healthz + /metrics, daily encrypted backups.
See `docs/SECURITY.md`.
