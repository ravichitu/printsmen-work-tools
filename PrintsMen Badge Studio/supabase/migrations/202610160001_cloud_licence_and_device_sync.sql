-- Adds consent-based installation reporting and owner-dashboard sync support.
-- Apply after 202610150001_printsmen_accounts_licensing.sql.

alter table public.installations
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

create index if not exists installations_user_id_idx on public.installations(user_id);

-- Allow the first owner to be bootstrapped from the SQL dashboard before any
-- owner exists, without allowing an authenticated user to promote themselves.
create or replace function public.printsmen_protect_profile_access()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.account_state is distinct from old.account_state)
     and not public.printsmen_is_owner()
     and not ((select auth.uid()) is null and not exists (
       select 1 from public.profiles p where p.role = 'owner' and p.account_state = 'active'
     )) then
    raise exception 'Only the account owner can change roles or account access';
  end if;
  return new;
end;
$$;

drop policy if exists "staff read installations" on public.installations;
drop policy if exists "staff manage installations" on public.installations;
drop policy if exists "users read own installations" on public.installations;

create policy "staff manage installations" on public.installations
  for all to authenticated
  using (public.printsmen_is_staff())
  with check (public.printsmen_is_staff());

create policy "users read own installations" on public.installations
  for select to authenticated
  using (user_id = (select auth.uid()) and public.printsmen_is_active_user());

grant select, insert, update, delete on public.installations to authenticated;

create or replace function public.printsmen_report_installation(
  p_install_id uuid,
  p_device_hash text,
  p_app_version text,
  p_platform text,
  p_activation_mode text
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
    install_state, notice_accepted_at, first_seen_at, last_reported_at
  ) values (
    (select auth.uid()), p_install_id, p_device_hash, coalesce(p_app_version, ''),
    coalesce(p_platform, ''), p_activation_mode, 'pending', reported_at, reported_at, reported_at
  )
  on conflict (install_id) do update
    set user_id = excluded.user_id, last_reported_at = reported_at
    where public.installations.device_hash = excluded.device_hash
  returning install_id into saved_install_id;

  if saved_install_id is null then
    raise exception 'Installation identifier is already registered to another device';
  end if;
  return reported_at;
end;
$$;

revoke all on function public.printsmen_report_installation(uuid, text, text, text, text) from public, anon;
grant execute on function public.printsmen_report_installation(uuid, text, text, text, text) to authenticated;
