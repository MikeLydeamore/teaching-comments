create table if not exists public.qwt_prompt_history (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.qwt_sessions(code) on delete cascade,
  prompt text not null check (char_length(prompt) between 5 and 1200),
  started_at timestamptz not null,
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);

create index if not exists qwt_prompt_history_session_started_idx
  on public.qwt_prompt_history (session_code, started_at desc);

alter table public.qwt_prompt_history enable row level security;

insert into public.qwt_prompt_history (session_code, prompt, started_at, ended_at)
select
  session.code,
  session.prompt,
  session.prompt_updated_at,
  null
from public.qwt_sessions as session
where not exists (
  select 1
  from public.qwt_prompt_history as history
  where history.session_code = session.code
);
