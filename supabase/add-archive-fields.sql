alter table public.qwt_submissions
  add column if not exists archived_at timestamptz;

alter table public.qwt_group_questions
  add column if not exists archived_at timestamptz;

create index if not exists qwt_submissions_session_archived_created_idx
  on public.qwt_submissions (session_code, archived_at, created_at desc);

create index if not exists qwt_group_questions_session_archived_created_idx
  on public.qwt_group_questions (session_code, archived_at, created_at desc);
