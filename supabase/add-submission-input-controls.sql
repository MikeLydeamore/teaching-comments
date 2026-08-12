alter table public.qwt_sessions
  add column if not exists text_input_enabled boolean;

alter table public.qwt_sessions
  add column if not exists gif_input_enabled boolean;

alter table public.qwt_sessions
  add column if not exists drawing_input_enabled boolean;

alter table public.qwt_sessions
  add column if not exists image_input_enabled boolean;

update public.qwt_sessions
set
  text_input_enabled = coalesce(text_input_enabled, true),
  gif_input_enabled = coalesce(gif_input_enabled, true),
  drawing_input_enabled = coalesce(drawing_input_enabled, true),
  image_input_enabled = coalesce(image_input_enabled, true);

alter table public.qwt_sessions
  alter column text_input_enabled set default true,
  alter column text_input_enabled set not null,
  alter column gif_input_enabled set default true,
  alter column gif_input_enabled set not null,
  alter column drawing_input_enabled set default false,
  alter column drawing_input_enabled set not null,
  alter column image_input_enabled set default true,
  alter column image_input_enabled set not null;
