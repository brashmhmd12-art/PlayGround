-- ============================================================
-- Migration 0006: real capability split (teacher vs grader),
-- direct writes narrowed to SELECT where functions own the writes.
-- Rationale: graders must grade but must NOT create exams or publish;
-- teachers must manage exams but must NOT manage users.
-- ============================================================

create or replace function public.is_teacher()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin','admin','teacher')
      and deleted_at is null and is_active
  );
$$;

-- ---------- exams: teachers manage, graders read ----------
drop policy if exists p_exams_staff on public.exams;
create policy p_exams_teacher on public.exams for all
  using (public.is_teacher()) with check (public.is_teacher());
create policy p_exams_grader_read on public.exams for select
  using (public.is_staff());

-- ---------- bank / options / links / access: same split ----------
drop policy if exists p_bank_staff on public.question_bank;
create policy p_bank_teacher on public.question_bank for all
  using (public.is_teacher()) with check (public.is_teacher());
create policy p_bank_grader_read on public.question_bank for select
  using (public.is_staff());

drop policy if exists p_options_staff on public.question_options;
create policy p_options_teacher on public.question_options for all
  using (public.is_teacher()) with check (public.is_teacher());
create policy p_options_grader_read on public.question_options for select
  using (public.is_staff());

drop policy if exists p_exq_staff on public.exam_questions;
create policy p_exq_teacher on public.exam_questions for all
  using (public.is_teacher()) with check (public.is_teacher());
create policy p_exq_grader_read on public.exam_questions for select
  using (public.is_staff());

drop policy if exists p_exacc_staff on public.exam_access;
create policy p_exacc_teacher on public.exam_access for all
  using (public.is_teacher()) with check (public.is_teacher());
create policy p_exacc_grader_read on public.exam_access for select
  using (public.is_staff());

-- ---------- attempts / answers / grading / results ----------
-- Direct client writes are never needed (Edge Functions own them
-- via service role). Staff keep read access for their duties.
drop policy if exists p_attempts_staff on public.attempts;
create policy p_attempts_staff_read on public.attempts for select
  using (public.is_staff());

drop policy if exists p_answers_staff on public.answers;
create policy p_answers_staff_read on public.answers for select
  using (public.is_staff());

drop policy if exists p_grading_staff on public.manual_grading;
create policy p_grading_staff_read on public.manual_grading for select
  using (public.is_staff());

drop policy if exists p_results_staff on public.results;
create policy p_results_staff_read on public.results for select
  using (public.is_staff());

-- question_versions was already select-only for staff; confirm grader read:
drop policy if exists p_qver_staff on public.question_versions;
create policy p_qver_staff_read on public.question_versions for select
  using (public.is_staff());
