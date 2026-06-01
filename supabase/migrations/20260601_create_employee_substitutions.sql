create table if not exists public.employee_substitutions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  absent_user_id uuid not null,
  substitute_user_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'pending',
  reason text,
  source_vacation_request_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_substitutions_dates_check check (ends_on >= starts_on),
  constraint employee_substitutions_different_users_check check (absent_user_id <> substitute_user_id),
  constraint employee_substitutions_status_check check (status in ('pending', 'active', 'cancelled', 'expired'))
);

create index if not exists employee_substitutions_substitute_active_idx
  on public.employee_substitutions (organization_id, substitute_user_id, starts_on, ends_on)
  where status = 'active';

create index if not exists employee_substitutions_absent_active_idx
  on public.employee_substitutions (organization_id, absent_user_id, starts_on, ends_on)
  where status = 'active';

alter table public.employee_substitutions enable row level security;

drop policy if exists "employee_substitutions_select_org_members" on public.employee_substitutions;
create policy "employee_substitutions_select_org_members"
  on public.employee_substitutions
  for select
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = employee_substitutions.organization_id
        and om.user_id = auth.uid()
        and om.is_active is true
    )
  );

drop policy if exists "employee_substitutions_manage_admins" on public.employee_substitutions;
create policy "employee_substitutions_manage_admins"
  on public.employee_substitutions
  for all
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = employee_substitutions.organization_id
        and om.user_id = auth.uid()
        and om.is_active is true
        and om.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = employee_substitutions.organization_id
        and om.user_id = auth.uid()
        and om.is_active is true
        and om.role in ('owner', 'admin')
    )
  );
