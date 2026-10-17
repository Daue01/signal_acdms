-- BOOTSTRAP ONLY: run this after creating the first administrator user in
-- Supabase Dashboard > Authentication > Users.
-- Replace the UUID below with that user's auth.users.id, then run once.
-- Never expose a service key or place this operation in the browser.

update public.profiles
set role = 'administrator', is_active = true
where user_id = '3983cb7e-e6d5-48f1-99bf-c053e07fbc8f'::uuid;

-- Verify the promotion:
-- select user_id, full_name, role, is_active from public.profiles
-- where user_id = '3983cb7e-e6d5-48f1-99bf-c053e07fbc8f'::uuid;
