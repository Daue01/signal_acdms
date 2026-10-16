-- Citizen accounts can submit household details for administrative review.
-- Run after 006_profile_trigger_repair.sql.
begin;

-- Accounts created by the legacy trigger may have been left as inactive
-- enumerators even though they signed up through the citizen portal.
update public.profiles p
set role = 'citizen', is_active = true
from auth.users u
where p.user_id = u.id
  and p.role = 'enumerator'
  and not p.is_active
  and u.raw_user_meta_data->>'account_type' = 'citizen';

create or replace function public.citizen_submission_individuals_valid(p_individuals jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_person jsonb;
  v_age text;
  v_date_of_birth text;
begin
  if jsonb_typeof(p_individuals) is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(p_individuals) = 0 then
    return false;
  end if;

  for v_person in select value from jsonb_array_elements(p_individuals)
  loop
    if jsonb_typeof(v_person) is distinct from 'object'
       or jsonb_typeof(v_person->'surname') is distinct from 'string'
       or length(btrim(v_person->>'surname')) = 0
       or jsonb_typeof(v_person->'firstname') is distinct from 'string'
       or length(btrim(v_person->>'firstname')) = 0
       or coalesce(v_person->>'sex', '') not in ('male', 'female') then
      return false;
    end if;

    if v_person ? 'age' and jsonb_typeof(v_person->'age') <> 'null' then
      if jsonb_typeof(v_person->'age') is distinct from 'number' then
        return false;
      end if;
      v_age := v_person->>'age';
      if length(v_age) > 3 or v_age !~ '^[0-9]+$' then
        return false;
      end if;
      if v_age::integer not between 0 and 120 then
        return false;
      end if;
    end if;

    v_date_of_birth := v_person->>'date_of_birth';
    if nullif(v_date_of_birth, '') is not null then
      if v_date_of_birth !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        return false;
      end if;
      begin
        perform v_date_of_birth::date;
      exception
        when invalid_datetime_format or datetime_field_overflow then
          return false;
      end;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.citizen_submission_individuals_valid(jsonb) from public, anon;
grant execute on function public.citizen_submission_individuals_valid(jsonb) to authenticated;

create table public.citizen_submissions (
  submission_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  state text not null check (length(btrim(state)) > 0),
  lga text not null check (length(btrim(lga)) > 0),
  ward text not null check (length(btrim(ward)) > 0),
  address text not null check (length(btrim(address)) > 0),
  housing_type text,
  utilities jsonb not null default '{}'::jsonb
    check (jsonb_typeof(utilities) = 'object'),
  ownership_status text,
  individuals jsonb not null
    check (public.citizen_submission_individuals_valid(individuals)),
  consent_recorded boolean not null check (consent_recorded),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(user_id),
  reviewed_at timestamptz,
  ea_id uuid references public.enumeration_areas(ea_id),
  household_id uuid unique references public.households(household_id),
  submitted_at timestamptz not null default now(),
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null
      and ea_id is null and household_id is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null
      and ea_id is null and household_id is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null
      and ea_id is not null and household_id is not null)
  )
);

create index citizen_submissions_pending_idx
  on public.citizen_submissions(submitted_at desc)
  where status = 'pending';

alter table public.citizen_submissions enable row level security;

grant select on public.citizen_submissions to authenticated;
grant insert (
  user_id, state, lga, ward, address, housing_type, utilities,
  ownership_status, individuals, consent_recorded
) on public.citizen_submissions to authenticated;
grant update (status, reviewed_by, reviewed_at, ea_id, household_id)
  on public.citizen_submissions to authenticated;

create policy citizen_submissions_read on public.citizen_submissions
  for select to authenticated
  using (
    (user_id = (select auth.uid()) and (select role_of()) = 'citizen')
    or (select is_admin())
  );

create policy citizen_submissions_insert on public.citizen_submissions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select role_of()) = 'citizen'
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and ea_id is null
    and household_id is null
  );

create policy citizen_submissions_review on public.citizen_submissions
  for update to authenticated
  using ((select is_admin()) and status = 'pending')
  with check (
    (select is_admin())
    and status in ('approved', 'rejected')
    and reviewed_by = (select auth.uid())
    and reviewed_at is not null
  );

-- Approved submissions enter the existing census tables atomically.
create policy hh_admin_insert on public.households
  for insert to authenticated
  with check ((select is_admin()));
create policy in_admin_insert on public.individuals
  for insert to authenticated
  with check ((select is_admin()));
grant insert on public.households, public.individuals to authenticated;

create or replace function public.approve_citizen_submission(
  p_submission_id uuid,
  p_ea_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_submission public.citizen_submissions%rowtype;
  v_household_id uuid;
begin
  if (select is_admin()) is not true then
    raise exception 'Only an administrator can approve citizen submissions'
      using errcode = '42501';
  end if;

  select s.* into v_submission
  from public.citizen_submissions s
  where s.submission_id = p_submission_id
  for update;

  if not found then
    raise exception 'Citizen submission not found' using errcode = 'P0002';
  end if;
  if v_submission.status <> 'pending' then
    raise exception 'Citizen submission has already been reviewed'
      using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.enumeration_areas e
    where e.ea_id = p_ea_id
      and lower(btrim(e.state)) = lower(btrim(v_submission.state))
      and lower(btrim(e.lga)) = lower(btrim(v_submission.lga))
      and lower(btrim(e.ward)) = lower(btrim(v_submission.ward))
  ) then
    raise exception 'Choose an enumeration area matching the submitted state, LGA and ward'
      using errcode = '23514';
  end if;

  insert into public.households (
    client_id, ea_id, address, housing_type, utilities, ownership_status,
    consent_recorded, consent_at, registered_by
  )
  values (
    gen_random_uuid(), p_ea_id, v_submission.address, v_submission.housing_type,
    v_submission.utilities, v_submission.ownership_status, true,
    v_submission.submitted_at, v_submission.user_id
  )
  returning household_id into v_household_id;

  insert into public.individuals (
    household_id, surname, firstname, sex, date_of_birth, age,
    relationship_to_head, education_level, occupation, disability_status,
    registered_by
  )
  select
    v_household_id, x.surname, x.firstname, x.sex,
    nullif(x.date_of_birth, '')::date, x.age, x.relationship_to_head,
    x.education_level, x.occupation, x.disability_status, v_submission.user_id
  from jsonb_to_recordset(v_submission.individuals) as x(
    surname text, firstname text, sex text, date_of_birth text, age integer,
    relationship_to_head text, education_level text, occupation text,
    disability_status text
  );

  update public.citizen_submissions
  set status = 'approved',
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      ea_id = p_ea_id,
      household_id = v_household_id
  where submission_id = p_submission_id;

  return v_household_id;
end;
$$;

revoke all on function public.approve_citizen_submission(uuid, uuid) from public, anon;
grant execute on function public.approve_citizen_submission(uuid, uuid) to authenticated;

-- Keep the admin account list and citizen review queue current while open.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'citizen_submissions'
    ) then
      alter publication supabase_realtime add table public.citizen_submissions;
    end if;
  end if;
end;
$$;

commit;

-- Verify after running:
-- select p.user_id, p.full_name, p.role, p.is_active
-- from public.profiles p
-- order by p.created_at desc;
