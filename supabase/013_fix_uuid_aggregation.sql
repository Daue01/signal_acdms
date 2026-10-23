-- Fix PostgreSQL's lack of a min(uuid) aggregate.
-- Apply after 008_citizen_routing.sql; this only replaces the function body.
begin;

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

  select count(*), (array_agg(ea.ea_id order by ea.ea_id))[1] into v_matches, v_ea
  from public.enumeration_areas ea
  where ea.ward_id = p_ward_id
    and (nullif(btrim(p_locality), '') is null or lower(ea.ea_code) = lower(btrim(p_locality)));
  if v_matches <> 1 and p_latitude is not null and p_longitude is not null then
    select count(*), (array_agg(ea.ea_id order by ea.ea_id))[1] into v_matches, v_ea
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

commit;
