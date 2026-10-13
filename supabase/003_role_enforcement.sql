-- =====================================================================
-- ACDMS migration 003: enforce roles and account status in RLS
-- Run ONCE, after schema.sql and 002_hardening.sql.
-- Tested on PostgreSQL 16 with a stubbed Supabase auth schema; still run
-- it on a Supabase branch / throwaway project first.
--
-- Fixes found when auditing 002:
--   a) Deactivating a profile (is_active = false) did NOT cut data access.
--      Policies checked auth.uid() directly, never is_active or role.
--   b) Any user assigned to an EA could insert households, whatever their
--      role (a supervisor, or a never-activated account).
--   c) enumeration_areas accepted any profile as enumerator/supervisor.
--   d) Supervisors saw duplicate flags from EAs that are not theirs.
--
-- role_of() already returns NULL for inactive users, so every policy that
-- tests role_of() = '<role>' is automatically denied once an account is
-- deactivated (and RLS is evaluated live, so this works immediately,
-- even while the person's JWT is still valid).
-- =====================================================================
begin;

-- 1. ENUMERATION AREAS: read access depends on the role you hold ------
drop policy ea_read on enumeration_areas;
create policy ea_read on enumeration_areas for select to authenticated
  using (
    (select is_admin())
    or ((select role_of()) = 'enumerator' and assigned_enumerator_id = (select auth.uid()))
    or ((select role_of()) = 'supervisor' and supervisor_id         = (select auth.uid()))
  );

-- 2. HOUSEHOLDS --------------------------------------------------------
drop policy hh_read on households;
create policy hh_read on households for select to authenticated
  using (
    (select is_admin())
    or exists (
      select 1 from enumeration_areas e
      where e.ea_id = households.ea_id
        and (
          ((select role_of()) = 'enumerator' and e.assigned_enumerator_id = (select auth.uid()))
          or ((select role_of()) = 'supervisor' and e.supervisor_id         = (select auth.uid()))
        )
    )
  );

drop policy hh_ins on households;
create policy hh_ins on households for insert to authenticated
  with check (
    (select role_of()) = 'enumerator'
    and registered_by = (select auth.uid())
    and exists (
      select 1 from enumeration_areas e
      where e.ea_id = households.ea_id
        and e.assigned_enumerator_id = (select auth.uid())
    )
  );

-- 3. INDIVIDUALS (in_read already inherits households' visibility) -----
drop policy in_ins on individuals;
create policy in_ins on individuals for insert to authenticated
  with check (
    (select role_of()) = 'enumerator'
    and registered_by = (select auth.uid())
    and exists (
      select 1 from households h
      where h.household_id = individuals.household_id
        and h.registered_by = (select auth.uid())
    )
  );

-- 4. SYNC LOG: only active enumerators write; admins/own rows read ----
drop policy sl_ins on sync_log;
create policy sl_ins on sync_log for insert to authenticated
  with check ((select role_of()) = 'enumerator' and enumerator_id = (select auth.uid()));

drop policy sl_read on sync_log;
create policy sl_read on sync_log for select to authenticated
  using ((select is_admin())
         or ((select role_of()) = 'enumerator' and enumerator_id = (select auth.uid())));

-- 5. DUPLICATE FLAGS: admins everything; supervisors only flags whose
--    record they can already see through households/individuals RLS ----
drop policy df_admin on duplicate_flags;
create policy df_admin on duplicate_flags for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

create policy df_sup_read on duplicate_flags for select to authenticated
  using (
    (select role_of()) = 'supervisor'
    and (
      (kind = 'household'  and exists (select 1 from households  h where h.household_id  = duplicate_flags.record_id))
      or
      (kind = 'individual' and exists (select 1 from individuals i where i.individual_id = duplicate_flags.record_id))
    )
  );

create policy df_sup_update on duplicate_flags for update to authenticated
  using (
    (select role_of()) = 'supervisor'
    and (
      (kind = 'household'  and exists (select 1 from households  h where h.household_id  = duplicate_flags.record_id))
      or
      (kind = 'individual' and exists (select 1 from individuals i where i.individual_id = duplicate_flags.record_id))
    )
  )
  with check (
    (select role_of()) = 'supervisor'
    and (
      (kind = 'household'  and exists (select 1 from households  h where h.household_id  = duplicate_flags.record_id))
      or
      (kind = 'individual' and exists (select 1 from individuals i where i.individual_id = duplicate_flags.record_id))
    )
  );

-- 6. EA ASSIGNMENTS: only an active enumerator can be the enumerator,
--    only an active supervisor can be the supervisor. Checked when the
--    assignment is made/changed (existing rows are not re-validated). ---
create or replace function public.check_ea_assignment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.assigned_enumerator_id is not null
     and (tg_op = 'INSERT' or new.assigned_enumerator_id is distinct from old.assigned_enumerator_id) then
    if not exists (select 1 from profiles
                   where user_id = new.assigned_enumerator_id
                     and role = 'enumerator' and is_active) then
      raise exception 'assigned_enumerator_id must be an active enumerator' using errcode = '23514';
    end if;
  end if;
  if new.supervisor_id is not null
     and (tg_op = 'INSERT' or new.supervisor_id is distinct from old.supervisor_id) then
    if not exists (select 1 from profiles
                   where user_id = new.supervisor_id
                     and role = 'supervisor' and is_active) then
      raise exception 'supervisor_id must be an active supervisor' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger ea_assignment_check
  before insert or update on enumeration_areas
  for each row execute function public.check_ea_assignment();

commit;

-- =====================================================================
-- DIAGNOSTICS (run by hand): existing EAs that already break rule 6.
--   select ea.ea_code, ea.assigned_enumerator_id, ea.supervisor_id
--   from enumeration_areas ea
--   left join profiles pe on pe.user_id = ea.assigned_enumerator_id
--   left join profiles ps on ps.user_id = ea.supervisor_id
--   where (ea.assigned_enumerator_id is not null and (pe.role <> 'enumerator' or not pe.is_active))
--      or (ea.supervisor_id          is not null and (ps.role <> 'supervisor' or not ps.is_active));
-- =====================================================================
