alter table public.qwt_sessions
  add column if not exists group_questions_screening_enabled boolean;

update public.qwt_sessions
set group_questions_screening_enabled = false
where group_questions_screening_enabled is null;

alter table public.qwt_sessions
  alter column group_questions_screening_enabled set default false;

alter table public.qwt_sessions
  alter column group_questions_screening_enabled set not null;

alter table public.qwt_group_questions
  add column if not exists is_visible boolean;

update public.qwt_group_questions
set is_visible = true
where is_visible is null;

alter table public.qwt_group_questions
  alter column is_visible set default true;

alter table public.qwt_group_questions
  alter column is_visible set not null;

create index if not exists qwt_group_questions_session_visible_created_idx
  on public.qwt_group_questions (session_code, is_visible, created_at desc);
