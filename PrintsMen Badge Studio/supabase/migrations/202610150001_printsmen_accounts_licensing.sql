-- PrintsMen identity and licence registry. Apply using the Supabase SQL Editor.
create extension if not exists pgcrypto with schema extensions;

create type public.printsmen_role as enum ('owner', 'admin', 'operator');
create type public.printsmen_account_state as enum ('pending', 'active', 'disabled');
create type public.printsmen_licence_state as enum ('pending', 'active', 'expired', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.printsmen_role not null default 'operator',
  account_state public.printsmen_account_state not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_display_name_length check (char_length(display_name) <= 120)
);

create function public.printsmen_is_staff()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid())
    and p.account_state = 'active' and p.role in ('owner','admin'));
$$;

create function public.printsmen_is_active_user()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid())
    and p.account_state = 'active');
$$;

create function public.printsmen_is_owner()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid())
    and p.account_state = 'active' and p.role = 'owner');
$$;

create function public.printsmen_protect_profile_access()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.account_state is distinct from old.account_state)
     and not public.printsmen_is_owner() then
    raise exception 'Only the account owner can change roles or account access';
  end if;
  return new;
end;
$$;

create trigger printsmen_profile_access_guard
before update on public.profiles for each row execute function public.printsmen_protect_profile_access();

create function public.printsmen_create_profile()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger printsmen_auth_profile_created
after insert on auth.users for each row execute function public.printsmen_create_profile();

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  reference text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint client_company_name_length check (char_length(company_name) between 1 and 120),
  constraint client_details_length check (char_length(contact_name)<=120 and char_length(email)<=254 and char_length(phone)<=40 and char_length(address)<=600 and char_length(reference)<=80)
);

create table public.licences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  recovery_key_hash text unique check (recovery_key_hash is null or recovery_key_hash ~ '^[0-9a-f]{64}$'),
  allowed_tools text[] not null check (cardinality(allowed_tools)>0),
  installation_limit integer not null default 1 check (installation_limit between 1 and 100),
  licence_state public.printsmen_licence_state not null default 'pending',
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
);

create table public.installations (
  id uuid primary key default gen_random_uuid(),
  licence_id uuid references public.licences(id) on delete restrict,
  install_id uuid not null unique,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  app_version text not null default '',
  platform text not null default '',
  activation_mode text not null check (activation_mode in ('online','offline')),
  install_state text not null default 'pending' check (install_state in ('pending','approved','active','expired','revoked','unlicensed')),
  notice_accepted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  approved_at timestamptz,
  last_reported_at timestamptz,
  retired_at timestamptz,
  constraint install_metadata_length check (char_length(app_version)<=40 and char_length(platform)<=40)
);

create index installations_licence_id_idx on public.installations(licence_id);
create index installations_last_reported_idx on public.installations(last_reported_at desc);
create index licences_client_id_idx on public.licences(client_id);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.licences enable row level security;
alter table public.installations enable row level security;

create policy "users read own profile" on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy "staff read all profiles" on public.profiles for select to authenticated using (public.printsmen_is_staff());
create policy "users update own display name" on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy "owner manages access" on public.profiles for update to authenticated using (public.printsmen_is_owner()) with check (public.printsmen_is_owner());
create policy "staff manage clients" on public.clients for all to authenticated using (public.printsmen_is_staff()) with check (public.printsmen_is_staff());
create policy "staff manage licences" on public.licences for all to authenticated using (public.printsmen_is_staff()) with check (public.printsmen_is_staff());
create policy "staff read installations" on public.installations for select to authenticated using (public.printsmen_is_staff());

revoke all on public.profiles, public.clients, public.licences, public.installations from anon;
grant select on public.profiles to authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;
grant update (account_state, role) on public.profiles to authenticated;
grant select, insert, update, delete on public.clients, public.licences to authenticated;
grant select on public.installations to authenticated;
grant usage on type public.printsmen_role, public.printsmen_account_state, public.printsmen_licence_state to authenticated;

-- Activation and key issuance are server-side operations. Never grant table writes to anon clients.
