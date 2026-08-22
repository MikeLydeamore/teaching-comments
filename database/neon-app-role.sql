-- Run as the Neon project owner after database/schema.sql.
-- Set edie_app's password separately in the Neon SQL editor; never commit it.
create role edie_app login nosuperuser nocreatedb nocreaterole noinherit;
grant usage on schema public to edie_app;
grant select, insert, update on edie_teacher_spaces to edie_app;
grant select, insert, update, delete on edie_space_members to edie_app;
grant select, insert, update on edie_sessions to edie_app;
grant select, insert, update on edie_submissions to edie_app;
grant select, insert, delete on edie_question_bank to edie_app;
grant select, insert, update, delete on edie_poll_question_bank to edie_app;
grant select, insert, update on edie_prompt_history to edie_app;
grant select, insert, update on edie_group_questions to edie_app;
grant select, insert, delete on edie_group_question_votes to edie_app;
grant select, insert, update on edie_polls to edie_app;
grant select, insert, update on edie_poll_responses to edie_app;

-- The application is a trusted server-side DAL. Neon has no service-role bypass,
-- so the owner must either disable RLS for these private tables or add equivalent policies.
alter table edie_teacher_spaces disable row level security;
alter table edie_sessions disable row level security;
alter table edie_submissions disable row level security;
alter table edie_question_bank disable row level security;
alter table edie_poll_question_bank disable row level security;
alter table edie_prompt_history disable row level security;
alter table edie_group_questions disable row level security;
alter table edie_group_question_votes disable row level security;
alter table edie_polls disable row level security;
alter table edie_poll_responses disable row level security;
