alter table public.qwt_sessions
  add column if not exists timer_duration_seconds integer;

alter table public.qwt_sessions
  add column if not exists timer_ends_at timestamptz;

update public.qwt_sessions
set timer_duration_seconds = 0
where timer_duration_seconds is null;

alter table public.qwt_sessions
  alter column timer_duration_seconds set default 0;

alter table public.qwt_sessions
  alter column timer_duration_seconds set not null;

alter table public.qwt_sessions
  drop constraint if exists qwt_sessions_timer_duration_seconds_check;

alter table public.qwt_sessions
  add constraint qwt_sessions_timer_duration_seconds_check
  check (timer_duration_seconds between 0 and 3600);
