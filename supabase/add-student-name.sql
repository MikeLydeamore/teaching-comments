alter table public.qwt_submissions
  add column if not exists student_name text;

update public.qwt_submissions
set student_name = 'Anonymous'
where student_name is null or btrim(student_name) = '';

alter table public.qwt_submissions
  alter column student_name set default 'Anonymous';

alter table public.qwt_submissions
  alter column student_name set not null;

alter table public.qwt_submissions
  drop constraint if exists qwt_submissions_student_name_check;

alter table public.qwt_submissions
  add constraint qwt_submissions_student_name_check
  check (char_length(student_name) between 1 and 80);
