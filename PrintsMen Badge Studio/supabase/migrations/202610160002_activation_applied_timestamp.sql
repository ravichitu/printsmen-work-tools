-- Adds device-reported activation time and safely bootstraps the first owner.
-- Apply after 202610160001_cloud_licence_and_device_sync.sql.

alter table public.installations
  add column if not exists client_activated_at timestamptz;

drop function if exists public.printsmen_report_installation(uuid, text, text, text, text);

create or replace function public.printsmen_report_installation(
  p_install_id uuid,
  p_device_hash text,
  p_app_version text,
  p_platform text,
  p_activation_mode text,
  p_client_activated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  reported_at timestamptz := now();
  saved_install_id uuid;
begin
  if (select auth.uid()) is null or not public.printsmen_is_active_user() then
    raise exception 'An active PrintsMen account is required';
  end if;
  if p_install_id is null or coalesce(p_device_hash, '') !~ '^[0-9a-f]{64}$'
     or char_length(coalesce(p_app_version, '')) > 40
     or char_length(coalesce(p_platform, '')) > 40
     or coalesce(p_activation_mode, '') not in ('online', 'offline') then
    raise exception 'Invalid installation report';
  end if;

  insert into public.installations (
    user_id, install_id, device_hash, app_version, platform, activation_mode,
    install_state, notice_accepted_at, first_seen_at, last_reported_at, client_activated_at
  ) values (
    (select auth.uid()), p_install_id, p_device_hash, coalesce(p_app_version, ''),
    coalesce(p_platform, ''), p_activation_mode, 'pending', reported_at, reported_at, reported_at, p_client_activated_at
  )
  on conflict (install_id) do update
    set user_id = excluded.user_id, last_reported_at = reported_at,
        client_activated_at = coalesce(excluded.client_activated_at, public.installations.client_activated_at)
    where public.installations.device_hash = excluded.device_hash
  returning install_id into saved_install_id;

  if saved_install_id is null then
    raise exception 'Installation identifier is already registered to another device';
  end if;
  return reported_at;
end;
$$;

revoke all on function public.printsmen_report_installation(uuid, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.printsmen_report_installation(uuid, text, text, text, text, timestamptz) to authenticated;
