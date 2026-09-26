# Security review — built-in + residual risks

## Covered in this build
- Passwords: PBKDF2-SHA256 210k iterations, per-user 16B salt, no plaintext.
  Production server uses argon2id (see server.js).
- Rate limiting + brute-force lockout (5 fails → 60s), login-attempt log,
  untrusted-device alert surfaced in Security Center.
- XSS: every dynamic string goes through `escapeHTML`; notes render via
  escaped Markdown-lite (no raw HTML injection); `Content-Security-Policy`
  meta (restrictive) + no `innerHTML` with user data unescaped.
- CSRF: local-first has no cookies; production uses SameSite=strict + token.
- IDOR / broken access: all queries filtered by owner (single-user local);
  server stub enforces `owner_id = req.user.id` + tests.
- Uploads: extension + size allowlist, blocked executables, preview via
  object URLs only, no server execution. Production adds magic-byte check.
- Sessions: 128-bit random ids, idle expiry, revoke-one/all, trusted devices.
- Vault: AES-GCM-256 with per-vault data key wrapped by PIN-derived key;
  auto-lock timer clears key from memory.
- Headers (production): helmet — HSTS, nosniff, frame-ancestors none, CSP.
- Audit: login/logout/upload/delete/password-change/vault-access/export.

## WebAuthn (round 7)
Passkey registration accepts `fmt:none` (no CA trust — fine for personal use,
not for a public IdP), enforces challenge/origin/rpId binding, ES256 verify,
and signature-counter clone detection. TOTP stays as fallback.

## Honest residual risks (local MVP)
- Browser storage is NOT a vault against device compromise or malicious
  extensions; real secrecy needs OS keychain + server HSM/KMS.
- Demo 2FA/OTP is not real TOTP; enable real TOTP + WebAuthn on server.
- IP/geolocation here is best-effort (client-side); enforce server-side.
- AI-cloud calls would exfiltrate context — default OFF, opt-in, key never
  committed. Local AI only by default.
- No E2E tests for WebAuthn yet; add before production launch.

## How to verify
1. Open `index.html` via local server, signup → check localStorage: no password.
2. 5 wrong logins → lockout message + attempt rows in Security Center.
3. Inject `<script>` in a note title → renders as text, no execution.
4. Upload `.exe` → rejected. Export → JSON restores fully.
Run: `python3 -m http.server -d abrash-os 8080` then open localhost:8080.
