create extension if not exists pgcrypto;

create table if not exists public.qwt_teacher_spaces (
  code text primary key check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  pin_hash text not null check (char_length(pin_hash) between 8 and 300),
  created_at timestamptz not null default now()
);

create table if not exists public.qwt_sessions (
  code text primary key check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  space_code text not null default 'default' references public.qwt_teacher_spaces(code) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  prompt text not null check (char_length(prompt) between 5 and 1200),
  is_open boolean not null default true,
  group_questions_screening_enabled boolean not null default false,
  submissions_screening_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  prompt_updated_at timestamptz not null default now(),
  timer_duration_seconds integer not null default 0 check (timer_duration_seconds between 0 and 3600),
  timer_ends_at timestamptz
);

create table if not exists public.qwt_question_bank (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.qwt_sessions(code) on delete cascade,
  title text not null check (char_length(title) between 1 and 1200),
  text text not null check (char_length(text) between 5 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qwt_prompt_history (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.qwt_sessions(code) on delete cascade,
  prompt text not null check (char_length(prompt) between 5 and 1200),
  started_at timestamptz not null,
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);

create table if not exists public.qwt_group_questions (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.qwt_sessions(code) on delete cascade,
  student_name text not null default 'Anonymous' check (char_length(student_name) between 1 and 80),
  text text not null check (char_length(text) between 5 and 500),
  is_answered boolean not null default false,
  is_visible boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qwt_group_question_votes (
  question_id uuid not null references public.qwt_group_questions(id) on delete cascade,
  voter_id text not null check (char_length(voter_id) between 8 and 120),
  created_at timestamptz not null default now(),
  primary key (question_id, voter_id)
);

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


create table if not exists public.qwt_submissions (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.qwt_sessions(code) on delete cascade,
  student_name text not null default 'Anonymous' check (char_length(student_name) between 1 and 80),
  text text not null default '' check (char_length(text) <= 2000),
  drawing_data jsonb,
  gif_data jsonb,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  starred boolean not null default false,
  flagged boolean not null default false,
  version integer not null default 1 check (version >= 1),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qwt_submissions_text_or_media_check
    check (char_length(text) >= 1 or drawing_data is not null or gif_data is not null),
  constraint qwt_submissions_drawing_data_check
    check (drawing_data is null or jsonb_typeof(drawing_data) = 'object'),
  constraint qwt_submissions_gif_data_check
    check (gif_data is null or jsonb_typeof(gif_data) = 'object')
);

create index if not exists qwt_submissions_session_created_idx
  on public.qwt_submissions (session_code, created_at desc);

create index if not exists qwt_submissions_session_status_idx
  on public.qwt_submissions (session_code, status);

create index if not exists qwt_submissions_session_archived_created_idx
  on public.qwt_submissions (session_code, archived_at, created_at desc);

create index if not exists qwt_sessions_space_created_idx
  on public.qwt_sessions (space_code, created_at desc);

create unique index if not exists qwt_sessions_space_code_idx
  on public.qwt_sessions (space_code, code);

create index if not exists qwt_question_bank_session_title_idx
  on public.qwt_question_bank (session_code, title);

create index if not exists qwt_prompt_history_session_started_idx
  on public.qwt_prompt_history (session_code, started_at desc);

create index if not exists qwt_group_questions_session_created_idx
  on public.qwt_group_questions (session_code, created_at desc);

create index if not exists qwt_group_questions_session_answered_created_idx
  on public.qwt_group_questions (session_code, is_answered, created_at desc);

create index if not exists qwt_group_questions_session_visible_created_idx
  on public.qwt_group_questions (session_code, is_visible, created_at desc);

create index if not exists qwt_group_questions_session_archived_created_idx
  on public.qwt_group_questions (session_code, archived_at, created_at desc);

create index if not exists qwt_group_question_votes_voter_idx
  on public.qwt_group_question_votes (voter_id);

alter table public.qwt_teacher_spaces enable row level security;
alter table public.qwt_sessions enable row level security;
alter table public.qwt_submissions enable row level security;
alter table public.qwt_question_bank enable row level security;
alter table public.qwt_prompt_history enable row level security;
alter table public.qwt_group_questions enable row level security;
alter table public.qwt_group_question_votes enable row level security;

insert into public.qwt_teacher_spaces (code, name, pin_hash)
values ('default', 'Default Space', 'plain:teach123')
on conflict (code) do nothing;

insert into public.qwt_sessions (code, title, prompt, is_open)
values (
  'demo-lecture',
  'Demo Lecture',
  'In one or two sentences, explain what the p-value tells us in this setting.',
  true
)
on conflict (code) do nothing;

insert into public.qwt_prompt_history (
  id,
  session_code,
  prompt,
  started_at,
  ended_at
)
select
  '44444444-4444-4444-8444-444444444444',
  session.code,
  session.prompt,
  session.prompt_updated_at,
  null
from public.qwt_sessions as session
where session.code = 'demo-lecture'
on conflict (id) do nothing;

insert into public.qwt_question_bank (
  id,
  session_code,
  title,
  text
)
values (
  '33333333-3333-4333-8333-333333333333',
  'demo-lecture',
  'Explain p-values',
  'In one or two sentences, explain what the p-value tells us in this setting.'
)
on conflict (id) do nothing;

insert into public.qwt_submissions (
  id,
  session_code,
  student_name,
  text,
  status,
  starred,
  flagged,
  version
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'demo-lecture',
    'Anonymous',
    'There is no evidence against the null model, so the observed difference could be due to random variation.',
    'visible',
    false,
    false,
    1
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'demo-lecture',
    'Anonymous',
    'The p-value is 0.28, which is not small enough to suggest the bird type proportions are different.',
    'visible',
    true,
    false,
    1
  )
on conflict (id) do nothing;
