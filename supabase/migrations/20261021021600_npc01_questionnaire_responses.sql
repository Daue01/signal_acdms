begin;

alter table public.households
  add column if not exists census_responses jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.households'::regclass
      and conname = 'households_census_responses_object'
  ) then
    alter table public.households
      add constraint households_census_responses_object
      check (jsonb_typeof(census_responses) = 'object') not valid;
  end if;
end;
$$;
alter table public.households
  validate constraint households_census_responses_object;

alter table public.individuals
  add column if not exists census_responses jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.individuals'::regclass
      and conname = 'individuals_census_responses_object'
  ) then
    alter table public.individuals
      add constraint individuals_census_responses_object
      check (jsonb_typeof(census_responses) = 'object') not valid;
  end if;
end;
$$;
alter table public.individuals
  validate constraint individuals_census_responses_object;

create or replace function public.submit_household(
  p_client_id uuid,
  p_household jsonb,
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

  insert into public.households(
    client_id, ea_id, address, housing_type, utilities, ownership_status,
    consent_recorded, consent_at, registered_by, census_responses
  )
  values (
    p_client_id,
    (p_household->>'ea_id')::uuid,
    p_household->>'address',
    p_household->>'housing_type',
    coalesce(p_household->'utilities', '{}'::jsonb),
    p_household->>'ownership_status',
    true,
    coalesce((p_household->>'consent_at')::timestamptz, now()),
    auth.uid(),
    coalesce(nullif(p_household->'census_responses', 'null'::jsonb), '{}'::jsonb)
  )
  on conflict (client_id) do nothing
  returning household_id into v_hh;

  if v_hh is null then
    select household_id into v_hh
    from public.households
    where client_id = p_client_id;
    return v_hh;
  end if;

  insert into public.individuals(
    household_id, surname, firstname, sex, date_of_birth, age,
    relationship_to_head, education_level, occupation, disability_status,
    registered_by, census_responses
  )
  select v_hh, x.surname, x.firstname, x.sex, nullif(x.date_of_birth, '')::date,
         x.age, x.relationship_to_head, x.education_level, x.occupation,
         x.disability_status, auth.uid(),
         coalesce(x.census_responses, '{}'::jsonb)
  from jsonb_to_recordset(p_individuals) as x(
    surname text, firstname text, sex text, date_of_birth text, age int,
    relationship_to_head text, education_level text, occupation text,
    disability_status text, census_responses jsonb
  );

  return v_hh;
end;
$$;

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
  if p_action not in ('approve', 'reject', 'correction_requested') then
    raise exception 'Invalid review action' using errcode = '22023';
  end if;
  select * into s
  from public.citizen_submissions
  where submission_id = p_submission_id
  for update;
  if not found then raise exception 'Submission not found' using errcode = 'P0002'; end if;
  if s.status <> 'pending_enumerator' then
    raise exception 'Submission is not awaiting enumerator review' using errcode = '23514';
  end if;
  if (select role_of()) <> 'enumerator'
     or s.assigned_enumerator_id <> (select auth.uid()) then
    raise exception 'Submission is not assigned to this enumerator' using errcode = '42501';
  end if;

  if p_action = 'approve' then
    insert into public.households(
      client_id, ea_id, address, housing_type, utilities, ownership_status,
      consent_recorded, consent_at, registered_by, census_responses
    )
    values (
      gen_random_uuid(), s.resolved_ea_id, s.address, s.housing_type, s.utilities,
      s.ownership_status, true, s.submitted_at, (select auth.uid()),
      coalesce(nullif(s.payload->'census_responses', 'null'::jsonb), '{}'::jsonb)
    )
    returning household_id into v_household;

    insert into public.individuals(
      household_id, surname, firstname, sex, date_of_birth, age,
      relationship_to_head, education_level, occupation, disability_status,
      registered_by, census_responses
    )
    select v_household, x.surname, x.firstname, x.sex,
           nullif(x.date_of_birth, '')::date, x.age, x.relationship_to_head,
           x.education_level, x.occupation, x.disability_status,
           (select auth.uid()), coalesce(x.census_responses, '{}'::jsonb)
    from jsonb_to_recordset(s.individuals) as x(
      surname text, firstname text, sex text, date_of_birth text,
      age integer, relationship_to_head text, education_level text,
      occupation text, disability_status text, census_responses jsonb
    );

    insert into public.household_indicators(
      household_id, electricity_access_type, electricity_hours_per_day,
      water_source, water_fetch_minutes, cars_owned, income_band
    )
    values (
      v_household, nullif(s.payload->>'electricity_access_type',''),
      nullif(s.payload->>'electricity_hours_per_day','')::numeric,
      nullif(s.payload->>'water_source',''),
      nullif(s.payload->>'water_fetch_minutes','')::int,
      coalesce(nullif(s.payload->>'cars_owned','')::int,0),
      nullif(s.payload->>'income_band','')
    );

    update public.citizen_submissions
    set status='approved', ea_id=s.resolved_ea_id, household_id=v_household,
        reviewed_by=(select auth.uid()), reviewed_at=now(),
        review_note=p_review_note, status_changed_at=now(), updated_at=now()
    where submission_id=s.submission_id;
  else
    update public.citizen_submissions
    set status=p_action, reviewed_by=(select auth.uid()), reviewed_at=now(),
        review_note=nullif(btrim(p_review_note), ''),
        status_changed_at=now(), updated_at=now()
    where submission_id=s.submission_id;
  end if;
  return p_action;
end;
$$;

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
  if not found then raise exception 'Citizen submission not found' using errcode = 'P0002'; end if;
  if v_submission.status <> 'pending' then
    raise exception 'Citizen submission has already been reviewed' using errcode = '23514';
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

  insert into public.households(
    client_id, ea_id, address, housing_type, utilities, ownership_status,
    consent_recorded, consent_at, registered_by, census_responses
  )
  values (
    gen_random_uuid(), p_ea_id, v_submission.address, v_submission.housing_type,
    v_submission.utilities, v_submission.ownership_status, true,
    v_submission.submitted_at, v_submission.user_id,
    coalesce(nullif(v_submission.payload->'census_responses', 'null'::jsonb), '{}'::jsonb)
  )
  returning household_id into v_household_id;

  insert into public.individuals(
    household_id, surname, firstname, sex, date_of_birth, age,
    relationship_to_head, education_level, occupation, disability_status,
    registered_by, census_responses
  )
  select
    v_household_id, x.surname, x.firstname, x.sex,
    nullif(x.date_of_birth, '')::date, x.age, x.relationship_to_head,
    x.education_level, x.occupation, x.disability_status,
    v_submission.user_id, coalesce(x.census_responses, '{}'::jsonb)
  from jsonb_to_recordset(v_submission.individuals) as x(
    surname text, firstname text, sex text, date_of_birth text, age integer,
    relationship_to_head text, education_level text, occupation text,
    disability_status text, census_responses jsonb
  );

  update public.citizen_submissions
  set status='approved', reviewed_by=(select auth.uid()), reviewed_at=now(),
      ea_id=p_ea_id, household_id=v_household_id
  where submission_id=p_submission_id;
  return v_household_id;
end;
$$;

commit;