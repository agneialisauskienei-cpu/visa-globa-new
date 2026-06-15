-- Tenant isolation and identity-flow integrity.
-- Policies are created only for tables present in the target environment.

create or replace function public.is_active_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
  );
$$;

create or replace function public.is_org_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner', 'admin')
  );
$$;

create unique index if not exists organization_members_org_user_unique
  on public.organization_members (organization_id, user_id);

create unique index if not exists organization_join_requests_one_pending
  on public.organization_join_requests (organization_id, user_id)
  where status = 'pending';

create unique index if not exists organization_invites_one_pending_email
  on public.organization_invites (organization_id, lower(email))
  where status = 'pending';

do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'residents',
    'resident_assignments',
    'resident_recurring_activities',
    'care_tasks',
    'activity_sessions',
    'activity_attendance',
    'employee_substitutions',
    'vacation_requests',
    'vacation_entitlements',
    'personnel_trainings',
    'personnel_credentials',
    'personnel_document_acknowledgements',
    'candidate_questionnaires',
    'candidates'
  ]
  loop
    if to_regclass('public.' || v_table_name) is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = v_table_name
           and column_name = 'organization_id'
       ) then
      execute format('alter table public.%I enable row level security', v_table_name);
      execute format('drop policy if exists tenant_members_select on public.%I', v_table_name);
      execute format(
        'create policy tenant_members_select on public.%I for select using (public.is_active_org_member(organization_id))',
        v_table_name
      );
      execute format('drop policy if exists tenant_admins_insert on public.%I', v_table_name);
      execute format(
        'create policy tenant_admins_insert on public.%I for insert with check (public.is_org_admin(organization_id))',
        v_table_name
      );
      execute format('drop policy if exists tenant_admins_update on public.%I', v_table_name);
      execute format(
        'create policy tenant_admins_update on public.%I for update using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id))',
        v_table_name
      );
      execute format('drop policy if exists tenant_admins_delete on public.%I', v_table_name);
      execute format(
        'create policy tenant_admins_delete on public.%I for delete using (public.is_org_admin(organization_id))',
        v_table_name
      );
    end if;
  end loop;
end
$$;

do $$
begin
  if to_regclass('public.care_tasks') is not null then
    drop policy if exists assigned_employee_updates_care_task on public.care_tasks;
    create policy assigned_employee_updates_care_task
    on public.care_tasks
    for update
    using (
      public.is_active_org_member(organization_id)
      and assigned_user_id = auth.uid()
    )
    with check (
      public.is_active_org_member(organization_id)
      and assigned_user_id = auth.uid()
    );
  end if;
end
$$;

alter table public.organization_invites enable row level security;
drop policy if exists org_admins_manage_invites on public.organization_invites;
create policy org_admins_manage_invites
on public.organization_invites
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

alter table public.organization_join_requests enable row level security;
drop policy if exists users_create_own_join_request on public.organization_join_requests;
create policy users_create_own_join_request
on public.organization_join_requests
for insert
with check (user_id = auth.uid());

drop policy if exists users_read_own_or_admin_join_request on public.organization_join_requests;
create policy users_read_own_or_admin_join_request
on public.organization_join_requests
for select
using (user_id = auth.uid() or public.is_org_admin(organization_id));

drop policy if exists admins_update_join_request on public.organization_join_requests;
create policy admins_update_join_request
on public.organization_join_requests
for update
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));
