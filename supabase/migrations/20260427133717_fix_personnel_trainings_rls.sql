alter table public.personnel_trainings enable row level security;

drop policy if exists "members can read personnel trainings" on public.personnel_trainings;
drop policy if exists "members can insert personnel trainings" on public.personnel_trainings;
drop policy if exists "members can update personnel trainings" on public.personnel_trainings;
drop policy if exists "members can delete personnel trainings" on public.personnel_trainings;

create policy "members can read personnel trainings"
on public.personnel_trainings
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = personnel_trainings.organization_id
      and om.is_active = true
      and om.role in ('owner', 'admin', 'employee')
  )
);

create policy "members can insert personnel trainings"
on public.personnel_trainings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = personnel_trainings.organization_id
      and om.is_active = true
      and om.role in ('owner', 'admin', 'employee')
  )
);

create policy "members can update personnel trainings"
on public.personnel_trainings
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = personnel_trainings.organization_id
      and om.is_active = true
      and om.role in ('owner', 'admin', 'employee')
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = personnel_trainings.organization_id
      and om.is_active = true
      and om.role in ('owner', 'admin', 'employee')
  )
);

create policy "members can delete personnel trainings"
on public.personnel_trainings
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = personnel_trainings.organization_id
      and om.is_active = true
      and om.role in ('owner', 'admin', 'employee')
  )
);
