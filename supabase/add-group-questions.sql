create table if not exists public.qwt_group_questions (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.qwt_sessions(code) on delete cascade,
  student_name text not null default 'Anonymous' check (char_length(student_name) between 1 and 80),
  text text not null check (char_length(text) between 5 and 500),
  is_answered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qwt_group_questions
  add column if not exists is_answered boolean;

alter table public.qwt_group_questions
  add column if not exists student_name text;

update public.qwt_group_questions
set is_answered = false
where is_answered is null;

update public.qwt_group_questions
set student_name = 'Anonymous'
where student_name is null or char_length(trim(student_name)) = 0;

alter table public.qwt_group_questions
  alter column is_answered set default false;

alter table public.qwt_group_questions
  alter column is_answered set not null;

alter table public.qwt_group_questions
  alter column student_name set default 'Anonymous';

alter table public.qwt_group_questions
  alter column student_name set not null;

alter table public.qwt_group_questions
  drop constraint if exists qwt_group_questions_student_name_check;

alter table public.qwt_group_questions
  add constraint qwt_group_questions_student_name_check
  check (char_length(student_name) between 1 and 80);

create table if not exists public.qwt_group_question_votes (
  question_id uuid not null references public.qwt_group_questions(id) on delete cascade,
  voter_id text not null check (char_length(voter_id) between 8 and 120),
  created_at timestamptz not null default now(),
  primary key (question_id, voter_id)
);

create index if not exists qwt_group_questions_session_created_idx
  on public.qwt_group_questions (session_code, created_at desc);

create index if not exists qwt_group_questions_session_answered_created_idx
  on public.qwt_group_questions (session_code, is_answered, created_at desc);

create index if not exists qwt_group_question_votes_voter_idx
  on public.qwt_group_question_votes (voter_id);

alter table public.qwt_group_questions enable row level security;
alter table public.qwt_group_question_votes enable row level security;
