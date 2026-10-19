-- ACDMS migration 009: refresh normalized geography after EA imports.
-- Run after 008_citizen_routing.sql whenever enumeration_areas were imported
-- after migration 002, or when the lookup tables are empty.

begin;

insert into public.states(name)
select distinct nullif(btrim(ea.state), '')
from public.enumeration_areas ea
where nullif(btrim(ea.state), '') is not null
on conflict (name) do nothing;

insert into public.lgas(state_id, name)
select distinct s.state_id, nullif(btrim(ea.lga), '')
from public.enumeration_areas ea
join public.states s on s.name = btrim(ea.state)
where nullif(btrim(ea.lga), '') is not null
on conflict (state_id, name) do nothing;

insert into public.wards(lga_id, name)
select distinct l.lga_id, nullif(btrim(ea.ward), '')
from public.enumeration_areas ea
join public.states s on s.name = btrim(ea.state)
join public.lgas l on l.state_id = s.state_id and l.name = btrim(ea.lga)
where nullif(btrim(ea.ward), '') is not null
on conflict (lga_id, name) do nothing;

update public.enumeration_areas ea
set ward_id = w.ward_id
from public.states s
join public.lgas l on l.state_id = s.state_id
join public.wards w on w.lga_id = l.lga_id
where s.name = btrim(ea.state)
  and l.name = btrim(ea.lga)
  and w.name = btrim(ea.ward)
  and (ea.ward_id is null or ea.ward_id <> w.ward_id);

grant select on public.states, public.lgas, public.wards to anon, authenticated;

drop policy if exists geo_public_read_states on public.states;
drop policy if exists geo_public_read_lgas on public.lgas;
drop policy if exists geo_public_read_wards on public.wards;
create policy geo_public_read_states on public.states for select to anon using (true);
create policy geo_public_read_lgas on public.lgas for select to anon using (true);
create policy geo_public_read_wards on public.wards for select to anon using (true);

commit;
