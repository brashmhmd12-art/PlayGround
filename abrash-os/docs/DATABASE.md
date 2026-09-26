# Database schema — local collections → Postgres

Local collections mirror these tables. Production: Postgres + pg_trgm FTS.

```sql
-- server/schema.sql (excerpt, full file in server/)
create extension if not exists pgcrypto, pg_trgm;
create table users(id uuid pk, email citext unique, username text unique,
  pass_hash text not null, salt text not null, tfa_secret text,
  created_at timestamptz default now());
create table sessions(id uuid pk, user_id uuid refs users, device text,
  ua text, ip inet, trusted bool default false, created_at timestamptz,
  last_seen timestamptz, revoked bool default false);
create table login_attempts(id uuid pk, user_id uuid, ip inet, ua text,
  ok bool, at timestamptz default now());
create index on login_attempts(user_id, at desc);
create table notes(id uuid pk, owner_id uuid, title text, body text,
  type text, folder text, tags text[], fav bool default false,
  archived bool default false, deleted_at timestamptz, updated_at timestamptz);
create index notes_fts on notes using gin(to_tsvector('simple', title||' '||body));
-- + files, file_versions, projects, project_stages, tasks, subtasks,
--   vault_items(bytea encrypted), knowledge, events, goals, ideas,
--   audits(user_id, action, meta jsonb, ip, ua, at), backups
alter table notes enable row level security;
create policy owner_only on notes using (owner_id = auth.uid());
```

Indexes: `(owner_id, updated_at desc)` everywhere, GIN on tags, trigram on title.
Soft delete everywhere; hard delete only via privacy controls with audit row.
Backups: encrypted `pg_dump` + object-storage snapshots, tested restore.
```

Entity relations for Memory Graph:
project ↔ notes (note.projectId) ↔ files (file.projectId / links[]) ↔
tasks (task.projectId) ↔ goals (goal.projectId) ↔ ideas ↔ knowledge (tags).
Graph renderer walks these edges; no separate edge table needed in MVP.
