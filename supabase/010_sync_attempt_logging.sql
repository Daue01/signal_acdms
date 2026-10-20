-- ACDMS migration 010: centrally record server-observed sync attempts.
-- Offline/network failures cannot be logged centrally until connectivity
-- returns; the client queue remains the source of truth for those failures.
begin;

alter table public.sync_log
  add column if not exists client_id uuid,
  add column if not exists status text not null default 'success',
  add column if not exists http_status int,
  add column if not exists error_code text,
  add column if not exists error_message text;

alter table public.sync_log
  drop constraint if exists sync_log_status_check;
alter table public.sync_log
  add constraint sync_log_status_check
  check (status in ('success', 'failed')) not valid;

create index if not exists sync_log_status_at_idx
  on public.sync_log(status, at desc);
create index if not exists sync_log_client_id_idx
  on public.sync_log(client_id);

-- This is intentionally a tightly-scoped SECURITY DEFINER function: it only
-- inserts a row attributed to the current authenticated user. It lets the
-- API record failures caused by inactive/wrong-role accounts even though the
-- normal table INSERT policy correctly denies those accounts.
create or replace function public.log_sync_attempt(
  p_client_id uuid,
  p_status text,
  p_records_uploaded int default 0,
  p_records_failed int default 0,
  p_http_status int default null,
  p_error_code text default null,
  p_error_message text default null,
  p_device_info text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_status not in ('success', 'failed') then
    raise exception 'Invalid sync status' using errcode = '22023';
  end if;

  insert into public.sync_log(
    enumerator_id, client_id, status, records_uploaded, records_failed,
    http_status, error_code, error_message, device_info)
  values (
    auth.uid(), p_client_id, p_status, greatest(coalesce(p_records_uploaded, 0), 0),
    greatest(coalesce(p_records_failed, 0), 0), p_http_status,
    left(p_error_code, 120), left(p_error_message, 1000), left(p_device_info, 500));
end;
$$;

revoke all on function public.log_sync_attempt(uuid, text, int, int, int, text, text, text)
  from public, anon;
grant execute on function public.log_sync_attempt(uuid, text, int, int, int, text, text, text)
  to authenticated;

commit;
