# Deploy — ABRASH OS production

## Option A: Docker (recommended)
```bash
cd abrash-os
cp deploy/abrash-os.env.example deploy/abrash-os.env   # fill AI_KEY etc, chmod 600
DOMAIN=your-domain.com docker compose up -d --build
curl https://your-domain.com/healthz   # {"ok":true}
```
Caddy terminates HTTPS automatically. Data persists in the `abrash-data` volume.

## Option B: systemd (bare metal)
```bash
sudo useradd -r -m abrash
sudo cp -r abrash-os /opt/abrash-os && sudo chown -R abrash:abrash /opt/abrash-os
sudo cp deploy/abrash-os.service /etc/systemd/system/
sudo cp deploy/abrash-os.env.example /etc/abrash-os.env  # edit + chmod 600
sudo systemctl enable --now abrash-os
```

## Backups (cron)
```cron
# daily 03:00, keep 14, encrypted
0 3 * * * DATA_DIR=/opt/abrash-os/server/data OUT_DIR=/opt/abrash-os/backups KEEP=14 BACKUP_PASS='...' /opt/abrash-os/deploy/backup.sh
```
Restore: `deploy/restore.sh backups/abrash-<ts>.tar.gz[.enc]` (verifies sha256 first).

## Checklist before exposing to the internet
- [ ] `AI_KEY` only in env, never in repo
- [ ] `DOMAIN` real + HTTPS reachable (Caddy logs)
- [ ] server signup creates YOUR user; no default credentials exist by design
- [ ] enable TOTP immediately (Security Center or `/api/auth/totp/*`)
- [ ] first backup taken + restore tested (`deploy/restore.sh` on a copy)
- [ ] `tests/server.mjs` passes against the live host (set PORT accordingly)
- [ ] Honest scope: single-user file DB; Postgres (`server/schema.sql`) before multi-user
