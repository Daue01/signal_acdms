-- ACDMS migration 011: explicit provenance and official-code keys for geography imports.
-- The import utility refuses to infer these values from names or working codes.
begin;

alter table public.states add column if not exists official_code text;
alter table public.states add column if not exists reference_code text;
alter table public.states add column if not exists record_type text;
alter table public.states add column if not exists identifier_source text;
alter table public.lgas add column if not exists official_code text;
alter table public.lgas add column if not exists reference_code text;
alter table public.lgas add column if not exists record_type text;
alter table public.lgas add column if not exists identifier_source text;
alter table public.wards add column if not exists official_code text;
alter table public.wards add column if not exists reference_code text;
alter table public.wards add column if not exists record_type text;
alter table public.wards add column if not exists identifier_source text;
alter table public.enumeration_areas add column if not exists official_code text;
alter table public.enumeration_areas add column if not exists reference_code text;
alter table public.enumeration_areas add column if not exists ea_name text;
alter table public.enumeration_areas add column if not exists record_type text;
alter table public.enumeration_areas add column if not exists identifier_source text;

create unique index if not exists states_official_code_uq on public.states(official_code);
create unique index if not exists states_reference_code_uq on public.states(reference_code);
create unique index if not exists lgas_official_code_uq on public.lgas(official_code);
create unique index if not exists lgas_reference_code_uq on public.lgas(reference_code);
create unique index if not exists wards_official_code_uq on public.wards(official_code);
create unique index if not exists wards_reference_code_uq on public.wards(reference_code);
create unique index if not exists enumeration_areas_official_code_uq on public.enumeration_areas(official_code);
create unique index if not exists enumeration_areas_reference_code_uq on public.enumeration_areas(reference_code);

commit;
