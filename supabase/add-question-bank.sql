create table if not exists public.qwt_question_bank (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references public.qwt_sessions(code) on delete cascade,
  title text,
  text text not null check (char_length(text) between 5 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qwt_question_bank
  add column if not exists title text;

update public.qwt_question_bank
set title = text
where title is null or char_length(trim(title)) = 0;

alter table public.qwt_question_bank
  alter column title set not null;

alter table public.qwt_question_bank
  drop constraint if exists qwt_question_bank_title_check;

alter table public.qwt_question_bank
  add constraint qwt_question_bank_title_check
  check (char_length(title) between 1 and 1200);

create index if not exists qwt_question_bank_session_title_idx
  on public.qwt_question_bank (session_code, title);

alter table public.qwt_question_bank enable row level security;
