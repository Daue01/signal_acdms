-- Centralise EA assignment so the administrator and state-administrator screens
-- use the same validation and receive a useful error when nothing is updated.
begin;

create or replace function public.assign_enumeration_areas(
  p_enumerator_id uuid,
  p_ea_ids uuid[]
) returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_enumerator_state smallint;
  v_state_name text;
  v_requested int;
  v_distinct int;
  v_updated int;
begin
  v_role := public.role_of();
  if v_role is null or v_role not in ('administrator', 'state_admin') then
    raise exception 'Only an administrator or state administrator can assign areas'
      using errcode = '42501';
  end if;

  v_requested := coalesce(cardinality(p_ea_ids), 0);
  if v_requested = 0 then
    raise exception 'Select at least one enumeration area' using errcode = '22023';
  end if;

  select count(distinct item)
    into v_distinct
  from unnest(p_ea_ids) as items(item);
  if v_distinct <> v_requested then
    raise exception 'An enumeration area was selected more than once' using errcode = '22023';
  end if;

  select p.state_id
    into v_enumerator_state
  from public.profiles p
  where p.user_id = p_enumerator_id
    and p.role in ('enumerator', 'state_admin')
    and p.is_active;
  if not found then
    raise exception 'The selected account is not an active enumerator'
      using errcode = '23514';
  end if;
  if v_enumerator_state is null then
    raise exception 'Assign the enumerator to a state before assigning areas'
      using errcode = '23514';
  end if;

  if v_role = 'state_admin'
     and (public.state_id_of() is null or v_enumerator_state <> public.state_id_of()) then
    raise exception 'You can only assign areas to an enumerator in your state'
      using errcode = '42501';
  end if;

  select s.name into v_state_name
  from public.states s
  where s.state_id = v_enumerator_state;
  if v_state_name is null then
    raise exception 'The enumerator state is not available in the geography table'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.enumeration_areas ea
    where ea.ea_id = any(p_ea_ids)
      and lower(btrim(ea.state)) <> lower(btrim(v_state_name))
  ) then
    raise exception 'All selected areas must belong to the enumerator''s state'
      using errcode = '23514';
  end if;

  update public.enumeration_areas ea
  set assigned_enumerator_id = p_enumerator_id
  where ea.ea_id = any(p_ea_ids);
  get diagnostics v_updated = row_count;

  if v_updated <> v_requested then
    raise exception 'One or more selected enumeration areas no longer exists'
      using errcode = 'P0002';
  end if;
  return v_updated;
end;
$$;

revoke all on function public.assign_enumeration_areas(uuid, uuid[]) from public, anon;
grant execute on function public.assign_enumeration_areas(uuid, uuid[]) to authenticated;

commit;
