create table if not exists public.qwt_polls (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.qwt_sessions(code) on delete cascade,
  question text not null check (char_length(question) between 1 and 500),
  selection_mode text not null check (selection_mode in ('single', 'multiple')),
  options jsonb not null check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 8
  ),
  status text not null default 'active' check (status in ('active', 'ended')),
  duration_seconds integer not null check (duration_seconds >= 5),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > started_at)
);

create table if not exists public.qwt_poll_responses (
  poll_id uuid not null references public.qwt_polls(id) on delete cascade,
  participant_id text not null check (char_length(participant_id) between 8 and 120),
  option_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(option_ids) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (poll_id, participant_id)
);

create index if not exists qwt_polls_session_started_idx
  on public.qwt_polls (session_code, started_at desc);

create unique index if not exists qwt_polls_one_active_per_session_idx
  on public.qwt_polls (session_code)
  where status = 'active';

create index if not exists qwt_poll_responses_poll_updated_idx
  on public.qwt_poll_responses (poll_id, updated_at desc);

alter table public.qwt_polls enable row level security;
alter table public.qwt_poll_responses enable row level security;

