-- Allow self-registered citizens while keeping one profile per auth user.
alter type user_role add value if not exists 'citizen';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare requested_role text;
begin
  requested_role := case when new.raw_user_meta_data->>'account_type' = 'citizen'
    then 'citizen' else 'enumerator' end;
  insert into public.profiles(user_id, full_name, role, is_active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Unnamed user'),
          requested_role::user_role, requested_role = 'citizen')
  on conflict (user_id) do nothing;
  return new;
end $$;

alter function public.handle_new_user() set search_path = public, pg_temp;

-- Ensure this migration repairs projects where 002 was not applied, or where
-- the trigger was removed during a reset. New Auth users need a profile row
-- before the application can display or approve their account.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
