alter table public.qwt_submissions add column if not exists image_data jsonb;

alter table public.qwt_submissions
  drop constraint if exists qwt_submissions_text_or_media_check,
  drop constraint if exists qwt_submissions_image_data_check,
  add constraint qwt_submissions_text_or_media_check
    check (char_length(text) >= 1 or drawing_data is not null or gif_data is not null or image_data is not null),
  add constraint qwt_submissions_image_data_check
    check (image_data is null or (
      jsonb_typeof(image_data) = 'object'
      and image_data->>'version' = '1'
      and (image_data->>'objectKey') ~ '^committed/[A-Za-z0-9_-]{43}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
      and image_data->>'contentType' in ('image/png', 'image/jpeg', 'image/webp')
      and ((image_data->>'contentType' = 'image/png' and image_data->>'objectKey' ~ '\.png$') or (image_data->>'contentType' = 'image/jpeg' and image_data->>'objectKey' ~ '\.jpg$') or (image_data->>'contentType' = 'image/webp' and image_data->>'objectKey' ~ '\.webp$'))
      and jsonb_typeof(image_data->'byteSize') = 'number'
      and case when jsonb_typeof(image_data->'byteSize') = 'number' then (image_data->'byteSize')::numeric between 1 and 10485760 and (image_data->'byteSize')::numeric = trunc((image_data->'byteSize')::numeric) else false end
      and char_length(coalesce(image_data->>'etag', '')) between 1 and 256
    ));

create unique index if not exists qwt_submissions_image_object_key_unique_idx
  on public.qwt_submissions ((image_data->>'objectKey'))
  where image_data is not null;
