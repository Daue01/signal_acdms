-- ACDMS schema: State > LGA > Ward > EA > Household > Individual (aligned to NPC hierarchy)
create extension if not exists pg_trgm;
create type user_role as enum ('administrator','supervisor','enumerator','citizen');

create table profiles(user_id uuid primary key references auth.users on delete cascade,
  full_name text not null, role user_role not null default 'enumerator',
  is_active boolean not null default true, created_at timestamptz default now());

create table enumeration_areas(ea_id uuid primary key default gen_random_uuid(),
  ea_code text unique not null, state text not null, lga text not null, ward text not null,
  assigned_enumerator_id uuid references profiles, supervisor_id uuid references profiles,
  target_households int not null default 120 check(target_households>0));

create table households(household_id uuid primary key default gen_random_uuid(),
  client_id uuid unique not null,               -- idempotency key from device
  ea_id uuid not null references enumeration_areas, address text not null,
  housing_type text, utilities jsonb default '{}', ownership_status text,
  consent_recorded boolean not null default false, -- NDPA 2023 lawful-basis record
  registered_by uuid references profiles, registered_at timestamptz default now(),
  sync_status text default 'synced');

create table individuals(individual_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  surname text not null, firstname text not null, sex text not null check(sex in('male','female')),
  date_of_birth date, age int check(age between 0 and 120), relationship_to_head text,
  education_level text, occupation text, disability_status text,
  registered_by uuid references profiles);

create table duplicate_flags(flag_id uuid primary key default gen_random_uuid(),
  kind text not null, record_id uuid not null, match_id uuid not null, reason text,
  status text not null default 'open' check(status in('open','confirmed','dismissed')),
  reviewed_by uuid references profiles, created_at timestamptz default now());
create table sync_log(sync_id uuid primary key default gen_random_uuid(),
  enumerator_id uuid references profiles, client_id uuid, at timestamptz default now(),
  status text not null default 'success' check(status in ('success','failed')),
  records_uploaded int not null default 0, records_failed int not null default 0,
  http_status int, error_code text, error_message text, device_info text);
create table audit_log(audit_id bigserial primary key, table_name text, record_id text,
  action text, changed_by uuid default auth.uid(), changed_at timestamptz default now(),
  old_values jsonb, new_values jsonb);

create index on households(ea_id); create index on individuals(household_id);
create index on individuals(lower(surname),lower(firstname),date_of_birth);
create index on households using gin(address gin_trgm_ops);

-- helpers (security definer avoids RLS recursion)
create function public.role_of() returns user_role language sql stable security definer as
$$select role from profiles where user_id=auth.uid() and is_active$$;
create function public.is_admin() returns boolean language sql stable as $$select role_of()='administrator'$$;

-- audit
create function log_change() returns trigger language plpgsql security definer as $$
begin insert into audit_log(table_name,record_id,action,old_values,new_values)
 values(TG_TABLE_NAME,coalesce((to_jsonb(new)->>TG_ARGV[0]),(to_jsonb(old)->>TG_ARGV[0])),TG_OP,
 case when TG_OP<>'INSERT' then to_jsonb(old) end, case when TG_OP<>'DELETE' then to_jsonb(new) end);
 return null; end $$;
create trigger a1 after insert or update or delete on households for each row execute function log_change('household_id');
create trigger a2 after insert or update or delete on individuals for each row execute function log_change('individual_id');
create trigger a3 after insert or update or delete on enumeration_areas for each row execute function log_change('ea_id');
create trigger a4 after insert or update or delete on profiles for each row execute function log_change('user_id');

-- duplicate flagging (never rejects; flags for review)
create function flag_dup_individual() returns trigger language plpgsql security definer as $$
declare m uuid; begin
 select individual_id into m from individuals where individual_id<>new.individual_id
  and lower(surname)=lower(new.surname) and lower(firstname)=lower(new.firstname)
  and date_of_birth is not null and date_of_birth=new.date_of_birth limit 1;
 if m is not null then insert into duplicate_flags(kind,record_id,match_id,reason)
  values('individual',new.individual_id,m,'Same surname, first name and date of birth'); end if;
 return null; end $$;
create trigger d1 after insert on individuals for each row execute function flag_dup_individual();
create function flag_dup_household() returns trigger language plpgsql security definer as $$
declare m uuid; begin
 select household_id into m from households where household_id<>new.household_id
  and ea_id=new.ea_id and similarity(address,new.address)>0.8 limit 1;
 if m is not null then insert into duplicate_flags(kind,record_id,match_id,reason)
  values('household',new.household_id,m,'Same EA and similar address'); end if;
 return null; end $$;
create trigger d2 after insert on households for each row execute function flag_dup_household();

create view ea_progress with(security_invoker=true) as
select ea.ea_id,ea.ea_code,ea.state,ea.lga,ea.ward,p.full_name enumerator,ea.target_households,
 count(distinct h.household_id) registered_households,count(i.individual_id) individuals,
 round(100.0*count(distinct h.household_id)/ea.target_households,1) pct
from enumeration_areas ea left join profiles p on p.user_id=ea.assigned_enumerator_id
left join households h on h.ea_id=ea.ea_id left join individuals i on i.household_id=h.household_id
group by ea.ea_id,p.full_name;

-- RLS
alter table profiles enable row level security; alter table enumeration_areas enable row level security;
alter table households enable row level security; alter table individuals enable row level security;
alter table duplicate_flags enable row level security; alter table sync_log enable row level security;
alter table audit_log enable row level security;
create policy p_self on profiles for select to authenticated using(user_id=auth.uid() or role_of() in('administrator','supervisor'));
create policy p_admin on profiles for all to authenticated using(is_admin()) with check(is_admin());
create policy ea_read on enumeration_areas for select to authenticated using(assigned_enumerator_id=auth.uid() or supervisor_id=auth.uid() or is_admin());
create policy ea_admin on enumeration_areas for all to authenticated using(is_admin()) with check(is_admin());
create policy hh_read on households for select to authenticated using(is_admin() or exists(select 1 from enumeration_areas e where e.ea_id=households.ea_id and (e.assigned_enumerator_id=auth.uid() or e.supervisor_id=auth.uid())));
create policy hh_ins on households for insert to authenticated with check(registered_by=auth.uid() and exists(select 1 from enumeration_areas e where e.ea_id=households.ea_id and e.assigned_enumerator_id=auth.uid()));
create policy in_read on individuals for select to authenticated using(exists(select 1 from households h where h.household_id=individuals.household_id));
create policy in_ins on individuals for insert to authenticated with check(registered_by=auth.uid() and exists(select 1 from households h where h.household_id=individuals.household_id and h.registered_by=auth.uid()));
create policy df_admin on duplicate_flags for all to authenticated using(role_of() in('administrator','supervisor')) with check(role_of() in('administrator','supervisor'));
create policy sl_ins on sync_log for insert to authenticated with check(enumerator_id=auth.uid());
create policy sl_read on sync_log for select to authenticated using(is_admin() or enumerator_id=auth.uid());
create policy al_read on audit_log for select to authenticated using(is_admin());

-- Server-observed sync failures are logged through a narrowly scoped function
-- so inactive/wrong-role users can be diagnosed without receiving data access.
create function public.log_sync_attempt(
  p_client_id uuid, p_status text, p_records_uploaded int default 0,
  p_records_failed int default 0, p_http_status int default null,
  p_error_code text default null, p_error_message text default null,
  p_device_info text default null
) returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_status not in ('success','failed') then raise exception 'Invalid sync status' using errcode = '22023'; end if;
  insert into public.sync_log(enumerator_id,client_id,status,records_uploaded,records_failed,http_status,error_code,error_message,device_info)
  values(auth.uid(),p_client_id,p_status,greatest(coalesce(p_records_uploaded,0),0),greatest(coalesce(p_records_failed,0),0),p_http_status,left(p_error_code,120),left(p_error_message,1000),left(p_device_info,500));
end $$;
revoke all on function public.log_sync_attempt(uuid,text,int,int,int,text,text,text) from public, anon;
grant execute on function public.log_sync_attempt(uuid,text,int,int,int,text,text,text) to authenticated;
