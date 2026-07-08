alter table public.qwt_group_questions
  add column if not exists student_name text;

update public.qwt_group_questions
set student_name = 'Anonymous'
where student_name is null or char_length(trim(student_name)) = 0;

alter table public.qwt_group_questions
  alter column student_name set default 'Anonymous';

alter table public.qwt_group_questions
  alter column student_name set not null;

alter table public.qwt_group_questions
  drop constraint if exists qwt_group_questions_student_name_check;

alter table public.qwt_group_questions
  add constraint qwt_group_questions_student_name_check
  check (char_length(student_name) between 1 and 80);
