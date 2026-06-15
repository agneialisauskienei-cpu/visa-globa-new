alter table public.vacation_requests
  add column if not exists substitute_user_id uuid null,
  add column if not exists handover_note text null,
  add column if not exists vacation_pay_method text not null default 'with_salary';

alter table public.vacation_requests
  drop constraint if exists vacation_requests_pay_method_check;

alter table public.vacation_requests
  add constraint vacation_requests_pay_method_check
  check (vacation_pay_method in ('with_salary', 'before_vacation'));

create index if not exists vacation_requests_substitute_idx
  on public.vacation_requests (organization_id, substitute_user_id, start_date, end_date);
