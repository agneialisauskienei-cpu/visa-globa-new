create extension if not exists pgcrypto;

alter table public.candidate_questionnaires
  add column if not exists public_token text,
  add column if not exists public_token_expires_at timestamptz;

create unique index if not exists candidate_questionnaires_public_token_unique
  on public.candidate_questionnaires (public_token)
  where public_token is not null;

update public.candidate_questionnaires
set
  public_token = coalesce(public_token, gen_random_uuid()::text),
  public_token_expires_at = coalesce(public_token_expires_at, now() + interval '14 days')
where public_token is null;
