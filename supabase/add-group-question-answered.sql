alter table public.qwt_group_questions
  add column if not exists is_answered boolean;

update public.qwt_group_questions
set is_answered = false
where is_answered is null;

alter table public.qwt_group_questions
  alter column is_answered set default false;

alter table public.qwt_group_questions
  alter column is_answered set not null;

create index if not exists qwt_group_questions_session_answered_created_idx
  on public.qwt_group_questions (session_code, is_answered, created_at desc);
