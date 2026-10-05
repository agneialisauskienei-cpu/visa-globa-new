create extension if not exists pgcrypto;

create table if not exists public.system_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists system_admins_email_unique
  on public.system_admins (lower(email));

alter table public.system_admins enable row level security;

drop policy if exists system_admins_read_own_email on public.system_admins;
create policy system_admins_read_own_email
on public.system_admins
for select
using (lower(email) = lower(coalesce(auth.email(), '')) and is_active = true);

insert into public.system_admins (email, is_active)
values
  ('admin@visagloba.lt', true),
  ('agne@visagloba.lt', true)
on conflict (email) do update
set
  is_active = excluded.is_active,
  updated_at = now();
