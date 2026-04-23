create extension if not exists pgcrypto;

create table if not exists public.residents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  full_name text not null,
  status text not null default 'active' check (status in ('active','draft','archived')),
  created_by uuid null,
  personal_code text null,
  birth_date date null,
  phone text null,
  email text null,
  address text null,
  internal_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resident_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  resident_id uuid not null references public.residents(id) on delete cascade,
  employee_user_id uuid not null,
  assigned_date date not null default current_date,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (resident_id, employee_user_id, assigned_date)
);

create table if not exists public.resident_recurring_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  resident_id uuid not null references public.residents(id) on delete cascade,
  title text not null,
  description text null,
  activity_type text not null default 'care',
  frequency_type text not null check (frequency_type in ('daily','weekly','selected_weekdays')),
  weekdays int[] null,
  times_per_day int not null default 1,
  preferred_time time null,
  assigned_user_id uuid null,
  is_active boolean not null default true,
  start_date date not null default current_date,
  end_date date null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  resident_id uuid not null references public.residents(id) on delete cascade,
  recurring_activity_id uuid null references public.resident_recurring_activities(id) on delete set null,
  title text not null,
  description text null,
  task_date date not null,
  status text not null default 'pending' check (status in ('pending','done','skipped')),
  assigned_user_id uuid null,
  completed_by uuid null,
  completed_at timestamptz null,
  completion_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_residents_org on public.residents(organization_id);
create index if not exists idx_resident_assignments_org_user on public.resident_assignments(organization_id, employee_user_id);
create index if not exists idx_recurring_activities_org on public.resident_recurring_activities(organization_id);
create index if not exists idx_care_tasks_org_date on public.care_tasks(organization_id, task_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_residents_updated_at on public.residents;
create trigger trg_residents_updated_at before update on public.residents
for each row execute function public.set_updated_at();

drop trigger if exists trg_resident_recurring_activities_updated_at on public.resident_recurring_activities;
create trigger trg_resident_recurring_activities_updated_at before update on public.resident_recurring_activities
for each row execute function public.set_updated_at();

drop trigger if exists trg_care_tasks_updated_at on public.care_tasks;
create trigger trg_care_tasks_updated_at before update on public.care_tasks
for each row execute function public.set_updated_at();
