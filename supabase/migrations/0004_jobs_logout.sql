-- ============================================================
-- Migration 0004: scheduler support, forced logout, audit write rules,
-- notification integrity guard.
-- ============================================================

-- 1) forced logout timestamp (logout-from-all-devices mechanism)
alter table public.profiles
  add column if not exists forced_logout_at timestamptz;

-- 2) audit writes: owner may log ONLY login/logout about self;
--    staff may log anything (functions use service role anyway).
create policy p_audit_self_insert on public.audit_logs for insert
  with check (actor_id = auth.uid()
    and action in ('auth.login','auth.logout'));
create policy p_audit_staff_insert on public.audit_logs for insert
  with check (public.is_staff());

-- 3) notifications: clients may flip is_read ONLY (title/body/type/link immutable)
create or replace function public.guard_notification_update()
returns trigger language plpgsql as $$
begin
  if new.user_id <> old.user_id or new.type <> old.type
     or new.title <> old.title or new.body <> old.body or new.link <> old.link then
    raise exception 'notification immutable fields';
  end if;
  return new;
end $$;
drop trigger if exists trg_notif_guard on public.notifications;
create trigger trg_notif_guard before update on public.notifications
  for each row execute function public.guard_notification_update();

-- 4) reminder bookkeeping (one reminder per exam)
create table if not exists public.exam_reminders (
  exam_id uuid primary key references public.exams(id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.exam_reminders enable row level security;
create policy p_rem_staff on public.exam_reminders for all
  using (public.is_staff()) with check (public.is_staff());
