-- ============================================================
-- Migration 0001: Core schema — secure electronic exam platform
-- Apply in Supabase SQL Editor (in order). PostgreSQL 15.
-- Principles: no grades/answers accepted from client, server time,
-- snapshots per attempt, soft delete, append-only audit.
-- ============================================================

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- profiles (linked to Supabase Auth) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student'
    check (role in ('super_admin','admin','teacher','grader','student')),
  full_name text not null,
  student_no text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_profiles_role on public.profiles(role)
  where deleted_at is null;
create index if not exists idx_profiles_name on public.profiles(full_name);

-- ---------- exams ----------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  description text default '',
  duration_min integer not null check (duration_min >= 1),
  starts_at timestamptz,
  ends_at timestamptz,
  max_attempts integer not null default 1 check (max_attempts >= 1),
  total_mark numeric not null default 100,
  pass_mark numeric not null default 50,
  show_result_immediately boolean not null default false,
  allow_review boolean not null default false,
  show_review_after_close boolean not null default true,
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  allow_back_navigation boolean not null default true,
  access_code_hash text,
  audience text not null default 'all' check (audience in ('all','groups')),
  status text not null default 'draft'
    check (status in ('draft','scheduled','published','active','expired','archived')),
  version integer not null default 1,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists idx_exams_status on public.exams(status)
  where deleted_at is null;
create index if not exists idx_exams_window on public.exams(starts_at, ends_at)
  where deleted_at is null;

-- ---------- question bank ----------
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  unit text default '',
  topic text default '',
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  qtype text not null check (qtype in ('mcq','tf','multi','written')),
  text text not null,
  mark numeric not null check (mark > 0),
  explanation text default '',
  image_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_bank_filter
  on public.question_bank(subject, qtype, difficulty) where deleted_at is null;

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position integer not null default 0
);
create index if not exists idx_options_q on public.question_options(question_id);

-- version snapshots of bank questions (append-only)
create table if not exists public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank(id) on delete cascade,
  version_no integer not null,
  snapshot_json jsonb not null,
  created_at timestamptz not null default now(),
  unique(question_id, version_no)
);

-- ---------- exam <-> questions ----------
create table if not exists public.exam_questions (
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.question_bank(id),
  position integer not null default 0,
  mark_override numeric check (mark_override is null or mark_override > 0),
  primary key (exam_id, question_id)
);

create table if not exists public.exam_access (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  group_name text not null default '',
  access_code_hash text
);

-- ---------- attempts ----------
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id),
  student_id uuid not null references public.profiles(id),
  attempt_no integer not null check (attempt_no >= 1),
  status text not null default 'in_progress'
    check (status in ('in_progress','submitted','grading','graded','expired')),
  question_snapshot jsonb not null,          -- full copy incl. correct answers (server-side only)
  question_order uuid[] not null default '{}',
  started_at timestamptz not null default now(),
  server_deadline timestamptz not null,
  submitted_at timestamptz,
  timed_out boolean not null default false,
  idempotency_key text not null unique,
  client_seq integer not null default 0,
  created_at timestamptz not null default now(),
  unique(exam_id, student_id, attempt_no)
);
create index if not exists idx_attempts_exam_status on public.attempts(exam_id, status);
create index if not exists idx_attempts_student on public.attempts(student_id, exam_id);

-- ---------- answers (one row per question per attempt) ----------
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null,
  answer_json jsonb not null default '{}',
  seq integer not null default 0,            -- client sequence: only newer wins
  updated_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);
create index if not exists idx_answers_attempt on public.answers(attempt_id);

-- ---------- manual grading ----------
create table if not exists public.manual_grading (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null,
  grader_id uuid references public.profiles(id),
  max_mark numeric not null,
  awarded_mark numeric,
  feedback text default '',
  status text not null default 'pending' check (status in ('pending','done')),
  graded_at timestamptz,
  unique(attempt_id, question_id)
);
create index if not exists idx_grading_queue on public.manual_grading(status)
  where status = 'pending';

create table if not exists public.grade_history (
  id uuid primary key default gen_random_uuid(),
  grading_id uuid not null references public.manual_grading(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  old_mark numeric, new_mark numeric,
  reason text default '',
  created_at timestamptz not null default now()
);

-- ---------- results (server-computed only) ----------
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts(id) on delete cascade,
  auto_score numeric not null default 0,
  manual_score numeric not null default 0,
  final_score numeric not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  unanswered_count integer not null default 0,
  percentage numeric not null default 0,
  passed boolean not null default false,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_results_exam
  on public.results(published) ;

-- ---------- notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user
  on public.notifications(user_id, is_read, created_at desc);

-- ---------- audit log (append-only; no update/delete via API) ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null default '',
  entity_id text not null default '',
  old_value jsonb,
  new_value jsonb,
  ip text default '',
  user_agent text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_actor on public.audit_logs(actor_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_logs(entity, entity_id);

-- ---------- attempt events (focus loss, disconnects, ...) ----------
create table if not exists public.attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  event text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_events_attempt on public.attempt_events(attempt_id);

-- ---------- updated_at triggers ----------
drop trigger if exists trg_profiles_upd on public.profiles;
create trigger trg_profiles_upd before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_exams_upd on public.exams;
create trigger trg_exams_upd before update on public.exams
  for each row execute function public.set_updated_at();
drop trigger if exists trg_bank_upd on public.question_bank;
create trigger trg_bank_upd before update on public.question_bank
  for each row execute function public.set_updated_at();
