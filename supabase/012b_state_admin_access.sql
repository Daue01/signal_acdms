-- Run after 012a_add_state_admin_role.sql, on a Supabase branch first.
begin;

alter table public.profiles
  add column if not exists state_id smallint references public.states(state_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_state_admin_requires_state'
  ) then
    alter table public.profiles
      add constraint profiles_state_admin_requires_state
      check (role <> 'state_admin' or state_id is not null);
  end if;
end $$;

create index if not exists profiles_state_id_idx on public.profiles(state_id);
create unique index if not exists profiles_one_state_admin_per_state
  on public.profiles(state_id) where role = 'state_admin';

-- Preserve existing enumerator state ownership where all current assignments
-- point to the same known state. Ambiguous accounts must be scoped by an admin.
with assigned_states as (
  select ea.assigned_enumerator_id as user_id,
         min(s.state_id) as state_id,
         count(distinct ea.state) as assigned_state_count,
         count(distinct s.state_id) as known_state_count
  from public.enumeration_areas ea
  left join public.states s on s.name = btrim(ea.state)
  where ea.assigned_enumerator_id is not null
  group by ea.assigned_enumerator_id
)
update public.profiles p
set state_id = assigned_states.state_id
from assigned_states
where p.user_id = assigned_states.user_id
  and p.role = 'enumerator'
  and p.state_id is null
  and assigned_states.assigned_state_count = 1
  and assigned_states.known_state_count = 1;

create or replace function public.state_id_of()
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.state_id
  from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role = 'state_admin'
    and p.is_active
$$;
revoke all on function public.state_id_of() from public, anon;
grant execute on function public.state_id_of() to authenticated;

drop policy if exists state_admin_profiles_select on public.profiles;
create policy state_admin_profiles_select on public.profiles
  for select to authenticated
  using (
    (select role_of()) = 'state_admin'
    and role = 'enumerator'
    and state_id = (select state_id_of())
  );

drop policy if exists state_admin_profiles_update on public.profiles;
create policy state_admin_profiles_update on public.profiles
  for update to authenticated
  using (
    (select role_of()) = 'state_admin'
    and role = 'enumerator'
    and state_id = (select state_id_of())
  )
  with check (
    (select role_of()) = 'state_admin'
    and role = 'enumerator'
    and state_id = (select state_id_of())
  );

create or replace function public.guard_state_admin_profile_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.state_id is distinct from old.state_id
     and new.role in ('enumerator', 'state_admin')
     and exists (
       select 1
       from public.enumeration_areas ea
       where ea.assigned_enumerator_id = new.user_id
         and not exists (
           select 1 from public.states s
           where s.name = btrim(ea.state)
             and s.state_id = new.state_id
         )
     ) then
    raise exception 'Reassign this account''s areas before changing its state'
      using errcode = '23514';
  end if;
  if (select role_of()) = 'state_admin' then
    if old.role <> 'enumerator'
       or old.state_id is distinct from (select state_id_of())
       or (to_jsonb(new) - 'is_active') is distinct from (to_jsonb(old) - 'is_active') then
      raise exception 'State administrators may only change enumerator active status in their own state'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists state_admin_profile_update_guard on public.profiles;
create trigger state_admin_profile_update_guard
  before update on public.profiles
  for each row execute function public.guard_state_admin_profile_update();

create or replace function public.check_ea_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_state_id smallint;
  v_is_active boolean;
begin
  if new.assigned_enumerator_id is not null
     and (tg_op = 'INSERT' or new.assigned_enumerator_id is distinct from old.assigned_enumerator_id) then
    select p.role, p.state_id, p.is_active
      into v_role, v_state_id, v_is_active
    from public.profiles p
    where p.user_id = new.assigned_enumerator_id;
    if not found or not v_is_active or v_role not in ('enumerator', 'state_admin') then
      raise exception 'assigned_enumerator_id must be an active enumerator'
        using errcode = '23514';
    end if;
    if v_state_id is not null and not exists (
      select 1 from public.states s
      where s.state_id = v_state_id and s.name = btrim(new.state)
    ) then
      raise exception 'Enumerator and area must belong to the same state'
        using errcode = '23514';
    end if;
  end if;
  if new.supervisor_id is not null
     and (tg_op = 'INSERT' or new.supervisor_id is distinct from old.supervisor_id) then
    if not exists (
      select 1 from public.profiles
      where user_id = new.supervisor_id
        and role = 'supervisor'
        and is_active
    ) then
      raise exception 'supervisor_id must be an active supervisor'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists ea_read on public.enumeration_areas;
create policy ea_read on public.enumeration_areas
  for select to authenticated
  using (
    (select is_admin())
    or (select role_of()) = 'analyst'
    or ((select role_of()) = 'enumerator' and assigned_enumerator_id = (select auth.uid()))
    or ((select role_of()) = 'supervisor' and supervisor_id = (select auth.uid()))
    or (
      (select role_of()) = 'state_admin'
      and exists (
        select 1 from public.states s
        where s.name = btrim(enumeration_areas.state)
          and s.state_id = (select state_id_of())
      )
    )
  );

drop policy if exists state_admin_ea_update on public.enumeration_areas;
create policy state_admin_ea_update on public.enumeration_areas
  for update to authenticated
  using (
    (select role_of()) = 'state_admin'
    and exists (
      select 1 from public.states s
      where s.name = btrim(enumeration_areas.state)
        and s.state_id = (select state_id_of())
    )
  )
  with check (
    (select role_of()) = 'state_admin'
    and exists (
      select 1 from public.states s
      where s.name = btrim(enumeration_areas.state)
        and s.state_id = (select state_id_of())
    )
    and (
      assigned_enumerator_id is null
      or exists (
        select 1 from public.profiles p
        where p.user_id = enumeration_areas.assigned_enumerator_id
          and p.role in ('enumerator', 'state_admin')
          and p.is_active
          and p.state_id = (select state_id_of())
      )
    )
  );

drop policy if exists hh_read on public.households;
create policy hh_read on public.households
  for select to authenticated
  using (
    (select is_admin())
    or exists (
      select 1 from public.enumeration_areas ea
      where ea.ea_id = households.ea_id
        and (
          ((select role_of()) = 'enumerator' and ea.assigned_enumerator_id = (select auth.uid()))
          or ((select role_of()) = 'state_admin' and ea.assigned_enumerator_id = (select auth.uid()))
          or ((select role_of()) = 'supervisor' and ea.supervisor_id = (select auth.uid()))
        )
    )
  );

drop policy if exists hh_ins on public.households;
create policy hh_ins on public.households
  for insert to authenticated
  with check (
    (select role_of()) in ('enumerator', 'state_admin')
    and registered_by = (select auth.uid())
    and exists (
      select 1 from public.enumeration_areas ea
      where ea.ea_id = households.ea_id
        and ea.assigned_enumerator_id = (select auth.uid())
    )
  );

drop policy if exists in_ins on public.individuals;
create policy in_ins on public.individuals
  for insert to authenticated
  with check (
    (select role_of()) in ('enumerator', 'state_admin')
    and registered_by = (select auth.uid())
    and exists (
      select 1 from public.households h
      where h.household_id = individuals.household_id
        and h.registered_by = (select auth.uid())
    )
  );

drop policy if exists sl_ins on public.sync_log;
create policy sl_ins on public.sync_log
  for insert to authenticated
  with check ((select role_of()) in ('enumerator', 'state_admin') and enumerator_id = (select auth.uid()));

drop policy if exists sl_read on public.sync_log;
create policy sl_read on public.sync_log
  for select to authenticated
  using (
    (select is_admin())
    or ((select role_of()) in ('enumerator', 'state_admin') and enumerator_id = (select auth.uid()))
  );

drop policy if exists household_indicators_enumerator_insert on public.household_indicators;
create policy household_indicators_enumerator_insert on public.household_indicators
  for insert to authenticated
  with check (
    (select role_of()) in ('enumerator', 'state_admin')
    and exists (
      select 1 from public.households h
      where h.household_id = household_indicators.household_id
        and h.registered_by = (select auth.uid())
    )
  );

create or replace function public.guard_state_admin_ea_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (select role_of()) = 'state_admin' then
    if (to_jsonb(new) - 'assigned_enumerator_id')
         is distinct from (to_jsonb(old) - 'assigned_enumerator_id') then
      raise exception 'State administrators may only change enumerator assignments'
        using errcode = '42501';
    end if;
    if new.assigned_enumerator_id is not null and not exists (
      select 1 from public.profiles p
      where p.user_id = new.assigned_enumerator_id
        and p.role in ('enumerator', 'state_admin')
        and p.is_active
        and p.state_id = (select state_id_of())
    ) then
      raise exception 'Assignments must target an active enumerator in your state'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists state_admin_ea_update_guard on public.enumeration_areas;
create trigger state_admin_ea_update_guard
  before update on public.enumeration_areas
  for each row execute function public.guard_state_admin_ea_update();

commit;
