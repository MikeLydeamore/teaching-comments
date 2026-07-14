alter table public.qwt_sessions
  add column if not exists submissions_screening_enabled boolean;

update public.qwt_sessions
set submissions_screening_enabled = false
where submissions_screening_enabled is null;

alter table public.qwt_sessions
  alter column submissions_screening_enabled set default false;

alter table public.qwt_sessions
  alter column submissions_screening_enabled set not null;
