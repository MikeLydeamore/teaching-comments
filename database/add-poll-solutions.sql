-- Run as the Neon project owner for databases created before poll solutions.
alter table edie_poll_question_bank
  add column if not exists correct_option_indexes jsonb not null default '[]'::jsonb
  check (jsonb_typeof(correct_option_indexes) = 'array');

alter table edie_polls
  add column if not exists correct_option_ids jsonb not null default '[]'::jsonb
  check (jsonb_typeof(correct_option_ids) = 'array'),
  add column if not exists solution_revealed boolean not null default false;

grant update on edie_poll_question_bank to edie_app;
