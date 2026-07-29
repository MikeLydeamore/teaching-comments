create table if not exists public.qwt_poll_question_bank (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.qwt_sessions(code) on delete cascade,
  title text,
  question text not null check (char_length(question) between 1 and 500),
  selection_mode text not null check (selection_mode in ('single', 'multiple')),
  options jsonb not null check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 8
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qwt_poll_question_bank
  add column if not exists title text;

update public.qwt_poll_question_bank
set title = question
where title is null or char_length(trim(title)) = 0;

alter table public.qwt_poll_question_bank
  alter column title set not null;

alter table public.qwt_poll_question_bank
  drop constraint if exists qwt_poll_question_bank_title_check;

alter table public.qwt_poll_question_bank
  add constraint qwt_poll_question_bank_title_check
  check (char_length(title) between 1 and 500);

create index if not exists qwt_poll_question_bank_session_title_idx
  on public.qwt_poll_question_bank (session_code, title);

alter table public.qwt_poll_question_bank enable row level security;
