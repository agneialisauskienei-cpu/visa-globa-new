create unique index if not exists employee_tasks_recurring_instance_unique_idx
  on public.employee_tasks (
    organization_id,
    coalesce(assigned_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(resident_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(type, ''),
    title,
    due_date,
    interval_days
  )
  where interval_days is not null
    and interval_days > 0
    and status in ('new', 'in_progress', 'waiting_parts');
