-- =====================================================================
-- ACDMS migration 002: hardening, atomic sync, geography normalisation
-- Run ONCE, on top of supabase/schema.sql.
-- NOT YET TESTED: run it first on a throwaway Supabase project or a
-- Supabase branch, then on your real project.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. ATOMIC, IDEMPOTENT HOUSEHOLD SUBMISSION
--    Replaces the two separate inserts + manual "rollback delete" in
--    src/app/api/sync/route.ts. That rollback delete is blocked by RLS
--    (no DELETE policy on households), so a failed individuals insert
--    left an orphan household holding the client_id. The retry then got
--    409, the device treated 409 as "stored", and deleted its local copy:
--    the household members were lost. A single function call is one
--    transaction, so it is all-or-nothing.
--    SECURITY INVOKER: RLS policies still apply to the calling user.
-- ---------------------------------------------------------------------
create or replace function public.submit_household(
  p_client_id   uuid,
  p_household   jsonb,
  p_individuals jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_hh uuid;
begin
  if p_client_id is null then
    raise exception 'client_id required' using errcode = '22023';
  end if;
  if not coalesce((p_household->>'consent_recorded')::boolean, false) then
    raise exception 'Respondent consent must be recorded (NDPA 2023)' using errcode = '23514';
  end if;
  if jsonb_typeof(p_individuals) is distinct from 'array'
     or jsonb_array_length(p_individuals) = 0 then
    raise exception 'At least one household member is required' using errcode = '22023';
  end if;

  insert into households(
    client_id, ea_id, address, housing_type, utilities, ownership_status,
    consent_recorded, consent_at, registered_by)
  values (
    p_client_id,
    (p_household->>'ea_id')::uuid,
    p_household->>'address',
    p_household->>'housing_type',
    coalesce(p_household->'utilities', '{}'::jsonb),
    p_household->>'ownership_status',
    true,
    coalesce((p_household->>'consent_at')::timestamptz, now()),
    auth.uid())
  on conflict (client_id) do nothing
  returning household_id into v_hh;

  -- Already stored by an earlier (complete) call: return it, do not re-insert.
  if v_hh is null then
    select household_id into v_hh from households where client_id = p_client_id;
    return v_hh;
  end if;

  insert into individuals(
    household_id, surname, firstname, sex, date_of_birth, age,
    relationship_to_head, education_level, occupation, disability_status, registered_by)
  select v_hh, x.surname, x.firstname, x.sex, nullif(x.date_of_birth, '')::date, x.age,
         x.relationship_to_head, x.education_level, x.occupation, x.disability_status, auth.uid()
  from jsonb_to_recordset(p_individuals) as x(
    surname text, firstname text, sex text, date_of_birth text, age int,
    relationship_to_head text, education_level text, occupation text, disability_status text);

  return v_hh;
end $$;

revoke all on function public.submit_household(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_household(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2. CONSENT TIMESTAMP + DATA-QUALITY CONSTRAINTS
--    NOT VALID = enforced for new/updated rows, existing rows not scanned.
-- ---------------------------------------------------------------------
alter table households add column if not exists consent_at timestamptz;

alter table households add constraint households_consent_required
  check (consent_recorded) not valid;
alter table households add constraint households_sync_status_chk
  check (sync_status in ('pending','synced','conflict','failed')) not valid;

-- ---------------------------------------------------------------------
-- 3. CORRECTIONS: admins could never fix or remove a record, so a
--    "confirmed" duplicate had no resolution path. Audit triggers still
--    capture every change.
-- ---------------------------------------------------------------------
create policy hh_admin_update on households for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy hh_admin_delete on households for delete to authenticated
  using ((select is_admin()));
create policy in_admin_update on individuals for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy in_admin_delete on individuals for delete to authenticated
  using ((select is_admin()));

-- ---------------------------------------------------------------------
-- 4. SECURITY DEFINER HARDENING: pin search_path (Supabase linter warning)
-- ---------------------------------------------------------------------
alter function public.role_of()             set search_path = public, extensions, pg_temp;
alter function public.is_admin()            set search_path = public, extensions, pg_temp;
alter function public.log_change()          set search_path = public, extensions, pg_temp;
alter function public.flag_dup_individual() set search_path = public, extensions, pg_temp;
alter function public.flag_dup_household()  set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------
-- 5. AUTO-CREATE PROFILES FOR NEW AUTH USERS
--    New users start as INACTIVE enumerators; an administrator activates
--    them and sets the role. Role is never read from user metadata
--    (users can edit their own metadata). Also turn off public sign-ups
--    in Supabase Auth settings and create users by invitation.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles(user_id, full_name, role, is_active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Unnamed user'),
          'enumerator', false)
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. DUPLICATE FLAGS: uniqueness, review timestamp
-- ---------------------------------------------------------------------
alter table duplicate_flags add column if not exists reviewed_at timestamptz;
create unique index if not exists duplicate_flags_pair_uq
  on duplicate_flags(kind, record_id, match_id);

create or replace function public.set_flag_reviewed() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status = 'open' and new.status <> 'open' then
    new.reviewed_at := now();
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  end if;
  return new;
end $$;
create trigger duplicate_flags_reviewed before update on duplicate_flags
  for each row execute function public.set_flag_reviewed();

-- ---------------------------------------------------------------------
-- 7. INDEXES used by RLS policies, dashboards and the audit report
-- ---------------------------------------------------------------------
create index if not exists ea_enumerator_idx      on enumeration_areas(assigned_enumerator_id);
create index if not exists ea_supervisor_idx      on enumeration_areas(supervisor_id);
create index if not exists hh_registered_by_idx   on households(registered_by);
create index if not exists hh_registered_at_idx   on households(registered_at);
create index if not exists indiv_registered_by_idx on individuals(registered_by);
create index if not exists dup_open_idx           on duplicate_flags(status) where status = 'open';
create index if not exists audit_record_idx       on audit_log(table_name, record_id);
create index if not exists audit_changed_at_idx   on audit_log(changed_at desc);
create index if not exists sync_log_enum_idx      on sync_log(enumerator_id, at desc);

-- ---------------------------------------------------------------------
-- 8. RLS PERFORMANCE: wrap auth.uid()/role_of() in (select ...) so they
--    are evaluated once per query instead of once per row. Same rules,
--    same behaviour, just faster at census scale.
-- ---------------------------------------------------------------------
drop policy p_self  on profiles;
drop policy p_admin on profiles;
create policy p_self on profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select role_of()) in ('administrator','supervisor'));
create policy p_admin on profiles for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

drop policy ea_read  on enumeration_areas;
drop policy ea_admin on enumeration_areas;
create policy ea_read on enumeration_areas for select to authenticated
  using (assigned_enumerator_id = (select auth.uid())
         or supervisor_id = (select auth.uid()) or (select is_admin()));
create policy ea_admin on enumeration_areas for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

drop policy hh_read on households;
drop policy hh_ins  on households;
create policy hh_read on households for select to authenticated
  using ((select is_admin()) or exists(select 1 from enumeration_areas e
         where e.ea_id = households.ea_id
           and (e.assigned_enumerator_id = (select auth.uid()) or e.supervisor_id = (select auth.uid()))));
create policy hh_ins on households for insert to authenticated
  with check (registered_by = (select auth.uid()) and exists(select 1 from enumeration_areas e
         where e.ea_id = households.ea_id and e.assigned_enumerator_id = (select auth.uid())));

drop policy in_ins on individuals;
create policy in_ins on individuals for insert to authenticated
  with check (registered_by = (select auth.uid()) and exists(select 1 from households h
         where h.household_id = individuals.household_id and h.registered_by = (select auth.uid())));

drop policy df_admin on duplicate_flags;
create policy df_admin on duplicate_flags for all to authenticated
  using ((select role_of()) in ('administrator','supervisor'))
  with check ((select role_of()) in ('administrator','supervisor'));

drop policy sl_ins  on sync_log;
drop policy sl_read on sync_log;
create policy sl_ins  on sync_log for insert to authenticated with check (enumerator_id = (select auth.uid()));
create policy sl_read on sync_log for select to authenticated
  using ((select is_admin()) or enumerator_id = (select auth.uid()));

drop policy al_read on audit_log;
create policy al_read on audit_log for select to authenticated using ((select is_admin()));

-- ---------------------------------------------------------------------
-- 9. REALTIME: the admin dashboard subscribes to households changes, but
--    schema.sql never adds the table to the realtime publication.
--    No-op if you already enabled it in the Supabase dashboard.
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public'
                       and tablename = 'households') then
    alter publication supabase_realtime add table public.households;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 10. GEOGRAPHY, PHASE 1: State > LGA > Ward lookup tables
--     enumeration_areas currently repeats state/lga/ward as free text
--     (ward -> lga -> state is a transitive dependency, so not 3NF, and
--     typos like "Rivers"/"rivers" split reports). Phase 1 adds the
--     lookups and backfills ward_id; the old text columns stay so the
--     app keeps working. Phase 2 is at the bottom.
-- ---------------------------------------------------------------------
create table states(
  state_id smallint generated always as identity primary key,
  name text not null unique);
create table lgas(
  lga_id int generated always as identity primary key,
  state_id smallint not null references states,
  name text not null,
  unique (state_id, name));
create table wards(
  ward_id int generated always as identity primary key,
  lga_id int not null references lgas,
  name text not null,
  unique (lga_id, name));

alter table states enable row level security;
alter table lgas   enable row level security;
alter table wards  enable row level security;
create policy geo_read_states on states for select to authenticated using (true);
create policy geo_read_lgas   on lgas   for select to authenticated using (true);
create policy geo_read_wards  on wards  for select to authenticated using (true);
create policy geo_admin_states on states for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy geo_admin_lgas on lgas for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy geo_admin_wards on wards for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

alter table enumeration_areas add column ward_id int references wards;
create index ea_ward_idx on enumeration_areas(ward_id);

insert into states(name)
  select distinct trim(state) from enumeration_areas on conflict do nothing;
insert into lgas(state_id, name)
  select distinct s.state_id, trim(ea.lga)
  from enumeration_areas ea join states s on s.name = trim(ea.state)
  on conflict do nothing;
insert into wards(lga_id, name)
  select distinct l.lga_id, trim(ea.ward)
  from enumeration_areas ea
  join states s on s.name = trim(ea.state)
  join lgas   l on l.state_id = s.state_id and l.name = trim(ea.lga)
  on conflict do nothing;
update enumeration_areas ea set ward_id = w.ward_id
  from states s, lgas l, wards w
  where s.name = trim(ea.state)
    and l.state_id = s.state_id and l.name = trim(ea.lga)
    and w.lga_id = l.lga_id and w.name = trim(ea.ward)
    and ea.ward_id is null;

commit;

-- =====================================================================
-- DIAGNOSTICS: run these by hand after the migration.
-- =====================================================================
-- Households left without members by the old non-atomic sync. Their
-- members cannot be recovered from the server; re-enumerate them.
--   select household_id, client_id, registered_at from households h
--   where not exists (select 1 from individuals i where i.household_id = h.household_id);
--
-- Geography spelling variants that were split into separate rows:
--   select lower(name), array_agg(name) from states group by 1 having count(*) > 1;
--   select lga_id, lower(name), array_agg(name) from wards group by 1,2 having count(*) > 1;
--   (also check lgas the same way)
--
-- EAs whose ward_id failed to backfill (must be empty before Phase 2):
--   select ea_id, ea_code from enumeration_areas where ward_id is null;

-- =====================================================================
-- OPTIONAL: controlled vocabularies. Adjust the values to YOUR census
-- questionnaire first. Free text makes "by education level" reports
-- unreliable. Uncomment once the lists are agreed.
-- =====================================================================
--   alter table individuals add constraint individuals_relationship_chk
--     check (relationship_to_head in ('head','spouse','child','parent','sibling',
--       'other_relative','non_relative')) not valid;
--   -- exactly one head per household:
--   create unique index one_head_per_household on individuals(household_id)
--     where relationship_to_head = 'head';

-- =====================================================================
-- GEOGRAPHY PHASE 2: run ONLY after the app reads geography via ward_id
-- (enumerator page currently reads ea.lga from enumeration_areas).
-- App change:  .select('*, ward:wards(name, lga:lgas(name, state:states(name)))')
--              and show ea?.ward?.lga?.name instead of ea?.lga
-- =====================================================================
--   begin;
--   alter table enumeration_areas alter column ward_id set not null;
--   create or replace view ea_progress with (security_invoker = true) as
--   select ea.ea_id, ea.ea_code, st.name state, l.name lga, w.name ward,
--          p.full_name enumerator, ea.target_households,
--          count(distinct h.household_id) registered_households,
--          count(i.individual_id) individuals,
--          round(100.0 * count(distinct h.household_id) / ea.target_households, 1) pct
--   from enumeration_areas ea
--   join wards w   on w.ward_id = ea.ward_id
--   join lgas l    on l.lga_id = w.lga_id
--   join states st on st.state_id = l.state_id
--   left join profiles p on p.user_id = ea.assigned_enumerator_id
--   left join households h on h.ea_id = ea.ea_id
--   left join individuals i on i.household_id = h.household_id
--   group by ea.ea_id, p.full_name, st.name, l.name, w.name;
--   alter table enumeration_areas drop column state, drop column lga, drop column ward;
--   commit;
