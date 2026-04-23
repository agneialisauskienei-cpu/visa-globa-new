alter table public.activity_sessions enable row level security;

drop policy if exists "members can insert activity sessions" on public.activity_sessions;

create policy "members can insert activity sessions"
on public.activity_sessions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = activity_sessions.organization_id
      and om.is_active = true
      and om.role in ('owner', 'admin', 'employee')
  )
);
