create unique index if not exists personnel_credentials_active_unique_idx
  on public.personnel_credentials (
    organization_id,
    employee_id,
    type
  )
  where status = 'active';
