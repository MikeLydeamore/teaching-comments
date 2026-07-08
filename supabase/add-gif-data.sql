alter table public.qwt_submissions
  add column if not exists gif_data jsonb;

alter table public.qwt_submissions
  alter column text set default '';

alter table public.qwt_submissions
  drop constraint if exists qwt_submissions_text_check;

alter table public.qwt_submissions
  drop constraint if exists qwt_submissions_text_or_drawing_check;

alter table public.qwt_submissions
  drop constraint if exists qwt_submissions_text_or_media_check;

alter table public.qwt_submissions
  add constraint qwt_submissions_text_or_media_check
  check (
    char_length(text) <= 2000
    and (
      char_length(text) >= 1
      or drawing_data is not null
      or gif_data is not null
    )
  );

alter table public.qwt_submissions
  drop constraint if exists qwt_submissions_gif_data_check;

alter table public.qwt_submissions
  add constraint qwt_submissions_gif_data_check
  check (gif_data is null or jsonb_typeof(gif_data) = 'object');
