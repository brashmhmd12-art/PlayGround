-- ============================================================
-- Migration 0005: student groups, question file storage, rate limits
-- ============================================================

-- 1) groups: admin assigns profiles.group_name; exams with audience='groups'
--    admit only matching exam_access rows (enforced in start-attempt).
alter table public.profiles
  add column if not exists group_name text not null default '';
create index if not exists idx_profiles_group on public.profiles(group_name)
  where deleted_at is null;

-- 2) public bucket for question images/files (staff upload, world read)
insert into storage.buckets (id, name, public)
values ('question-files', 'question-files', true)
on conflict (id) do nothing;

drop policy if exists "staff upload question files" on storage.objects;
create policy "staff upload question files" on storage.objects for insert
  with check (bucket_id = 'question-files' and public.is_staff());

drop policy if exists "staff manage question files" on storage.objects;
create policy "staff manage question files" on storage.objects for all
  using (bucket_id = 'question-files' and public.is_staff())
  with check (bucket_id = 'question-files' and public.is_staff());

drop policy if exists "public read question files" on storage.objects;
create policy "public read question files" on storage.objects for select
  using (bucket_id = 'question-files');

-- 3) rate limit counters (service-role only; no direct client access)
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 1
);
alter table public.rate_limits enable row level security;
