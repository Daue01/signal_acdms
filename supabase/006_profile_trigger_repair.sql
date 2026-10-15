-- Repair existing projects where Auth users were created without profiles.
-- Run once in the Supabase SQL Editor after schema.sql.
begin;

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare requested_role text;
begin
  requested_role := case
    when new.raw_user_meta_data->>'account_type' = 'citizen' then 'citizen'
    else 'enumerator'
  end;

  insert into public.profiles(user_id, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Unnamed user'),
    requested_role::user_role,
    requested_role = 'citizen'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill accounts created before the trigger existed.
-- Citizens become active; enumerators remain pending approval.
insert into public.profiles (user_id, full_name, role, is_active)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.email, 'Unnamed user'),
  case
    when u.raw_user_meta_data->>'account_type' = 'citizen'
      then 'citizen'::user_role
    else 'enumerator'::user_role
  end,
  u.raw_user_meta_data->>'account_type' = 'citizen'
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

commit;

-- Verify:
-- select p.user_id, p.full_name, p.role, p.is_active, u.email
-- from public.profiles p join auth.users u on u.id = p.user_id
-- order by p.created_at desc;
