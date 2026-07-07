alter table public.qwt_submissions
  add column if not exists drawing_data jsonb;

alter table public.qwt_submissions
  alter column text set default '';

alter table public.qwt_submissions
  drop constraint if exists qwt_submissions_text_check;

alter table public.qwt_submissions
  drop constraint if exists qwt_submissions_text_or_drawing_check;

alter table public.qwt_submissions
  add constraint qwt_submissions_text_or_drawing_check
  check (
    char_length(text) <= 2000
    and (char_length(text) >= 1 or drawing_data is not null)
  );

alter table public.qwt_submissions
  drop constraint if exists qwt_submissions_drawing_data_check;

alter table public.qwt_submissions
  add constraint qwt_submissions_drawing_data_check
  check (drawing_data is null or jsonb_typeof(drawing_data) = 'object');
