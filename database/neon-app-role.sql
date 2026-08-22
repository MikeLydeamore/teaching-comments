-- Run as the Neon project owner after database/schema.sql.
-- Set qwt_app's password separately in the Neon SQL editor; never commit it.
create role qwt_app login nosuperuser nocreatedb nocreaterole noinherit;
grant usage on schema public to qwt_app;
grant select, insert, update on qwt_teacher_spaces to qwt_app;
grant select, insert, update on qwt_sessions to qwt_app;
grant select, insert, update on qwt_submissions to qwt_app;
grant select, insert, delete on qwt_question_bank to qwt_app;
grant select, insert, update, delete on qwt_poll_question_bank to qwt_app;
grant select, insert, update on qwt_prompt_history to qwt_app;
grant select, insert, update on qwt_group_questions to qwt_app;
grant select, insert, delete on qwt_group_question_votes to qwt_app;
grant select, insert, update on qwt_polls to qwt_app;
grant select, insert, update on qwt_poll_responses to qwt_app;

-- The application is a trusted server-side DAL. Neon has no service-role bypass,
-- so the owner must either disable RLS for these private tables or add equivalent policies.
alter table qwt_teacher_spaces disable row level security;
alter table qwt_sessions disable row level security;
alter table qwt_submissions disable row level security;
alter table qwt_question_bank disable row level security;
alter table qwt_poll_question_bank disable row level security;
alter table qwt_prompt_history disable row level security;
alter table qwt_group_questions disable row level security;
alter table qwt_group_question_votes disable row level security;
alter table qwt_polls disable row level security;
alter table qwt_poll_responses disable row level security;
