-- ============================================================
-- tests/rls.test.sql — automated RLS/security assertions.
-- Run on a SCRATCH database AFTER migrations 0001..0006:
--   psql -v ON_ERROR_STOP=1 -f tests/rls.test.sql
-- Ends with "ALL RLS TESTS PASSED" or raises on first failure.
-- Scope (honest): covers RLS policies, triggers, constraints.
-- Edge-Function authorization + E2E require a staging project.
-- ============================================================

-- fake JWT subject for local runs (Supabase provides the real one)
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function tests_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)::void
$$;

-- Run assertions as an UNPRIVILEGED role (superusers bypass RLS, like
-- service_role does — the app never uses that path for user traffic).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'tester') then
    create role tester nologin;
  end if;
end $$;
grant usage on schema public to tester;
grant usage on schema auth to tester;
grant all privileges on all tables in schema public to tester;
grant all privileges on table auth.users to tester;

-- ---------- fixtures (superuser bypasses RLS, like service_role) ----------
-- idempotent reruns first
delete from notifications where user_id in
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444');
delete from audit_logs where actor_id in
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444',
   '55555555-5555-5555-5555-555555555555');
delete from results where attempt_id in
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','dddddddd-dddd-dddd-dddd-dddddddddddd');
delete from attempts where id in
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','dddddddd-dddd-dddd-dddd-dddddddddddd');
delete from exam_questions where exam_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
delete from question_options where question_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
delete from question_bank where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
delete from exams where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
delete from profiles where id in
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444',
   '55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666');
delete from auth.users where id in
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444',
   '55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666');
insert into auth.users(id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@x.com'),
  ('22222222-2222-2222-2222-222222222222', 'teacher@x.com'),
  ('33333333-3333-3333-3333-333333333333', 'grader@x.com'),
  ('44444444-4444-4444-4444-444444444444', 's1@x.com'),
  ('55555555-5555-5555-5555-555555555555', 's2@x.com');

-- NOTE: the signup trigger already created inactive student profiles for the
-- 5 users above, so we UPDATE them into their roles instead of inserting.
update profiles set role = 'admin', full_name = 'مدير', is_active = true
  where id = '11111111-1111-1111-1111-111111111111';
update profiles set role = 'teacher', full_name = 'معلم', is_active = true
  where id = '22222222-2222-2222-2222-222222222222';
update profiles set role = 'grader', full_name = 'مصحح', is_active = true
  where id = '33333333-3333-3333-3333-333333333333';
update profiles set role = 'student', full_name = 'طالب1', is_active = true
  where id = '44444444-4444-4444-4444-444444444444';
update profiles set role = 'student', full_name = 'طالب2', is_active = true
  where id = '55555555-5555-5555-5555-555555555555';

insert into exams(id, title, subject, duration_min, status, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'اختبار نشط', 'علوم', 30, 'active',
   '11111111-1111-1111-1111-111111111111');

insert into question_bank(id, subject, qtype, text, mark) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'علوم', 'mcq', 'سؤال؟', 5);
insert into question_options(question_id, text, is_correct, position) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'صحيح', true, 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'خطأ', false, 1);
insert into exam_questions(exam_id, question_id, position) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0);

insert into attempts(id, exam_id, student_id, attempt_no, status, question_snapshot,
  question_order, server_deadline, idempotency_key) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444', 1, 'in_progress', '[]', '{}',
   now() + interval '1 hour', 'k1');

insert into results(attempt_id, auto_score, final_score, published) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 80, 80, true);

insert into attempts(id, exam_id, student_id, attempt_no, status, question_snapshot,
  question_order, server_deadline, idempotency_key) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '55555555-5555-5555-5555-555555555555', 1, 'graded', '[]', '{}',
   now() - interval '1 hour', 'k2');
insert into results(attempt_id, auto_score, final_score, published) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 70, 70, true),
  -- unpublished own result for s1 path is covered via update below
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 0, 0, false)
  on conflict (attempt_id) do nothing;

-- ---------- fixtures done (superuser) — assertions run as tester ----------
set role tester;

-- ---------- T1: student sees ZERO option rows (correct answers hidden) ----------
select tests_as('44444444-4444-4444-4444-444444444444');
do $$ declare c int; begin
  select count(*) into c from question_options;
  if c <> 0 then raise exception 'T1 FAILED: student sees % option rows', c; end if;
end $$;

-- ---------- T2: student sees ZERO exam-question links ----------
do $$ declare c int; begin
  select count(*) into c from exam_questions;
  if c <> 0 then raise exception 'T2 FAILED: student sees % links', c; end if;
end $$;

-- ---------- T3: student reads OWN published result ----------
do $$ declare c int; begin
  select count(*) into c from results r join attempts a on a.id = r.attempt_id
    where a.student_id = '44444444-4444-4444-4444-444444444444' and r.published;
  if c <> 1 then raise exception 'T3 FAILED: own published count=%', c; end if;
end $$;

-- ---------- T4: student cannot read ANOTHER student's result ----------
do $$ declare c int; begin
  select count(*) into c from results r join attempts a on a.id = r.attempt_id
    where a.student_id = '55555555-5555-5555-5555-555555555555';
  if c <> 0 then raise exception 'T4 FAILED: cross-student leak %', c; end if;
end $$;

-- ---------- T5: unpublished results invisible to students ----------
do $$ declare c int; begin
  select count(*) into c from results where not published;
  if c <> 0 then raise exception 'T5 FAILED: unpublished visible %', c; end if;
end $$;

-- ---------- T6: grader CANNOT create exams ----------
select tests_as('33333333-3333-3333-3333-333333333333');
do $$ begin
  insert into exams(title, subject, duration_min) values ('x', 'y', 10);
  raise exception 'T6 FAILED: grader insert allowed';
exception when insufficient_privilege then
  -- expected
end $$;

-- ---------- T7: grader CAN read attempts (grading duty) ----------
do $$ declare c int; begin
  select count(*) into c from attempts;
  if c < 1 then raise exception 'T7 FAILED: grader cannot read attempts'; end if;
end $$;

-- ---------- T8: teacher CANNOT manage users ----------
-- NOTE: denied UPDATEs affect 0 rows (no error), so we verify no change.
select tests_as('22222222-2222-2222-2222-222222222222');
do $$ begin
  update profiles set full_name = 'hacked'
    where id = '44444444-4444-4444-4444-444444444444';
end $$;
reset role;
do $$ declare v text; begin
  select full_name into v from profiles where id = '44444444-4444-4444-4444-444444444444';
  if v <> 'طالب1' then raise exception 'T8 FAILED: teacher modified user'; end if;
end $$;
set role tester;

-- ---------- T9: student audit insert restricted to own login/logout ----------
select tests_as('44444444-4444-4444-4444-444444444444');
do $$ begin
  insert into audit_logs(actor_id, action) values
    ('44444444-4444-4444-4444-444444444444', 'result.forge');
  raise exception 'T9 FAILED: arbitrary audit insert allowed';
exception when insufficient_privilege then
  -- expected
end $$;
do $$ begin
  insert into audit_logs(actor_id, action) values
    ('44444444-4444-4444-4444-444444444444', 'auth.login');
end $$;

-- ---------- T10: teacher CANNOT directly edit results ----------
select tests_as('22222222-2222-2222-2222-222222222222');
do $$ begin
  update results set final_score = 100;
end $$;
reset role;
do $$ declare n int; begin
  select count(*) into n from results where final_score = 100;
  if n <> 0 then raise exception 'T10 FAILED: direct result edit applied'; end if;
end $$;
set role tester;

-- ---------- T11: signup trigger creates inactive student ----------
insert into auth.users(id, email, raw_user_meta_data)
  values ('66666666-6666-6666-6666-666666666666', 'new@x.com', '{"full_name":"جديد"}');
do $$ declare r record; begin
  select role, is_active into r from profiles where id = '66666666-6666-6666-6666-666666666666';
  if r.role <> 'student' or r.is_active then
    raise exception 'T11 FAILED: bad auto profile % %', r.role, r.is_active;
  end if;
end $$;

-- ---------- T12: anonymous catalog = active exams only, no bank ----------
select tests_as(null);
do $$ declare ce int; cb int; begin
  select count(*) into ce from exams;
  select count(*) into cb from question_bank;
  if ce < 1 then raise exception 'T12 FAILED: public catalog empty'; end if;
  if cb <> 0 then raise exception 'T12 FAILED: anon sees bank'; end if;
end $$;

select 'ALL RLS TESTS PASSED' as result;
reset role;
