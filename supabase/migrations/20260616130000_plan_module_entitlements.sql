create table if not exists public.organization_modules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_key)
);

alter table public.organization_modules
  add column if not exists is_enabled boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

delete from public.organization_modules a
using public.organization_modules b
where a.ctid < b.ctid
  and a.organization_id = b.organization_id
  and a.module_key = b.module_key;

create unique index if not exists organization_modules_org_module_uidx
  on public.organization_modules (organization_id, module_key);

alter table public.subscriptions
  add column if not exists ends_at timestamptz;

delete from public.subscriptions a
using public.subscriptions b
where a.ctid < b.ctid
  and a.organization_id = b.organization_id
  and a.plan_code = b.plan_code;

create unique index if not exists subscriptions_org_plan_uidx
  on public.subscriptions (organization_id, plan_code);

with module_catalog(module_key) as (
  values
    ('employees'), ('tasks'), ('residents'), ('activities'), ('medicine'),
    ('rooms'), ('inventory'), ('handover'), ('reports'), ('audit')
),
desired as (
  select
    o.id as organization_id,
    m.module_key,
    case lower(coalesce(o.plan, 'basic'))
      when 'starter' then m.module_key in ('employees', 'tasks', 'residents', 'rooms')
      when 'basic' then m.module_key in (
        'employees', 'tasks', 'residents', 'activities', 'rooms', 'handover'
      )
      when 'pro' then m.module_key in (
        'employees', 'tasks', 'residents', 'activities', 'medicine',
        'rooms', 'inventory', 'handover', 'reports'
      )
      when 'enterprise' then true
      else m.module_key in (
        'employees', 'tasks', 'residents', 'activities', 'rooms', 'handover'
      )
    end as is_enabled
  from public.organizations o
  cross join module_catalog m
)
insert into public.organization_modules (
  organization_id,
  module_key,
  is_enabled,
  updated_at
)
select organization_id, module_key, is_enabled, now()
from desired
on conflict (organization_id, module_key)
do update set
  is_enabled = excluded.is_enabled,
  updated_at = excluded.updated_at;

insert into public.subscriptions (
  organization_id,
  plan_code,
  status,
  starts_at,
  ends_at
)
select
  o.id,
  lower(coalesce(o.plan, 'basic')),
  case when coalesce(o.status, 'active') = 'active' then 'active' else 'inactive' end,
  coalesce(o.created_at, now()),
  case when coalesce(o.status, 'active') = 'active' then null else now() end
from public.organizations o
on conflict (organization_id, plan_code)
do update set
  status = excluded.status,
  ends_at = excluded.ends_at;

alter table public.organization_modules enable row level security;

drop policy if exists "members can read organization modules"
  on public.organization_modules;
create policy "members can read organization modules"
  on public.organization_modules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_modules.organization_id
        and om.user_id = auth.uid()
        and om.is_active = true
    )
  );
