create extension if not exists pgcrypto;

create table if not exists public.work_schedule_entries (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  employee_id uuid not null,

  date date not null,

  start_datetime timestamptz,
  end_datetime timestamptz,

  status text not null default 'planned',
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_schedule_entries_org
  on public.work_schedule_entries (organization_id);

create index if not exists idx_work_schedule_entries_employee
  on public.work_schedule_entries (employee_id);

create index if not exists idx_work_schedule_entries_date
  on public.work_schedule_entries (date);

alter table public.work_schedule_entries enable row level security;

drop policy if exists "Members can view work schedule entries"
on public.work_schedule_entries;

create policy "Members can view work schedule entries"
on public.work_schedule_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = work_schedule_entries.organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
  )
);

drop policy if exists "Admins can manage work schedule entries"
on public.work_schedule_entries;

create policy "Admins can manage work schedule entries"
on public.work_schedule_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = work_schedule_entries.organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = work_schedule_entries.organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner', 'admin')
  )
);

create or replace function public.update_work_schedule_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_work_schedule_entries_updated_at
on public.work_schedule_entries;

create trigger trg_work_schedule_entries_updated_at
before update on public.work_schedule_entries
for each row
execute function public.update_work_schedule_entries_updated_at();
