-- ============================================================
-- Migration 0003: self-signup with admin activation + client events
-- 1) New auth user -> inactive student profile (admin activates later).
-- 2) Students may INSERT attempt_events for their OWN attempts only
--    (focus loss / disconnect telemetry). No other direct writes.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, email, is_active)
  values (new.id, 'student',
          coalesce(new.raw_user_meta_data->>'full_name', 'طالب جديد'),
          new.email, false)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_new_user on auth.users;
create trigger trg_new_user after insert on auth.users
  for each row execute function public.handle_new_user();

create policy p_events_owner_insert on public.attempt_events for insert
  with check (exists (select 1 from public.attempts a
                      where a.id = attempt_events.attempt_id
                        and a.student_id = auth.uid()
                        and a.status = 'in_progress'));
