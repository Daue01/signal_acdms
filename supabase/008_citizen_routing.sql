-- ACDMS migration 008: public citizen intake, EA routing, review workflow,
-- assignment history and public-safe population aggregates.
-- Run after 007_citizen_submissions.sql.
-- This migration is additive and preserves existing census records.

begin;

-- The analyst enum value is added by 007a_add_analyst_role.sql before this migration.

-- Geography is reference data and can be read by the public cascade controls.
grant select on public.states, public.lgas, public.wards to anon, authenticated;
drop policy if exists geo_public_read_states on public.states;
drop policy if exists geo_public_read_lgas on public.lgas;
drop policy if exists geo_public_read_wards on public.wards;
create policy geo_public_read_states on public.states for select to anon using (true);
create policy geo_public_read_lgas on public.lgas for select to anon using (true);
create policy geo_public_read_wards on public.wards for select to anon using (true);

-- Keep an assignment history while enumeration_areas.assigned_enumerator_id
-- remains the compatibility column used by the existing offline client.
create table if not exists public.enumerator_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  ea_id uuid not null references public.enumeration_areas(ea_id) on delete cascade,
  enumerator_id uuid not null references public.profiles(user_id),
  assigned_by uuid references public.profiles(user_id),
  status text not null default 'active' check (status in ('active', 'revoked')),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (assignment_id)
);
create unique index if not exists enumerator_assignments_one_active_ea
  on public.enumerator_assignments(ea_id) where status = 'active';
create index if not exists enumerator_assignments_enumerator_idx
  on public.enumerator_assignments(enumerator_id, status);
alter table public.enumerator_assignments enable row level security;
grant select on public.enumerator_assignments to authenticated;
drop policy if exists enumerator_assignments_read on public.enumerator_assignments;
drop policy if exists enumerator_assignments_admin on public.enumerator_assignments;
create policy enumerator_assignments_read on public.enumerator_assignments
  for select to authenticated
  using (
    (select is_admin())
    or enumerator_id = (select auth.uid())
    or exists (
      select 1 from public.enumeration_areas ea
      where ea.ea_id = enumerator_assignments.ea_id
        and ea.supervisor_id = (select auth.uid())
    )
  );
create policy enumerator_assignments_admin on public.enumerator_assignments
  for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

create or replace function public.sync_enumerator_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.assigned_enumerator_id is distinct from old.assigned_enumerator_id then
    update public.enumerator_assignments
    set status = 'revoked', revoked_at = now()
    where ea_id = new.ea_id and status = 'active';

    if new.assigned_enumerator_id is not null then
      insert into public.enumerator_assignments(ea_id, enumerator_id, assigned_by)
      values (new.ea_id, new.assigned_enumerator_id, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enumeration_area_assignment_history on public.enumeration_areas;
create trigger enumeration_area_assignment_history
after update of assigned_enumerator_id on public.enumeration_areas
for each row execute function public.sync_enumerator_assignment();

insert into public.enumerator_assignments(ea_id, enumerator_id, status)
select ea.ea_id, ea.assigned_enumerator_id, 'active'
from public.enumeration_areas ea
where ea.assigned_enumerator_id is not null
on conflict (ea_id) where status = 'active' do nothing;

-- Extend the existing citizen submission model rather than replacing it.
alter table public.enumeration_areas add column if not exists geometry jsonb;
alter table public.citizen_submissions alter column user_id drop not null;
alter table public.citizen_submissions
  add column if not exists reference_code text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists state_id smallint references public.states(state_id),
  add column if not exists lga_id int references public.lgas(lga_id),
  add column if not exists ward_id int references public.wards(ward_id),
  add column if not exists locality text,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists resolved_ea_id uuid references public.enumeration_areas(ea_id),
  add column if not exists assigned_enumerator_id uuid references public.profiles(user_id),
  add column if not exists review_note text,
  add column if not exists routing_reason text,
  add column if not exists captcha_verified boolean not null default false,
  add column if not exists submitter_ip_hash text,
  add column if not exists status_changed_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.citizen_submissions
set reference_code = 'ACD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where reference_code is null;
alter table public.citizen_submissions alter column reference_code set not null;
create unique index if not exists citizen_submissions_reference_code_uq
  on public.citizen_submissions(reference_code);

alter table public.citizen_submissions drop constraint if exists citizen_submissions_status_check;
alter table public.citizen_submissions drop constraint if exists citizen_submissions_check;
update public.citizen_submissions set status = 'needs_admin' where status = 'pending';
alter table public.citizen_submissions drop constraint if exists citizen_submissions_status_check;
alter table public.citizen_submissions add constraint citizen_submissions_status_check
  check (status in ('pending_enumerator', 'needs_admin', 'approved', 'rejected', 'correction_requested'));
grant update (status, reviewed_by, reviewed_at, ea_id, household_id, resolved_ea_id, assigned_enumerator_id, review_note, routing_reason, status_changed_at, updated_at) on public.citizen_submissions to authenticated;

create index if not exists citizen_submissions_status_idx
  on public.citizen_submissions(status, submitted_at desc);
create index if not exists citizen_submissions_assignee_idx
  on public.citizen_submissions(assigned_enumerator_id, status, submitted_at desc);
create index if not exists citizen_submissions_ea_idx
  on public.citizen_submissions(resolved_ea_id, status);
create index if not exists citizen_submissions_reference_trgm_idx
  on public.citizen_submissions using gin(reference_code gin_trgm_ops);
create index if not exists profiles_full_name_trgm_idx on public.profiles using gin(full_name gin_trgm_ops);
create index if not exists enumeration_areas_code_trgm_idx on public.enumeration_areas using gin(ea_code gin_trgm_ops);
create index if not exists enumeration_areas_location_trgm_idx on public.enumeration_areas using gin((state || ' ' || lga || ' ' || ward) gin_trgm_ops);
create index if not exists states_name_trgm_idx on public.states using gin(name gin_trgm_ops);
create index if not exists lgas_name_trgm_idx on public.lgas using gin(name gin_trgm_ops);
create index if not exists wards_name_trgm_idx on public.wards using gin(name gin_trgm_ops);
create index if not exists households_client_id_trgm_idx on public.households using gin((client_id::text) gin_trgm_ops);

-- Anonymous intake is rate limited by an API-generated hash, never by raw IP.
create table if not exists public.citizen_submission_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count int not null default 0 check (request_count >= 0),
  last_request_at timestamptz not null default now()
);
alter table public.citizen_submission_rate_limits enable row level security;
revoke all on public.citizen_submission_rate_limits from public, anon, authenticated;

-- Household indicators are separated from the operational household table so
-- enumerators cannot read raw wealth data through the existing household RLS.
create table if not exists public.household_indicators (
  household_id uuid primary key references public.households(household_id) on delete cascade,
  electricity_access_type text check (electricity_access_type in ('grid','generator','solar','none')),
  electricity_hours_per_day numeric(4,1) check (electricity_hours_per_day between 0 and 24),
  water_source text check (water_source in ('piped','borehole','well','surface','vendor')),
  water_fetch_minutes int check (water_fetch_minutes between 0 and 1440),
  cars_owned int not null default 0 check (cars_owned between 0 and 50),
  income_band text,
  recorded_at timestamptz not null default now()
);
alter table public.household_indicators enable row level security;
revoke all on public.household_indicators from public, anon, authenticated;
drop policy if exists household_indicators_staff_read on public.household_indicators;
drop policy if exists household_indicators_staff_write on public.household_indicators;
drop policy if exists household_indicators_enumerator_insert on public.household_indicators;
create policy household_indicators_staff_read on public.household_indicators
  for select to authenticated
  using ((select role_of()) in ('administrator', 'analyst'));
create policy household_indicators_staff_write on public.household_indicators
  for all to authenticated
  using ((select is_admin()) or (select role_of()) = 'analyst')
  with check ((select is_admin()) or (select role_of()) = 'analyst');
grant insert on public.household_indicators to authenticated;
create policy household_indicators_enumerator_insert on public.household_indicators
  for insert to authenticated
  with check ((select role_of()) = 'enumerator' and exists (
    select 1 from public.households h where h.household_id = household_indicators.household_id and h.registered_by = (select auth.uid())
  ));

-- Aggregate-only table. Rows are maintained by the approved-record triggers.
create table if not exists public.population_aggregates (
  aggregate_key text primary key,
  scope text not null check (scope in ('national','state','lga','ward','ea')),
  state_id smallint references public.states(state_id),
  lga_id int references public.lgas(lga_id),
  ward_id int references public.wards(ward_id),
  ea_id uuid references public.enumeration_areas(ea_id),
  approved_households bigint not null default 0 check (approved_households >= 0),
  approved_individuals bigint not null default 0 check (approved_individuals >= 0),
  electricity_households bigint not null default 0,
  electricity_hours_total numeric(12,1) not null default 0,
  improved_water_households bigint not null default 0,
  cars_total bigint not null default 0,
  car_households bigint not null default 0,
  income_band_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check ((scope = 'national' and state_id is null and lga_id is null and ward_id is null and ea_id is null)
      or (scope = 'state' and state_id is not null and lga_id is null and ward_id is null and ea_id is null)
      or (scope = 'lga' and state_id is not null and lga_id is not null and ward_id is null and ea_id is null)
      or (scope = 'ward' and state_id is not null and lga_id is not null and ward_id is not null and ea_id is null)
      or (scope = 'ea' and state_id is not null and lga_id is not null and ward_id is not null and ea_id is not null))
);
alter table public.population_aggregates add column if not exists car_households bigint not null default 0;
alter table public.population_aggregates enable row level security;
grant select on public.population_aggregates to authenticated;
drop policy if exists population_aggregates_staff_read on public.population_aggregates;
create policy population_aggregates_staff_read on public.population_aggregates
  for select to authenticated using (true);
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'population_aggregates'
     ) then
    alter publication supabase_realtime add table public.population_aggregates;
  end if;
end;
$$;

create table if not exists public.census_indicator_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.census_indicator_config enable row level security;
insert into public.census_indicator_config(key, value)
values
  ('small_count_threshold', '10'::jsonb),
  ('income_bands', '["below_50000","50000_99999","100000_249999","250000_plus"]'::jsonb),
  ('electricity_thresholds', '{"very_low":25,"low":50,"medium":75}'::jsonb),
  ('water_thresholds', '{"very_low":25,"low":50,"medium":75}'::jsonb)
on conflict (key) do nothing;
drop policy if exists census_indicator_config_public_read on public.census_indicator_config;
create policy census_indicator_config_public_read on public.census_indicator_config
  for select to anon, authenticated using (key in ('small_count_threshold', 'income_bands', 'electricity_thresholds', 'water_thresholds'));
drop policy if exists census_indicator_config_admin on public.census_indicator_config;
create policy census_indicator_config_admin on public.census_indicator_config
  for all to authenticated using ((select is_admin())) with check ((select is_admin()));
grant select, insert, update, delete on public.census_indicator_config to authenticated;
grant select on public.census_indicator_config to anon;

-- Rebuild all hierarchy aggregate rows for one household. The trigger is
-- deliberately small and uses indexed primary-key lookups.
create or replace function public.bump_population_aggregate(
  p_delta_households int,
  p_delta_individuals int,
  p_state_id smallint,
  p_lga_id int,
  p_ward_id int,
  p_ea_id uuid,
  p_electricity boolean default false,
  p_electricity_hours numeric default 0,
  p_improved_water boolean default false,
  p_cars int default 0,
  p_income_band text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope text;
  v_key text;
begin
  foreach v_scope in array array['national','state','lga','ward','ea'] loop
    v_key := case v_scope
      when 'national' then 'national'
      when 'state' then 'state:' || p_state_id
      when 'lga' then 'lga:' || p_lga_id
      when 'ward' then 'ward:' || p_ward_id
      else 'ea:' || p_ea_id
    end;
    insert into public.population_aggregates(
      aggregate_key, scope, state_id, lga_id, ward_id, ea_id,
      approved_households, approved_individuals, electricity_households,
      electricity_hours_total, improved_water_households, cars_total,
      income_band_counts)
    values (
      v_key, v_scope, case when v_scope <> 'national' then p_state_id end,
      case when v_scope in ('lga','ward','ea') then p_lga_id end,
      case when v_scope in ('ward','ea') then p_ward_id end,
      case when v_scope = 'ea' then p_ea_id end,
      greatest(p_delta_households, 0), greatest(p_delta_individuals, 0),
      case when p_electricity then greatest(p_delta_households, 0) else 0 end,
      case when p_electricity then p_electricity_hours else 0 end,
      case when p_improved_water then greatest(p_delta_households, 0) else 0 end,
      greatest(p_cars, 0),
      case when p_income_band is null then '{}'::jsonb else jsonb_build_object(p_income_band, greatest(p_delta_households, 0)) end)
    on conflict (aggregate_key) do update set
      approved_households = population_aggregates.approved_households + p_delta_households,
      approved_individuals = population_aggregates.approved_individuals + p_delta_individuals,
      electricity_households = population_aggregates.electricity_households + case when p_electricity then p_delta_households else 0 end,
      electricity_hours_total = population_aggregates.electricity_hours_total + case when p_electricity then p_electricity_hours else 0 end,
      improved_water_households = population_aggregates.improved_water_households + case when p_improved_water then p_delta_households else 0 end,
      cars_total = population_aggregates.cars_total + p_cars,
      income_band_counts = case when p_income_band is null then population_aggregates.income_band_counts
        else jsonb_set(population_aggregates.income_band_counts, array[p_income_band], to_jsonb(coalesce((population_aggregates.income_band_counts->>p_income_band)::bigint, 0) + p_delta_households), true) end,
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.aggregate_household_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state smallint;
  v_lga int;
  v_ward int;
begin
  select w.ward_id, l.lga_id, s.state_id into v_ward, v_lga, v_state
  from public.enumeration_areas ea
  join public.wards w on w.ward_id = ea.ward_id
  join public.lgas l on l.lga_id = w.lga_id
  join public.states s on s.state_id = l.state_id
  where ea.ea_id = new.ea_id;
  if v_state is not null then
    perform public.bump_population_aggregate(1, 0, v_state, v_lga, v_ward, new.ea_id);
  end if;
  return new;
end;
$$;

drop trigger if exists aggregate_household_insert on public.households;
create trigger aggregate_household_insert after insert on public.households
for each row execute function public.aggregate_household_insert();

create or replace function public.aggregate_individual_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state smallint;
  v_lga int;
  v_ward int;
  v_ea uuid;
begin
  select s.state_id, l.lga_id, w.ward_id, h.ea_id into v_state, v_lga, v_ward, v_ea
  from public.households h
  join public.enumeration_areas ea on ea.ea_id = h.ea_id
  join public.wards w on w.ward_id = ea.ward_id
  join public.lgas l on l.lga_id = w.lga_id
  join public.states s on s.state_id = l.state_id
  where h.household_id = new.household_id;
  if v_state is not null then
    perform public.bump_population_aggregate(0, 1, v_state, v_lga, v_ward, v_ea);
  end if;
  return new;
end;
$$;

drop trigger if exists aggregate_individual_insert on public.individuals;
create trigger aggregate_individual_insert after insert on public.individuals
for each row execute function public.aggregate_individual_insert();

create or replace function public.adjust_population_indicators(
  p_state_id smallint, p_lga_id int, p_ward_id int, p_ea_id uuid,
  p_electricity boolean, p_electricity_hours numeric, p_improved_water boolean,
  p_cars int, p_income_band text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope text;
  v_key text;
begin
  foreach v_scope in array array['national','state','lga','ward','ea'] loop
    v_key := case v_scope when 'national' then 'national' when 'state' then 'state:'||p_state_id when 'lga' then 'lga:'||p_lga_id when 'ward' then 'ward:'||p_ward_id else 'ea:'||p_ea_id end;
    insert into public.population_aggregates(aggregate_key,scope,state_id,lga_id,ward_id,ea_id,electricity_households,electricity_hours_total,improved_water_households,cars_total,car_households,income_band_counts)
    values(v_key,v_scope,case when v_scope<>'national' then p_state_id end,case when v_scope in ('lga','ward','ea') then p_lga_id end,case when v_scope in ('ward','ea') then p_ward_id end,case when v_scope='ea' then p_ea_id end,case when p_electricity then 1 else 0 end,p_electricity_hours,case when p_improved_water then 1 else 0 end,greatest(p_cars,0),case when p_cars > 0 then 1 else 0 end,case when p_income_band is null then '{}'::jsonb else jsonb_build_object(p_income_band,1) end)
    on conflict (aggregate_key) do update set
      electricity_households=population_aggregates.electricity_households+case when p_electricity then 1 else 0 end,
      electricity_hours_total=population_aggregates.electricity_hours_total+p_electricity_hours,
      improved_water_households=population_aggregates.improved_water_households+case when p_improved_water then 1 else 0 end,
      cars_total=population_aggregates.cars_total+greatest(p_cars,0),
       car_households=population_aggregates.car_households+case when p_cars > 0 then 1 else 0 end,
      income_band_counts=case when p_income_band is null then population_aggregates.income_band_counts else jsonb_set(population_aggregates.income_band_counts,array[p_income_band],to_jsonb(coalesce((population_aggregates.income_band_counts->>p_income_band)::bigint,0)+1),true) end,
      updated_at=now();
  end loop;
end;
$$;

create or replace function public.aggregate_indicator_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state smallint;
  v_lga int;
  v_ward int;
  v_ea uuid;
  v_electricity boolean := new.electricity_access_type is not null and new.electricity_access_type <> 'none';
  v_water boolean := new.water_source in ('piped','borehole','well');
begin
  select s.state_id, l.lga_id, w.ward_id, h.ea_id into v_state, v_lga, v_ward, v_ea
  from public.households h join public.enumeration_areas ea on ea.ea_id=h.ea_id
  join public.wards w on w.ward_id=ea.ward_id join public.lgas l on l.lga_id=w.lga_id join public.states s on s.state_id=l.state_id
  where h.household_id = new.household_id;
  if v_state is not null then
    perform public.adjust_population_indicators(v_state, v_lga, v_ward, v_ea, v_electricity, coalesce(new.electricity_hours_per_day,0), v_water, new.cars_owned, new.income_band);
  end if;
  return new;
end;
$$;
drop trigger if exists aggregate_indicator_insert on public.household_indicators;
create trigger aggregate_indicator_insert after insert on public.household_indicators
for each row execute function public.aggregate_indicator_insert();

-- Raw wealth/service details require an explicit reason and are never exposed
-- through the public aggregate RPC or an unrestricted table select.
create or replace function public.get_household_indicators(p_household_id uuid, p_reason text)
returns table(household_id uuid, electricity_access_type text, electricity_hours_per_day numeric, water_source text, water_fetch_minutes int, cars_owned int, income_band text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce((select role_of())::text, '') not in ('administrator', 'analyst') then
    raise exception 'Sensitive indicator access is not available for this role' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 5 then
    raise exception 'A reason is required for sensitive indicator access' using errcode = '22023';
  end if;
  insert into public.audit_log(table_name, record_id, action, changed_by, new_values)
  values ('household_indicators', p_household_id::text, 'SENSITIVE_LOOKUP', auth.uid(), jsonb_build_object('reason', left(btrim(p_reason), 240)));
  return query select hi.household_id, hi.electricity_access_type, hi.electricity_hours_per_day, hi.water_source, hi.water_fetch_minutes, hi.cars_owned, hi.income_band
  from public.household_indicators hi where hi.household_id = p_household_id;
end;
$$;
revoke all on function public.get_household_indicators(uuid, text) from public, anon;
grant execute on function public.get_household_indicators(uuid, text) to authenticated;

create or replace function public.rebuild_population_aggregates()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h record;
  i record;
  ind record;
begin
  truncate table public.population_aggregates;
  for h in
    select h.household_id, h.ea_id, s.state_id, l.lga_id, w.ward_id
    from public.households h
    join public.enumeration_areas ea on ea.ea_id=h.ea_id
    join public.wards w on w.ward_id=ea.ward_id
    join public.lgas l on l.lga_id=w.lga_id
    join public.states s on s.state_id=l.state_id
  loop
    perform public.bump_population_aggregate(1,0,h.state_id,h.lga_id,h.ward_id,h.ea_id);
  end loop;
  for i in
    select i.individual_id, s.state_id, l.lga_id, w.ward_id, h.ea_id
    from public.individuals i join public.households h on h.household_id=i.household_id
    join public.enumeration_areas ea on ea.ea_id=h.ea_id join public.wards w on w.ward_id=ea.ward_id
    join public.lgas l on l.lga_id=w.lga_id join public.states s on s.state_id=l.state_id
  loop
    perform public.bump_population_aggregate(0,1,i.state_id,i.lga_id,i.ward_id,i.ea_id);
  end loop;
  for ind in
    select hi.*, s.state_id, l.lga_id, w.ward_id, h.ea_id
    from public.household_indicators hi join public.households h on h.household_id=hi.household_id
    join public.enumeration_areas ea on ea.ea_id=h.ea_id join public.wards w on w.ward_id=ea.ward_id
    join public.lgas l on l.lga_id=w.lga_id join public.states s on s.state_id=l.state_id
  loop
    perform public.adjust_population_indicators(ind.state_id,ind.lga_id,ind.ward_id,ind.ea_id,ind.electricity_access_type is not null and ind.electricity_access_type <> 'none',coalesce(ind.electricity_hours_per_day,0),ind.water_source in ('piped','borehole','well'),ind.cars_owned,ind.income_band);
  end loop;
end;
$$;

select public.rebuild_population_aggregates();

-- Public totals are aggregate-only and suppress small counts.
create or replace function public.suppressed_metric(p_value numeric, p_denominator bigint, p_threshold int)
returns text
language sql
immutable
as $$
  select case when p_denominator < p_threshold then '<10' else round(coalesce(p_value, 0), 1)::text end;
$$;

create or replace function public.supply_level(p_percentage numeric, p_thresholds jsonb, p_suppressed boolean)
returns text
language sql
immutable
as $$
  select case
    when p_suppressed then 'Suppressed'
    when coalesce(p_percentage, 0) < coalesce((p_thresholds->>'very_low')::numeric, 25) then 'Very low'
    when coalesce(p_percentage, 0) < coalesce((p_thresholds->>'low')::numeric, 50) then 'Low'
    when coalesce(p_percentage, 0) < coalesce((p_thresholds->>'medium')::numeric, 75) then 'Medium'
    else 'High'
  end;
$$;

create or replace function public.suppressed_income_distribution(p_counts jsonb, p_threshold int)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_object_agg(e.key, case when (e.value #>> '{}')::bigint < p_threshold then to_jsonb('<10'::text) else e.value end), '{}'::jsonb)
  from jsonb_each(coalesce(p_counts, '{}'::jsonb)) e;
$$;

drop function if exists public.public_population_totals();
create or replace function public.public_population_totals(
  p_scope text default null,
  p_state_id smallint default null,
  p_lga_id int default null,
  p_ward_id int default null
)
returns table(
  scope text,
  aggregate_key text,
  approved_households text,
  approved_individuals text,
  electricity_percentage text,
  average_electricity_hours text,
  improved_water_percentage text,
  car_ownership_rate text,
  income_band_distribution jsonb,
  electricity_level text,
  water_level text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with config as (
    select
      coalesce((select (value #>> '{}')::int from public.census_indicator_config where key = 'small_count_threshold'), 10) threshold,
      coalesce((select value from public.census_indicator_config where key = 'electricity_thresholds'), '{"very_low":25,"low":50,"medium":75}'::jsonb) electricity_thresholds,
      coalesce((select value from public.census_indicator_config where key = 'water_thresholds'), '{"very_low":25,"low":50,"medium":75}'::jsonb) water_thresholds
  )
  select a.scope, a.aggregate_key,
    case when a.approved_households < c.threshold then '<10' else a.approved_households::text end,
    case when a.approved_households < c.threshold or a.approved_individuals < c.threshold then '<10' else a.approved_individuals::text end,
    public.suppressed_metric(100.0 * a.electricity_households / nullif(a.approved_households, 0), a.approved_households, c.threshold),
    public.suppressed_metric(a.electricity_hours_total / nullif(a.approved_households, 0), a.approved_households, c.threshold),
    public.suppressed_metric(100.0 * a.improved_water_households / nullif(a.approved_households, 0), a.approved_households, c.threshold),
    public.suppressed_metric(100.0 * a.car_households / nullif(a.approved_households, 0), a.approved_households, c.threshold),
    case when a.approved_households < c.threshold then jsonb_build_object('suppressed', '<10') else public.suppressed_income_distribution(a.income_band_counts, c.threshold) end,
    public.supply_level(100.0 * a.electricity_households / nullif(a.approved_households, 0), c.electricity_thresholds, a.approved_households < c.threshold),
    public.supply_level(100.0 * a.improved_water_households / nullif(a.approved_households, 0), c.water_thresholds, a.approved_households < c.threshold)
  from public.population_aggregates a
  cross join config c
  where (a.scope in ('national','state','lga','ward') or (a.scope = 'ea' and p_scope = 'ea' and coalesce((select role_of())::text, '') in ('administrator','supervisor','analyst')))
    and (p_scope is null or a.scope = p_scope)
    and (p_state_id is null or a.state_id = p_state_id)
    and (p_lga_id is null or a.lga_id = p_lga_id)
    and (p_ward_id is null or a.ward_id = p_ward_id);
$$;
revoke all on function public.public_population_totals(text, smallint, int, int) from public;
grant execute on function public.public_population_totals(text, smallint, int, int) to anon, authenticated;

-- Public submission route. It validates geography IDs, resolves a unique EA
-- when locality matches exactly or the ward has one EA, and otherwise queues
-- the record for admin resolution.
create or replace function public.point_in_geojson_ring(p_ring jsonb, p_longitude numeric, p_latitude numeric)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  i int;
  j int;
  n int := jsonb_array_length(p_ring);
  xi numeric;
  yi numeric;
  xj numeric;
  yj numeric;
  inside boolean := false;
begin
  if n < 3 then return false; end if;
  for i in 0..n-1 loop
    j := case when i = 0 then n - 1 else i - 1 end;
    xi := ((p_ring->i)->>0)::numeric;
    yi := ((p_ring->i)->>1)::numeric;
    xj := ((p_ring->j)->>0)::numeric;
    yj := ((p_ring->j)->>1)::numeric;
    if ((yi > p_latitude) <> (yj > p_latitude)) and
       p_longitude < (xj - xi) * (p_latitude - yi) / nullif(yj - yi, 0) + xi then
      inside := not inside;
    end if;
  end loop;
  return inside;
end;
$$;

create or replace function public.point_in_ea_geometry(p_geometry jsonb, p_longitude numeric, p_latitude numeric)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_type text := p_geometry->>'type';
  v_polygon jsonb;
begin
  if p_geometry is null or p_longitude is null or p_latitude is null then return false; end if;
  if v_type = 'Polygon' then
    return public.point_in_geojson_ring(p_geometry->'coordinates'->0, p_longitude, p_latitude);
  elsif v_type = 'MultiPolygon' then
    for v_polygon in select value from jsonb_array_elements(p_geometry->'coordinates') loop
      if public.point_in_geojson_ring(v_polygon->0->0, p_longitude, p_latitude) then return true; end if;
    end loop;
  end if;
  return false;
end;
$$;

create or replace function public.submit_public_citizen_submission(
  p_state_id smallint,
  p_lga_id int,
  p_ward_id int,
  p_locality text,
  p_address text,
  p_payload jsonb,
  p_consent_recorded boolean,
  p_captcha_verified boolean,
  p_rate_key text,
  p_latitude numeric default null,
  p_longitude numeric default null
) returns table(reference_code text, status text, routing_reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state text;
  v_lga text;
  v_ward text;
  v_ea uuid;
  v_enumerator uuid;
  v_matches int;
  v_reference text;
  v_status text;
  v_reason text;
  v_count int;
begin
  if not p_consent_recorded then raise exception 'Consent is required' using errcode = '23514'; end if;
  if not p_captcha_verified then raise exception 'Captcha verification is required' using errcode = '42501'; end if;
  if coalesce(length(btrim(p_address)), 0) = 0 then raise exception 'Address is required' using errcode = '22023'; end if;
  if p_rate_key is null or length(p_rate_key) < 16 then raise exception 'Rate limit key required' using errcode = '22023'; end if;
  if nullif(btrim(p_payload->>'income_band'), '') is not null and not exists (
    select 1 from public.census_indicator_config c, jsonb_array_elements_text(c.value) band
    where c.key = 'income_bands' and band = btrim(p_payload->>'income_band')
  ) then
    raise exception 'Income band is not in the configured list' using errcode = '22023';
  end if;

  insert into public.citizen_submission_rate_limits(rate_key, window_started_at, request_count)
  values (p_rate_key, now(), 1)
  on conflict (rate_key) do update set
    request_count = case when now() - citizen_submission_rate_limits.window_started_at > interval '1 hour' then 1 else citizen_submission_rate_limits.request_count + 1 end,
    window_started_at = case when now() - citizen_submission_rate_limits.window_started_at > interval '1 hour' then now() else citizen_submission_rate_limits.window_started_at end,
    last_request_at = now();
  select request_count into v_count from public.citizen_submission_rate_limits where rate_key = p_rate_key;
  if v_count > 5 then raise exception 'Submission rate limit exceeded' using errcode = 'P0001'; end if;

  select s.name into v_state from public.states s where s.state_id = p_state_id;
  select l.name into v_lga from public.lgas l where l.lga_id = p_lga_id and l.state_id = p_state_id;
  select w.name into v_ward from public.wards w where w.ward_id = p_ward_id and w.lga_id = p_lga_id;
  if v_state is null or v_lga is null or v_ward is null then raise exception 'Invalid state, LGA or ward selection' using errcode = '23503'; end if;

  select count(*), min(ea.ea_id) into v_matches, v_ea
  from public.enumeration_areas ea
  where ea.ward_id = p_ward_id
    and (nullif(btrim(p_locality), '') is null or lower(ea.ea_code) = lower(btrim(p_locality)));
  if v_matches <> 1 and p_latitude is not null and p_longitude is not null then
    select count(*), min(ea.ea_id) into v_matches, v_ea
    from public.enumeration_areas ea
    where ea.ward_id = p_ward_id
      and ea.geometry is not null
      and public.point_in_ea_geometry(ea.geometry, p_longitude, p_latitude);
  end if;
  if v_matches <> 1 then
    v_ea := null;
    v_reason := case when v_matches = 0 then 'No EA found for the selected ward/locality' else 'Multiple EAs match; admin resolution required' end;
  else
    select aa.enumerator_id into v_enumerator
    from public.enumerator_assignments aa
    where aa.ea_id = v_ea and aa.status = 'active'
    limit 1;
    if v_enumerator is null then
      v_reason := 'EA has no active enumerator assignment';
    end if;
  end if;
  v_status := case when v_ea is not null and v_enumerator is not null then 'pending_enumerator' else 'needs_admin' end;
  v_reference := 'ACD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.citizen_submissions(
    reference_code, user_id, state, lga, ward, state_id, lga_id, ward_id,
    locality, address, housing_type, ownership_status, utilities, payload, individuals, consent_recorded, captcha_verified,
    latitude, longitude, resolved_ea_id, assigned_enumerator_id, status,
    routing_reason, submitted_at, status_changed_at, updated_at)
  values (
    v_reference, auth.uid(), v_state, v_lga, v_ward, p_state_id, p_lga_id, p_ward_id,
    nullif(btrim(p_locality), ''), btrim(p_address), p_payload->>'housing_type', p_payload->>'ownership_status', coalesce(p_payload->'utilities','{}'::jsonb), p_payload,
    coalesce(p_payload->'individuals', '[]'::jsonb), true, p_captcha_verified,
    p_latitude, p_longitude, v_ea, v_enumerator, v_status, v_reason, now(), now(), now());

  return query select v_reference, v_status, v_reason;
end;
$$;
revoke all on function public.submit_public_citizen_submission(smallint, int, int, text, text, jsonb, boolean, boolean, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.submit_public_citizen_submission(smallint, int, int, text, text, jsonb, boolean, boolean, text, numeric, numeric) to service_role;

create or replace function public.get_public_submission_status(p_reference_code text)
returns table(reference_code text, status text, submitted_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.reference_code, s.status, s.submitted_at, s.updated_at
  from public.citizen_submissions s
  where upper(s.reference_code) = upper(btrim(p_reference_code));
$$;
revoke all on function public.get_public_submission_status(text) from public;
grant execute on function public.get_public_submission_status(text) to anon, authenticated;

-- Enumerator review is server-side and checks the assignment before approval.
create or replace function public.review_citizen_submission(
  p_submission_id uuid,
  p_action text,
  p_review_note text default null
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  s public.citizen_submissions%rowtype;
  v_household uuid;
begin
  if p_action not in ('approve', 'reject', 'correction_requested') then raise exception 'Invalid review action' using errcode = '22023'; end if;
  select * into s from public.citizen_submissions where submission_id = p_submission_id for update;
  if not found then raise exception 'Submission not found' using errcode = 'P0002'; end if;
  if s.status <> 'pending_enumerator' then raise exception 'Submission is not awaiting enumerator review' using errcode = '23514'; end if;
  if (select role_of()) <> 'enumerator' or s.assigned_enumerator_id <> (select auth.uid()) then raise exception 'Submission is not assigned to this enumerator' using errcode = '42501'; end if;

  if p_action = 'approve' then
    insert into public.households(client_id, ea_id, address, housing_type, utilities, ownership_status, consent_recorded, consent_at, registered_by)
    values (gen_random_uuid(), s.resolved_ea_id, s.address, s.housing_type, s.utilities, s.ownership_status, true, s.submitted_at, auth.uid())
    returning household_id into v_household;
    insert into public.individuals(household_id, surname, firstname, sex, date_of_birth, age, relationship_to_head, education_level, occupation, disability_status, registered_by)
    select v_household, x.surname, x.firstname, x.sex, nullif(x.date_of_birth, '')::date, x.age, x.relationship_to_head, x.education_level, x.occupation, x.disability_status, auth.uid()
    from jsonb_to_recordset(s.individuals) as x(surname text, firstname text, sex text, date_of_birth text, age integer, relationship_to_head text, education_level text, occupation text, disability_status text);
    insert into public.household_indicators(household_id, electricity_access_type, electricity_hours_per_day, water_source, water_fetch_minutes, cars_owned, income_band)
    values (v_household, nullif(s.payload->>'electricity_access_type',''), nullif(s.payload->>'electricity_hours_per_day','')::numeric, nullif(s.payload->>'water_source',''), nullif(s.payload->>'water_fetch_minutes','')::int, coalesce(nullif(s.payload->>'cars_owned','')::int,0), nullif(s.payload->>'income_band',''));
    update public.citizen_submissions set status='approved', ea_id=s.resolved_ea_id, household_id=v_household, reviewed_by=auth.uid(), reviewed_at=now(), review_note=p_review_note, status_changed_at=now(), updated_at=now() where submission_id=s.submission_id;
  else
    update public.citizen_submissions set status=p_action, reviewed_by=auth.uid(), reviewed_at=now(), review_note=nullif(btrim(p_review_note), ''), status_changed_at=now(), updated_at=now() where submission_id=s.submission_id;
  end if;
  return p_action;
end;
$$;
revoke all on function public.review_citizen_submission(uuid, text, text) from public, anon;
grant execute on function public.review_citizen_submission(uuid, text, text) to authenticated;

-- Replace the older broad citizen policies with role-scoped policies.
drop policy if exists citizen_submissions_read on public.citizen_submissions;
drop policy if exists citizen_submissions_insert on public.citizen_submissions;
drop policy if exists citizen_submissions_review on public.citizen_submissions;
drop policy if exists citizen_submissions_admin_update on public.citizen_submissions;
drop policy if exists citizen_submissions_enumerator_update on public.citizen_submissions;
create policy citizen_submissions_read on public.citizen_submissions
  for select to authenticated
  using (
    (select is_admin())
    or ((select role_of()) = 'analyst')
    or ((select role_of()) = 'citizen' and user_id = (select auth.uid()))
    or ((select role_of()) = 'enumerator' and assigned_enumerator_id = (select auth.uid()))
    or ((select role_of()) = 'supervisor' and exists (select 1 from public.enumeration_areas ea where ea.ea_id = resolved_ea_id and ea.supervisor_id = (select auth.uid())))
  );
create policy citizen_submissions_admin_update on public.citizen_submissions
  for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy citizen_submissions_enumerator_update on public.citizen_submissions
  for update to authenticated
  using ((select role_of()) = 'enumerator' and assigned_enumerator_id = (select auth.uid()))
  with check ((select role_of()) = 'enumerator' and assigned_enumerator_id = (select auth.uid()));
revoke all on public.citizen_submissions from anon;

drop policy if exists p_self on public.profiles;
create policy p_self on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select role_of()) in ('administrator','supervisor','analyst'));
drop policy if exists ea_read on public.enumeration_areas;
create policy ea_read on public.enumeration_areas for select to authenticated
  using ((select is_admin()) or (select role_of()) = 'analyst'
      or ((select role_of()) = 'enumerator' and assigned_enumerator_id = (select auth.uid()))
      or ((select role_of()) = 'supervisor' and supervisor_id = (select auth.uid())));
drop policy if exists hh_read on public.households;
create policy hh_read on public.households for select to authenticated
  using ((select role_of()) in ('administrator','analyst') or exists(
    select 1 from public.enumeration_areas ea where ea.ea_id = households.ea_id and
      ((select role_of()) = 'enumerator' and ea.assigned_enumerator_id = (select auth.uid())) or
      ((select role_of()) = 'supervisor' and ea.supervisor_id = (select auth.uid()))));

create or replace function public.resolve_citizen_submission(
  p_submission_id uuid,
  p_ea_id uuid,
  p_enumerator_id uuid
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  s public.citizen_submissions%rowtype;
begin
  if (select is_admin()) is not true then raise exception 'Only an administrator can resolve submissions' using errcode = '42501'; end if;
  select * into s from public.citizen_submissions where submission_id = p_submission_id for update;
  if not found then raise exception 'Submission not found' using errcode = 'P0002'; end if;
  if s.status <> 'needs_admin' then raise exception 'Submission is not in the administrator queue' using errcode = '23514'; end if;
  if not exists (select 1 from public.enumeration_areas ea where ea.ea_id = p_ea_id and ea.ward_id = s.ward_id) then
    raise exception 'The selected EA does not belong to the submitted ward' using errcode = '23503';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = p_enumerator_id and p.role = 'enumerator' and p.is_active) then
    raise exception 'The selected enumerator is not active' using errcode = '23514';
  end if;
  update public.enumeration_areas set assigned_enumerator_id = p_enumerator_id where ea_id = p_ea_id;
  update public.citizen_submissions set resolved_ea_id=p_ea_id, ea_id=p_ea_id, assigned_enumerator_id=p_enumerator_id, status='pending_enumerator', routing_reason=null, review_note=null, reviewed_by=auth.uid(), reviewed_at=now(), status_changed_at=now(), updated_at=now() where submission_id=s.submission_id;
  return 'pending_enumerator';
end;
$$;
revoke all on function public.resolve_citizen_submission(uuid, uuid, uuid) from public, anon;
grant execute on function public.resolve_citizen_submission(uuid, uuid, uuid) to authenticated;

create or replace function public.reject_citizen_submission(
  p_submission_id uuid,
  p_review_note text
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (select is_admin()) is not true then raise exception 'Only an administrator can reject submissions' using errcode = '42501'; end if;
  update public.citizen_submissions set status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), review_note=nullif(btrim(p_review_note), ''), status_changed_at=now(), updated_at=now() where submission_id=p_submission_id and status='needs_admin';
  if not found then raise exception 'Submission is not in the administrator queue' using errcode = '23514'; end if;
  return 'rejected';
end;
$$;
revoke all on function public.reject_citizen_submission(uuid, text) from public, anon;
grant execute on function public.reject_citizen_submission(uuid, text) to authenticated;

create or replace function public.log_admin_lookup(p_query text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce((select role_of())::text, '') not in ('administrator', 'supervisor', 'analyst') then
    raise exception 'Search is not available for this role' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 5 then
    raise exception 'A search reason is required' using errcode = '22023';
  end if;
  insert into public.audit_log(table_name, record_id, action, changed_by, new_values)
  values ('admin_search', 'query:' || md5(lower(btrim(coalesce(p_query, '')))), 'SEARCH', auth.uid(),
          jsonb_build_object('reason', left(btrim(p_reason), 240)));
end;
$$;
revoke all on function public.log_admin_lookup(text, text) from public, anon;
grant execute on function public.log_admin_lookup(text, text) to authenticated;

drop function if exists public.admin_search(text, int, int);
create or replace function public.admin_search(
  p_query text,
  p_limit int default 20,
  p_offset int default 0,
  p_reason text default null
) returns table(kind text, record_id text, label text, detail text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform public.log_admin_lookup(p_query, p_reason);
  return query
  with q as (select '%' || lower(btrim(p_query)) || '%' as pattern)
  select * from (
    select 'enumeration_area', ea.ea_id::text, ea.ea_code, ea.state || ' / ' || ea.lga || ' / ' || ea.ward
    from public.enumeration_areas ea, q
    where lower(ea.ea_code) like q.pattern or lower(ea.state || ' ' || ea.lga || ' ' || ea.ward) like q.pattern
    union all
    select 'enumerator', p.user_id::text, p.full_name, p.role::text
    from public.profiles p, q
    where p.role in ('enumerator','supervisor','administrator','analyst') and lower(p.full_name) like q.pattern
    union all
    select 'submission', s.submission_id::text, s.reference_code, s.status || ' · ' || s.state || ' / ' || s.lga || ' / ' || s.ward
    from public.citizen_submissions s, q
    where lower(s.reference_code) like q.pattern or lower(s.state || ' ' || s.lga || ' ' || s.ward) like q.pattern
    union all
    select 'household', h.household_id::text, h.client_id::text, h.address
    from public.households h, q
    where lower(h.client_id::text) like q.pattern or lower(h.address) like q.pattern
  ) matches
  order by kind, label
  limit greatest(1, least(p_limit, 50)) offset greatest(p_offset, 0);
end;
$$;
revoke all on function public.admin_search(text, int, int, text) from public, anon;
grant execute on function public.admin_search(text, int, int, text) to authenticated;

create or replace function public.audit_citizen_submission_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_log(table_name, record_id, action, changed_by, old_values, new_values)
    values ('citizen_submissions', new.reference_code, 'STATUS_' || upper(new.status), auth.uid(), jsonb_build_object('status', old.status), jsonb_build_object('status', new.status, 'note', new.review_note));
  end if;
  new.updated_at := now();
  new.status_changed_at := case when new.status is distinct from old.status then now() else old.status_changed_at end;
  return new;
end;
$$;
drop trigger if exists audit_citizen_submission_status on public.citizen_submissions;
create trigger audit_citizen_submission_status
before update on public.citizen_submissions
for each row execute function public.audit_citizen_submission_status();

commit;
