-- Run as the Neon project owner before deploying Markdown image controls.
alter table edie_sessions
  add column if not exists image_embeds_enabled boolean not null default true;
