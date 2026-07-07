alter table public.qwt_sessions
  add column if not exists prompt_updated_at timestamptz;

update public.qwt_sessions
set prompt_updated_at = created_at
where prompt_updated_at is null;

alter table public.qwt_sessions
  alter column prompt_updated_at set default now();

alter table public.qwt_sessions
  alter column prompt_updated_at set not null;
