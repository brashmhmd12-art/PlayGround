-- ============================================================
-- Migration 0002: Row Level Security
-- Deny-by-default. Students NEVER get question_options / is_correct.
-- All grade-affecting writes go through Edge Functions (service role).
-- ============================================================

alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.question_bank enable row level security;
alter table public.question_options enable row level security;
alter table public.question_versions enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_access enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;
alter table public.manual_grading enable row level security;
alter table public.grade_history enable row level security;
alter table public.results enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.attempt_events enable row level security;

-- helper: admin check (SECURITY DEFINER avoids RLS recursion)
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin','admin')
      and deleted_at is null and is_active
  );
$$;

create or replace function public.is_staff()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin','admin','teacher','grader')
      and deleted_at is null and is_active
  );
$$;

-- ---------- profiles ----------
create policy p_profiles_self on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy p_profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- exams ----------
-- staff: full access
create policy p_exams_staff on public.exams for all
  using (public.is_staff()) with check (public.is_staff());
-- students: read non-deleted, non-draft, non-archived only (no correct data lives here)
create policy p_exams_student_read on public.exams for select
  using (deleted_at is null and status in ('scheduled','published','active','expired'));

-- ---------- question bank / options / versions / exam_questions ----------
-- staff only. Students receive sanitized copies via start-attempt function.
create policy p_bank_staff on public.question_bank for all
  using (public.is_staff()) with check (public.is_staff());
create policy p_options_staff on public.question_options for all
  using (public.is_staff()) with check (public.is_staff());
create policy p_qver_staff on public.question_versions for select
  using (public.is_staff());
create policy p_exq_staff on public.exam_questions for all
  using (public.is_staff()) with check (public.is_staff());
create policy p_exacc_staff on public.exam_access for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- attempts ----------
create policy p_attempts_owner_read on public.attempts for select
  using (student_id = auth.uid() or public.is_staff());
-- inserts/updates go through Edge Functions (service role); no direct write policy for students.
create policy p_attempts_staff on public.attempts for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- answers ----------
create policy p_answers_owner_read on public.answers for select
  using (exists (select 1 from public.attempts a
                 where a.id = answers.attempt_id
                   and (a.student_id = auth.uid() or public.is_staff())));
-- writes via functions only.
create policy p_answers_staff on public.answers for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- grading / history ----------
create policy p_grading_staff on public.manual_grading for all
  using (public.is_staff()) with check (public.is_staff());
create policy p_ghist_staff on public.grade_history for select
  using (public.is_staff());

-- ---------- results ----------
-- student reads OWN published results only; staff read all.
create policy p_results_owner on public.results for select
  using (published and exists (select 1 from public.attempts a
           where a.id = results.attempt_id and a.student_id = auth.uid())
         or public.is_staff());
create policy p_results_staff on public.results for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- notifications ----------
create policy p_notif_owner on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());
create policy p_notif_owner_upd on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy p_notif_staff on public.notifications for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- audit / events ----------
create policy p_audit_staff_read on public.audit_logs for select
  using (public.is_staff());
-- inserts via service role (functions) only; no insert policy for anon/authenticated.
create policy p_events_owner_read on public.attempt_events for select
  using (exists (select 1 from public.attempts a
                 where a.id = attempt_events.attempt_id
                   and (a.student_id = auth.uid() or public.is_staff())));
