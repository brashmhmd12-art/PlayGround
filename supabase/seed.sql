-- Seed: run AFTER creating users in Supabase Auth dashboard.
-- Replace the UUIDs with the real auth.users ids.
-- 1) Create admin user in Dashboard > Authentication > Users.
-- 2) Copy its UID below. 3) Run this file.

-- مثال (استبدل بالقيم الحقيقية):
-- insert into public.profiles (id, role, full_name, email)
-- values ('PASTE-ADMIN-UID-HERE', 'admin', 'مدير النظام', 'admin@example.com')
-- on conflict (id) do update set role='admin', full_name='مدير النظام';

-- Optional demo subject rows are inserted by the app itself; no exam seed here
-- by design (exams must be created by the admin through the UI/API).
select 'seed placeholder — set your admin profile UID first' as note;
